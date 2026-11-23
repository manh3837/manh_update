import { useState } from "react"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { User, Phone, Mail, Lock, UserPlus, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authService } from "@/services/auth.service"
import type { MainLayoutContextType } from "@/layouts/MainLayout"

export const RegisterPage = () => {
  const navigate = useNavigate()
  const { showToast } = useOutletContext<MainLayoutContextType>()

  // 1. Quản lý dữ liệu form đăng ký bằng useState
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Trạng thái hiển thị mật khẩu
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 2. Xử lý nhập Họ và tên: Chặn không cho nhập số
  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // replace(/[0-9]/g, ""): Loại bỏ toàn bộ các chữ số 0-9
    const withoutNumbers = e.target.value.replace(/[0-9]/g, "")
    setFullName(withoutNumbers)
  }

  // 3. Xử lý nhập Số điện thoại: Chặn không cho nhập chữ, chỉ nhận số (tối đa 11 số)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // replace(/[^0-9]/g, ""): Loại bỏ tất cả ký tự không phải là số (chữ cái, ký tự đặc biệt)
    const onlyNumbers = e.target.value.replace(/[^0-9]/g, "").slice(0, 11)
    setPhone(onlyNumbers)
  }

  // 4. Hàm xử lý khi người dùng nhấn nút Đăng ký - Gửi sang Backend MySQL
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // Kiểm tra không để trống
    if (!fullName.trim() || !phone.trim() || !email.trim() || !password || !confirmPassword) {
      showToast("Vui lòng điền đầy đủ tất cả các trường!")
      return
    }

    // Kiểm tra Họ và tên không được chứa số
    if (/\d/.test(fullName)) {
      showToast("Họ và tên không được chứa số!")
      return
    }

    // Kiểm tra Số điện thoại chỉ chứa số và độ dài từ 9 đến 11 số
    if (!/^[0-9]+$/.test(phone)) {
      showToast("Số điện thoại không được chứa chữ cái hay ký tự đặc biệt!")
      return
    }

    if (phone.length < 9 || phone.length > 11) {
      showToast("Số điện thoại phải từ 9 đến 11 chữ số!")
      return
    }

    // Kiểm tra mật khẩu xác nhận
    if (password !== confirmPassword) {
      showToast("Mật khẩu xác nhận không khớp!")
      return
    }

    setIsLoading(true)

    try {
      // Gửi yêu cầu đăng ký tài khoản sang Backend (lưu vào MySQL)
      const res = await authService.register({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      })

      if (!res.success) {
        showToast(res.message || "Đăng ký không thành công!")
        setIsLoading(false)
        return
      }

      // Đăng ký thành công -> Tự động đăng nhập người dùng vào phiên
      const newUser = {
        id: res.data?.id,
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: "customer" as const,
        points: 0,
      }
      authService.saveUser(newUser)

      showToast(`Chúc mừng ${fullName}! Đăng ký thành công và đã lưu vào database.`)
      navigate("/homepage")
    } catch (error) {
      console.error("Lỗi đăng ký:", error)
      showToast("Không thể kết nối đến máy chủ Backend!")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      {/* Card Đăng ký */}
      <div className="w-full max-w-md rounded-2xl border border-[#1f2c3d] bg-[#121923] p-8 shadow-2xl">
        
        {/* Tiêu đề & Giới thiệu */}
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full border border-[#2a3c25] bg-[#162518] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#caef6b]">
            TÀI KHOẢN MỚI
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Đăng ký tài khoản
          </h1>
          <p className="mt-2 text-sm text-[#9ba9ba]">
            Tạo tài khoản để nhận ưu đãi và tích điểm khi xem phim
          </p>
        </div>

        {/* Biểu mẫu đăng ký */}
        <form onSubmit={handleRegister} className="space-y-4">
          {/* 1. Họ và tên: Không nhận số */}
          <div className="space-y-1.5">
            <Label htmlFor="fullname">Họ và tên (chỉ nhập chữ)</Label>
            <div className="relative">
              <Input
                id="fullname"
                type="text"
                placeholder="Ví dụ: Nguyễn Minh Anh"
                value={fullName}
                onChange={handleFullNameChange}
                className="pl-10"
                required
              />
              <User className="absolute left-3.5 top-3 size-4 text-[#9ba9ba]" />
            </div>
          </div>

          {/* 2. Số điện thoại: Không nhận chữ */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Số điện thoại (chỉ nhập số)</Label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="Ví dụ: 0912345678"
                value={phone}
                onChange={handlePhoneChange}
                className="pl-10"
                required
              />
              <Phone className="absolute left-3.5 top-3 size-4 text-[#9ba9ba]" />
            </div>
          </div>

          {/* 3. Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
              <Mail className="absolute left-3.5 top-3 size-4 text-[#9ba9ba]" />
            </div>
          </div>

          {/* 4. Mật khẩu */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Mật khẩu</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <Lock className="absolute left-3.5 top-3 size-4 text-[#9ba9ba]" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#9ba9ba] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* 5. Xác nhận lại mật khẩu */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Xác nhận lại mật khẩu</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <Lock className="absolute left-3.5 top-3 size-4 text-[#9ba9ba]" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3 text-[#9ba9ba] hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* 6. Nút Đăng ký */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 rounded-xl bg-[#caef6b] py-2.5 font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-lg shadow-[#caef6b]/10 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Đang tạo tài khoản...
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                Đăng ký tài khoản
              </>
            )}
          </Button>
        </form>

        {/* Chuyển hướng sang trang Đăng nhập */}
        <div className="mt-6 border-t border-[#1f2c3d] pt-5 text-center text-xs text-[#9ba9ba]">
          Bạn đã có tài khoản?{" "}
          <Link
            to="/login"
            className="font-bold text-[#caef6b] hover:underline transition-colors"
          >
            Đăng nhập ngay
          </Link>
        </div>

      </div>
    </div>
  )
}
