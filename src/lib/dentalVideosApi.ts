import type {
  DentalVideo,
  DentalVideosResponse,
  DentalCategory,
  DentalVideosParams,
} from "@/types/dentalVideo";
import { ApiError } from "@/types/dentalVideo";

/**
 * Base URL for all API requests.
 * Falls back to the current origin so relative paths work when the frontend
 * is served from the same domain as the Cloudflare Functions.
 */
const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "");

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generic fetch wrapper that handles JSON parsing and error mapping.
 * @throws {ApiError} when the response status is not OK.
 */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (networkError: any) {
    throw new ApiError(
      networkError?.message ?? "Network request failed",
      0
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // body wasn't JSON — keep the generic message
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of dental videos with optional filters.
 *
 * @param params - Optional query parameters (category, q, page, limit, sort).
 * @returns A paginated response containing an array of videos and metadata.
 * @throws {ApiError} on network or server errors.
 *
 * @example
 * ```ts
 * const res = await getVideos({ category: "Orthodontics", page: 2 });
 * console.log(res.data, res.totalPages);
 * ```
 */
export async function getVideos(
  params?: DentalVideosParams
): Promise<DentalVideosResponse> {
  const searchParams = new URLSearchParams();

  if (params?.category) searchParams.set("category", params.category);
  if (params?.q) searchParams.set("q", params.q);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.sort) searchParams.set("sort", params.sort);

  const qs = searchParams.toString();
  const path = `/api/dental-videos${qs ? `?${qs}` : ""}`;

  return apiFetch<DentalVideosResponse>(path);
}

/**
 * Fetch a single dental video by its UUID.
 *
 * @param id - The UUID of the dental video.
 * @returns The dental video record.
 * @throws {ApiError} with status 404 if the video does not exist.
 *
 * @example
 * ```ts
 * const video = await getVideoById("b1c2d3e4-...");
 * console.log(video.title);
 * ```
 */
export async function getVideoById(id: string): Promise<DentalVideo> {
  return apiFetch<DentalVideo>(`/api/dental-videos?id=${encodeURIComponent(id)}`);
}

/**
 * Fetch all dental categories with their associated video counts.
 * Categories are sorted by count in descending order.
 *
 * @returns An array of categories with counts.
 * @throws {ApiError} on network or server errors.
 *
 * @example
 * ```ts
 * const cats = await getCategories();
 * cats.forEach(c => console.log(c.category, c.count));
 * ```
 */
export async function getCategories(): Promise<DentalCategory[]> {
  return apiFetch<DentalCategory[]>("/api/dental-categories");
}
