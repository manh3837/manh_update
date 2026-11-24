import { useState } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Film,
  CalendarClock,
  Armchair,
  Users,
  ChevronDown,
  Globe,
  LogOut,
  Bell,
  Menu,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CINEMAS } from "@/constants"

export const AdminLayout = () => {
  const location = useLocation()
  const [selectedCinema, setSelectedCinema] = useState(CINEMAS[0] || "Cinema Nguyễn Du")
  const [isCinemaDropdownOpen, setIsCinemaDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Lấy thông tin tài khoản hiện tại từ localStorage
  const savedUserStr = localStorage.getItem("user")
  let currentUser: { name?: string; email?: string; role?: string } | null = null
  try {
    currentUser = savedUserStr ? JSON.parse(savedUserStr) : null
  } catch {
    currentUser = null
  }

  const isSuperAdmin = currentUser?.role === "admin"
  const isManager = currentUser?.role === "manager"

  const navItems = [
    { name: "Tổng quan", path: "/admin", icon: LayoutDashboard },
    { name: "Quản lý phim", path: "/admin/movies", icon: Film },
    { name: "Suất chiếu", path: "/admin/showtimes", icon: CalendarClock },
    { name: "Phòng & giá vé", path: "/admin/rooms", icon: Armchair },
    ...(isSuperAdmin
      ? [{ name: "Tài khoản & vai trò", path: "/admin/users", icon: Users }]
      : []),
  ]

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  const adminName = currentUser?.name || (isManager ? "Quản lý rạp" : "Quản trị viên")
  const roleTitle = isSuperAdmin ? "Quản trị viên hệ thống" : isManager ? "Quản lý rạp" : "Nhân viên"
  const portalSubtitle = isSuperAdmin ? "PORTAL QUẢN TRỊ" : "PORTAL QUẢN LÝ"
  const adminInitials = adminName
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "AD"

  return (
    <div className="relative flex min-h-screen bg-black text-[#f4f6f7]">
      {/* Stellar Mist Ambient Background — cùng công thức với MainLayout */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 140% 50% at 15% 60%, rgba(124, 58, 237, 0.11), transparent 48%),
            radial-gradient(ellipse 90% 80% at 85% 25%, rgba(245, 101, 101, 0.09), transparent 58%),
            radial-gradient(ellipse 120% 65% at 40% 90%, rgba(34, 197, 94, 0.13), transparent 52%),
            radial-gradient(ellipse 100% 45% at 70% 5%, rgba(251, 191, 36, 0.07), transparent 42%),
            radial-gradient(ellipse 80% 75% at 90% 80%, rgba(168, 85, 247, 0.10), transparent 55%),
            #000000
          `,
        }}
      />
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* 1. Sidebar Navigation (Desktop + Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#1f2c3d] bg-[#0c121a]/95 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between border-b border-[#1f2c3d] px-6">
          <Link to="/" onClick={closeMobileMenu} className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg border-2 border-[#caef6b] bg-[#caef6b]/10">
              <div className="size-3 rounded-sm bg-[#caef6b]" />
            </div>
            <div>
              <div className="text-base font-black tracking-wider text-white">CINEMA</div>
              <div className="text-[9px] -mt-1 font-bold tracking-widest text-[#caef6b]">
                {portalSubtitle}
              </div>
            </div>
          </Link>
          <button
            onClick={closeMobileMenu}
            className="rounded-lg p-1 text-[#9ba9ba] hover:bg-[#1f2c3d] hover:text-white md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Current Cinema Selector */}
        <div className="relative border-b border-[#1f2c3d] p-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ba9ba]">
            Chi nhánh đang chọn
          </label>
          <button
            type="button"
            onClick={() => setIsCinemaDropdownOpen(!isCinemaDropdownOpen)}
            className="mt-1.5 flex w-full items-center justify-between rounded-xl border border-[#243041] bg-[#121923] px-3 py-2 text-xs text-white hover:border-[#384c66] transition-colors cursor-pointer"
          >
            <span className="font-semibold text-[#caef6b] truncate">{selectedCinema}</span>
            <ChevronDown
              className={`size-3.5 text-[#9ba9ba] transition-transform ${isCinemaDropdownOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          {/* Cinema Dropdown */}
          {isCinemaDropdownOpen && (
            <div className="absolute left-4 right-4 top-full z-50 mt-1 rounded-xl border border-[#243041] bg-[#121923] p-1.5 shadow-2xl backdrop-blur-xl">
              {CINEMAS.map((cinema) => (
                <button
                  key={cinema}
                  type="button"
                  onClick={() => {
                    setSelectedCinema(cinema)
                    setIsCinemaDropdownOpen(false)
                  }}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${selectedCinema === cinema
                    ? "bg-[#1f2c3d] font-bold text-[#caef6b]"
                    : "text-[#d3dce7] hover:bg-[#192331] hover:text-white"
                    }`}
                >
                  {cinema}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.path === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.path)
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${isActive
                  ? "border border-[#2a3c25] bg-[#152317] text-[#caef6b] shadow-sm"
                  : "text-[#9ba9ba] hover:bg-[#121923] hover:text-white"
                  }`}
              >
                <Icon className={`size-4 ${isActive ? "text-[#caef6b]" : "text-[#9ba9ba]"}`} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom Profile & Return to Website */}
        <div className="border-t border-[#1f2c3d] p-4 space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-[#1f2c3d] bg-[#121923] p-2.5">
            <Avatar className="size-8 border border-[#243041]">
              <AvatarFallback className="bg-[#1f2c3d] text-xs font-bold text-[#caef6b]">
                {adminInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-xs font-bold text-white">{adminName}</div>
              <div className="truncate text-[10px] text-[#caef6b]">{roleTitle}</div>
            </div>
          </div>

          <Link
            to="/homepage"
            onClick={closeMobileMenu}
            className="flex items-center gap-2 rounded-xl border border-[#243041] bg-[#090d14] px-3 py-2 text-xs font-semibold text-[#9ba9ba] hover:text-white transition-colors"
          >
            <Globe className="size-3.5 text-[#caef6b]" />
            <span>Về website khách hàng</span>
          </Link>

          <Link
            to="/login"
            onClick={() => {
              localStorage.removeItem("user")
              closeMobileMenu()
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-[#ff8e8e] hover:bg-[#201313] transition-colors"
          >
            <LogOut className="size-3.5" />
            <span>Đăng xuất</span>
          </Link>
        </div>
      </aside>

      {/* 2. Main Admin Content Area */}
      <div className="relative z-10 flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[#1f2c3d] bg-[#090d14]/90 px-4 sm:px-6 backdrop-blur-md">
          {/* Mobile hamburger menu & brand */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#121923] hover:text-white"
              aria-label="Mở menu quản trị"
            >
              <Menu className="size-5" />
            </button>
            <Link to="/admin" className="flex items-center gap-2">
              <div className="size-5 rounded bg-[#caef6b]" />
              <span className="font-bold text-white text-sm">CINEMA Admin</span>
            </Link>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[#9ba9ba]">
            <span>Hệ thống:</span>
            <span className="rounded-md border border-[#2a3c25] bg-[#162518] px-2 py-0.5 font-mono text-[11px] font-bold text-[#caef6b]">
              Online · 100% Sẵn sàng
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">

            <button
              aria-label="Thông báo quản trị"
              className="flex size-8 items-center justify-center rounded-xl border border-[#243041] bg-[#121923] text-[#9ba9ba] hover:text-white transition-colors cursor-pointer"
            >
              <Bell className="size-4" />
            </button>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
