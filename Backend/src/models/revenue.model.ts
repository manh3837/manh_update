import { pool } from "../config/db.js";
import type { RowDataPacket } from "mysql2";

export interface MovieRevenueItem {
  movieId: number;
  movieTitle: string;
  genre: string;
  posterUrl: string | null;
  showtimesCount: number;
  ticketsSold: number;
  revenue: number;
  occupancyRate: number;
}

export interface RoomRevenueItem {
  roomId: number;
  roomName: string;
  cinemaId: number;
  cinemaName: string;
  format: string;
  totalSeats: number;
  status: "active" | "maintenance";
  showtimesCount: number;
  ticketsSold: number;
  totalRevenue: number;
  occupancyRate: number;
  movies: MovieRevenueItem[];
}

export interface DailyRevenuePoint {
  date: string;
  dayLabel: string;
  revenue: number;
  tickets: number;
}

export interface TopMovieRevenue {
  movieId: number;
  title: string;
  genre: string;
  revenue: number;
  tickets: number;
  fillRate: string;
}

export interface RevenueReportData {
  periodType: "day" | "month" | "range";
  startDate: string;
  endDate: string;
  cinemaId?: number;
  summary: {
    totalRevenue: number;
    totalTickets: number;
    totalBookings: number;
    totalShowtimes: number;
    avgOccupancyRate: number;
  };
  dailyTrend: DailyRevenuePoint[];
  topMovies: TopMovieRevenue[];
  roomsBreakdown: RoomRevenueItem[];
}

