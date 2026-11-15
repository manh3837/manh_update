import { useState } from "react"
import { Sparkles, Eye, EyeOff, Lock, Loader2 } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { userService } from "@/services/user.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useOutletContext } from "react-router-dom"
import type { MainLayoutContextType } from "@/layouts/MainLayout"

export const AccountPage = () => {
    const { showToast } = useOutletContext<MainLayoutContextType>()

    const savedUserStr = localStorage.getItem("user")
    let savedUser = null
    try {
        savedUser = savedUserStr ? JSON.parse(savedUserStr) : null
    } catch {
        savedUser = null
    }

    // Form states
    const [fullName, setFullName] = useState(savedUser?.name || "Người dùng")
    const [phoneNumber, setPhoneNumber] = useState(savedUser?.phone || "0912 345 678")
    const [email, setEmail] = useState(savedUser?.email || "user@email.com")
    const [dob, setDob] = useState("2001-06-15")
    const [gender, setGender] = useState("female")
    const [favoriteCinema, setFavoriteCinema] = useState("Cinema Nguyễn Du")

    // Password states
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)

    // AI Privacy toggle
    const [aiEnabled, setAiEnabled] = useState(true)

    // Loading states
    const [isSavingInfo, setIsSavingInfo] = useState(false)
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

    const handleSaveInfo = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!fullName.trim() || !email.trim()) {
            showToast("Họ tên và Email không được để trống!")
            return
        }

        if (!savedUser?.id) {
            showToast("Vui lòng đăng nhập lại để cập nhật thông tin!")
            return
        }

        setIsSavingInfo(true)
        try {
            const res = await userService.updateProfile({
                userId: savedUser.id,
                name: fullName.trim(),
                email: email.trim(),
                phone: phoneNumber.trim(),
            })

            if (res.success && res.user) {
                const updatedUser = {
                    ...savedUser,
                    name: res.user.name,
                    email: res.user.email,
                    phone: res.user.phone,
                }
                localStorage.setItem("user", JSON.stringify(updatedUser))
                window.dispatchEvent(new Event("auth-changed"))
                showToast(res.message || "Đã lưu thông tin tài khoản thành công!")
            } else {
                showToast(res.message || "Cập nhật thông tin thất bại!")
            }
        } catch {
            showToast("Không thể kết nối đến máy chủ Backend!")
        } finally {
            setIsSavingInfo(false)
        }
    }

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentPassword || !newPassword) {
            showToast("Vui lòng nhập đầy đủ thông tin mật khẩu!")
            return
        }
        if (newPassword.length < 6) {
            showToast("Mật khẩu mới phải có ít nhất 6 ký tự!")
            return
        }
        if (newPassword !== confirmPassword) {
            showToast("Mật khẩu xác nhận không trùng khớp!")
            return
        }

        if (!savedUser?.id) {
            showToast("Vui lòng đăng nhập lại để thực hiện đổi mật khẩu!")
            return
        }

        setIsUpdatingPassword(true)
        try {
            const res = await userService.changePassword({
                userId: savedUser.id,
                currentPassword,
                newPassword,
            })

            if (res.success) {
                showToast(res.message || "Đã đổi mật khẩu thành công!")
                setCurrentPassword("")
                setNewPassword("")
                setConfirmPassword("")
            } else {
                showToast(res.message || "Đổi mật khẩu thất bại!")
            }
        } catch {
            showToast("Không thể kết nối đến máy chủ Backend!")
        } finally {
            setIsUpdatingPassword(false)
        }
    }

    return (
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
            {/* 1. Header */}
            <div className="mb-8">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                    Không gian của tôi
                </span>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Chào {fullName}, đây là không gian của bạn.
                </h1>
                <p className="mt-2 text-sm text-[#9ba9ba]">
                    Cập nhật thông tin cá nhân và quản lý bảo mật tài khoản.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Left Column: Profile Info + Privacy */}
                <div className="space-y-6 lg:col-span-8">
                    {/* Profile Badge Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-2xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <Avatar className="size-20 border-2 border-[#caef6b]/50">
                            <AvatarFallback className="bg-[#1f2c3d] text-2xl font-black text-[#caef6b]">
                                {fullName ? fullName.trim().split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase() : "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-xl font-bold text-white">{fullName}</h2>
                                <Badge className="border-[#2a3c25] bg-[#162518] px-2.5 py-0.5 text-xs font-bold text-[#caef6b]">
                                    {savedUser?.role === "admin"
                                        ? "Quản trị viên"
                                        : savedUser?.role === "manager"
                                            ? "Quản lý rạp"
                                            : "Thành viên VIP"}
                                </Badge>
                            </div>
                            <p className="text-xs text-[#9ba9ba]">
                                {email} · {phoneNumber}
                            </p>
                            <div className="pt-1 flex items-center gap-4 text-xs font-semibold text-white">
                                <span>
                                    <strong className="text-[#caef6b]">8</strong> vé đã xem
                                </span>
                                <span>•</span>
                                <span>
                                    <strong className="text-[#caef6b]">{savedUser?.points ?? 120}</strong> điểm tích lũy
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Personal Info Form */}
                    <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <h3 className="mb-5 text-base font-bold text-white">Thông tin cá nhân</h3>
                        <form onSubmit={handleSaveInfo} className="space-y-5">
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="fullname">Họ và tên *</Label>
                                    <Input
                                        id="fullname"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Số điện thoại *</Label>
                                    <Input
                                        id="phone"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="dob">Ngày sinh</Label>
                                    <DatePicker
                                        value={dob}
                                        onChange={(_date, formattedDate) => setDob(formattedDate)}
                                        placeholder="Chọn ngày sinh"
                                        minDate={null}
                                        showQuickChips={false}
                                        className="h-10 bg-[#1a2431]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gender">Giới tính</Label>
                                    <select
                                        id="gender"
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value)}
                                        className="flex h-10 w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2 text-sm text-[#f4f6f7] transition-all focus:border-[#caef6b] focus:outline-none focus:ring-1 focus:ring-[#caef6b]"
                                    >
                                        <option value="female">Nữ</option>
                                        <option value="male">Nam</option>
                                        <option value="other">Khác</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="cinema">Rạp yêu thích</Label>
                                <select
                                    id="cinema"
                                    value={favoriteCinema}
                                    onChange={(e) => setFavoriteCinema(e.target.value)}
                                    className="flex h-10 w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2 text-sm text-[#f4f6f7] transition-all focus:border-[#caef6b] focus:outline-none focus:ring-1 focus:ring-[#caef6b]"
                                >
                                    <option value="Cinema Nguyễn Du">Cinema Nguyễn Du (Quận 1, TP.HCM)</option>
                                    <option value="Cinema Thảo Điền">Cinema Thảo Điền (TP. Thủ Đức)</option>
                                    <option value="Cinema Landmark 81">Cinema Landmark 81 (Bình Thạnh)</option>
                                    <option value="Cinema Ba Tháng Hai">Cinema Ba Tháng Hai (Quận 10)</option>
                                </select>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    type="submit"
                                    disabled={isSavingInfo}
                                    className="rounded-xl bg-[#caef6b] px-6 font-bold text-[#090d14] hover:bg-[#b8df5b] flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                                >
                                    {isSavingInfo && <Loader2 className="size-4 animate-spin" />}
                                    {isSavingInfo ? "Đang lưu..." : "Lưu thay đổi"}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* AI Privacy & Preferences */}
                    <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="size-4 text-[#caef6b]" />
                                    <h3 className="text-base font-bold text-white">
                                        Ưu đãi điện ảnh & quyền riêng tư AI
                                    </h3>
                                </div>
                                <p className="text-xs text-[#9ba9ba]">
                                    Cho phép hệ thống phân tích sở thích xem phim để đưa ra gợi ý thông minh nhất.
                                </p>
                            </div>
                            <Switch
                                checked={aiEnabled}
                                onCheckedChange={(checked) => {
                                    setAiEnabled(checked)
                                    showToast(checked ? "Đã bật gợi ý phim bằng AI!" : "Đã tắt gợi ý AI.")
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Change Password */}
                <div className="lg:col-span-4">
                    <div className="sticky top-28 rounded-2xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <div className="flex items-center gap-2 border-b border-[#1f2c3d] pb-4">
                            <Lock className="size-5 text-[#caef6b]" />
                            <h2 className="text-base font-bold text-white">Đổi mật khẩu</h2>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="curr-pass">Mật khẩu hiện tại</Label>
                                <div className="relative">
                                    <Input
                                        id="curr-pass"
                                        type={showCurrentPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-2.5 text-[#9ba9ba] hover:text-white"
                                    >
                                        {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-pass">Mật khẩu mới</Label>
                                <div className="relative">
                                    <Input
                                        id="new-pass"
                                        type={showNewPassword ? "text" : "password"}
                                        placeholder="Tối thiểu 8 ký tự"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-2.5 text-[#9ba9ba] hover:text-white"
                                    >
                                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-pass">Xác nhận mật khẩu mới</Label>
                                <Input
                                    id="confirm-pass"
                                    type="password"
                                    placeholder="Nhập lại mật khẩu mới"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isUpdatingPassword}
                                className="w-full rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                            >
                                {isUpdatingPassword && <Loader2 className="size-4 animate-spin" />}
                                {isUpdatingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
