import { apiRequest, type ApiResponse } from "./api";

export interface UserProfile {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "manager" | "customer";
  points?: number;
  avatar_url?: string;
}

export interface LoginParams {
  account: string;  // Email hoặc Số điện thoại
  password: string;
}

export interface RegisterParams {
  name: string;
  email: string;
  phone: string;
  password: string;
}

// Service quản lý các kết nối API xác thực (Đăng nhập / Đăng ký / Phiên làm việc)
export const authService = {
  // Gửi thông tin Đăng nhập sang Backend (/api/auth/login)
  async login(params: LoginParams): Promise<ApiResponse<UserProfile>> {
    const res = await apiRequest<UserProfile>("/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    });

    // Nếu đăng nhập thành công từ Backend, lưu thông tin và token vào localStorage
    if (res.success && res.user) {
      authService.saveUser(res.user);
      if (res.token) {
        localStorage.setItem("token", res.token);
      }
    }

    return res;
  },

  // 2. Gửi thông tin Đăng ký sang Backend (/api/auth/register)
  async register(params: RegisterParams): Promise<ApiResponse<{ id: number; name: string; email: string }>> {
    const res = await apiRequest<{ id: number; name: string; email: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(params),
    });

    if (res.success && res.token) {
      localStorage.setItem("token", res.token);
    }

    return res;
  },

  // 3. Lưu thông tin người dùng vào localStorage
  saveUser(user: UserProfile) {
    localStorage.setItem("user", JSON.stringify(user));
  },

  // Lấy thông tin người dùng đang đăng nhập từ localStorage
  getCurrentUser(): UserProfile | null {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  },

  // 5. Lấy JWT Token từ localStorage
  getToken(): string | null {
    return localStorage.getItem("token");
  },

  // 6. Đăng xuất: xóa phiên làm việc và token khỏi localStorage
  logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  },
};
