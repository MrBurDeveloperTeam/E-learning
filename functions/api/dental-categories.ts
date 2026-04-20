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
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

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

// ---------------------------------------------------------------------------
// OPTIONS preflight
// ---------------------------------------------------------------------------
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ---------------------------------------------------------------------------
// GET /api/dental-categories
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

    const cf = (context.request as any).cf;
    if (cf?.country) {
      console.log(
        `[dental-categories] visitor country: ${cf.country}, ip: ${ip}`
      );
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

    // Query distinct categories with counts, excluding needs_review videos
    // and videos without a category
    const { data, error } = await supabase.rpc("get_dental_categories");

    if (error) {
      console.error("dental-categories rpc error:", error);

      // Fallback: manual aggregation if the RPC doesn't exist yet
      const { data: videos, error: fallbackError } = await supabase
        .from("dental_videos")
        .select("category")
        .eq("needs_review", false)
        .not("category", "is", null);

      if (fallbackError) {
        console.error("dental-categories fallback error:", fallbackError);
        return jsonResponse({ error: "Database error" }, 500);
      }

      // Aggregate client-side
      const counts: Record<string, number> = {};
      for (const row of videos || []) {
        if (row.category) {
          counts[row.category] = (counts[row.category] || 0) + 1;
        }
      }

      const result = Object.entries(counts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      return jsonResponse(result);
    }

    return jsonResponse(data || []);
  } catch (err: any) {
    console.error("Error in dental-categories function:", err);
    return jsonResponse(
      { error: "Internal server error", details: err.message },
      500
    );
  }
}
