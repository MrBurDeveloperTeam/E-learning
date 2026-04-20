/** A single dental video row from the database. */
export interface DentalVideo {
  id: string;
  video_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  channel_name: string;
  published_at: string; // ISO timestamp string
  category: string | null;
  confidence_score: number | null;
  tags: string[] | null;
  needs_review: boolean;
  fetched_at: string; // ISO timestamp string
}

/** Paginated response from the dental videos API. */
export interface DentalVideosResponse {
  data: DentalVideo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** A category with its associated video count. */
export interface DentalCategory {
  category: string;
  count: number;
}

/** Query parameters for fetching paginated dental videos. */
export interface DentalVideosParams {
  category?: string;
  q?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "confidence";
}

/** Structured API error thrown by the dental videos API client. */
export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
