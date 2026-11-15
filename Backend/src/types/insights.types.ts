export interface ForecastInsightsInput {
  date?: string; // YYYY-MM-DD
  forceRefresh?: boolean;
}

export interface DailySalesPoint {
  date: string;
  dayOfWeek: string;
  ticketsSold: number;
  revenue: number;
}

export interface MovieTodayStat {
  movieId: number;
  title: string;
  genre: string;
  revenue: number;
  ticketsSold: number;
  totalSeats: number;
  fillRate: number; // Tỷ lệ lấp đầy (%)
}

export interface GenreTrend {
  genre: string;
  recentRevenue: number;
  previousRevenue: number;
  growthPercent: number;
  isIncreasing: boolean;
}

export interface RiskyShowtimeItem {
  showtimeId: number;
  movie: string;
  time: string;
  fillRate: number; // Tỷ lệ lấp đầy (%)
  suggestion: string;
}

export interface RecommendationItem {
  type: "add_showtime" | "promotion" | "pricing";
  text: string;
}

export interface ForecastData {
  tomorrowRevenue: number;
  weekRevenue: number;
  growthPercent: number;
}

export interface ForecastInsightsData {
  source: "ai" | "fallback";
  forecast: ForecastData;
  riskyShowtimes: RiskyShowtimeItem[];
  executiveSummary: string;
  recommendations: RecommendationItem[];
}

export interface RawInsightsMetrics {
  targetDate: string;
  todayRevenue: number;
  yesterdayRevenue: number;
  avg7DaysRevenue: number;
  revenueChangePercent: number;
  moviesToday: MovieTodayStat[];
  genreTrends: GenreTrend[];
  sales14Days: DailySalesPoint[];
  riskyShowtimes: RiskyShowtimeItem[];
}
