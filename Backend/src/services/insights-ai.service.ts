import { Type } from "@google/genai";
import { ai, GEMINI_MODEL } from "../config/gemini.js";
import {
  RawInsightsMetrics,
  ForecastInsightsData,
  ForecastData,
  RecommendationItem,
  RiskyShowtimeItem,
} from "../types/insights.types.js";
import { parseLocalDate, getDayOfWeekName } from "../models/insights.model.js";

const DAY_FACTORS: Record<number, number> = {
  0: 1.5, // Chủ Nhật
  1: 0.85, // Thứ Hai
  2: 0.9, // Thứ Ba
  3: 0.95, // Thứ Tư
  4: 1.0, // Thứ Năm
  5: 1.3, // Thứ Sáu
  6: 1.6, // Thứ Bảy
};

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount));
}

/** Schema bắt buộc Gemini tuân thủ */
const INSIGHTS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    forecast: {
      type: Type.OBJECT,
      properties: {
        tomorrowRevenue: { type: Type.NUMBER },
        weekRevenue: { type: Type.NUMBER },
        growthPercent: { type: Type.NUMBER },
      },
      required: ["tomorrowRevenue", "weekRevenue", "growthPercent"],
    },
    riskyShowtimes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          showtimeId: { type: Type.INTEGER },
          movie: { type: Type.STRING },
          time: { type: Type.STRING },
          fillRate: { type: Type.NUMBER },
          suggestion: { type: Type.STRING },
        },
        required: ["showtimeId", "movie", "time", "fillRate", "suggestion"],
      },
    },
    executiveSummary: { type: Type.STRING },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ["add_showtime", "promotion", "pricing"],
          },
          text: { type: Type.STRING },
        },
        required: ["type", "text"],
      },
    },
  },
  required: ["forecast", "riskyShowtimes", "executiveSummary", "recommendations"],
};

/**
 * Thuật toán dự phòng (Fallback) khi AI gặp sự cố hoặc timeout
 * Sử dụng trung bình động 7 ngày nhân hệ số theo thứ trong tuần
 */
