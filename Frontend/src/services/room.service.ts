import { apiRequest, type ApiResponse } from "./api";

export interface AdminRoom {
  id: number;
  cinema_id: number;
  cinema_name: string;
  name: string;
  total_seats: number;
  regular_count: number;
  vip_count: number;
  format: string;
  audio: string;
  rows_count: number;
  cols_count: number;
  vip_rows: string | null;
  status: "active" | "maintenance";
  active_showtimes: number;
}

export interface RoomPayload {
  cinemaId?: number;
  name?: string;
  totalSeats?: number;
  regularCount?: number;
  vipCount?: number;
  format?: string;
  audio?: string;
  rowsCount?: number;
  colsCount?: number;
  vipRows?: string;
}

export interface RoomMutationResponse {
  success: boolean;
  message?: string;
  room?: AdminRoom;
  cancelledShowtimes?: number;
}

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

export interface RevenueReportParams {
  cinemaId?: number | string;
  periodType?: "day" | "month" | "range";
  date?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

export const roomService = {
  /** Báo cáo doanh thu chi tiết theo từng phòng và từng phim, kèm bộ lọc ngày / tháng */
  async getRevenueBreakdown(params: RevenueReportParams): Promise<ApiResponse<RevenueReportData>> {
    const sp = new URLSearchParams();
    if (params.cinemaId && params.cinemaId !== "all") sp.append("cinemaId", String(params.cinemaId));
    if (params.periodType) sp.append("periodType", params.periodType);
    if (params.date) sp.append("date", params.date);
    if (params.month) sp.append("month", params.month);
    if (params.startDate) sp.append("startDate", params.startDate);
    if (params.endDate) sp.append("endDate", params.endDate);

    const qs = sp.toString() ? `?${sp.toString()}` : "";
    return apiRequest<RevenueReportData>(`/rooms/revenue-breakdown${qs}`);
  },
  /** Danh sách phòng (kèm số suất chiếu) */
  async getRooms(cinemaId?: number): Promise<ApiResponse<AdminRoom[]>> {
    const query = cinemaId ? `?cinemaId=${cinemaId}` : "";
    return apiRequest<AdminRoom[]>(`/rooms${query}`);
  },

  /** Admin: thêm phòng chiếu */
  async createRoom(payload: RoomPayload): Promise<RoomMutationResponse> {
    return apiRequest(`/rooms`, {
      method: "POST",
      body: JSON.stringify(payload),
    }) as unknown as Promise<RoomMutationResponse>;
  },

  /** Admin: lưu cấu hình phòng */
  async updateRoom(id: number, payload: RoomPayload): Promise<RoomMutationResponse> {
    return apiRequest(`/rooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }) as unknown as Promise<RoomMutationResponse>;
  },

  /** Admin: ngừng phòng (maintenance) hoặc mở lại (active) */
  async setStatus(id: number, status: "active" | "maintenance"): Promise<RoomMutationResponse> {
    return apiRequest(`/rooms/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }) as unknown as Promise<RoomMutationResponse>;
  },
};
