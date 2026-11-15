import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// Định nghĩa kiểu dữ liệu cho User tương ứng với bảng 'users' trong MySQL
export interface User {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role?: "customer" | "manager" | "admin";
  status?: "active" | "locked" | "unverified";
  avatar_url?: string;
  points?: number;
  created_at?: Date;
  updated_at?: Date;
  /** Số đơn đặt vé (chỉ dùng cho trang admin) */
  booking_count?: number;
}

// 1. Tìm người dùng theo Email hoặc Số điện thoại (dùng cho Đăng nhập)
export async function findUserByEmailOrPhone(identifier: string): Promise<User | null> {
  const query = "SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1";
  const [rows] = await pool.query<RowDataPacket[]>(query, [identifier, identifier]);

  if (rows.length === 0) return null;
  return rows[0] as User;
}

//2. Tìm người dùng theo ID
export async function findUserById(id: number): Promise<User | null> {
  const query = "SELECT id, name, email, phone, role, status, points FROM users WHERE id = ? LIMIT 1";
  const [rows] = await pool.query<RowDataPacket[]>(query, [id]);

  if (rows.length === 0) return null;
  return rows[0] as User;
}

// 3. Thêm tài khoản mới vào Database (dùng cho Đăng ký)
export async function createUser(userData: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<number> {
  const query = `
    INSERT INTO users (name, email, phone, password, role, status, points)
    VALUES (?, ?, ?, ?, 'customer', 'active', 0)
  `;
  const [result] = await pool.query<ResultSetHeader>(query, [
    userData.name,
    userData.email,
    userData.phone,
    userData.password,
  ]);

  return result.insertId;
}

// 4. Cập nhật thông tin cá nhân (Họ tên, SĐT, Email)
export async function updateUserProfile(
  id: number,
  data: { name: string; phone?: string; email?: string }
): Promise<boolean> {
  const query = `
    UPDATE users 
    SET name = ?, phone = ?, email = ?
    WHERE id = ?
  `;
  const [result] = await pool.query<ResultSetHeader>(query, [
    data.name,
    data.phone || null,
    data.email,
    id,
  ]);
  return result.affectedRows > 0;
}

//5. Cập nhật mật khẩu mới
export async function updateUserPassword(id: number, newPassword: string): Promise<boolean> {
  const query = "UPDATE users SET password = ? WHERE id = ?";
  const [result] = await pool.query<ResultSetHeader>(query, [newPassword, id]);
  return result.affectedRows > 0;
}


// ADMIN: danh sách + thống kê + cập nhật vai trò/trạng thái
export interface UserStats {
  total: number;
  customer: number;
  manager: number;
  admin: number;
  active: number;
  locked: number;
  unverified: number;
}

/** Toàn bộ tài khoản (không kèm mật khẩu) */
export async function getAllUsers(): Promise<User[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.points,
            u.created_at, u.updated_at,
            (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS booking_count
     FROM users u
     ORDER BY u.id ASC`
  );
  return rows as User[];
}

/** Đếm theo vai trò + trạng thái cho các tab "Tất cả / Khách hàng / Quản lý / Quản trị viên" */
export async function getUserStats(): Promise<UserStats> {
  const stats: UserStats = {
    total: 0,
    customer: 0,
    manager: 0,
    admin: 0,
    active: 0,
    locked: 0,
    unverified: 0,
  };

  const [roleRows] = await pool.query<RowDataPacket[]>(
    "SELECT role, COUNT(*) AS total FROM users GROUP BY role"
  );
  for (const row of roleRows) {
    const role = String(row.role) as "customer" | "manager" | "admin";
    const total = Number(row.total) || 0;
    if (role === "customer" || role === "manager" || role === "admin") stats[role] = total;
    stats.total += total;
  }

  const [statusRows] = await pool.query<RowDataPacket[]>(
    "SELECT status, COUNT(*) AS total FROM users GROUP BY status"
  );
  for (const row of statusRows) {
    const status = String(row.status) as "active" | "locked" | "unverified";
    const total = Number(row.total) || 0;
    if (status in stats) stats[status] = total;
  }

  return stats;
}

/** Admin cập nhật hồ sơ + vai trò + trạng thái tài khoản */
export async function adminUpdateUser(
  id: number,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    role?: "customer" | "manager" | "admin";
    status?: "active" | "locked" | "unverified";
  }
): Promise<boolean> {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    params.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    params.push(data.email);
  }
  if (data.phone !== undefined) {
    fields.push("phone = ?");
    params.push(data.phone);
  }
  if (data.role !== undefined) {
    fields.push("role = ?");
    params.push(data.role);
  }
  if (data.status !== undefined) {
    fields.push("status = ?");
    params.push(data.status);
  }

  if (fields.length === 0) return false;

  params.push(id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

/** Đếm số quản trị viên (để chặn xóa admin cuối cùng) */
export async function countAdmins(): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'"
  );
  return Number(rows[0]?.total || 0);
}


export async function countBookingsByUser(id: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM bookings WHERE user_id = ?",
    [id]
  );
  return Number(rows[0]?.total || 0);
}


export async function deleteUserById(id: number, force = false): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (force) {
      await conn.query("DELETE FROM bookings WHERE user_id = ?", [id]);
    }
    await conn.query("DELETE FROM favorites WHERE user_id = ?", [id]);
    await conn.query("DELETE FROM users WHERE id = ?", [id]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
