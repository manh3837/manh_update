import { apiRequest, type ApiResponse } from "./api";

export type MovieRating = "P" | "T13" | "T16" | "T18";
export type MovieStatus = "now_showing" | "coming_soon" | "ended";

export interface AdminMovie {
  id: number;
  title: string;
  rating: MovieRating;
  genre: string;
  duration_min: number;
  synopsis: string | null;
  director: string | null;
  cast_members: string | null;
  release_date: string | null;
  country: string | null;
  format: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  ai_recommendation: string | null;
  status: MovieStatus;
  is_featured: number;
  showtime_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MoviePayload {
  title?: string;
  rating?: MovieRating;
  genre?: string;
  duration_min?: number;
  synopsis?: string;
  director?: string;
  cast_members?: string;
  release_date?: string | null;
  country?: string;
  format?: string;
  poster_url?: string;
  trailer_url?: string;
  ai_recommendation?: string;
  status?: MovieStatus;
  is_featured?: boolean;
}

/** Backend trả movie ở top-level cho POST/PUT */
export interface MovieMutationResponse {
  success: boolean;
  message?: string;
  movie?: AdminMovie;
}

export const movieService = {
  /** Danh sách phim + số suất chiếu (công khai) */
  async getMovies(): Promise<ApiResponse<AdminMovie[]>> {
    return apiRequest<AdminMovie[]>("/movies");
  },

  /** Admin: thêm phim mới */
  async createMovie(payload: MoviePayload): Promise<MovieMutationResponse> {
    return apiRequest<AdminMovie>("/movies", {
      method: "POST",
      body: JSON.stringify(payload),
    }) as unknown as Promise<MovieMutationResponse>;
  },

  /** Admin: cập nhật phim */
  async updateMovie(id: number, payload: MoviePayload): Promise<MovieMutationResponse> {
    return apiRequest<AdminMovie>(`/movies/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }) as unknown as Promise<MovieMutationResponse>;
  },

  /** Admin: xóa phim (409 nếu còn suất chiếu) */
  async deleteMovie(id: number): Promise<ApiResponse> {
    return apiRequest(`/movies/${id}`, { method: "DELETE" });
  },
};
