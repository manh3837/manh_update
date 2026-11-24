import { Sparkles, Lightbulb } from "lucide-react"
import type { RiskyShowtimeItem } from "@/services/ai.service"

interface ForecastRiskyTabProps {
    riskyShowtimes?: RiskyShowtimeItem[]
}

export const ForecastRiskyTab = ({ riskyShowtimes }: ForecastRiskyTabProps) => {
    if (!riskyShowtimes || riskyShowtimes.length === 0) {
        return (
            <div className="rounded-xl border border-[#233821] bg-[#0c160e] p-6 text-center text-xs text-[#8ca490]">
                <Sparkles className="mx-auto size-6 text-[#caef6b] mb-2" />
                Tất cả suất chiếu trong 24h tới đều có tỷ lệ đặt chỗ khả quan (≥ 20%). Không có cảnh báo nguy cơ ế!
            </div>
        )
    }

    return (
        <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {riskyShowtimes.map((item) => (
                <div
                    key={`${item.showtimeId}-${item.time}`}
                    className="rounded-xl border border-[#2a3c25] bg-[#0c160e] p-3 text-xs space-y-1.5 hover:border-[#385232] transition-colors"
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-bold text-white">
                            <span className="size-2 rounded-full bg-[#f59e0b]" />
                            <span>{item.movie}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-[#8ca490]">{item.time}</span>
                            <span className="rounded bg-[#f59e0b]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#f59e0b]">
                                Lấp đầy: {item.fillRate}%
                            </span>
                        </div>
                    </div>
                    <div className="rounded-lg bg-[#142316] px-2.5 py-1.5 text-[11px] text-[#caef6b] flex items-start gap-1.5">
                        <Lightbulb className="size-3.5 shrink-0 mt-0.5" />
                        <span className="leading-tight">{item.suggestion}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}
