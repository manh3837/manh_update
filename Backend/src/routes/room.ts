import { Router } from "express";
import {
  getRooms,
  findRoomById,
  createRoom,
  updateRoomById,
  setRoomStatus,
  isRoomNameTaken,
  type RoomInput,
} from "../models/room.model.js";
import { getDetailedRevenueReport, type RevenueReportQuery } from "../models/revenue.model.js";
import { authenticateToken, requireManagerOrAdmin } from "./auth.js";

const roomRouter = Router();

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Chuẩn hóa payload cấu hình phòng */
function normalizeRoomInput(body: Record<string, unknown>): {
  data: RoomInput;
  error?: string;
} {
  const data: RoomInput = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { data, error: "Tên phòng không được để trống!" };
    data.name = name;
  }
  if (body.cinemaId !== undefined) {
    const cinemaId = parseId(body.cinemaId);
    if (!cinemaId) return { data, error: "Rạp (cinemaId) không hợp lệ!" };
    data.cinemaId = cinemaId;
  }
  if (body.totalSeats !== undefined) {
    const value = parseRange(body.totalSeats, 1, 1000);
    if (!value) return { data, error: "Tổng số ghế phải từ 1 đến 1000!" };
    data.totalSeats = value;
  }
  if (body.regularCount !== undefined) {
    const value = parseRange(body.regularCount, 0, 1000);
    if (value === null) return { data, error: "Số ghế thường không hợp lệ!" };
    data.regularCount = value;
  }
  if (body.vipCount !== undefined) {
    const value = parseRange(body.vipCount, 0, 1000);
    if (value === null) return { data, error: "Số ghế VIP không hợp lệ!" };
    data.vipCount = value;
  }
  if (body.rowsCount !== undefined) {
    const value = parseRange(body.rowsCount, 1, 50);
    if (!value) return { data, error: "Số hàng ghế phải từ 1 đến 50!" };
    data.rowsCount = value;
  }
  if (body.colsCount !== undefined) {
    const value = parseRange(body.colsCount, 1, 50);
    if (!value) return { data, error: "Số ghế mỗi hàng phải từ 1 đến 50!" };
    data.colsCount = value;
  }
  if (body.format !== undefined) {
    const format = String(body.format).trim();
    if (!format) return { data, error: "Định dạng chiếu không được để trống!" };
    data.format = format;
  }
  if (body.audio !== undefined) {
    const audio = String(body.audio).trim();
    if (!audio) return { data, error: "Hệ thống âm thanh không được để trống!" };
    data.audio = audio;
  }
  if (body.vipRows !== undefined) data.vipRows = String(body.vipRows).trim();
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!["active", "maintenance"].includes(status)) {
      return { data, error: "Trạng thái phòng không hợp lệ!" };
    }
    data.status = status as "active" | "maintenance";
  }

  return { data };
}

// GET /api/rooms?cinemaId=1 - Danh sách phòng (công khai) kèm số suất chiếu
roomRouter.get("/", async (req, res) => {
  try {
    const cinemaId = req.query.cinemaId ? parseId(req.query.cinemaId) : null;
    if (req.query.cinemaId && !cinemaId) {
      return res.status(400).json({ success: false, message: "cinemaId không hợp lệ!" });
    }

    const rooms = await getRooms(cinemaId || undefined);
    return res.json({ success: true, data: rooms });
  } catch (error) {
    console.error("Lỗi lấy danh sách phòng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải danh sách phòng!",
    });
  }
});

// GET /api/rooms/revenue-breakdown - Báo cáo doanh thu chi tiết theo từng phòng và từng phim (Admin / Manager)
roomRouter.get("/revenue-breakdown", async (req, res) => {
  try {
    const { cinemaId, periodType, date, month, startDate, endDate } = req.query as Record<string, string>;

    const query: RevenueReportQuery = {
      cinemaId: cinemaId && cinemaId !== "all" ? parseId(cinemaId) || undefined : undefined,
      periodType: (periodType as "day" | "month" | "range") || "day",
      date,
      month,
      startDate,
      endDate,
    };

    const report = await getDetailedRevenueReport(query);
    return res.json({ success: true, data: report });
  } catch (error: any) {
    console.error("Lỗi tạo báo cáo doanh thu chi tiết:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy báo cáo doanh thu phòng và phim!",
      error: error?.message,
    });
  }
});

// POST /api/rooms (admin) - Thêm phòng chiếu mới
roomRouter.post("/", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { data, error } = normalizeRoomInput(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    if (!data.name) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập tên phòng!" });
    }

    const result = await createRoom({
      ...data,
      name: data.name,
      cinemaId: data.cinemaId || 1,
    });

    if (result.duplicate) {
      return res.status(409).json({
        success: false,
        message: "Tên phòng này đã tồn tại trong rạp!",
      });
    }

    const room = result.id ? await findRoomById(result.id) : null;
    return res.status(201).json({
      success: true,
      message: "Đã thêm phòng chiếu vào database!",
      room,
    });
  } catch (error) {
    console.error("Lỗi thêm phòng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi thêm phòng chiếu!",
    });
  }
});

// PUT /api/rooms/:id (admin) - Lưu cấu hình phòng
roomRouter.put("/:id", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "ID phòng không hợp lệ!" });

    const existing = await findRoomById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng chiếu!" });
    }

    const { data, error } = normalizeRoomInput(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    if (data.name && data.name !== existing.name) {
      const taken = await isRoomNameTaken(data.name, existing.cinema_id, id);
      if (taken) {
        return res.status(409).json({ success: false, message: "Tên phòng này đã tồn tại trong rạp!" });
      }
    }

    const updated = await updateRoomById(id, data);
    if (!updated) {
      return res.status(400).json({ success: false, message: "Không có thay đổi nào để lưu!" });
    }

    const room = await findRoomById(id);
    return res.json({ success: true, message: "Đã lưu cấu hình phòng!", room });
  } catch (error) {
    console.error("Lỗi cập nhật phòng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật phòng!",
    });
  }
});

// PUT /api/rooms/:id/status (admin) - Ngừng phòng (maintenance) hoặc mở lại (active).
// Khi ngừng: hủy các suất chiếu tương lai của phòng.
roomRouter.put("/:id/status", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "ID phòng không hợp lệ!" });

    const status = String(req.body?.status || "");
    if (!["active", "maintenance"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái phòng chỉ nhận 'active' hoặc 'maintenance'!",
      });
    }

    const existing = await findRoomById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng chiếu!" });
    }

    const result = await setRoomStatus(id, status as "active" | "maintenance");
    if (!result.ok) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng chiếu!" });
    }

    return res.json({
      success: true,
      message:
        status === "maintenance"
          ? `Đã ngừng phòng ${existing.name}${result.cancelledShowtimes > 0
            ? ` và hủy ${result.cancelledShowtimes} suất chiếu sắp tới`
            : ""
          }.`
          : `Đã mở lại phòng ${existing.name}.`,
      cancelledShowtimes: result.cancelledShowtimes,
      room: await findRoomById(id),
    });
  } catch (error) {
    console.error("Lỗi đổi trạng thái phòng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi đổi trạng thái phòng!",
    });
  }
});

export default roomRouter;
