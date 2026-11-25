import { Router } from "express";
import { Type } from "@google/genai";
import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import { ai, GEMINI_MODEL } from "../config/gemini.js";
import { authenticateToken, requireManagerOrAdmin } from "./auth.js";
import { AutoScheduleInput } from "../types/schedule.types.js";
import {
  getMoviesForSchedule,
  getRoomsForSchedule,
  getExistingShowtimes,
} from "../models/schedule.model.js";
import { scheduleWithAI } from "../services/schedule-ai.service.js";
import {
  ForecastInsightsInput,
  ForecastInsightsData,
} from "../types/insights.types.js";
import {
  getAggregatedInsightsMetrics,
  formatLocalDate,
} from "../models/insights.model.js";
import { generateAIInsights } from "../services/insights-ai.service.js";

const router = Router();

interface MoodRecommendation {
  title: string;
  genre: string;
  matchScore: number;
  aiReply: string;
  reason: string;
}

/** Schema JSON: buộc model trả đúng cấu trúc, không kèm văn xuôi hay ```json */
const MOOD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    genre: { type: Type.STRING },
    matchScore: { type: Type.NUMBER },
    aiReply: { type: Type.STRING },
    reason: { type: Type.STRING },
  },
  required: ["title", "genre", "matchScore", "aiReply", "reason"],
};

/** Fallback khi model trả JSON hỏng — không để người dùng thấy lỗi */
const FALLBACK_RECOMMENDATION: MoodRecommendation = {
  title: "Tín hiệu từ ngày mai",
  genre: "Khoa học viễn tưởng · 118 phút",
  matchScore: 97,
  aiReply:
    "AI đã ghi nhận tâm trạng của bạn và chọn ra bộ phim phù hợp nhất cho buổi xem tối nay!",
  reason:
    "Bộ phim có nội dung hấp dẫn, hình ảnh mãn nhãn và rất phù hợp với tâm trạng của bạn.",
};

//Cache kết quả theo (mood + ý kiến khách).
//Bấm lại cùng một lựa chọn sẽ trả về tức thì thay vì gọi Gemini lần nữa.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const moodCache = new Map<string, { at: number; data: MoodRecommendation }>();

function getCached(key: string): MoodRecommendation | null {
  const hit = moodCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    moodCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key: string, data: MoodRecommendation): void {
  if (moodCache.size >= CACHE_MAX_ENTRIES) moodCache.clear();
  moodCache.set(key, { at: Date.now(), data });
}

/** Gemini trả lỗi timeout/abort → 504 để frontend biết mà dùng phương án dự phòng */
function isTimeoutError(err: unknown): boolean {
  const e = err as { name?: string; message?: string };
  return (
    e?.name === "AbortError" ||
    /timeout|timed out|deadline|aborted/i.test(e?.message || "")
  );
}

/**
 * POST /api/ai/chat
 * Body: { message: string }
 * Trả về câu trả lời AI tư vấn điện ảnh Cinema Management kết hợp dữ liệu phim thực tế từ MySQL
 */
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body as { message?: string };

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: "message không được để trống" });
    }

    // 1. Lấy danh sách phim đang chiếu thực tế từ Database
    let activeMovies: RowDataPacket[] = [];
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, title, rating, genre, duration_min, synopsis, format, poster_url, ai_recommendation
         FROM movies
         WHERE status = 'now_showing'
         ORDER BY is_featured DESC, id ASC`
      );
      activeMovies = rows;
    } catch (dbErr) {
      console.warn("[AI /chat] Không query được movies từ DB, dùng danh sách fallback:", dbErr);
    }

    const movieListStr = activeMovies.length > 0
      ? activeMovies.map((m, idx) => `${idx + 1}. [ID: ${m.id}] "${m.title}" (${m.genre} · ${m.duration_min} phút · Hạng ${m.rating}) - ${m.synopsis || m.ai_recommendation || ""}`).join("\n")
      : `1. "Tín hiệu từ ngày mai" (Khoa học viễn tưởng · 118 phút · T13)
2. "Qua miền ký ức" (Khoa học viễn tưởng · 106 phút · T13)
3. "Chuyến tàu bình minh" (Phiêu lưu · 112 phút · P)
4. "Thành phố không ngủ" (Hành động · 124 phút · T18)
5. "Khu rừng biết nói" (Hoạt hình · 95 phút · P)
6. "Mùa hè ở lại" (Tình cảm · 102 phút · T13)`;

    const systemPrompt = `Bạn là trợ lý AI chuyên gia điện ảnh của hệ thống rạp chiếu phim cao cấp Cinema Management tại TP. Hồ Chí Minh.
