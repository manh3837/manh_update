import { apiRequest, type ApiResponse } from "./api";
import type { UserProfile } from "./auth.service";

export interface UpdateProfileParams {
  userId: number;
  name: string;
  email: string;
  phone?: string;
}

export interface ChangePasswordParams {
  userId: number;
  currentPassword: string;
  newPassword: string;
}

export type AdminRole = "customer" | "manager" | "admin";
export type AdminStatus = "active" | "locked" | "unverified";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  status: AdminStatus;
  points: number;
  created_at: string;
  updated_at: string;
  /** Số đơn đặt vé (dùng để cảnh báo khi xóa) */
  booking_count: number;
}

export interface AdminUserStats {
  total: number;
  customer: number;
  manager: number;
  admin: number;
  active: number;
  locked: number;
  unverified: number;
}

export interface AdminUsersData {
  users: AdminUser[];
  stats: AdminUserStats;
}

export interface AdminUpdateUserParams {
  name?: string;
  email?: string;
  phone?: string;
  role?: AdminRole;
  status?: AdminStatus;
}

// Service quản lý API Người dùng (Cập nhật hồ sơ, Đổi mật khẩu)
export const userService = {
  //1. Cập nhật thông tin cá nhân vào Database MySQL (/api/users/profile)
  async updateProfile(params: UpdateProfileParams): Promise<ApiResponse<UserProfile>> {
    return apiRequest<UserProfile>("/users/profile", {
      method: "PUT",
      body: JSON.stringify(params),
    });
  },

  // 2. Đổi mật khẩu tài khoản vào Database MySQL (/api/users/change-password)
  async changePassword(params: ChangePasswordParams): Promise<ApiResponse> {
    return apiRequest("/users/change-password", {
      method: "PUT",
      body: JSON.stringify(params),
    });
  },

  //3. ADMIN: lấy toàn bộ tài khoản + thống kê theo vai trò/trạng thái (/api/users)
  async getUsers(): Promise<ApiResponse<AdminUsersData>> {
    return apiRequest<AdminUsersData>("/users");
  },

  //4. ADMIN: cập nhật hồ sơ, vai trò, trạng thái của 1 tài khoản (/api/users/:id)
  async updateUser(
    id: number,
    params: AdminUpdateUserParams
  ): Promise<ApiResponse<AdminUser>> {
    return apiRequest<AdminUser>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(params),
    });
  },

  //5. ADMIN: xóa tài khoản (/api/users/:id)
  // force=false: backend chặn nếu tài khoản còn đơn đặt vé (409)
  // force=true: xóa luôn bookings + booking_seats rồi xóa user
  async deleteUser(id: number, force = false): Promise<ApiResponse> {
    return apiRequest(`/users/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
  },
};
