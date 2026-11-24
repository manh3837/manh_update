import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface SeatCalculation {
  seatCode: string;
  type: "regular" | "vip";
  price: number;
}

export interface LockResult {
  success: boolean;
  message: string;
  showtimeId: number;
  lockedSeats: string[];
  totalPrice: number;
  breakdown: {
    regularCount: number;
    regularPrice: number;
    regularTotal: number;
    vipCount: number;
    vipPrice: number;
    vipTotal: number;
  };
  expiresInSeconds: number;
  expiresAt: string;
  conflictingSeats?: string[];
}

// 1. Khởi tạo bảng seat_locks trong MySQL nếu chưa tồn tại
export async function initSeatLocksTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS seat_locks (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      showtime_id INT UNSIGNED NOT NULL,
      seat_code VARCHAR(10) NOT NULL,
      user_id INT UNSIGNED DEFAULT NULL,
      session_id VARCHAR(100) NOT NULL,
      seat_type ENUM('regular','vip') NOT NULL DEFAULT 'regular',
      price DECIMAL(10,0) NOT NULL DEFAULT 90000,
      locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      UNIQUE KEY uq_showtime_seat (showtime_id, seat_code),
      INDEX idx_showtime (showtime_id),
      INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await pool.query(query);
  } catch (err) {
    console.error("Lỗi khởi tạo bảng seat_locks:", err);
  }
}

// 2. Tự động dọn dẹp các ghế bị khóa đã hết hạn (> 5 phút)
export async function cleanupExpiredLocks(): Promise<void> {
  try {
    await pool.query("DELETE FROM seat_locks WHERE expires_at < NOW()");
  } catch (err) {
    console.error("Lỗi xóa ghế lock hết hạn:", err);
  }
}

// 3. Lấy danh sách ghế đã bán và ghế đang bị người khác giữ chỗ
export async function getOccupiedSeats(
  showtimeId: number,
  sessionId: string
): Promise<{
  bookedSeats: string[];
  lockedByOthers: string[];
  myLockedSeats: string[];
  expiresInSeconds: number;
}> {
  await cleanupExpiredLocks();

  // Danh sách ghế mẫu đã bán (mặc định cho các suất chiếu demo)
  const defaultSoldSeats = [
    "B4", "B5", "C6", "C7", "C8",
    "D5", "D6", "D7", "D8",
    "E6", "E7", "E8", "E9",
    "F5", "F6", "G7", "G8"
  ];

  // Ghế bị khóa bởi người khác
  const [otherLocks] = await pool.query<RowDataPacket[]>(
    "SELECT seat_code FROM seat_locks WHERE showtime_id = ? AND expires_at > NOW() AND session_id != ?",
    [showtimeId, sessionId]
  );
  const lockedByOthers = otherLocks.map((r) => r.seat_code as string);

  // Ghế đang được giữ bởi chính phiên này
  const [myLocks] = await pool.query<RowDataPacket[]>(
    "SELECT seat_code, TIMESTAMPDIFF(SECOND, NOW(), expires_at) as remaining_seconds FROM seat_locks WHERE showtime_id = ? AND expires_at > NOW() AND session_id = ?",
    [showtimeId, sessionId]
  );
  const myLockedSeats = myLocks.map((r) => r.seat_code as string);
  const expiresInSeconds = myLocks.length > 0 ? Math.max(0, myLocks[0].remaining_seconds) : 0;

  return {
    bookedSeats: defaultSoldSeats,
    lockedByOthers,
    myLockedSeats,
    expiresInSeconds,
  };
}

