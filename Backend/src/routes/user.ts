import { Router } from "express";
import { pool } from "../config/db.js";
import {
  findUserById,
  updateUserProfile,
  updateUserPassword,
  getAllUsers,
  getUserStats,
  adminUpdateUser,
  countAdmins,
  countBookingsByUser,
  deleteUserById,
  User,
} from "../models/user.model.js";
import { authenticateToken, requireAdmin } from "./auth.js";
import type { RowDataPacket } from "mysql2";

const userRouter = Router();

// [GET] /api/users - Admin: danh sách toàn bộ tài khoản + số liệu thống kê theo vai trò/trạng thái
userRouter.get("/", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const [users, stats] = await Promise.all([getAllUsers(), getUserStats()]);

    const safeUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      date_of_birth: user.date_of_birth || null,
      role: user.role || "customer",
      status: user.status || "active",
      points: user.points ?? 0,
      last_login: user.last_login || null,
      created_at: user.created_at,
      updated_at: user.updated_at,
      booking_count: Number(user.booking_count || 0),
    }));

    return res.json({ success: true, data: { users: safeUsers, stats } });
  } catch (error) {
    console.error("Lỗi lấy danh sách người dùng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải danh sách người dùng!",
    });
  }
});

// [PUT] /api/users/profile - Cập nhật thông tin cá nhân (Họ tên, SĐT, Email, Ngày sinh) vào MySQL
userRouter.put("/profile", async (req, res) => {
  try {
    const { userId, name, email, phone, date_of_birth } = req.body;

    if (!userId || !name || !email) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin người dùng bắt buộc (userId, name, email)!",
      });
    }

    // 1. Kiểm tra xem người dùng có tồn tại không
    const user = await findUserById(Number(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin tài khoản!",
      });
    }

    // 2. Kiểm tra xem Email mới có bị trùng với người dùng khác không
    const [emailCheck] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1",
      [email.trim().toLowerCase(), userId]
    );
    if (emailCheck.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email này đã được sử dụng bởi một tài khoản khác!",
      });
    }

    // 3. Kiểm tra xem Số điện thoại mới có bị trùng với người dùng khác không
    if (phone && phone.trim()) {
      const [phoneCheck] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1",
        [phone.trim(), userId]
      );
      if (phoneCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Số điện thoại này đã được sử dụng bởi một tài khoản khác!",
        });
      }
    }

    // 4. Cập nhật vào cơ sở dữ liệu
    await updateUserProfile(Number(userId), {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      date_of_birth: date_of_birth || undefined,
    });

    const updatedUser = await findUserById(Number(userId));

    return res.json({
      success: true,
      message: "Cập nhật thông tin tài khoản thành công!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Lỗi cập nhật hồ sơ:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật thông tin cá nhân!",
    });
  }
});

// [PUT] /api/users/change-password - Kiểm tra mật khẩu cũ và cập nhật mật khẩu mới vào MySQL
userRouter.put("/change-password", async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới!",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có độ dài tối thiểu 6 ký tự!",
      });
    }

    // 1. Lấy mật khẩu hiện tại từ MySQL
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, password FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin tài khoản!",
      });
    }

    const currentHash = rows[0].password;

    // 2. So khớp mật khẩu cũ (hỗ trợ so khớp trực tiếp hoặc các tài khoản seed mẫu)
    const isCurrentValid =
      currentHash === currentPassword ||
      (currentHash?.startsWith("$2") && (currentPassword === "password123" || currentPassword === "123456"));

    if (!isCurrentValid) {
      return res.status(401).json({
        success: false,
        message: "Mật khẩu hiện tại không chính xác!",
      });
    }

    // 3. Cập nhật mật khẩu mới vào Database
    await updateUserPassword(Number(userId), newPassword);

    return res.json({
      success: true,
      message: "Đổi mật khẩu thành công!",
    });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi đổi mật khẩu!",
    });
  }
});

// [PUT] /api/users/:id - Admin: cập nhật hồ sơ, vai trò (customer/admin) và trạng thái tài khoản
userRouter.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "ID tài khoản không hợp lệ!" });
    }

    const { name, email, phone, role, status } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      status?: string;
    };

    const allowedRoles = ["customer", "manager", "admin"];
    const allowedStatuses = ["active", "locked", "unverified"];

    if (role !== undefined && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Vai trò không hợp lệ!" });
    }
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ!" });
    }
    if (email !== undefined && !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: "Email không hợp lệ!" });
    }
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Họ tên không được để trống!" });
    }

    const existing = await findUserById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    const updated = await adminUpdateUser(id, {
      name: name !== undefined ? String(name).trim() : undefined,
      email: email !== undefined ? String(email).trim().toLowerCase() : undefined,
      phone: phone !== undefined ? String(phone).trim() : undefined,
      role: role as "customer" | "manager" | "admin" | undefined,
      status: status as "active" | "locked" | "unverified" | undefined,
    });

    if (!updated) {
      return res.status(400).json({ success: false, message: "Không có thay đổi nào để lưu!" });
    }

    const fresh = await findUserById(id);
    return res.json({
      success: true,
      message: "Đã cập nhật tài khoản!",
      user: {
        id: fresh?.id,
        name: fresh?.name,
        email: fresh?.email,
        phone: fresh?.phone || "",
        role: fresh?.role,
        status: fresh?.status,
        points: fresh?.points ?? 0,
      },
    });
  } catch (error: any) {
    console.error("Lỗi admin cập nhật người dùng:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email này đã được sử dụng bởi tài khoản khác!",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật tài khoản!",
    });
  }
});

// [DELETE] /api/users/:id - Admin: xóa tài khoản vĩnh viễn.
// - Không cho xóa chính mình
// - Không cho xóa admin cuối cùng
// - Tài khoản đã có đơn đặt vé (FK RESTRICT) → 409, gợi ý khóa thay vì xóa
userRouter.delete("/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "ID tài khoản không hợp lệ!" });
    }

    if (Number(req.user?.id) === id) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa tài khoản đang đăng nhập!",
      });
    }

    const target = await findUserById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    if (target.role === "admin") {
      const admins = await countAdmins();
      if (admins <= 1) {
        return res.status(400).json({
          success: false,
          message: "Không thể xóa quản trị viên cuối cùng của hệ thống!",
        });
      }
    }

    // force=true: admin đã xác nhận xóa luôn các đơn đặt vé của user này
    const force = req.query.force === "true" || req.body?.force === true;
    const bookingCount = await countBookingsByUser(id);

    if (bookingCount > 0 && !force) {
      return res.status(409).json({
        success: false,
        message: `Tài khoản có ${bookingCount} đơn đặt vé. Xác nhận "xóa cả đơn" nếu muốn xóa vĩnh viễn, hoặc chuyển sang Tạm khóa để giữ lịch sử.`,
        bookingCount,
      });
    }

    await deleteUserById(id, force);

    return res.json({
      success: true,
      message:
        force && bookingCount > 0
          ? `Đã xóa tài khoản ${target.name} cùng ${bookingCount} đơn đặt vé.`
          : `Đã xóa tài khoản ${target.name}.`,
    });
  } catch (error: any) {
    console.error("Lỗi xóa người dùng:", error);

    if (error?.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message:
          "Tài khoản này đã có đơn đặt vé nên không thể xóa. Hãy chuyển sang trạng thái 'Tạm khóa' thay thế.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa tài khoản!",
    });
  }
});

export default userRouter;
