import { pool } from "../config/db.js";
import type { RowDataPacket } from "mysql2";
import {
  RawInsightsMetrics,
  DailySalesPoint,
  MovieTodayStat,
  GenreTrend,
  RiskyShowtimeItem,
} from "../types/insights.types.js";

const DAY_NAMES = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

export function getDayOfWeekName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

/** Chuyển YYYY-MM-DD thành Date object cục bộ (tránh lệch timezone) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format Date object thành YYYY-MM-DD */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Truy vấn và tổng hợp toàn bộ số liệu vận hành và doanh thu từ MySQL
 */
export async function getAggregatedInsightsMetrics(
  targetDate: string
): Promise<RawInsightsMetrics> {
  const target = parseLocalDate(targetDate);

  // 1. Tạo danh sách 14 ngày tính đến targetDate
  const dateList: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(target);
    d.setDate(d.getDate() - i);
    dateList.push(formatLocalDate(d));
  }
  const startDate = dateList[0];
  const yesterdayDate = dateList[12]; // ngày thứ 13 (index 12)

  // 2. Truy vấn doanh thu và số vé bán theo ngày trong 14 ngày
  const [salesRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       DATE_FORMAT(b.created_at, '%Y-%m-%d') AS sale_date,
       COALESCE(SUM(b.total_price), 0) AS revenue,
       COUNT(DISTINCT b.id) AS booking_count,
       COALESCE(SUM(seat_counts.count), COUNT(DISTINCT b.id)) AS tickets_sold
     FROM bookings b
     LEFT JOIN (
       SELECT booking_id, COUNT(*) AS count 
       FROM booking_seats 
       GROUP BY booking_id
     ) seat_counts ON seat_counts.booking_id = b.id
     WHERE b.payment_status = 'paid'
       AND DATE(b.created_at) BETWEEN ? AND ?
     GROUP BY DATE_FORMAT(b.created_at, '%Y-%m-%d')
     ORDER BY sale_date ASC`,
    [startDate, targetDate]
  );

  const salesMap = new Map<string, { revenue: number; ticketsSold: number }>();
  for (const row of salesRows) {
    salesMap.set(String(row.sale_date), {
      revenue: Number(row.revenue || 0),
      ticketsSold: Math.max(Number(row.tickets_sold || 0), Number(row.booking_count || 0)),
    });
  }

  // Lắp đầy 14 ngày (kể cả ngày không có đơn nào)
  const sales14Days: DailySalesPoint[] = dateList.map((dStr) => {
    const dObj = parseLocalDate(dStr);
    const data = salesMap.get(dStr) || { revenue: 0, ticketsSold: 0 };
    return {
      date: dStr,
      dayOfWeek: getDayOfWeekName(dObj),
      ticketsSold: data.ticketsSold,
      revenue: data.revenue,
    };
  });

  const todayData = salesMap.get(targetDate) || { revenue: 0, ticketsSold: 0 };
  const yesterdayData = salesMap.get(yesterdayDate) || { revenue: 0, ticketsSold: 0 };

  const todayRevenue = todayData.revenue;
  const yesterdayRevenue = yesterdayData.revenue;

  // Tính trung bình 7 ngày gần nhất (từ targetDate - 7 đến targetDate - 1)
  const past7Days = dateList.slice(6, 13);
  const sum7Days = past7Days.reduce(
    (acc, d) => acc + (salesMap.get(d)?.revenue || 0),
    0
  );
  const avg7DaysRevenue = Math.round(sum7Days / 7);

  // Tính % thay đổi hôm nay so với hôm qua
  let revenueChangePercent = 0;
  if (yesterdayRevenue > 0) {
    revenueChangePercent =
      Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 1000) / 10;
  } else if (todayRevenue > 0) {
    revenueChangePercent = 100;
  }

  // 3. Suất chiếu và tỷ lệ lấp đầy theo phim hôm nay
  const [showtimesToday] = await pool.query<RowDataPacket[]>(
    `SELECT 
       s.id AS showtime_id,
       s.movie_id,
       m.title AS movie_title,
       m.genre,
       r.total_seats,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:%i') AS start_time_full,
       DATE_FORMAT(s.start_time, '%H:%i') AS start_time_str
     FROM showtimes s
     JOIN movies m ON m.id = s.movie_id
     JOIN rooms r ON r.id = s.room_id
     WHERE DATE(s.start_time) = ? AND s.status <> 'cancelled'
     ORDER BY s.start_time ASC`,
    [targetDate]
  );

  // Lấy lượng vé và doanh thu theo showtime_id
  const [showtimeSalesRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       b.showtime_id,
       COALESCE(SUM(b.total_price), 0) AS revenue,
       COUNT(DISTINCT b.id) AS booking_count,
       COUNT(bs.id) AS seat_count
     FROM bookings b
     LEFT JOIN booking_seats bs ON bs.booking_id = b.id
     WHERE b.payment_status = 'paid'
     GROUP BY b.showtime_id`
  );

  const showtimeSalesMap = new Map<number, { revenue: number; tickets: number }>();
  for (const row of showtimeSalesRows) {
    showtimeSalesMap.set(Number(row.showtime_id), {
      revenue: Number(row.revenue || 0),
      tickets: Math.max(Number(row.seat_count || 0), Number(row.booking_count || 0)),
    });
  }

  // Tổng hợp theo phim hôm nay
  const movieMap = new Map<
    number,
    {
      title: string;
      genre: string;
      revenue: number;
      ticketsSold: number;
      totalSeats: number;
    }
  >();

  for (const st of showtimesToday) {
    const movieId = Number(st.movie_id);
    const sales = showtimeSalesMap.get(Number(st.showtime_id)) || {
      revenue: 0,
      tickets: 0,
    };
    const totalSeats = Number(st.total_seats || 100);

    const curr = movieMap.get(movieId) || {
      title: String(st.movie_title),
      genre: String(st.genre || "Điện ảnh"),
      revenue: 0,
      ticketsSold: 0,
      totalSeats: 0,
    };

    curr.revenue += sales.revenue;
    curr.ticketsSold += sales.tickets;
    curr.totalSeats += totalSeats;
    movieMap.set(movieId, curr);
  }

  // Nếu hôm nay chưa có suất chiếu được xếp, lấy danh sách phim đang chiếu
  if (movieMap.size === 0) {
    const [activeMovies] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, genre FROM movies WHERE status = 'now_showing' LIMIT 6`
    );
    for (const m of activeMovies) {
      movieMap.set(Number(m.id), {
        title: String(m.title),
        genre: String(m.genre || "Điện ảnh"),
        revenue: 0,
        ticketsSold: 0,
        totalSeats: 0,
      });
    }
  }

  const moviesToday: MovieTodayStat[] = Array.from(movieMap.entries()).map(
    ([movieId, item]) => {
      const fillRate =
        item.totalSeats > 0
          ? Math.min(100, Math.round((item.ticketsSold / item.totalSeats) * 1000) / 10)
          : 0;
      return {
        movieId,
        title: item.title,
        genre: item.genre,
        revenue: item.revenue,
        ticketsSold: item.ticketsSold,
        totalSeats: item.totalSeats,
        fillRate,
      };
    }
  );

  // 4. Xu hướng thể loại (7 ngày gần nhất vs 7 ngày trước đó)
  const recentStartDate = dateList[7];
  const [genreRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       m.genre,
       COALESCE(SUM(CASE WHEN DATE(b.created_at) >= ? THEN b.total_price ELSE 0 END), 0) AS recent_rev,
       COALESCE(SUM(CASE WHEN DATE(b.created_at) < ? THEN b.total_price ELSE 0 END), 0) AS prev_rev
     FROM bookings b
     JOIN showtimes s ON s.id = b.showtime_id
     JOIN movies m ON m.id = s.movie_id
     WHERE b.payment_status = 'paid'
       AND DATE(b.created_at) BETWEEN ? AND ?
     GROUP BY m.genre
     ORDER BY recent_rev DESC`,
    [recentStartDate, recentStartDate, startDate, targetDate]
  );

  const genreTrends: GenreTrend[] = genreRows.map((r) => {
    const recent = Number(r.recent_rev || 0);
    const prev = Number(r.prev_rev || 0);
    let growth = 0;
    if (prev > 0) {
      growth = Math.round(((recent - prev) / prev) * 1000) / 10;
    } else if (recent > 0) {
      growth = 100;
    }
    return {
      genre: String(r.genre),
      recentRevenue: recent,
      previousRevenue: prev,
      growthPercent: growth,
      isIncreasing: recent >= prev,
    };
  });

  // 5. Suất chiếu trong 24h có nguy cơ ế (tỷ lệ lấp đầy < 20%)
  const [next24hShowtimes] = await pool.query<RowDataPacket[]>(
    `SELECT 
       s.id AS showtime_id,
       m.title AS movie_title,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:%i') AS show_time_full,
       DATE_FORMAT(s.start_time, '%H:%i') AS show_time_hm,
       r.total_seats
     FROM showtimes s
     JOIN movies m ON m.id = s.movie_id
     JOIN rooms r ON r.id = s.room_id
     WHERE s.start_time >= CONCAT(?, ' 00:00:00') 
       AND s.start_time <= DATE_ADD(CONCAT(?, ' 00:00:00'), INTERVAL 24 HOUR)
       AND s.status = 'active'
     ORDER BY s.start_time ASC`,
    [targetDate, targetDate]
  );

  const riskyShowtimes: RiskyShowtimeItem[] = [];
  for (const st of next24hShowtimes) {
    const stId = Number(st.showtime_id);
    const totalSeats = Number(st.total_seats || 100);
    const sales = showtimeSalesMap.get(stId) || { revenue: 0, tickets: 0 };
    const fillRate =
      totalSeats > 0
        ? Math.min(100, Math.round((sales.tickets / totalSeats) * 1000) / 10)
        : 0;

    if (fillRate < 20) {
      const timeStr = String(st.show_time_full);
      const hour = parseInt(st.show_time_hm.split(":")[0], 10);
      let suggestion = "Kích cầu giờ chót: Giảm giá 20% hoặc tặng kèm bắp nước.";
      if (hour < 12) {
        suggestion = "Áp dụng giá vé ưu đãi buổi sáng (Early Bird) và quảng bá combo cà phê + vé.";
      } else if (hour >= 18 && hour <= 21) {
        suggestion = "Khung giờ vàng nhưng lấp đầy thấp: Đẩy thông báo flash sale trên app và banner trang chủ.";
      } else if (hour > 21) {
        suggestion = "Suất chiếu khuya: Đồng giá vé 65k hoặc cân nhắc dời khách sang phòng chiếu nhỏ hơn.";
      }

      riskyShowtimes.push({
        showtimeId: stId,
        movie: String(st.movie_title),
        time: timeStr,
        fillRate,
        suggestion,
      });
    }
  }

  return {
    targetDate,
    todayRevenue,
    yesterdayRevenue,
    avg7DaysRevenue,
    revenueChangePercent,
    moviesToday,
    genreTrends,
    sales14Days,
    riskyShowtimes,
  };
}
