import { useState, useEffect, useCallback } from "react"
import {
    Sparkles,
    TrendingUp,
    RotateCw,
    AlertTriangle,
    Lightbulb,
    AlertCircle,
    Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { aiService, type ForecastInsightsResponse } from "@/services/ai.service"
import { ForecastOverviewTab } from "./forecast/ForecastOverviewTab"
import { ForecastRiskyTab } from "./forecast/ForecastRiskyTab"
import { ForecastRecommendationsTab } from "./forecast/ForecastRecommendationsTab"

const DEMO_DATE = "2026-10-24"

function getTodayStr(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())
}

export const AIForecastCard = () => {
    const [selectedDate, setSelectedDate] = useState<string>(getTodayStr())
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<ForecastInsightsResponse | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [activeTab, setActiveTab] = useState<"overview" | "risky" | "recommendations">("overview")

    const fetchForecast = useCallback(
        async (dateToFetch: string, isForceRefresh = false) => {
            if (isForceRefresh) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            try {
                const res = await aiService.getForecastInsights({
                    date: dateToFetch,
                    forceRefresh: isForceRefresh,
                })

                if (!res.success) {
                    throw new Error(res.message || res.error || "Không thể tải dự báo doanh thu từ AI.")
                }

                setData(res)
                setLastUpdated(new Date())
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Đã xảy ra lỗi khi gọi AI dự báo."
                setError(message)
            } finally {
                setLoading(false)
                setRefreshing(false)
            }
        },
        []
    )

    useEffect(() => {
        fetchForecast(selectedDate, false)
    }, [selectedDate, fetchForecast])

    const handleRefresh = () => {
        fetchForecast(selectedDate, true)
    }

    const toggleDemoDate = () => {
        const today = getTodayStr()
        const nextDate = selectedDate === today ? DEMO_DATE : today
        setSelectedDate(nextDate)
    }

    return (
        <div className="rounded-3xl border border-[#2a3c25] bg-[#121f15] p-6 shadow-xl lg:col-span-7 transition-all duration-300">
            {/* Header: Title, Badges & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f3020] pb-4">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#caef6b]">
                        <Sparkles className="size-4" />
                        <span>DỰ ĐOÁN DOANH THU TỪ AI</span>
                    </div>

                    {!loading && data && (
                        <Badge
                            className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                data.source === "ai"
                                    ? "bg-[#1f3a1a] text-[#caef6b] border-[#2f5522]"
                                    : "bg-[#332211] text-[#f59e0b] border-[#553311]"
                            }`}
                        >
                            {data.source === "ai" ? "AI Gemini" : "Ước tính (fallback)"}
                        </Badge>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={toggleDemoDate}
                        disabled={loading || refreshing}
                        className="flex items-center gap-1.5 rounded-lg border border-[#2a3c25] bg-[#0c160e] px-2.5 py-1 text-[11px] font-semibold text-[#caef6b] hover:bg-[#162719] disabled:opacity-50 transition-colors"
                        title="Chuyển đổi giữa Hôm nay và Ngày mẫu có dữ liệu"
                    >
                        <Calendar className="size-3 text-[#caef6b]" />
                        <span>
                            {selectedDate === getTodayStr() ? "Hôm nay" : `Demo: ${selectedDate}`}
                        </span>
                    </button>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className="h-7 rounded-lg border border-[#2a3c25] bg-[#0c160e] px-2.5 text-[11px] font-bold text-white hover:bg-[#162719] hover:text-[#caef6b] disabled:opacity-50"
                        title="Làm mới phân tích AI (bỏ cache)"
                    >
                        <RotateCw
                            className={`mr-1 size-3 text-[#caef6b] ${
                                refreshing ? "animate-spin" : ""
                            }`}
                        />
                        <span>{refreshing ? "Đang phân tích..." : "Làm mới"}</span>
                    </Button>

                    {lastUpdated && (
                        <span className="text-[10px] text-[#7d9380] hidden sm:inline-block">
                            Cập nhật: {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                    )}
                </div>
            </div>

            {/* Skeleton Loading State */}
            {loading ? (
                <div className="mt-4 space-y-4 animate-pulse">
                    <div className="flex items-baseline gap-4">
                        <div className="h-9 w-48 rounded-lg bg-[#1a2c1d]" />
                        <div className="h-5 w-32 rounded bg-[#1a2c1d]" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 w-full rounded bg-[#1a2c1d]" />
                        <div className="h-4 w-5/6 rounded bg-[#1a2c1d]" />
                    </div>
                    <div className="h-8 w-64 rounded-lg bg-[#1a2c1d]" />
                    <div className="h-24 w-full rounded-2xl bg-[#1a2c1d]" />
                </div>
            ) : error ? (
                /* Error State */
                <div className="mt-4 rounded-2xl border border-red-900/50 bg-red-950/20 p-5 text-xs text-red-200">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 shrink-0 text-red-400 mt-0.5" />
                        <div className="flex-1 space-y-1">
                            <div className="font-bold text-red-300">Không thể phân tích dữ liệu AI</div>
                            <p className="text-[11px] text-red-200/80 leading-relaxed">{error}</p>
                            <div className="pt-2">
                                <Button
                                    size="sm"
                                    onClick={handleRefresh}
                                    className="h-7 rounded-lg bg-red-600 px-3 text-[11px] font-bold text-white hover:bg-red-500"
                                >
                                    <RotateCw className="mr-1.5 size-3" />
                                    Thử lại
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : data ? (
                /* Data Loaded State */
                <div className="mt-4 space-y-4">
                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 border-b border-[#1f3020] pb-2 text-xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab("overview")}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-colors ${
                                activeTab === "overview"
                                    ? "bg-[#1e3421] text-[#caef6b]"
                                    : "text-[#9ba9ba] hover:text-white"
                            }`}
                        >
                            <TrendingUp className="size-3.5" />
                            <span>Dự báo & Tóm tắt</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("risky")}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-colors ${
                                activeTab === "risky"
                                    ? "bg-[#1e3421] text-[#caef6b]"
                                    : "text-[#9ba9ba] hover:text-white"
                            }`}
                        >
                            <AlertTriangle className="size-3.5" />
                            <span>Suất nguy cơ ế</span>
                            {data.riskyShowtimes && data.riskyShowtimes.length > 0 && (
                                <span className="ml-1 rounded-full bg-[#f59e0b]/20 px-1.5 py-0.2 text-[10px] font-black text-[#f59e0b]">
                                    {data.riskyShowtimes.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("recommendations")}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-colors ${
                                activeTab === "recommendations"
                                    ? "bg-[#1e3421] text-[#caef6b]"
                                    : "text-[#9ba9ba] hover:text-white"
                            }`}
                        >
                            <Lightbulb className="size-3.5" />
                            <span>Khuyến nghị hành động</span>
                            {data.recommendations && data.recommendations.length > 0 && (
                                <span className="ml-1 rounded-full bg-[#caef6b]/20 px-1.5 py-0.2 text-[10px] font-black text-[#caef6b]">
                                    {data.recommendations.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Tab Contents */}
                    {activeTab === "overview" && (
                        <ForecastOverviewTab
                            forecast={data.forecast}
                            executiveSummary={data.executiveSummary}
                        />
                    )}

                    {activeTab === "risky" && (
                        <ForecastRiskyTab riskyShowtimes={data.riskyShowtimes} />
                    )}

                    {activeTab === "recommendations" && (
                        <ForecastRecommendationsTab
                            recommendations={data.recommendations}
                        />
                    )}
                </div>
            ) : null}
        </div>
    )
}
