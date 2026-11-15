import React, { useState, useRef, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Bell,
  Sparkles,
  ChevronDown,
  Heart,
  Ticket,
  User,
  LogIn,
  UserPlus,
  LayoutDashboard,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { NAV_LINKS } from "@/constants"

interface NavbarProps {
  onOpenAIModal?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAIModal }) => {
  const location = useLocation()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Đọc thông tin người dùng từ localStorage để xác định quyền
  const [currentUser, setCurrentUser] = useState<{
    name: string
    email: string
    role: "admin" | "manager" | "customer"
    points?: number
  } | null>(() => {
    try {
      const saved = localStorage.getItem("user")
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Tự động đồng bộ quyền người dùng khi chuyển trang hoặc đăng nhập/đăng xuất
  useEffect(() => {
    try {
      const saved = localStorage.getItem("user")
      setCurrentUser(saved ? JSON.parse(saved) : null)
    } catch {
      setCurrentUser(null)
    }
  }, [location.pathname])

  // Xử lý đăng xuất
  const handleLogout = () => {
    localStorage.removeItem("user")
    setCurrentUser(null)
    setIsAccountMenuOpen(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false)
      }
    }
    if (isAccountMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isAccountMenuOpen])

  // Close menu on route or hash change
  useEffect(() => {
    setIsAccountMenuOpen(false)
  }, [location.pathname, location.hash])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1f2c3d]/60 bg-[#090d14]/85 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 lg:px-12">
        {/* Brand Logo */}
        <Link to="/homepage" className="flex items-center gap-3 group">
          <div className="flex size-9 items-center justify-center rounded-lg border-2 border-[#caef6b] bg-[#caef6b]/10 transition-transform group-hover:scale-105">
            <div className="size-3.5 rounded-sm bg-[#caef6b]" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-wider text-white">
              Quản lý rạp chiếu phim
            </span>
            <span className="text-[10px] -mt-1 font-semibold tracking-widest text-[#9ba9ba]">
              CINEMA MANAGEMENT
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`relative py-1 text-sm font-medium transition-colors ${isActive
                  ? "text-[#caef6b] font-semibold"
                  : "text-[#9ba9ba] hover:text-white"
                  }`}
              >
                {link.name}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-2 h-0.5 rounded-full bg-[#caef6b]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Account & AI Action */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            onClick={onOpenAIModal}
            className="group relative flex items-center gap-2 rounded-full border border-[#2a3c25] bg-[#152317] px-4 py-2 text-xs font-semibold text-[#caef6b] shadow-sm hover:border-[#caef6b]/60 hover:bg-[#1c301f] hover:shadow-[0_0_15px_rgba(202,239,107,0.2)] transition-all cursor-pointer"
          >
            <Sparkles className="size-3.5 transition-transform group-hover:rotate-12" />
            <span>AI chọn phim</span>
          </Button>

          <button
            className="flex size-9 items-center justify-center rounded-full border border-[#243041] bg-[#121923] text-[#9ba9ba] transition-colors hover:border-[#caef6b]/40 hover:text-white cursor-pointer"
            aria-label="Thông báo"
          >
            <Bell className="size-4" />
          </button>

          {/* Account Dropdown Container */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="flex items-center gap-2.5 rounded-full border border-[#243041] bg-[#121923] p-1 pr-3 cursor-pointer hover:border-[#35465d] transition-all focus:outline-none focus:border-[#caef6b]"
              aria-expanded={isAccountMenuOpen}
              aria-label="Tài khoản cá nhân"
            >
              <Avatar className="size-7 border border-[#243041]">
                <AvatarFallback className="bg-[#1f2c3d] text-[11px] font-bold text-[#caef6b]">
                  {currentUser ? (
                    currentUser.name.trim().split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase() || "U"
                  ) : (
                    <User className="size-3.5 text-[#9ba9ba]" />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-medium text-white sm:inline-block">
                {currentUser ? currentUser.name : "Tài khoản"}
              </span>
              <ChevronDown
                className={`size-3 text-[#9ba9ba] transition-transform duration-200 ${isAccountMenuOpen ? "rotate-180 text-[#caef6b]" : ""
                  }`}
              />
            </button>

            {/* Dropdown Menu Modal */}
            {isAccountMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-[#243041] bg-[#121923] p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 z-[100]">
                {/* User Info Header */}
                <div className="border-b border-[#1f2c3d] px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-9 border border-[#243041]">
                      <AvatarFallback className="bg-[#1f2c3d] text-xs font-bold text-[#caef6b]">
                        {currentUser?.name ? (
                          currentUser.name.trim().split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase()
                        ) : (
                          <User className="size-4 text-[#9ba9ba]" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <div className="truncate text-xs font-bold text-white">
                        {currentUser ? currentUser.name : "Khách chưa đăng nhập"}
                      </div>
                      <div className="truncate text-[10px] text-[#caef6b] font-medium">
                        {currentUser
                          ? currentUser.role === "admin"
                            ? "Quản trị viên hệ thống"
                            : currentUser.role === "manager"
                            ? "Quản lý rạp"
                            : `Thành viên VIP · ${currentUser.points ?? 120} điểm`
                          : "Đăng nhập để xem vé & ưu đãi"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. KHI ĐÃ ĐĂNG NHẬP: Hiển thị Vé của tôi, Tài khoản, Admin (nếu có quyền), Đăng xuất */}
                {currentUser ? (
                  <>
                    <div className="py-1.5 space-y-0.5">
                      <Link
                        to="/my-tickets"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#d3dce7] hover:bg-[#1a2431] hover:text-[#caef6b] transition-colors"
                      >
                        <Ticket className="size-4 text-[#caef6b]" />
                        <span>Vé của tôi</span>
                      </Link>

                      <Link
                        to="/favorites"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#d3dce7] hover:bg-[#1a2431] hover:text-[#caef6b] transition-colors"
                      >
                        <Heart className="size-4 text-[#caef6b]" />
                        <span>Phim yêu thích</span>
                      </Link>

                      <Link
                        to="/account"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#d3dce7] hover:bg-[#1a2431] hover:text-[#caef6b] transition-colors"
                      >
                        <User className="size-4 text-[#caef6b]" />
                        <span>Tài khoản của tôi</span>
                      </Link>

                      {/* HIỂN THỊ TRANG QUẢN TRỊ / QUẢN LÝ KHI ROLE LÀ ADMIN HOẶC MANAGER */}
                      {(currentUser.role === "admin" || currentUser.role === "manager") && (
                        <Link
                          to="/admin"
                          onClick={() => setIsAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#caef6b] hover:bg-[#1a2431] hover:text-white transition-colors border border-[#2a3c25] bg-[#162518]"
                        >
                          <LayoutDashboard className="size-4 text-[#caef6b]" />
                          <span>
                            {currentUser.role === "admin"
                              ? "Trang quản trị (Admin)"
                              : "Bàn làm việc Quản lý"}
                          </span>
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-[#1f2c3d] pt-1.5 mt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#ff8e8e] hover:bg-[#201313] transition-colors text-left"
                      >
                        <LogOut className="size-4" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </>
                ) : (
                  /* 2. KHI CHƯA ĐĂNG NHẬP: Chỉ hiển thị nút Đăng nhập và Đăng ký */
                  <div className="pt-2 space-y-1">
                    <Link
                      to="/login"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#caef6b] px-3 py-2 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] transition-colors"
                    >
                      <LogIn className="size-4" />
                      <span>Đăng nhập</span>
                    </Link>

                    <Link
                      to="/register"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[#243041] bg-[#1a2431] px-3 py-2 text-xs font-semibold text-[#d3dce7] hover:bg-[#202c3d] hover:text-white transition-colors"
                    >
                      <UserPlus className="size-4 text-[#caef6b]" />
                      <span>Đăng ký tài khoản</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
