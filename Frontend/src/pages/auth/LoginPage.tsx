import { useState } from "react"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { Eye, EyeOff, LogIn, Lock, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authService } from "@/services/auth.service"
import type { MainLayoutContextType } from "@/layouts/MainLayout"

export const LoginPage = () => {
  const navigate = useNavigate()
  const { showToast } = useOutletContext<MainLayoutContextType>()

  // 1. Quản lý dữ liệu người dùng nhập bằng useState
  const [account, setAccount] = useState("")       // Email hoặc Số điện thoại
  const [password, setPassword] = useState("")     // Mật khẩu
  const [showPassword, setShowPassword] = useState(false) // Trạng thái ẩn/hiện mật khẩu
  const [isLoading, setIsLoading] = useState(false) // Trạng thái chờ gọi API

  // 2. Hàm xử lý khi người dùng nhấn nút Đăng nhập - Gọi sang Backend
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    // Kiểm tra dữ liệu bắt buộc
    if (!account.trim() || !password) {
      showToast("Vui lòng nhập đầy đủ Email/Số điện thoại và Mật khẩu!")
      return
    }

    setIsLoading(true)

    try {
      // Gửi yêu cầu xác thực tới Backend qua authService
      const res = await authService.login({
        account: account.trim(),
        password,
      })

      if (!res.success || !res.user) {
        showToast(res.message || "Tài khoản hoặc mật khẩu không chính xác!")
        setIsLoading(false)
        return
      }

      // Đăng nhập thành công (Backend đã đối chiếu đúng trong MySQL)
      showToast(res.message || "Đăng nhập thành công!")

      // Phân quyền điều hướng
      if (res.user.role === "admin") {
        navigate("/admin")
      } else {
        navigate("/homepage")
      }
    } catch (error) {
      console.error("Lỗi đăng nhập:", error)
      showToast("Không thể kết nối đến máy chủ Backend!")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      {/* Card Đăng nhập */}
      <div className="w-full max-w-md rounded-2xl border border-[#1f2c3d] bg-[#121923] p-8 shadow-2xl">

        {/* Tiêu đề & Giới thiệu */}
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-[#2a3c25] bg-[#162518] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#caef6b]">
            CINEMA MANAGEMENT
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Đăng nhập
          </h1>
          <p className="mt-2 text-sm text-[#9ba9ba]">
            Nhập email hoặc số điện thoại để tiếp tục trải nghiệm
          </p>
        </div>

        {/* Biểu mẫu đăng nhập */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Trường 1: Email hoặc Số điện thoại */}
          <div className="space-y-2">
            <Label htmlFor="account">Email hoặc Số điện thoại</Label>
            <div className="relative">
              <Input
                id="account"
                type="text"
                placeholder="Nhập email hoặc số điện thoại..."
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="pl-10"
                required
              />
              <User className="absolute left-3.5 top-3 size-4 text-[#9ba9ba]" />
            </div>
          </div>

          {/* Trường 2: Mật khẩu */}
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <Lock className="absolute left-3.5 top-3 size-4 text-[#9ba9ba]" />

              {/* Nút bấm ẩn/hiện mật khẩu */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#9ba9ba] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Nút Đăng nhập */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#caef6b] py-2.5 font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-lg shadow-[#caef6b]/10 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Đang xác thực...
              </>
            ) : (
              <>
                <LogIn className="size-4" />
                Đăng nhập
              </>
            )}
          </Button>
        </form>

        {/* Chuyển hướng sang trang Đăng ký */}
        <div className="mt-6 border-t border-[#1f2c3d] pt-5 text-center text-xs text-[#9ba9ba]">
          Bạn chưa có tài khoản?{" "}
          <Link
            to="/register"
            className="font-bold text-[#caef6b] hover:underline transition-colors"
          >
            Đăng ký ngay
          </Link>
        </div>

      </div>
    </div>
  )
}