import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
    Sparkles,
    Send,
    RotateCw,
    Film,
    Compass,
    Bot,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { NOW_SHOWING_MOVIES } from "@/constants"
import { aiService } from "@/services/ai.service"
import type { Movie } from "@/types"

interface ChatMessage {
    id: string
    sender: "user" | "ai"
    text: string
    recommendations?: Movie[]
}

export const AIPage = () => {
    const navigate = useNavigate()
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Preference filters
    const [selectedGenre, setSelectedGenre] = useState("Khoa học viễn tưởng")
    const [selectedMood, setSelectedMood] = useState("Cảm xúc lắng đọng")
    const [selectedCinema, setSelectedCinema] = useState("Cinema Nguyễn Du")
    const [selectedTimeRange, setSelectedTimeRange] = useState("Buổi tối (19:00 - 22:00)")

    // Chat conversation
    const [inputMessage, setInputMessage] = useState("")
    const [isThinking, setIsThinking] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "m1",
            sender: "user",
            text: "Mình đi xem cùng bạn nữ vào tối cuối tuần, muốn xem phim nhẹ nhàng hoặc kịch tính một chút nhưng không kinh dị. Từ 19h trở đi, có rạp Cinema Nguyễn Du không?",
        },
        {
            id: "m2",
            sender: "ai",
            text: "Chào bạn! Với buổi hẹn cuối tuần tại Cinema Nguyễn Du, mình gợi ý bạn 3 bộ phim giàu cảm xúc và mãn nhãn, rất thích hợp xem cùng bạn nữ:",
            recommendations: [
                NOW_SHOWING_MOVIES[0], // Tín hiệu từ ngày mai
                NOW_SHOWING_MOVIES[1], // Qua miền ký ức
                NOW_SHOWING_MOVIES[2], // Chuyến tàu bình minh
            ],
        },
    ])

    // Tự động cuộn xuống tin nhắn mới nhất
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isThinking])

    // Tìm movie object từ danh sách chuẩn kèm poster fallback
    const resolveMovieItem = (rec: any): Movie => {
        const found = NOW_SHOWING_MOVIES.find(
            (m) =>
                m.id === String(rec.id) ||
                m.title.toLowerCase() === String(rec.title).toLowerCase()
        )
        if (found) return found

        return {
            id: String(rec.id || "1"),
            title: rec.title || "Phim đang chiếu",
            rating: rec.rating || "T13",
            genre: rec.genre || "Điện ảnh",
            duration: rec.duration || "110 phút",
            poster: rec.posterUrl || NOW_SHOWING_MOVIES[0].poster,
            synopsis: rec.synopsis || "Phim chiếu rạp chuẩn âm thanh Dolby Atmos đỉnh cao.",
            status: "now_showing",
            aiRecommendation: rec.synopsis,
        }
    }

    const handleSendMessage = async (textToSend?: string) => {
        const text = (textToSend || inputMessage).trim()
        if (!text || isThinking) return

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: "user",
            text,
        }

        setMessages((prev) => [...prev, userMsg])
        setInputMessage("")
        setIsThinking(true)

        try {
            // Gọi trực tiếp Gemini AI API thông qua Backend
            const res = await aiService.chatWithAI(text)

            let recMovies: Movie[] = []

            if (res.recommendedMovies && res.recommendedMovies.length > 0) {
                recMovies = res.recommendedMovies.map(resolveMovieItem)
            } else if (res.reply) {
                // Quét xem câu trả lời của AI có nhắc đến tên phim nào không
                const replyLower = res.reply.toLowerCase()
                recMovies = NOW_SHOWING_MOVIES.filter((m) =>
                    replyLower.includes(m.title.toLowerCase())
                )
            }

            // Nếu không quét được, lấy mặc định 2 phim hot nhất
            if (recMovies.length === 0) {
                recMovies = [NOW_SHOWING_MOVIES[0], NOW_SHOWING_MOVIES[3]]
            }

            const aiReply: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: "ai",
                text:
                    res.reply ||
                    `Dựa trên yêu cầu của bạn, Cinema Management đề xuất những bộ phim phù hợp nhất dưới đây tại ${selectedCinema}:`,
                recommendations: recMovies.slice(0, 3),
            }

            setMessages((prev) => [...prev, aiReply])
        } catch (err) {
            console.error("Lỗi khi trò chuyện với AI:", err)
            const fallbackReply: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: "ai",
                text: "Hiện tại hệ thống AI đang có lượng truy cập cao. Cinema Management đề xuất ngay cho bạn bộ phim ăn khách nhất hôm nay:",
                recommendations: [NOW_SHOWING_MOVIES[0]],
            }
            setMessages((prev) => [...prev, fallbackReply])
        } finally {
            setIsThinking(false)
        }
    }

    const handleGenerateRecommendation = () => {
        const prompt = `Gợi ý phim thể loại ${selectedGenre}, cảm xúc "${selectedMood}" tại ${selectedCinema} khung giờ ${selectedTimeRange}`
        handleSendMessage(prompt)
    }

    const handleClearChat = () => {
        setMessages([
            {
                id: "welcome",
                sender: "ai",
                text: `Xin chào! Tôi là trợ lý điện ảnh AI của Cinema Management. Hãy chia sẻ tâm trạng, dịp đi xem phim hoặc gu điện ảnh của bạn, tôi sẽ chọn ra bộ phim lý tưởng nhất tại ${selectedCinema}!`,
            },
        ])
    }

    return (
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
            {/* 1. Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                        Trợ lý điện ảnh thông minh
                    </span>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                        AI Tư Vấn & Gợi Ý Phim
                    </h1>
                    <p className="mt-2 text-sm text-[#9ba9ba]">
                        Khám phá bộ phim hoàn hảo theo tâm trạng, sở thích và bạn đồng hành cùng công nghệ Google Gemini.
                    </p>
                </div>

                <Button
                    variant="outline"
                    onClick={handleClearChat}
                    className="self-start rounded-xl border-[#243041] bg-[#121923] text-xs text-[#9ba9ba] hover:text-white"
                >
                    <RotateCw className="mr-1.5 size-3.5" />
                    Bắt đầu phiên mới
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Left Column: Preference Sidebar */}
                <div className="space-y-6 lg:col-span-4">
                    <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <div className="flex items-center gap-2 border-b border-[#1f2c3d] pb-4">
                            <Compass className="size-5 text-[#caef6b]" />
                            <h2 className="text-base font-bold text-white">Gu & Sở thích xem phim</h2>
                        </div>

                        <div className="mt-5 space-y-5">
                            {/* Genre preference */}
                            <div>
                                <label className="text-xs font-semibold text-[#9ba9ba] uppercase tracking-wider">
                                    Thể loại ưa thích
                                </label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {["Khoa học viễn tưởng", "Phiêu lưu", "Tình cảm", "Hành động"].map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setSelectedGenre(g)}
                                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                                                selectedGenre === g
                                                    ? "border border-[#caef6b] bg-[#caef6b]/15 text-[#caef6b]"
                                                    : "border border-[#243041] bg-[#1a2431] text-[#9ba9ba] hover:text-white"
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mood preference */}
                            <div>
                                <label className="text-xs font-semibold text-[#9ba9ba] uppercase tracking-wider">
                                    Cảm xúc mong muốn
                                </label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {[
                                        "Muốn thư giãn",
                                        "Cảm xúc lắng đọng",
                                        "Hồi hộp kịch tính",
                                        "Vui vẻ phấn khởi",
                                    ].map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => setSelectedMood(m)}
                                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                                                selectedMood === m
                                                    ? "border border-[#caef6b] bg-[#caef6b]/15 text-[#caef6b]"
                                                    : "border border-[#243041] bg-[#1a2431] text-[#9ba9ba] hover:text-white"
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cinema */}
                            <div>
                                <label className="text-xs font-semibold text-[#9ba9ba] uppercase tracking-wider">
                                    Rạp chiếu ưu tiên
                                </label>
                                <select
                                    value={selectedCinema}
                                    onChange={(e) => setSelectedCinema(e.target.value)}
                                    className="mt-2 flex h-10 w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2 text-sm text-[#f4f6f7] transition-all focus:border-[#caef6b] focus:outline-none"
                                >
                                    <option value="Cinema Nguyễn Du">Cinema Nguyễn Du (Quận 1)</option>
                                    <option value="Cinema Thảo Điền">Cinema Thảo Điền (TP. Thủ Đức)</option>
                                    <option value="Cinema Landmark 81">Cinema Landmark 81 (Bình Thạnh)</option>
                                    <option value="Cinema Ba Tháng Hai">Cinema Ba Tháng Hai (Quận 10)</option>
                                </select>
                            </div>

                            {/* Time */}
                            <div>
                                <label className="text-xs font-semibold text-[#9ba9ba] uppercase tracking-wider">
                                    Khung giờ dự kiến
                                </label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {[
                                        "Buổi tối (19:00 - 22:00)",
                                        "Chiều (14:00 - 18:00)",
                                        "Suất muộn (> 22:00)",
                                    ].map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setSelectedTimeRange(t)}
                                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                                                selectedTimeRange === t
                                                    ? "border border-[#caef6b] bg-[#caef6b]/15 text-[#caef6b]"
                                                    : "border border-[#243041] bg-[#1a2431] text-[#9ba9ba] hover:text-white"
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={handleGenerateRecommendation}
                                disabled={isThinking}
                                className="w-full rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-lg shadow-[#caef6b]/10"
                            >
                                <Sparkles className="mr-2 size-4" />
                                {isThinking ? "AI đang tư vấn..." : "Tạo gợi ý theo gu"}
                            </Button>
                        </div>
                    </div>

                    {/* AI Helper Tip Card */}
                    <div className="rounded-2xl border border-[#2a3c25] bg-[#121f15] p-5 text-xs text-[#9ba9ba]">
                        <div className="flex items-center gap-2 font-bold text-[#caef6b]">
                            <Bot className="size-4" />
                            <span>Mẹo hỏi AI hiệu quả</span>
                        </div>
                        <p className="mt-2 leading-relaxed">
                            Bạn có thể nhắn bất kỳ yêu cầu tự nhiên nào như: <em>"Mình thích phim du hành thời gian sâu lắng"</em>, <em>"Tối nay đi xem với người yêu phim gì hay?"</em> hoặc <em>"Có phim nào phòng IMAX không?"</em>.
                        </p>
                    </div>
                </div>

                {/* Right Column: Chat & Recommendation Area */}
                <div className="flex flex-col rounded-2xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-8">
                    {/* Chat Header Status */}
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <div className="flex items-center gap-2">
                            <span className="flex size-2 rounded-full bg-[#caef6b] animate-pulse" />
                            <span className="text-xs font-semibold text-[#9ba9ba]">
                                Gemini Cinema AI · Đang trực tuyến · {selectedCinema}
                            </span>
                        </div>
                        <Badge className="border-[#2a3c25] bg-[#162518] text-[#caef6b] text-[10px]">
                            Google GenAI Connected
                        </Badge>
                    </div>

                    {/* Messages Stream */}
                    <div className="flex-1 space-y-6 py-6 overflow-y-auto max-h-[600px] pr-2">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                            >
                                {msg.sender === "ai" && (
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#caef6b] text-[#090d14]">
                                        <Sparkles className="size-4" />
                                    </div>
                                )}

                                <div
                                    className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                                        msg.sender === "user"
                                            ? "bg-[#1a2838] text-white border border-[#2f4057]"
                                            : "bg-[#0e141d] text-[#f4f6f7] border border-[#1f2c3d]"
                                    }`}
                                >
                                    <p className="whitespace-pre-line">{msg.text}</p>

                                    {/* Recommendation Cards if attached */}
                                    {msg.recommendations && msg.recommendations.length > 0 && (
                                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                                            {msg.recommendations.map((rec) => (
                                                <div
                                                    key={rec.id}
                                                    className="flex flex-col justify-between overflow-hidden rounded-xl border border-[#243041] bg-[#121923] p-3 shadow-md hover:border-[#3b4e68] transition-all"
                                                >
                                                    <div>
                                                        <img
                                                            src={rec.poster}
                                                            alt={rec.title}
                                                            className="h-36 w-full rounded-lg object-cover"
                                                        />
                                                        <div className="mt-2.5 flex items-center justify-between">
                                                            <h4 className="line-clamp-1 text-xs font-bold text-white">
                                                                {rec.title}
                                                            </h4>
                                                            <Badge className="border-[#2a3c25] bg-[#162518] text-[#caef6b] text-[9px] px-1 py-0">
                                                                {rec.rating}
                                                            </Badge>
                                                        </div>
                                                        <div className="mt-1 text-[10px] text-[#caef6b] font-medium">
                                                            {rec.genre} · {rec.duration}
                                                        </div>
                                                        <p className="mt-1.5 line-clamp-2 text-[11px] text-[#9ba9ba] leading-tight">
                                                            {rec.aiRecommendation ||
                                                                rec.synopsis ||
                                                                "Phim chiếu rạp với công nghệ âm thanh Dolby Atmos."}
                                                        </p>
                                                    </div>

                                                    <Button
                                                        onClick={() =>
                                                            navigate(
                                                                `/booking/seats?movie=${encodeURIComponent(
                                                                    rec.title
                                                                )}&cinema=${encodeURIComponent(selectedCinema)}`
                                                            )
                                                        }
                                                        className="mt-3 w-full rounded-lg bg-[#caef6b] py-1.5 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                                                    >
                                                        <Film className="mr-1.5 size-3" />
                                                        Đặt vé ngay
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {msg.sender === "user" && (
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#1f2c3d] text-white font-bold text-xs">
                                        Bạn
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Thinking animation indicator */}
                        {isThinking && (
                            <div className="flex gap-3 justify-start">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#caef6b] text-[#090d14]">
                                    <Sparkles className="size-4 animate-spin" />
                                </div>
                                <div className="rounded-2xl border border-[#2a3c25] bg-[#121f15] p-4 text-xs text-[#caef6b] flex items-center gap-2">
                                    <span className="flex size-2 rounded-full bg-[#caef6b] animate-ping" />
                                    <span>AI đang phân tích sở thích và tìm phim phù hợp nhất...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Prompts */}
                    <div className="border-t border-[#1f2c3d] pt-4">
                        <div className="mb-2 text-[11px] font-semibold text-[#9ba9ba]">
                            Gợi ý câu hỏi nhanh:
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[
                                "Gợi ý phim tình cảm hẹn hò cho 2 người?",
                                "Có phim hành động kỹ xảo IMAX nào đỉnh?",
                                "Phim hoạt hình vui vẻ nhẹ nhàng?",
                                "Phim nào có âm thanh Dolby Atmos hay nhất?",
                            ].map((prompt) => (
                                <button
                                    key={prompt}
                                    disabled={isThinking}
                                    onClick={() => handleSendMessage(prompt)}
                                    className="rounded-full border border-[#243041] bg-[#0e141d] px-3 py-1 text-xs text-[#9ba9ba] hover:border-[#caef6b] hover:text-white transition-all disabled:opacity-50"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        {/* Input area */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                handleSendMessage()
                            }}
                            className="mt-4 flex items-center gap-2"
                        >
                            <Input
                                placeholder="Nhập yêu cầu của bạn (ví dụ: 'Tìm phim viễn tưởng du hành thời gian cho tối nay')..."
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                disabled={isThinking}
                                className="h-11 rounded-xl bg-[#0e141d] border-[#243041] text-xs sm:text-sm text-white"
                            />
                            <Button
                                type="submit"
                                disabled={isThinking || !inputMessage.trim()}
                                className="size-11 shrink-0 rounded-xl bg-[#caef6b] p-0 text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-50"
                            >
                                <Send className="size-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
