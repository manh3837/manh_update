import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/common/FavoriteButton"
import { NOW_SHOWING_MOVIES, COMING_SOON_MOVIES } from "@/constants"
import { useFavorites } from "@/hooks/useFavorites"
import type { MainLayoutContextType } from "@/layouts/MainLayout"
import type { Movie } from "@/types"

export const MoviesPage = () => {
  const navigate = useNavigate()
  const { showToast } = useOutletContext<MainLayoutContextType>()
  const { isFavorite, toggle, isToggling } = useFavorites()

  const handleToggleFavorite = async (movie: Movie) => {
    const res = await toggle(movie.id)
    if (res.ok) {
      showToast(
        res.favorited
          ? `Đã lưu "${movie.title}" vào phim yêu thích!`
          : `Đã bỏ "${movie.title}" khỏi phim yêu thích.`
      )
      return
    }
    if (res.reason === "login") {
      showToast("Vui lòng đăng nhập để lưu phim yêu thích!")
      navigate("/login")
      return
    }
    showToast(res.message || "Không thể cập nhật phim yêu thích. Vui lòng thử lại!")
  }

  const getRatingStyle = (rating: string) => {
    switch (rating) {
      case "T18": return "border-[#682424] bg-[#2d1515] text-[#ff8e8e]"
      case "T16": return "border-[#5c3e1e] bg-[#2d1e10] text-[#ffbd7a]"
      case "T13": return "border-[#2d3e54] bg-[#1a2431] text-[#a4c8f5]"
      case "P":   return "border-[#2a3c25] bg-[#162518] text-[#caef6b]"
      default:    return "border-[#2d3e54] bg-[#1a2431] text-white"
    }
  }

  const MovieGrid = ({ movies, title }: { movies: typeof NOW_SHOWING_MOVIES; title: string }) => (
    <div className="mb-14">
      <div className="flex items-center justify-between border-b border-[#1f2c3d]/60 pb-5 mb-8">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-6">
        {movies.map((movie) => (
          <div
            key={movie.id}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-transparent bg-[#0e141d] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#2f4057] hover:shadow-xl"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#16202c]">
              <Link to={`/movies/${movie.id}`} aria-label={`Xem chi tiết ${movie.title}`}>
                <img
                  src={movie.poster}
                  alt={movie.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090d14] via-transparent to-transparent opacity-60" />
              </Link>
              <div className="absolute left-2.5 top-2.5">
                <Badge className={`px-1.5 py-0.5 text-[10px] font-bold uppercase border rounded ${getRatingStyle(movie.rating)}`}>
                  {movie.rating}
                </Badge>
              </div>
              {movie.status === "coming_soon" && (
                <div className="absolute right-2.5 top-2.5">
                  <span className="rounded border border-[#2a3c25] bg-[#162518] px-1.5 py-0.5 text-[9px] font-bold text-[#caef6b]">
                    Sắp chiếu
                  </span>
                </div>
              )}

              {/* Nút yêu thích phim (nằm ngoài thẻ Link để không lồng button trong anchor) */}
              <div className="absolute bottom-2.5 right-2.5">
                <FavoriteButton
                  active={isFavorite(movie.id)}
                  disabled={isToggling}
                  onClick={() => void handleToggleFavorite(movie)}
                  className="shadow-lg"
                />
              </div>
            </div>
            <Link
              to={`/movies/${movie.id}`}
              className="flex flex-1 flex-col justify-between pt-3 pb-2 px-1"
            >
              <div>
                <h3 className="line-clamp-1 text-sm font-semibold text-white transition-colors group-hover:text-[#caef6b]">
                  {movie.title}
                </h3>
                <p className="mt-1 line-clamp-1 text-[11px] text-[#9ba9ba]">
                  {movie.genre} · {movie.duration}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#1f2c3d]/40 pt-2 text-[11px] font-semibold text-[#caef6b]">
                <span>{movie.status === "coming_soon" ? "Nhắc tôi" : "Đặt vé ngay"}</span>
                <ArrowUpRight className="size-3" />
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-12 lg:px-12">
      <div className="mb-10">
        <nav className="flex items-center gap-2 text-xs text-[#9ba9ba] mb-4">
          <Link to="/" className="hover:text-[#caef6b] transition-colors">Trang chủ</Link>
          <span>/</span>
          <span className="text-white">Phim</span>
        </nav>
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          Tất cả phim
        </h1>
        <p className="mt-2 text-sm text-[#9ba9ba]">
          Khám phá toàn bộ danh mục phim đang chiếu và sắp ra mắt tại Cinema Management.
        </p>
      </div>

      <MovieGrid movies={NOW_SHOWING_MOVIES} title="Đang chiếu" />
      <MovieGrid movies={COMING_SOON_MOVIES} title="Sắp chạm màn ảnh" />
    </div>
  )
}