Dưới đây là danh sách toàn bộ các bộ phim HIỆN ĐANG CHIẾU THỰC TẾ tại rạp:
${movieListStr}

Nhiệm vụ của bạn:
1. Lắng nghe nhu cầu, cảm xúc, gu phim hoặc dịp xem phim của khách hàng.
2. Tư vấn và gợi ý 1 đến 2 bộ phim PHÙ HỢP NHẤT trong danh sách phim đang chiếu ở trên.
3. Giải thích ngắn gọn lý do vì sao bộ phim đó phù hợp với khách (hình ảnh, âm thanh Dolby Atmos, cảm xúc).
4. Luôn trả lời bằng Tiếng Việt thân thiện, nhiệt tình, lịch sự, ngắn gọn (tối đa 4 câu).
5. QUAN TRỌNG: Hãy nhắc chính xác tên của bộ phim được gợi ý trong dấu ngoặc kép hoặc đề cập rõ tên phim để hệ thống nhận diện.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\nKhách hàng hỏi: " + message }] },
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const text = response.text ?? "";

    // Tìm các phim được AI gợi ý dựa trên tiêu đề xuất hiện trong câu trả lời
    const matchedMovies = activeMovies.filter((m) =>
      text.toLowerCase().includes(m.title.toLowerCase())
    );

    // Nếu không khớp tên nào do AI nói chung chung, lấy 2 phim nổi bật nhất làm gợi ý
    const recommendedList = matchedMovies.length > 0 ? matchedMovies.slice(0, 3) : activeMovies.slice(0, 2);

    return res.json({
      success: true,
      reply: text,
      recommendedMovies: recommendedList.map((m) => ({
        id: String(m.id),
        title: m.title,
        rating: m.rating,
        genre: m.genre,
        duration: `${m.duration_min} phút`,
        synopsis: m.synopsis || m.ai_recommendation,
        format: m.format,
        posterUrl: m.poster_url,
      })),
    });
  } catch (err) {
    console.error("[AI /chat] error:", err);
    if (isTimeoutError(err)) {
      return res.status(504).json({
        success: false,
        error: "AI phản hồi quá lâu, vui lòng thử lại.",
        reply: "Rất tiếc hiện tại kết nối đến AI đang bận. Bạn có thể tham khảo ngay 2 phim hot nhất hôm nay là 'Tín hiệu từ ngày mai' và 'Thành phố không ngủ' đang có nhiều suất chiếu đẹp tại Cinema Management!",
      });
    }
    return res.status(500).json({
      success: false,
      error: "Lỗi AI, vui lòng thử lại.",
      reply: "Hệ thống AI đang khởi động lại. Mời bạn tham khảo lịch chiếu hôm nay tại trang Lịch chiếu hoặc thử hỏi lại nhé!",
    });
  }
});

/**
 * POST /api/ai/mood-recommend
 * Body: { mood?: string, userInput?: string }
 * Trả về gợi ý phim theo cảm xúc
 */
