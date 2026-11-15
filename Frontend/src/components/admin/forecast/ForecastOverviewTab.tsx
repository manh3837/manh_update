import { TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react"
import type { ForecastData } from "@/services/ai.service"

interface ForecastOverviewTabProps {
    forecast?: ForecastData
    executiveSummary?: string
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " đ"
}

export const ForecastOverviewTab = ({ forecast, executiveSummary }: ForecastOverviewTabProps) => {
    const growth = forecast?.growthPercent || 0

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Doanh thu ngày mai */}
                <div className="rounded-2xl border border-[#233821] bg-[#0c160e] p-4">
                    <span className="text-[11px] font-semibold text-[#8ca490]">
                        Dự báo doanh thu ngày mai
                    </span>
                    <div className="mt-2 text-2xl font-black text-white">
                        {formatVND(forecast?.tomorrowRevenue || 0)}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-bold">
                        {growth >= 0 ? (
                            <span className="flex items-center gap-0.5 text-[#caef6b]">
                                <TrendingUp className="size-3" /> +{growth}%
                            </span>
                        ) : (
                            <span className="flex items-center gap-0.5 text-rose-400">
                                <TrendingDown className="size-3" /> {growth}%
                            </span>
                        )}
                        <span className="text-[10px] font-normal text-[#7d9380]">
                            so với trung bình kỳ
                        </span>
                    </div>
                </div>

                {/* Doanh thu 7 ngày tới */}
                <div className="rounded-2xl border border-[#233821] bg-[#0c160e] p-4">
                    <span className="text-[11px] font-semibold text-[#8ca490]">
                        Ước tính doanh thu 7 ngày tới
                    </span>
                    <div className="mt-2 text-2xl font-black text-[#caef6b]">
                        {formatVND(forecast?.weekRevenue || 0)}
                    </div>
                    <div className="mt-1 text-[10px] text-[#7d9380]">
                        Dựa trên hệ số nhu cầu theo thứ & thể loại phim
                    </div>
                </div>
            </div>

            {/* Executive Summary */}
            <div className="rounded-2xl border border-[#253d23] bg-[#0e1a10] p-4 text-xs">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#caef6b]">
                    <ArrowUpRight className="size-3.5" />
                    <span>Tóm tắt điều hành (Executive Summary)</span>
                </div>
                <p className="text-[#a5b9a7] leading-relaxed">
                    {executiveSummary || "Đang ghi nhận số liệu và dự báo doanh thu dựa trên phân tích chuyên sâu."}
                </p>
            </div>
        </div>
    )
}
