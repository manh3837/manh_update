import { apiRequest, type ApiResponse } from "./api";

export interface ShowtimeRow {
  id: number;
  movie_id: number;
  movie_title: string;
  room_id: number;
  room_name: string;
  cinema_id: number;
  start_time_str: string;
  end_time_str: string;
  price_regular: string;
  price_vip: string;
  format: string;
  status: "active" | "cancelled" | "full";
}

export interface CreateShowtimePayload {
  movieId: number;
  roomId: number;
  date: string;
  startTime: string;
  endTime: string;
  priceRegular?: number;
  priceVip?: number;
  format?: string;
}

export interface BulkSlot {
  movieId: number;
  roomId: number;
  startTime: string;
  endTime: string;
}

export interface ShowtimeMutationResponse {
  success: boolean;
  message?: string;
  id?: number;
  created?: number;
  skipped?: number;
  data?: ShowtimeRow[];
}

export const showtimeService = {
  /** Lịch chiếu còn hiệu lực của 1 ngày */
  async getByDate(date: string): Promise<ApiResponse<ShowtimeRow[]>> {
    return apiRequest<ShowtimeRow[]>(`/showtimes?date=${encodeURIComponent(date)}`);
  },

  /** Admin: tạo 1 suất chiếu */
  async create(payload: CreateShowtimePayload): Promise<ShowtimeMutationResponse> {
    return apiRequest(`/showtimes`, {
      method: "POST",
      body: JSON.stringify(payload),
    }) as unknown as Promise<ShowtimeMutationResponse>;
  },

  /** Admin: thêm nhiều suất (áp dụng kết quả AI) */
  async bulkCreate(date: string, slots: BulkSlot[]): Promise<ShowtimeMutationResponse> {
    return apiRequest(`/showtimes/bulk`, {
      method: "POST",
      body: JSON.stringify({ date, slots }),
    }) as unknown as Promise<ShowtimeMutationResponse>;
  },

  /** Admin: hủy suất chiếu (mềm) */
  async cancel(id: number): Promise<ApiResponse> {
    return apiRequest(`/showtimes/${id}`, { method: "DELETE" });
  },
};