router.post("/mood-recommend", async (req, res) => {
  try {
    const { mood, userInput } = req.body as { mood?: string; userInput?: string };

    // 1. Trả cache nếu khách đã hỏi đúng câu này trong 10 phút
    const cacheKey = `${(mood || "").trim().toLowerCase()}|${(userInput || "").trim().toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, cached: true, mood });
    }

    const moodMap: Record<string, string> = {
      "Tò mò & khám phá": "tò mò, thích khám phá những điều mới lạ, khoa học viễn tưởng bí ẩn",
      "Chữa lành & nhẹ nhàng": "cần chữa lành, thư giãn nhẹ nhàng, giải tỏa căng thẳng",
      "Hồi hộp, giật gân": "hồi hộp, kịch tính, thích cảm giác giật gân và nghẹt thở",
      "Phiêu lưu, xúc động": "muốn phiêu lưu, khám phá những vùng đất mới và giàu cảm xúc",
      "Ngọt ngào, hoài niệm": "thích sự ngọt ngào, hoài niệm về tình yêu thanh xuân trong trẻo",
      romantic: "lãng mạn, muốn xem phim tình cảm nhẹ nhàng",
      excited: "hứng khởi, muốn xem phim hành động hoặc phiêu lưu mãn nhãn",
      relaxed: "thư giãn, muốn xem phim gia đình hoặc hài nhẹ nhàng",
      adventurous: "thích khám phá, muốn xem phim khoa học viễn tưởng hoặc phiêu lưu kỳ bí",
      thoughtful: "trầm tư, muốn xem phim tâm lý hoặc nghệ thuật có chiều sâu",
    };

    const moodDesc = mood && moodMap[mood] ? moodMap[mood] : (mood || "muốn tìm một bộ phim hay");
    const userOpinion = userInput?.trim()
      ? `Ý kiến & mong muốn cụ thể của khách: "${userInput.trim()}"`
      : "Khách chưa nhập thêm yêu cầu cụ thể.";

    const prompt = `Bạn là trợ lý AI chuyên gia điện ảnh cao cấp tại rạp Cinema Management.
Khách hàng đang tìm kiếm gợi ý phim:
- Cảm xúc / tâm trạng lựa chọn: "${moodDesc}"
- ${userOpinion}

Danh sách các phim hiện đang chiếu độc quyền tại Cinema Management (BẠN BẮT BUỘC CHỌN 1 BỘ PHIM PHÙ HỢP NHẤT TRONG DANH SÁCH NÀY):
1. Tín hiệu từ ngày mai (Khoa học viễn tưởng · 118 phút) - Hành trình vượt thời gian đầy bí ẩn, kỹ xảo vũ trụ đỉnh cao chuẩn Dolby Atmos, triết lý sâu sắc.
2. Qua miền ký ức (Khoa học viễn tưởng / Tâm lý · 106 phút) - Chuyến du hành vào những tầng ký ức sâu thẳm, âm nhạc xúc động, giàu tính nghệ thuật.
3. Chuyến tàu bình minh (Phiêu lưu / Cảm động · 112 phút) - Chuyến tàu xuyên mây qua những dãy núi hùng vĩ, khơi gợi khát khao tuổi trẻ và ước mơ.
4. Thành phố không ngủ (Hành động / Giật gân · 124 phút) - Tiết tấu dồn dập, rượt đuổi nghẹt thở trong màn đêm đô thị, twist liên tục.
5. Khu rừng biết nói (Hoạt hình / Gia đình · 95 phút) - Hình ảnh thiên nhiên thơ mộng, âm nhạc êm dịu giúp giải tỏa mọi căng thẳng sau ngày dài.
6. Mùa hè ở lại (Tình cảm / Lãng mạn · 102 phút) - Giai điệu thanh xuân trong trẻo bờ biển ngập nắng vàng, dịu êm và đong đầy rung động chân thành.

Hãy chọn phim thích hợp nhất với tâm trạng và ý kiến của khách. matchScore là số nguyên 92-99.`;

    // 2. Gọi Gemini với JSON schema — nhanh hơn, không cần parse code fence
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.6,
        maxOutputTokens: 500,
        responseMimeType: "application/json",
        responseSchema: MOOD_SCHEMA,
      },
    });

    let resultData: MoodRecommendation;
    try {
      resultData = JSON.parse(response.text || "{}") as MoodRecommendation;
      if (!resultData?.title) throw new Error("missing title");
    } catch {
      // Fallback nếu model trả JSON không hợp lệ
      resultData = FALLBACK_RECOMMENDATION;
    }

    setCached(cacheKey, resultData);

    return res.json({
      success: true,
      data: resultData,
      recommendation: response.text,
      mood,
    });
  } catch (err) {
    console.error("[AI /mood-recommend] error:", err);
    if (isTimeoutError(err)) {
      return res
        .status(504)
        .json({ success: false, error: "AI phản hồi quá lâu, vui lòng thử lại." });
    }
    return res.status(500).json({ success: false, error: "Lỗi AI, vui lòng thử lại." });
  }
});

/**
 * POST /api/ai/admin/auto-schedule
 * Tự động xếp lịch chiếu thông minh bằng AI (Admin only)
 */
router.post(
  "/admin/auto-schedule",
  authenticateToken,
  requireManagerOrAdmin,
  async (req, res) => {
    try {
      const {
        date,
        movieIds,
        roomIds,
        cleaningBufferMinutes = 15,
      } = req.body as AutoScheduleInput;

      // 1. Kiểm tra định dạng ngày
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          message: "Ngày chiếu (date) không hợp lệ! Vui lòng dùng định dạng YYYY-MM-DD.",
        });
      }

      // 2. Kiểm tra movieIds
      if (!Array.isArray(movieIds) || movieIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Danh sách phim (movieIds) không được để trống!",
        });
      }

      const validMovieIds = movieIds
        .map(Number)
        .filter((id) => !isNaN(id) && id > 0);

      if (validMovieIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Danh sách movieIds phải chứa các ID số nguyên hợp lệ!",
        });
      }

      // 3. Kiểm tra roomIds nếu có
      let validRoomIds: number[] | undefined;
      if (roomIds !== undefined) {
        if (!Array.isArray(roomIds)) {
          return res.status(400).json({
            success: false,
            message: "Danh sách phòng (roomIds) nếu có phải là một mảng ID!",
          });
        }
        validRoomIds = roomIds
          .map(Number)
          .filter((id) => !isNaN(id) && id > 0);

        if (roomIds.length > 0 && validRoomIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: "roomIds không chứa ID phòng hợp lệ!",
          });
        }
      }

      // 4. Kiểm tra cleaningBufferMinutes (mặc định 15, cho phép 15-20)
      const buffer = Number(cleaningBufferMinutes);
      if (isNaN(buffer) || buffer < 15 || buffer > 20) {
        return res.status(400).json({
          success: false,
          message: "Thời gian dọn phòng (cleaningBufferMinutes) chỉ cho phép từ 15 đến 20 phút!",
        });
      }

      // 5. Lấy dữ liệu thật từ DB
      const movies = await getMoviesForSchedule(validMovieIds);
      if (movies.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bất kỳ phim nào trong cơ sở dữ liệu với các movieIds đã cung cấp!",
        });
      }

      const rooms = await getRoomsForSchedule(validRoomIds);
      if (rooms.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy phòng chiếu hoạt động nào phù hợp!",
        });
      }

      const existingSlots = await getExistingShowtimes(date, validRoomIds);

      // 6. Thực hiện xếp lịch thông minh (AI + Validation + Fallback)
      const result = await scheduleWithAI(
        date,
        movies,
        rooms,
        existingSlots,
        buffer
      );

      return res.json({
        success: true,
        source: result.source,
        schedule: result.schedule,
        summary: result.summary,
      });
    } catch (err: any) {
      console.error("[AI /admin/auto-schedule] error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi máy chủ khi xếp lịch chiếu tự động!",
        error: err?.message || String(err),
      });
    }
  }
);

// Cache kết quả dự báo điều hành 5 phút theo ngày
const INSIGHTS_CACHE_TTL_MS = 5 * 60 * 1000;
const insightsCache = new Map<
  string,
  { at: number; data: ForecastInsightsData }
>();

function getCachedInsights(date: string): ForecastInsightsData | null {
  const hit = insightsCache.get(date);
  if (!hit) return null;
  if (Date.now() - hit.at > INSIGHTS_CACHE_TTL_MS) {
    insightsCache.delete(date);
    return null;
  }
  return hit.data;
}

function setCachedInsights(date: string, data: ForecastInsightsData): void {
  insightsCache.set(date, { at: Date.now(), data });
}

/**
 * POST /api/ai/admin/forecast-insights
 * Dự báo doanh thu và phân tích chuyên sâu cho ban điều hành bằng AI (Admin only)
 */
router.post(
  "/admin/forecast-insights",
  authenticateToken,
  requireManagerOrAdmin,
  async (req, res) => {
    try {
      const { date, forceRefresh } = req.body as ForecastInsightsInput;

      // 1. Kiểm tra hoặc gán ngày mặc định (hôm nay)
      let targetDate: string;
      if (date && typeof date === "string" && date.trim()) {
        const trimmed = date.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return res.status(400).json({
            success: false,
            message:
              "Định dạng ngày (date) không hợp lệ! Vui lòng dùng định dạng YYYY-MM-DD.",
          });
        }
        targetDate = trimmed;
      } else {
        targetDate = formatLocalDate(new Date());
      }

      // 2. Kiểm tra cache 5 phút (nếu forceRefresh = true thì bỏ qua cache)
      if (forceRefresh) {
        insightsCache.delete(targetDate);
      } else {
        const cached = getCachedInsights(targetDate);
        if (cached) {
          return res.json({
            success: true,
            ...cached,
          });
        }
      }

      // 3. Truy vấn tổng hợp số liệu thực tế từ MySQL
      const metrics = await getAggregatedInsightsMetrics(targetDate);

      // 4. Phân tích với AI Gemini (hoặc fallback nếu lỗi)
      const insights = await generateAIInsights(metrics);

      // 5. Lưu cache 5 phút
      setCachedInsights(targetDate, insights);

      return res.json({
        success: true,
        ...insights,
      });
    } catch (err: any) {
      console.error("[AI /admin/forecast-insights] error:", err);
      return res.status(500).json({
        success: false,
        message: "Lỗi máy chủ khi tạo dự báo và phân tích điều hành!",
        error: err?.message || String(err),
      });
    }
  }
);

export default router;
