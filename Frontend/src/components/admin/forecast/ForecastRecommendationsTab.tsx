import { Film, Gift, BadgePercent, Lightbulb } from "lucide-react"
import type { RecommendationItem } from "@/services/ai.service"

interface ForecastRecommendationsTabProps {
    recommendations?: RecommendationItem[]
}

export const ForecastRecommendationsTab = ({
    recommendations,
}: ForecastRecommendationsTabProps) => {
    if (!recommendations || recommendations.length === 0) {
        return (
            <div className="rounded-xl border border-[#233821] bg-[#0c160e] p-6 text-center text-xs text-[#8ca490]">
                Chưa có khuyến nghị mới cho ngày này.
            </div>
        )
    }

    const renderIcon = (type: RecommendationItem["type"]) => {
        switch (type) {
            case "add_showtime":
                return <Film className="size-4 text-[#38bdf8]" />
            case "promotion":
                return <Gift className="size-4 text-[#f472b6]" />
            case "pricing":
                return <BadgePercent className="size-4 text-[#caef6b]" />
            default:
                return <Lightbulb className="size-4 text-[#caef6b]" />
        }
    }

    const renderLabel = (type: RecommendationItem["type"]) => {
        switch (type) {
            case "add_showtime":
                return "Tối ưu suất chiếu"
            case "promotion":
                return "Khuyến mãi & Kích cầu"
            case "pricing":
                return "Chính sách giá"
            default:
                return "Chiến lược"
        }
    }

    return (
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {recommendations.map((rec, idx) => (
                <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-[#2a3c25] bg-[#0c160e] p-3 text-xs hover:border-[#385232] transition-colors"
                >
                    <div className="mt-0.5 rounded-lg bg-[#1a2c1d] p-1.5 shrink-0">
                        {renderIcon(rec.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#caef6b]">
                            {renderLabel(rec.type)}
                        </span>
                        <p className="text-white leading-relaxed text-[11px]">{rec.text}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
