import { Router } from "express";
import {
  getShowtimesByDate,
  createShowtime,
  bulkCreateShowtimes,
  cancelShowtime,
} from "../models/showtime.model.js";
import { authenticateToken, requireManagerOrAdmin } from "./auth.js";

const showtimeRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parsePositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

// GET /api/showtimes?date=YYYY-MM-DD - Danh sách suất chiếu còn hiệu lực của ngày (công khai)
showtimeRouter.get("/", async (req, res) => {
  try {
    const date = String(req.query.date || "");
    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Ngày không hợp lệ! Dùng định dạng YYYY-MM-DD.",
      });
    }

    const showtimes = await getShowtimesByDate(date);
    return res.json({ success: true, data: showtimes });
  } catch (error) {
    console.error("Lỗi lấy lịch chiếu:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải lịch chiếu!",
    });
  }
});

// POST /api/showtimes (admin) - Body: { movieId, roomId, date, startTime, endTime, priceRegular?, priceVip?, format? }
showtimeRouter.post("/", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { movieId, roomId, date, startTime, endTime, priceRegular, priceVip, format } =
      req.body || {};

    const movie = parsePositiveInt(movieId);
    const room = parsePositiveInt(roomId);

    if (!movie || !room) {
      return res.status(400).json({
        success: false,
        message: "Phim hoặc phòng chiếu không hợp lệ!",
      });
    }
    if (!isValidDate(String(date))) {
      return res.status(400).json({ success: false, message: "Ngày chiếu không hợp lệ!" });
    }
    if (!TIME_RE.test(String(startTime)) || !TIME_RE.test(String(endTime))) {
      return res.status(400).json({
        success: false,
        message: "Giờ bắt đầu/kết thúc phải theo định dạng HH:mm!",
      });
    }
    if (String(startTime) >= String(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Giờ kết thúc phải sau giờ bắt đầu!",
      });
    }

    const result = await createShowtime({
      movieId: movie,
      roomId: room,
      date: String(date),
      startTime: String(startTime),
      endTime: String(endTime),
      priceRegular: Number(priceRegular) || undefined,
      priceVip: Number(priceVip) || undefined,
      format: format ? String(format) : undefined,
    });

    if (result.error) {
      return res.status(404).json({ success: false, message: result.error });
    }
    if (result.conflict) {
      return res.status(409).json({
        success: false,
        message: "Khung giờ này đã bị trùng với một suất khác trong cùng phòng!",
        conflictId: result.conflict,
      });
    }

    const showtimes = await getShowtimesByDate(String(date));
    return res.status(201).json({
      success: true,
      message: "Đã tạo suất chiếu vào database!",
      id: result.id,
      data: showtimes,
    });
  } catch (error) {
    console.error("Lỗi tạo suất chiếu:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tạo suất chiếu!",
    });
  }
});

// POST /api/showtimes/bulk (admin) - Body: { date, slots: [{ movieId, roomId, startTime, endTime }] } - Dùng cho "Áp dụng" kết quả AI xếp lịch
showtimeRouter.post("/bulk", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { date, slots } = req.body || {};

    if (!isValidDate(String(date))) {
      return res.status(400).json({ success: false, message: "Ngày chiếu không hợp lệ!" });
    }
    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách suất chiếu trống!" });
    }
    if (slots.length > 100) {
      return res.status(400).json({ success: false, message: "Tối đa 100 suất mỗi lần!" });
    }

    const normalized: Array<{ movieId: number; roomId: number; startTime: string; endTime: string }> = [];
    for (const slot of slots) {
      const movie = parsePositiveInt(slot?.movieId);
      const room = parsePositiveInt(slot?.roomId);
      const start = String(slot?.startTime || "");
      const end = String(slot?.endTime || "");

      if (!movie || !room || !TIME_RE.test(start) || !TIME_RE.test(end) || start >= end) {
        return res.status(400).json({
          success: false,
          message: "Có suất chiếu không hợp lệ trong danh sách (movieId/roomId/giờ)!",
        });
      }
      normalized.push({ movieId: movie, roomId: room, startTime: start, endTime: end });
    }

    const result = await bulkCreateShowtimes(String(date), normalized);
    const showtimes = await getShowtimesByDate(String(date));

    return res.status(201).json({
      success: true,
      message: `Đã thêm ${result.created} suất chiếu${result.skipped > 0 ? `, bỏ qua ${result.skipped} suất trùng giờ` : ""
        }.`,
      created: result.created,
      skipped: result.skipped,
      data: showtimes,
    });
  } catch (error) {
    console.error("Lỗi thêm nhiều suất chiếu:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi thêm suất chiếu!",
    });
  }
});

// DELETE /api/showtimes/:id (admin) - Hủy suất chiếu (mềm) — giữ lịch sử vé
showtimeRouter.delete("/:id", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "ID suất chiếu không hợp lệ!" });
    }

    const result = await cancelShowtime(id);
    if (!result.ok) {
      if (result.status === "cancelled") {
        return res.status(400).json({ success: false, message: "Suất chiếu đã bị hủy trước đó!" });
      }
      return res.status(404).json({ success: false, message: "Không tìm thấy suất chiếu!" });
    }

    return res.json({ success: true, message: "Đã hủy suất chiếu!" });
  } catch (error) {
    console.error("Lỗi hủy suất chiếu:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi hủy suất chiếu!",
    });
  }
});

export default showtimeRouter;