// 4. Khóa ghế tạm thời trong 5 phút & Tự động tính toán chi phí
export async function lockSeatsWithPriceCalculation(params: {
  showtimeId: number;
  seats: string[];
  userId?: number;
  sessionId: string;
  regularPrice?: number;
  vipPrice?: number;
}): Promise<LockResult> {
  const {
    showtimeId,
    seats,
    userId,
    sessionId,
    regularPrice = 90000,
    vipPrice = 120000,
  } = params;

  // Dọn dẹp ghế quá hạn
  await cleanupExpiredLocks();

  // Nếu không chọn ghế nào (hủy hết lựa chọn) -> giải phóng các ghế của session này
  if (!seats || seats.length === 0) {
    await pool.query(
      "DELETE FROM seat_locks WHERE showtime_id = ? AND session_id = ?",
      [showtimeId, sessionId]
    );
    return {
      success: true,
      message: "Đã giải phóng toàn bộ ghế được chọn.",
      showtimeId,
      lockedSeats: [],
      totalPrice: 0,
      breakdown: {
        regularCount: 0,
        regularPrice,
        regularTotal: 0,
        vipCount: 0,
        vipPrice,
        vipTotal: 0,
      },
      expiresInSeconds: 0,
      expiresAt: new Date().toISOString(),
    };
  }

  // 1. Kiểm tra xem có ghế nào đã bán hoặc đang bị người khác giữ chỗ không
  const [conflictRows] = await pool.query<RowDataPacket[]>(
    `SELECT seat_code FROM seat_locks 
     WHERE showtime_id = ? AND expires_at > NOW() AND session_id != ? AND seat_code IN (?)`,
    [showtimeId, sessionId, seats]
  );

  if (conflictRows.length > 0) {
    const conflictingSeats = conflictRows.map((r) => r.seat_code as string);
    return {
      success: false,
      message: `Ghế [${conflictingSeats.join(", ")}] vừa được người khác giữ chỗ. Vui lòng chọn ghế khác!`,
      showtimeId,
      lockedSeats: [],
      totalPrice: 0,
      breakdown: {
        regularCount: 0,
        regularPrice,
        regularTotal: 0,
        vipCount: 0,
        vipPrice,
        vipTotal: 0,
      },
      expiresInSeconds: 0,
      expiresAt: new Date().toISOString(),
      conflictingSeats,
    };
  }

  // 2. Tính toán phân loại ghế & đơn giá (Hàng E, F, G là VIP, các hàng khác là Regular)
  let regularCount = 0;
  let vipCount = 0;
  const seatDetails: SeatCalculation[] = seats.map((seat) => {
    const row = seat[0].toUpperCase();
    const isVip = ["E", "F", "G"].includes(row);
    if (isVip) {
      vipCount++;
      return { seatCode: seat, type: "vip", price: vipPrice };
    } else {
      regularCount++;
      return { seatCode: seat, type: "regular", price: regularPrice };
    }
  });

  const regularTotal = regularCount * regularPrice;
  const vipTotal = vipCount * vipPrice;
  const totalPrice = regularTotal + vipTotal;

  // 3. Xóa các ghế lock cũ của session này cho suất chiếu này
  await pool.query(
    "DELETE FROM seat_locks WHERE showtime_id = ? AND session_id = ?",
    [showtimeId, sessionId]
  );

  // 4. Khóa các ghế mới trong 5 phút (DATE_ADD(NOW(), INTERVAL 5 MINUTE))
  const lockQueries = seatDetails.map((s) => {
    return pool.query(
      `INSERT INTO seat_locks (showtime_id, seat_code, user_id, session_id, seat_type, price, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
       ON DUPLICATE KEY UPDATE 
         user_id = VALUES(user_id),
         session_id = VALUES(session_id),
         expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)`,
      [showtimeId, s.seatCode, userId || null, sessionId, s.type, s.price]
    );
  });
  await Promise.all(lockQueries);

  // Thời gian hết hạn sau 5 phút
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  return {
    success: true,
    message: `Đã giữ chỗ thành công ${seats.length} ghế trong 5 phút.`,
    showtimeId,
    lockedSeats: seats,
    totalPrice,
    breakdown: {
      regularCount,
      regularPrice,
      regularTotal,
      vipCount,
      vipPrice,
      vipTotal,
    },
    expiresInSeconds: 300,
    expiresAt,
  };
}

//Giải phóng ghế đang giữ chỗ khi người dùng hủy bỏ

export async function releaseSeats(showtimeId: number, sessionId: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM seat_locks WHERE showtime_id = ? AND session_id = ?",
    [showtimeId, sessionId]
  );
  return result.affectedRows > 0;
}