export function generateFallbackInsights(
  metrics: RawInsightsMetrics
): ForecastInsightsData {
  const target = parseLocalDate(metrics.targetDate);
  const tomorrow = new Date(target);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = tomorrow.getDay();
  const tomorrowFactor = DAY_FACTORS[tomorrowDay] || 1.0;

  // Lấy mức doanh thu cơ sở: ưu tiên avg7DaysRevenue, nếu = 0 thì lấy todayRevenue
  const baseRevenue =
    metrics.avg7DaysRevenue > 0
      ? metrics.avg7DaysRevenue
      : metrics.todayRevenue > 0
      ? metrics.todayRevenue
      : 12000000;

  const tomorrowRevenue = Math.round(baseRevenue * tomorrowFactor);

  // Tính 7 ngày tới
  let weekRevenue = 0;
  for (let i = 1; i <= 7; i++) {
    const nextDay = new Date(target);
    nextDay.setDate(nextDay.getDate() + i);
    const factor = DAY_FACTORS[nextDay.getDay()] || 1.0;
    weekRevenue += Math.round(baseRevenue * factor);
  }

  let growthPercent = 0;
  if (baseRevenue > 0) {
    growthPercent =
      Math.round(((tomorrowRevenue - baseRevenue) / baseRevenue) * 1000) / 10;
  }

  const forecast: ForecastData = {
    tomorrowRevenue,
    weekRevenue,
    growthPercent,
  };

  // Tìm phim có doanh thu cao nhất hôm nay
  const sortedMovies = [...metrics.moviesToday].sort((a, b) => b.revenue - a.revenue);
  const topMovie = sortedMovies[0];

  const topMovieText =
    topMovie && topMovie.revenue > 0
      ? `Phim dẫn đầu hôm nay là "${topMovie.title}" với doanh thu ${formatVND(
          topMovie.revenue
        )} VND (tỷ lệ lấp đầy ${topMovie.fillRate}%).`
      : "Các phim đang có lượng khách phân bổ đều giữa các khung giờ.";

  const changeText =
    metrics.revenueChangePercent >= 0
      ? `tăng ${metrics.revenueChangePercent}%`
      : `giảm ${Math.abs(metrics.revenueChangePercent)}%`;

  const executiveSummary =
    `Trong ngày ${metrics.targetDate}, toàn hệ thống rạp ghi nhận doanh thu ${formatVND(
      metrics.todayRevenue
    )} VND (${changeText} so với hôm qua), trong khi trung bình 7 ngày qua đạt ${formatVND(
      metrics.avg7DaysRevenue
    )} VND/ngày. ${topMovieText} Toàn hệ thống có ${metrics.riskyShowtimes.length} suất chiếu trong 24h tới có tỷ lệ lấp đầy dưới 20% cần có biện pháp điều phối. Dự báo doanh thu ngày mai (${getDayOfWeekName(
      tomorrow
    )}) ước đạt ${formatVND(
      tomorrowRevenue
    )} VND nhờ xu hướng khán giả theo ngày trong tuần.`;

  const recommendations: RecommendationItem[] = [];

  if (topMovie && topMovie.revenue > 0) {
    recommendations.push({
      type: "add_showtime",
      text: `Tăng thêm 1-2 suất chiếu khung giờ vàng (18:30 - 21:00) cho tựa phim "${topMovie.title}" để tối đa hóa doanh thu do đang có nhu cầu cao.`,
    });
  } else {
    recommendations.push({
      type: "add_showtime",
      text: "Cân đối lại lịch chiếu giữa các phim hành động và khoa học viễn tưởng trong khung giờ tối để tối ưu lượng khách.",
    });
  }

  if (metrics.riskyShowtimes.length > 0) {
    recommendations.push({
      type: "promotion",
      text: `Kích hoạt chương trình Flash Sale giảm giá vé 20% hoặc tặng voucher combo bắp nước cho ${metrics.riskyShowtimes.length} suất chiếu có tỷ lệ lấp đầy dưới 20% trong 24h tới.`,
    });
  } else {
    recommendations.push({
      type: "promotion",
      text: "Triển khai chương trình tích điểm gấp đôi cho thành viên khi đặt vé online trước 24 giờ.",
    });
  }

  recommendations.push({
    type: "pricing",
    text: "Áp dụng chính sách giá linh hoạt (Dynamic Pricing): ưu đãi giá vé Early Bird cho các suất trước 12:00 trưa và tăng giá nhẹ cho hàng ghế VIP vào tối cuối tuần.",
  });

  return {
    source: "fallback",
    forecast,
    riskyShowtimes: metrics.riskyShowtimes,
    executiveSummary,
    recommendations,
  };
}

/**
 * Gọi AI Gemini để phân tích dữ liệu điều hành và đưa ra dự báo
 */
