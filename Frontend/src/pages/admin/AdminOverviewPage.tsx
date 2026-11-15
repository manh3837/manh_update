import { useState } from "react"
import { Link } from "react-router-dom"
import {
    TrendingUp,
    Calendar,
    Sparkles,
    Download,
    ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AutoScheduleModal } from "@/components/admin/AutoScheduleModal"
import { AIForecastCard } from "@/components/admin/AIForecastCard"
import { showtimeService } from "@/services/showtime.service"
import { formatISOToVN } from "@/constants/adminSchedule"

interface LastAppliedInfo {
    date: string
    count: number
}

export const AdminOverviewPage = () => {
    const [selectedRange] = useState("Hôm nay (24/10/2026)")
    const [isAIModalOpen, setIsAIModalOpen] = useState(false)
    const [lastApplied, setLastApplied] = useState<LastAppliedInfo | null>(null)

    const revenueBars = [
        { day: "T2", value: 85, label: "85M" },
        { day: "T3", value: 92, label: "92M" },
        { day: "T4", value: 104, label: "104M" },
        { day: "T5", value: 110, label: "110M" },
        { day: "T6", value: 125, label: "125M" },
        { day: "T7", value: 138.7, label: "138.7M", isToday: true },
        { day: "CN", value: 145, label: "145M (Dự kiến)" },
    ]

    const topMovies = [
        { title: "Tín hiệu từ ngày mai", revenue: "54.200.000 đ", tickets: "482 vé", fillRate: "88%" },
        { title: "Chuyến tàu bình minh", revenue: "32.100.000 đ", tickets: "310 vé", fillRate: "72%" },
        { title: "Thành phố không ngủ", revenue: "28.600.000 đ", tickets: "245 vé", fillRate: "65%" },
        { title: "Qua miền ký ức", revenue: "23.820.000 đ", tickets: "247 vé", fillRate: "60%" },
    ]

    return (
        <div className="space-y-8">
            {/* 1. Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                        BẢNG ĐIỀU KHIỂN RẠP
                    </span>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
                        Một góc nhìn. Toàn bộ rạp.
                    </h1>
                    <p className="mt-1 text-xs text-[#9ba9ba]">
                        Cập nhật tức thời doanh thu, lượng khách, suất chiếu và gợi ý vận hành từ AI.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-[#243041] bg-[#121923] px-3.5 py-2 text-xs text-white">
                        <Calendar className="size-3.5 text-[#caef6b]" />
                        <span>{selectedRange}</span>
                    </div>

                    <Button
                        onClick={() => alert("Đang xuất báo cáo định dạng Excel / PDF...")}
                        className="rounded-xl bg-[#caef6b] px-4 py-2 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                    >
                        <Download className="mr-1.5 size-3.5" />
                        Xuất báo cáo
                    </Button>
                </div>
            </div>

            {/* 2. Top Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Doanh thu */}
                <div className="rounded-2xl border border-[#2a3c25] bg-[#121f15] p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#9ba9ba]">Doanh thu hôm nay</span>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#caef6b]">
                            <TrendingUp className="size-3" /> +12.5%
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">138.720.000 đ</div>
                    <div className="mt-1 text-[11px] text-[#9ba9ba]">So với 123.300.000 đ hôm qua</div>
                </div>

                {/* Vé đã bán */}
                <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#9ba9ba]">Vé đã bán</span>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#caef6b]">
                            <TrendingUp className="size-3" /> +8.3%
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">1.284</div>
                    <div className="mt-1 text-[11px] text-[#9ba9ba]">1.185 vé tại quầy & online</div>
                </div>

                {/* Tỷ lệ lấp đầy */}
                <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#9ba9ba]">Tỷ lệ lấp đầy ghế</span>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#caef6b]">
                            <TrendingUp className="size-3" /> +4.2%
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">68,5%</div>
                    <div className="mt-1 text-[11px] text-[#9ba9ba]">Giờ cao điểm đạt 92%</div>
                </div>

                {/* Suất chiếu */}
                <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#9ba9ba]">Suất chiếu hôm nay</span>
                        <span className="rounded border border-[#2a3c25] bg-[#162518] px-2 py-0.5 text-[9px] font-bold text-[#caef6b]">
                            Ổn định
                        </span>
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">126</div>
                    <div className="mt-1 text-[11px] text-[#9ba9ba]">6 phòng chiếu hoạt động</div>
                </div>
            </div>

            {/* 2.5. Quick action: AI xếp lịch tự động */}
            <div className="relative overflow-hidden rounded-3xl border border-[#2a3c25] bg-gradient-to-r from-[#121f15] via-[#0f1a12] to-[#121923] p-5 shadow-xl sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#caef6b]/15 text-[#caef6b]">
                            <Sparkles className="size-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">AI Xếp lịch tự động</h3>
                            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#9ba9ba]">
                                Chọn ngày, phim và phòng chiếu — Gemini sẽ phân bổ suất theo khung giờ vàng,
                                tránh trùng lịch và chừa thời gian dọn phòng.
                            </p>
                            {lastApplied && (
                                <p className="mt-2 text-[11px] font-semibold text-[#caef6b]">
                                    Đã thêm {lastApplied.count} suất cho{" "}
                                    {formatISOToVN(lastApplied.date)} ·{" "}
                                    <Link to="/admin/showtimes" className="underline underline-offset-2">
                                        Xem lịch chiếu
                                    </Link>
                                </p>
                            )}
                        </div>
                    </div>

                    <Button
                        onClick={() => setIsAIModalOpen(true)}
                        className="shrink-0 rounded-xl bg-[#caef6b] px-4 py-2.5 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                    >
                        <Sparkles className="mr-1.5 size-4" />
                        Mở AI xếp lịch
                        <ArrowRight className="ml-1.5 size-3.5" />
                    </Button>
                </div>
            </div>

            {/* 3. Middle Section: Revenue Chart + Top Movies */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Revenue Bar Chart */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-7">
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <div>
                            <h3 className="text-base font-bold text-white">Doanh thu theo ngày</h3>
                            <p className="text-xs text-[#9ba9ba]">Tuần hiện tại (19/10 - 25/10/2026)</p>
                        </div>
                        <span className="rounded-lg border border-[#2a3c25] bg-[#162518] px-2.5 py-1 text-xs font-bold text-[#caef6b]">
                            +15.8% TB tuần
                        </span>
                    </div>

                    {/* Bar Chart Container */}
                    <div className="mt-8 flex h-56 items-end justify-between gap-3 px-2 sm:px-6">
                        {revenueBars.map((item) => {
                            const heightPercent = (item.value / 150) * 100
                            return (
                                <div key={item.day} className="flex flex-1 flex-col items-center gap-2 group">
                                    <span className="text-[10px] font-bold text-[#9ba9ba] opacity-0 group-hover:opacity-100 transition-opacity">
                                        {item.label}
                                    </span>
                                    <div className="w-full max-w-[42px] rounded-t-xl bg-[#1a2431] p-1 flex items-end h-44">
                                        <div
                                            style={{ height: `${heightPercent}%` }}
                                            className={`w-full rounded-t-lg transition-all duration-500 ${item.isToday
                                                    ? "bg-[#caef6b] shadow-[0_0_15px_rgba(202,239,107,0.4)]"
                                                    : "bg-[#25364b] group-hover:bg-[#344d6b]"
                                                }`}
                                        />
                                    </div>
                                    <span
                                        className={`text-xs font-bold ${item.isToday ? "text-[#caef6b]" : "text-[#9ba9ba]"
                                            }`}
                                    >
                                        {item.day}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Top Movies by Revenue */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-5">
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <h3 className="text-base font-bold text-white">Phim có doanh thu cao</h3>
                        <span className="text-xs text-[#9ba9ba]">Hôm nay</span>
                    </div>

                    <div className="mt-4 space-y-4">
                        {topMovies.map((movie, idx) => (
                            <div
                                key={movie.title}
                                className="flex items-center justify-between rounded-xl border border-[#1f2c3d] bg-[#0e141d] p-3 text-xs"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex size-6 items-center justify-center rounded-lg bg-[#1a2431] font-bold text-[#caef6b] text-xs">
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <div className="font-bold text-white">{movie.title}</div>
                                        <div className="text-[11px] text-[#9ba9ba]">
                                            {movie.tickets} · Tỷ lệ lấp đầy: {movie.fillRate}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-[#caef6b]">{movie.revenue}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Bottom Section: AI Forecast + Operational Health */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* AI Revenue Forecast Card */}
                <AIForecastCard />

                {/* Operational Health Card */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-5">
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <h3 className="text-base font-bold text-white">Sức khỏe vận hành</h3>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#caef6b]">
                            <span className="size-2 rounded-full bg-[#caef6b] animate-ping" /> Tốt
                        </span>
                    </div>

                    <div className="mt-4 space-y-3 text-xs">
                        <div className="flex justify-between">
                            <span className="text-[#9ba9ba]">Phòng chiếu hoạt động</span>
                            <span className="font-bold text-white">6 / 6 phòng (100%)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#9ba9ba]">Suất chiếu trễ / Sự cố</span>
                            <span className="font-bold text-[#caef6b]">0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#9ba9ba]">Máy chiếu & Hệ thống âm thanh</span>
                            <span className="font-bold text-[#caef6b]">Dolby Atmos bình thường</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal AI xếp lịch — ghi thẳng vào database */}
            {isAIModalOpen && (
                <AutoScheduleModal
                    onClose={() => setIsAIModalOpen(false)}
                    onApply={async (result, aiDate) => {
                        const res = await showtimeService.bulkCreate(
                            aiDate,
                            result.schedule.map((slot) => ({
                                movieId: slot.movieId,
                                roomId: slot.roomId,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                            }))
                        )
                        return { success: res.success, message: res.message }
                    }}
                    onApplied={(aiDate, result) =>
                        setLastApplied({ date: aiDate, count: result.schedule.length })
                    }
                />
            )}
        </div>
    )
}
