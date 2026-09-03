import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ---------------------------------------------------------------------------
// Rate-limiting (in-memory, per-isolate)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Env = {
  SUPABASE_URL: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Sanitise a user-provided search query for use with PostgreSQL to_tsquery.
 * Strips special tsquery characters and joins remaining words with ' & '.
 */
function sanitiseSearchQuery(raw: string): string {
  // Remove all characters that have special meaning in tsquery
  const cleaned = raw.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  if (!cleaned) return "";
  // Join words with & for AND semantics
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .join(" & ");
}

function isGeneralCategory(category: string | null): boolean {
  const normalized = category?.trim().toLowerCase();
  return normalized === "general dentistry" || normalized === "others" || normalized === "other";
}

function applyCategoryFilter(query: any, category: string | null) {
  if (!category) return query;

  if (isGeneralCategory(category)) {
    return query.or("category.is.null,category.eq.General Dentistry,category.eq.Others,category.eq.Restorative");
  }

  return query.eq("category", category);
}

function normalizeVideoCategory(video: any) {
  const category = video?.category?.trim();
  if (!category || ["others", "other", "restorative"].includes(category.toLowerCase())) {
    return { ...video, category: "General Dentistry" };
  }
  return video;
}

// ---------------------------------------------------------------------------
// OPTIONS preflight
// ---------------------------------------------------------------------------
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ---------------------------------------------------------------------------
// GET /dental-api/dental-videos          → paginated list
// GET /dental-api/dental-videos?id=<id>  → single video by id
// ---------------------------------------------------------------------------
export async function onRequestGet(context: {
  env: Env;
  request: Request;
}) {
  try {
    // --- Rate limiting ---
    const ip =
      context.request.headers.get("CF-Connecting-IP") ||
      context.request.headers.get("x-forwarded-for") ||
      "unknown";

    // Log visitor country (best-effort via cf object)
    const cf = (context.request as any).cf;
    if (cf?.country) {
      console.log(`[dental-videos] visitor country: ${cf.country}, ip: ${ip}`);
    }

    if (isRateLimited(ip)) {
      return jsonResponse({ error: "Too many requests" }, 429);
    }

    // --- Supabase client ---
    const SUPABASE_URL =
      context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = context.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        { error: "Missing Supabase environment variables" },
        500
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse query params ---
    const url = new URL(context.request.url);
    const idParam = url.searchParams.get("id");
    const adjacentToParam = url.searchParams.get("adjacentTo");

    // -----------------------------------------------------------------------
    // Adjacent public videos in the default newest-first library order
    // -----------------------------------------------------------------------
    if (adjacentToParam) {
      const { data: current, error: currentError } = await supabase
        .from("dental_videos")
        .select("id,published_at")
        .eq("id", adjacentToParam)
        .eq("needs_review", false)
        .maybeSingle();

      if (currentError) {
        console.error("dental-videos adjacent lookup error:", currentError);
        return jsonResponse({ error: "Database error" }, 500);
      }

      if (!current) {
        return jsonResponse({ error: "Video not found" }, 404);
      }

      const selectAdjacent = "id,title,published_at";
      const [sameDateResult, newerResult, olderResult] = await Promise.all([
        supabase
          .from("dental_videos")
          .select(selectAdjacent)
          .eq("needs_review", false)
          .eq("published_at", current.published_at)
          .order("id", { ascending: false }),
        supabase
          .from("dental_videos")
          .select(selectAdjacent)
          .eq("needs_review", false)
          .gt("published_at", current.published_at)
          .order("published_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(1),
        supabase
          .from("dental_videos")
          .select(selectAdjacent)
          .eq("needs_review", false)
          .lt("published_at", current.published_at)
          .order("published_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1),
      ]);

      const adjacentError =
        sameDateResult.error || newerResult.error || olderResult.error;
      if (adjacentError) {
        console.error("dental-videos adjacent query error:", adjacentError);
        return jsonResponse({ error: "Database error" }, 500);
      }

      const sameDate = sameDateResult.data || [];
      const currentIndex = sameDate.findIndex((item) => item.id === current.id);
      const previous =
        (currentIndex > 0 ? sameDate[currentIndex - 1] : newerResult.data?.[0]) ||
        null;
      const next =
        (currentIndex >= 0 && currentIndex < sameDate.length - 1
          ? sameDate[currentIndex + 1]
          : olderResult.data?.[0]) || null;

      // Choose a stable featured-partner video for this transition. Alternating
      // the preferred channel keeps exposure balanced without storing user data.
      const sponsorSeed = Array.from(current.id).reduce(
        (total, character) => total + character.charCodeAt(0),
        0
      );
      const excludedIds = [current.id, next?.id].filter(Boolean);
      let sponsorQuery = supabase
        .from("dental_videos")
        .select("id,video_id,title,channel_name")
        .eq("needs_review", false)
        .or(
          "channel_name.ilike.%Mr Bur%,channel_name.ilike.%MR.BUR%,channel_name.ilike.%Kaneiko%"
        )
        .order("published_at", { ascending: false })
        .limit(60);

      if (excludedIds.length > 0) {
        sponsorQuery = sponsorQuery.not(
          "id",
          "in",
          `(${excludedIds.join(",")})`
        );
      }

      const { data: sponsorCandidates, error: sponsorError } = await sponsorQuery;
      if (sponsorError) {
        console.error("dental-videos sponsor query error:", sponsorError);
      }

      const preferredChannel = sponsorSeed % 2 === 0 ? "mr bur" : "kaneiko";
      const preferredCandidates = (sponsorCandidates || []).filter((item) =>
        item.channel_name?.toLowerCase().replace(".", " ").includes(preferredChannel)
      );
      const sponsorPool =
        preferredCandidates.length > 0
          ? preferredCandidates
          : sponsorCandidates || [];
      const sponsor =
        sponsorPool.length > 0
          ? sponsorPool[sponsorSeed % sponsorPool.length]
          : null;

      const compact = (item: any) =>
        item ? { id: item.id, title: item.title } : null;

      return jsonResponse({
        previous: compact(previous),
        next: compact(next),
        sponsor,
      });
    }

    // -----------------------------------------------------------------------
    // Single video by id
    // -----------------------------------------------------------------------
    if (idParam) {
      const { data, error } = await supabase
        .from("dental_videos")
        .select("*")
        .eq("id", idParam)
        .maybeSingle();

      if (error) {
        console.error("dental-videos single lookup error:", error);
        return jsonResponse({ error: "Database error" }, 500);
      }

      if (!data) {
        return jsonResponse({ error: "Video not found" }, 404);
      }

      return jsonResponse(normalizeVideoCategory(data));
    }

    // -----------------------------------------------------------------------
    // Paginated list
    // -----------------------------------------------------------------------
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q");
    const languageParam = url.searchParams.get("language");
    const language = languageParam?.trim().toLowerCase() || null;
    if (language && !/^[a-z]{2,3}$/.test(language)) {
      return jsonResponse({ error: "Invalid language filter" }, 400);
    }
    const videoTypeParam = url.searchParams.get("videoType");
    const videoType = videoTypeParam?.trim().toLowerCase() || null;
    if (videoType && videoType !== "short_video" && videoType !== "video") {
      return jsonResponse({ error: "Invalid video type filter" }, 400);
    }
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get("limit") || "12", 10))
    );
    const sort = url.searchParams.get("sort") || "newest";

    // Determine sort column + direction
    let sortColumn = "published_at";
    let ascending = false;
    if (sort === "oldest") {
      sortColumn = "published_at";
      ascending = true;
    } else if (sort === "confidence") {
      sortColumn = "confidence_score";
      ascending = false;
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Language filtering uses the standard query builder so it works together
    // with search without requiring a separate language-aware search RPC.
    if (q && language) {
      const escapedQuery = q.trim().replace(/[%_,]/g, "");
      if (!escapedQuery) {
        return jsonResponse({ data: [], total: 0, page, limit, totalPages: 0 });
      }
      let languageSearchQuery = supabase
        .from("dental_videos")
        .select("*", { count: "exact" })
        .eq("needs_review", false)
        .eq("language", language)
        .or(`title.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%`);

      languageSearchQuery = applyCategoryFilter(languageSearchQuery, category);
      if (videoType) languageSearchQuery = languageSearchQuery.eq("video_type", videoType);
      languageSearchQuery = languageSearchQuery
        .order(sortColumn, { ascending })
        .range(from, to);

      const { data, error, count } = await languageSearchQuery;
      if (error) {
        console.error("dental-videos language search error:", error);
        return jsonResponse({ error: "Database error" }, 500);
      }

      const total = count ?? 0;
      return jsonResponse({
        data: (data || []).map(normalizeVideoCategory),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    // If full-text search is requested, use an RPC call for the tsquery.
    // Otherwise use the standard query builder.
    if (q) {
      if (isGeneralCategory(category) || videoType) {
        const escapedQuery = q.trim().replace(/[%_,]/g, "");

        let othersQuery = supabase
          .from("dental_videos")
          .select("*", { count: "exact" })
          .eq("needs_review", false)
          .or(
            `title.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%`
          );

        othersQuery = applyCategoryFilter(othersQuery, category);
        if (videoType) othersQuery = othersQuery.eq("video_type", videoType);
        othersQuery = othersQuery.order(sortColumn, { ascending }).range(from, to);

        const {
          data: othersData,
          error: othersError,
          count: othersCount,
        } = await othersQuery;

        if (othersError) {
          console.error(
            "dental-videos General Dentistry search error:",
            othersError
          );

          return jsonResponse(
            { error: "Database error" },
            500
          );
        }

        const total = othersCount ?? 0;

        return jsonResponse({
          data: (othersData || []).map(normalizeVideoCategory),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        });
      }

      const tsquery = sanitiseSearchQuery(q);
      if (!tsquery) {
        return jsonResponse({
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }

      // Use raw SQL via rpc for full-text search with count
      const { data, error } = await supabase.rpc("search_dental_videos", {
        search_query: tsquery,
        filter_category: category || "",
        sort_by: sortColumn,
        sort_asc: ascending,
        page_from: from,
        page_limit: limit,
      });

      if (error) {
        console.error("dental-videos search error:", error);

        // Fallback: try without RPC (in case the function hasn't been created yet)
        // Use ILIKE as a simpler fallback
        let query = supabase
          .from("dental_videos")
          .select("*", { count: "exact" })
          .eq("needs_review", false)
          .or(`title.ilike.%${q}%,description.ilike.%${q}%`);

        if (category) {
          query = applyCategoryFilter(query, category);
        }

        query = query.order(sortColumn, { ascending }).range(from, to);

        const { data: fallbackData, error: fallbackError, count } = await query;

        if (fallbackError) {
          console.error("dental-videos fallback search error:", fallbackError);
          return jsonResponse({ error: "Database error" }, 500);
        }

        const total = count ?? 0;
        return jsonResponse({
          data: (fallbackData || []).map(normalizeVideoCategory),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        });
      }

      // The RPC returns rows with a _total_count column
      const rows = data || [];
      const total = rows.length > 0 ? (rows[0] as any)._total_count : 0;
      // Strip the _total_count helper field from each row
      const cleaned = rows.map((row: any) => {
        const { _total_count, ...rest } = row;
        return normalizeVideoCategory(rest);
      });

      return jsonResponse({
        data: cleaned,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    // Standard (non-search) query
    let query = supabase
      .from("dental_videos")
      .select("*", { count: "exact" })
      .eq("needs_review", false);

    if (category) {
      query = applyCategoryFilter(query, category);
    }

    if (language) {
      query = query.eq("language", language);
    }

    if (videoType) {
      query = query.eq("video_type", videoType);
    }

    query = query.order(sortColumn, { ascending }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("dental-videos list error:", error);
      return jsonResponse({ error: "Database error" }, 500);
    }

    const total = count ?? 0;

    return jsonResponse({
      data: (data || []).map(normalizeVideoCategory),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error("Error in dental-videos function:", err);
    return jsonResponse(
      { error: "Internal server error", details: err.message },
      500
    );
  }
}
