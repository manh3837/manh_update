import { Router } from "express";
import {
  initSeatLocksTable,
  getOccupiedSeats,
  lockSeatsWithPriceCalculation,
  releaseSeats,
} from "../models/booking.model.js";

const bookingRouter = Router();

// Tự động kiểm tra và khởi tạo bảng seat_locks
initSeatLocksTable();

// [GET] /api/booking/occupied-seats - Lấy danh sách ghế đã bán và ghế đang bị khóa tạm thời trong 5 phút
bookingRouter.get("/occupied-seats", async (req, res) => {
  try {
    const showtimeId = Number(req.query.showtimeId) || 1;
    const sessionId = (req.query.sessionId as string) || "guest";

    const data = await getOccupiedSeats(showtimeId, sessionId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách ghế đã đặt/khóa:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải sơ đồ ghế!",
    });
  }
});

// [POST] /api/booking/lock-seats - 1. Khóa ghế tạm thời trong 5 phút trong MySQL
// 2. Tự động tính toán tổng số tiền dựa theo đơn giá ghế và số lượng ghế chọn
bookingRouter.post("/lock-seats", async (req, res) => {
  try {
    const {
      showtimeId,
      seats,
      userId,
      sessionId,
      regularPrice,
      vipPrice,
    } = req.body;

    if (!showtimeId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin suất chiếu hoặc phiên chọn ghế (sessionId)!",
      });
    }

    const result = await lockSeatsWithPriceCalculation({
      showtimeId: Number(showtimeId),
      seats: Array.isArray(seats) ? seats : [],
      userId: userId ? Number(userId) : undefined,
      sessionId: String(sessionId),
      regularPrice: regularPrice ? Number(regularPrice) : 90000,
      vipPrice: vipPrice ? Number(vipPrice) : 120000,
    });

    if (!result.success) {
      return res.status(409).json(result); // 409 Conflict: trùng ghế
    }

    return res.json(result);
  } catch (error) {
    console.error("Lỗi khóa ghế và tính tiền:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xử lý giữ chỗ ghế!",
    });
  }
});

// [POST] /api/booking/release-seats - Hủy giữ chỗ ghế khi người dùng thoát hoặc hủy chọn
bookingRouter.post("/release-seats", async (req, res) => {
  try {
    const { showtimeId, sessionId } = req.body;

    if (!showtimeId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin suất chiếu hoặc sessionId!",
      });
    }

    await releaseSeats(Number(showtimeId), String(sessionId));

    return res.json({
      success: true,
      message: "Đã hủy giữ chỗ các ghế thành công.",
    });
  } catch (error) {
    console.error("Lỗi giải phóng ghế:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi hủy giữ chỗ ghế!",
    });
  }
});

export default bookingRouter;