export interface RevenueReportQuery {
  cinemaId?: number;
  periodType?: "day" | "month" | "range";
  date?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export async function getDetailedRevenueReport(query: RevenueReportQuery): Promise<RevenueReportData> {
  const periodType = query.periodType || "day";
  let startDate = query.startDate;
  let endDate = query.endDate;

  if (periodType === "day") {
    const d = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : formatDate(new Date());
    startDate = d;
    endDate = d;
  } else if (periodType === "month") {
    const m = query.month && /^\d{4}-\d{2}$/.test(query.month) ? query.month : formatDate(new Date()).slice(0, 7);
    const [year, month] = m.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    startDate = `${m}-01`;
    endDate = `${m}-${String(lastDay).padStart(2, "0")}`;
  } else {
    // range or default past 7 days
    if (!startDate || !endDate) {
      const today = new Date();
      const past7 = new Date();
      past7.setDate(today.getDate() - 6);
      startDate = formatDate(past7);
      endDate = formatDate(today);
    }
  }

  const cinemaId = query.cinemaId ? Number(query.cinemaId) : undefined;

  // 1. Lấy danh sách phòng
  let roomsSql = `
    SELECT r.id, r.cinema_id, c.name AS cinema_name, r.name, r.total_seats, r.format, r.status
    FROM rooms r
    JOIN cinemas c ON c.id = r.cinema_id
  `;
  const roomsParams: unknown[] = [];
  if (cinemaId) {
    roomsSql += " WHERE r.cinema_id = ?";
    roomsParams.push(cinemaId);
  }
  roomsSql += " ORDER BY r.cinema_id ASC, r.id ASC";
  const [roomsRows] = await pool.query<RowDataPacket[]>(roomsSql, roomsParams);

  // 2. Lấy suất chiếu trong khoảng thời gian
  let showtimesSql = `
    SELECT s.id, s.room_id, s.movie_id, s.start_time, s.status,
           m.title AS movie_title, m.genre, m.poster_url,
           r.total_seats
    FROM showtimes s
    JOIN movies m ON m.id = s.movie_id
    JOIN rooms r ON r.id = s.room_id
    WHERE DATE(s.start_time) BETWEEN ? AND ?
      AND s.status <> 'cancelled'
  `;
  const stParams: unknown[] = [startDate, endDate];
  if (cinemaId) {
    showtimesSql += " AND r.cinema_id = ?";
    stParams.push(cinemaId);
  }
  const [showtimesRows] = await pool.query<RowDataPacket[]>(showtimesSql, stParams);

  // 3. Lấy doanh thu từ bảng bookings (payment_status = 'paid')
  let bookingsSql = `
    SELECT 
      b.id AS booking_id,
      b.showtime_id,
      b.total_price,
      DATE_FORMAT(b.created_at, '%Y-%m-%d') AS booking_date,
      s.room_id,
      s.movie_id,
      m.title AS movie_title,
      m.genre,
      COALESCE(seat_counts.count, 1) AS tickets_count
    FROM bookings b
    JOIN showtimes s ON s.id = b.showtime_id
    JOIN movies m ON m.id = s.movie_id
    JOIN rooms r ON r.id = s.room_id
    LEFT JOIN (
      SELECT booking_id, COUNT(*) AS count
      FROM booking_seats
      GROUP BY booking_id
    ) seat_counts ON seat_counts.booking_id = b.id
    WHERE b.payment_status = 'paid'
      AND (
        DATE(b.created_at) BETWEEN ? AND ?
        OR DATE(s.start_time) BETWEEN ? AND ?
      )
  `;
  const bParams: unknown[] = [startDate, endDate, startDate, endDate];
  if (cinemaId) {
    bookingsSql += " AND r.cinema_id = ?";
    bParams.push(cinemaId);
  }
  const [bookingsRows] = await pool.query<RowDataPacket[]>(bookingsSql, bParams);

  // 4. Map gom nhóm doanh thu theo Room và Movie
  interface AccMovie {
    movieId: number;
    movieTitle: string;
    genre: string;
    posterUrl: string | null;
    showtimesCount: number;
    ticketsSold: number;
    revenue: number;
    totalSeatsCapacity: number;
  }

  interface AccRoom {
    roomId: number;
    roomName: string;
    cinemaId: number;
    cinemaName: string;
    format: string;
    totalSeats: number;
    status: "active" | "maintenance";
    showtimesCount: number;
    ticketsSold: number;
    totalRevenue: number;
    totalSeatsCapacity: number;
    moviesMap: Map<number, AccMovie>;
  }

  const roomMap = new Map<number, AccRoom>();
  for (const r of roomsRows) {
    roomMap.set(r.id, {
      roomId: r.id,
      roomName: r.name,
      cinemaId: r.cinema_id,
      cinemaName: r.cinema_name,
      format: r.format,
      totalSeats: r.total_seats,
      status: r.status,
      showtimesCount: 0,
      ticketsSold: 0,
      totalRevenue: 0,
      totalSeatsCapacity: 0,
      moviesMap: new Map(),
    });
  }

  // Cộng số suất chiếu và dung lượng ghế
  for (const st of showtimesRows) {
    const room = roomMap.get(st.room_id);
    if (!room) continue;

    room.showtimesCount += 1;
    room.totalSeatsCapacity += Number(st.total_seats || room.totalSeats);

    let m = room.moviesMap.get(st.movie_id);
    if (!m) {
      m = {
        movieId: st.movie_id,
        movieTitle: st.movie_title,
        genre: st.genre || "Điện ảnh",
        posterUrl: st.poster_url,
        showtimesCount: 0,
        ticketsSold: 0,
        revenue: 0,
        totalSeatsCapacity: 0,
      };
      room.moviesMap.set(st.movie_id, m);
    }
    m.showtimesCount += 1;
    m.totalSeatsCapacity += Number(st.total_seats || room.totalSeats);
  }

  // Cộng doanh thu và số vé từ bookings
  let totalRevenueAll = 0;
  let totalTicketsAll = 0;
  const movieOverallMap = new Map<number, { title: string; genre: string; revenue: number; tickets: number; seats: number }>();
  const dailyMap = new Map<string, { revenue: number; tickets: number }>();

  for (const b of bookingsRows) {
    const rev = Number(b.total_price || 0);
    const tix = Number(b.tickets_count || 1);
    totalRevenueAll += rev;
    totalTicketsAll += tix;

    // Daily breakdown
    const dStr = String(b.booking_date || startDate);
    const dayStat = dailyMap.get(dStr) || { revenue: 0, tickets: 0 };
    dayStat.revenue += rev;
    dayStat.tickets += tix;
    dailyMap.set(dStr, dayStat);

    // Room & Movie in Room
    const room = roomMap.get(b.room_id);
    if (room) {
      room.totalRevenue += rev;
      room.ticketsSold += tix;

      let m = room.moviesMap.get(b.movie_id);
      if (!m) {
        m = {
          movieId: b.movie_id,
          movieTitle: b.movie_title,
          genre: b.genre || "Điện ảnh",
          posterUrl: null,
          showtimesCount: 0,
          ticketsSold: 0,
          revenue: 0,
          totalSeatsCapacity: 0,
        };
        room.moviesMap.set(b.movie_id, m);
      }
      m.revenue += rev;
      m.ticketsSold += tix;
    }

    // Top movie overall
    const mov = movieOverallMap.get(b.movie_id) || {
      title: b.movie_title,
      genre: b.genre || "Điện ảnh",
      revenue: 0,
      tickets: 0,
      seats: 0,
    };
    mov.revenue += rev;
    mov.tickets += tix;
    movieOverallMap.set(b.movie_id, mov);
  }

  // Chuẩn bị roomsBreakdown
  const roomsBreakdown: RoomRevenueItem[] = [];
  let totalCapacityAll = 0;

  for (const room of roomMap.values()) {
    totalCapacityAll += room.totalSeatsCapacity;
    const occRate =
      room.totalSeatsCapacity > 0
        ? Math.min(100, Math.round((room.ticketsSold / room.totalSeatsCapacity) * 1000) / 10)
        : 0;

    const moviesList: MovieRevenueItem[] = Array.from(room.moviesMap.values()).map((m) => {
      const mOcc =
        m.totalSeatsCapacity > 0
          ? Math.min(100, Math.round((m.ticketsSold / m.totalSeatsCapacity) * 1000) / 10)
          : 0;
      return {
        movieId: m.movieId,
        movieTitle: m.movieTitle,
        genre: m.genre,
        posterUrl: m.posterUrl,
        showtimesCount: m.showtimesCount,
        ticketsSold: m.ticketsSold,
        revenue: m.revenue,
        occupancyRate: mOcc,
      };
    });

    moviesList.sort((a, b) => b.revenue - a.revenue);

    roomsBreakdown.push({
      roomId: room.roomId,
      roomName: room.roomName,
      cinemaId: room.cinemaId,
      cinemaName: room.cinemaName,
      format: room.format,
      totalSeats: room.totalSeats,
      status: room.status,
      showtimesCount: room.showtimesCount,
      ticketsSold: room.ticketsSold,
      totalRevenue: room.totalRevenue,
      occupancyRate: occRate,
      movies: moviesList,
    });
  }

  // Sắp xếp phòng theo doanh thu giảm dần
  roomsBreakdown.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Tạo daily trend
  const dailyTrend: DailyRevenuePoint[] = [];
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const curD = new Date(startD);

  while (curD <= endD) {
    const dStr = formatDate(curD);
    const dayName = DAY_NAMES[curD.getDay()];
    const stat = dailyMap.get(dStr) || { revenue: 0, tickets: 0 };
    dailyTrend.push({
      date: dStr,
      dayLabel: `${dayName} (${curD.getDate()}/${curD.getMonth() + 1})`,
      revenue: stat.revenue,
      tickets: stat.tickets,
    });
    curD.setDate(curD.getDate() + 1);
  }

  // Top movies
  const topMovies: TopMovieRevenue[] = Array.from(movieOverallMap.entries())
    .map(([movieId, mov]) => ({
      movieId,
      title: mov.title,
      genre: mov.genre,
      revenue: mov.revenue,
      tickets: mov.tickets,
      fillRate: `${mov.revenue > 0 ? Math.min(95, Math.max(50, Math.round(mov.tickets * 1.5))) : 0}%`,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const avgOccupancyRate =
    totalCapacityAll > 0
      ? Math.min(100, Math.round((totalTicketsAll / totalCapacityAll) * 1000) / 10)
      : 0;

  return {
    periodType,
    startDate,
    endDate,
    cinemaId,
    summary: {
      totalRevenue: totalRevenueAll,
      totalTickets: totalTicketsAll,
      totalBookings: bookingsRows.length,
      totalShowtimes: showtimesRows.length,
      avgOccupancyRate,
    },
    dailyTrend,
    topMovies,
    roomsBreakdown,
  };
}