export async function generateAIInsights(
  metrics: RawInsightsMetrics
): Promise<ForecastInsightsData> {
  const target = parseLocalDate(metrics.targetDate);
  const tomorrow = new Date(target);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const contextData = {
    date: metrics.targetDate,
    dayOfWeek: getDayOfWeekName(target),
    tomorrowDate: tomorrow.toISOString().split("T")[0],
    tomorrowDayOfWeek: getDayOfWeekName(tomorrow),
    revenue: {
      today: metrics.todayRevenue,
      yesterday: metrics.yesterdayRevenue,
      avg7Days: metrics.avg7DaysRevenue,
      changePercentVsYesterday: metrics.revenueChangePercent,
      currency: "VND",
    },
    moviesToday: metrics.moviesToday,
    genreTrends: metrics.genreTrends,
    sales14DaysHistory: metrics.sales14Days,
    riskyShowtimesUnder20Percent: metrics.riskyShowtimes,
  };

  const systemPrompt = `Bạn là Giám đốc Phân tích Doanh thu và Điều hành Cấp cao (Chief Revenue & Operations Officer) của hệ thống rạp chiếu phim Cinema Management.
Nhiệm vụ của bạn là phân tích dữ liệu vận hành thực tế do hệ thống cung cấp và đưa ra dự báo doanh thu, cảnh báo suất chiếu rủi ro, tóm tắt điều hành và các khuyến nghị chiến lược.

QUY TẮC BẮT BUỘC (TUÂN THỦ TUYỆT ĐỐI):
1. CHỈ ĐƯỢC DÙNG SỐ LIỆU ĐÃ TRUYỀN VÀO TRONG NGỮ CẢNH DƯỚI ĐÂY. TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA ĐẶT HOẶC SUY DIỄN SỐ LIỆU TÀI CHÍNH KHÔNG CÓ THẬT.
2. TẤT CẢ SỐ TIỀN PHẢI TÍNH BẰNG ĐƠN VỊ ĐỒNG VIỆT NAM (VND).
3. Dự báo doanh thu ngày mai (tomorrowRevenue) và 7 ngày tới (weekRevenue):
   - Phải dựa trên: mức trung bình 7 ngày (avg7Days), xu hướng tăng trưởng (changePercentVsYesterday), và thứ trong tuần (Thứ Sáu, Thứ Bảy, Chủ Nhật có lượng khách và doanh thu cao hơn ngày thường từ 30% đến 60%).
   - growthPercent: Tỷ lệ % tăng/giảm dự báo của ngày mai so với trung bình 7 ngày hoặc hôm nay.
4. riskyShowtimes:
   - Giữ nguyên danh sách các suất chiếu có tỷ lệ lấp đầy < 20% đã cung cấp trong "riskyShowtimesUnder20Percent".
   - Bổ sung suggestion (gợi ý giải pháp) thực tế, sắc sảo và hành động được ngay cho từng suất (ví dụ: giảm giá giờ chót, combo bắp nước, gộp phòng...).
5. executiveSummary:
   - Viết một đoạn văn súc tích từ 3 đến 5 câu tiếng Việt tự nhiên, chuyên nghiệp.
   - BẮT BUỘC có các con số cụ thể: doanh thu hôm nay, % tăng giảm, mức trung bình 7 ngày, tựa phim đóng góp tốt nhất, số lượng suất chiếu nguy cơ ế.
6. recommendations:
   - Cung cấp từ 3 đến 4 khuyến nghị chiến lược thuộc 3 nhóm: "add_showtime" (tối ưu/thêm suất cho phim/thể loại đang tăng), "promotion" (khuyến mãi, voucher, kích cầu), "pricing" (điều chỉnh giá vé linh hoạt).`;

  try {
    const promptText = `${systemPrompt}

DỮ LIỆU VẬN HÀNH THỰC TẾ:
${JSON.stringify(contextData, null, 2)}

Hãy xuất kết quả phân tích theo đúng schema JSON yêu cầu.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
        responseSchema: INSIGHTS_RESPONSE_SCHEMA,
      },
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);

    if (
      !parsed.forecast ||
      typeof parsed.forecast.tomorrowRevenue !== "number" ||
      !Array.isArray(parsed.riskyShowtimes) ||
      !parsed.executiveSummary ||
      !Array.isArray(parsed.recommendations)
    ) {
      throw new Error("Phản hồi từ AI thiếu các trường bắt buộc.");
    }

    return {
      source: "ai",
      forecast: parsed.forecast,
      riskyShowtimes: parsed.riskyShowtimes,
      executiveSummary: parsed.executiveSummary,
      recommendations: parsed.recommendations,
    };
  } catch (err) {
    console.warn(
      "[AI /forecast-insights] Lỗi khi gọi Gemini, chuyển sang phương án dự phòng (fallback):",
      err
    );
    return generateFallbackInsights(metrics);
  }
}
