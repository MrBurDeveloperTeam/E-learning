import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, signHS256, verifyHS256 } from "../api/_shared/auth";

const TOKEN_SCOPE = "dental_video_orientation";
const TOKEN_TTL_SECONDS = 2 * 60 * 60;
const MAX_BATCH_SIZE = 25;
const ALLOWED_VIDEO_TYPES = new Set(["short_video", "video"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Env = {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CLASSIFIER_SIGNING_SECRET?: string;
};

function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...getCorsHeaders(request, "GET, POST, PATCH, OPTIONS"),
    },
  });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

function getServerConfig(env: Env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const signingSecret = env.CLASSIFIER_SIGNING_SECRET;
  if (!url || !serviceKey || !signingSecret || signingSecret.length < 32) return null;
  return { url, serviceKey, signingSecret };
}

async function requireClassifierToken(request: Request, signingSecret: string) {
  const token = getBearerToken(request);
  if (!token) return { ok: false as const, status: 401, error: "Paste a valid classifier access code and try again." };
  const verified = await verifyHS256({ token, secret: signingSecret });
  if (!verified.ok || verified.payload?.scope !== TOKEN_SCOPE || !verified.payload?.sub) {
    return { ok: false as const, status: 401, error: "The classifier access code is invalid or has expired." };
  }
  return { ok: true as const, adminId: String(verified.payload.sub) };
}

export async function onRequestOptions(context: { request: Request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request, "GET, POST, PATCH, OPTIONS") });
}

// Issue a short-lived, classifier-only token to a signed-in administrator.
export async function onRequestPost(context: { request: Request; env: Env }) {
  const config = getServerConfig(context.env);
  if (!config) {
    return json(context.request, { error: "Classifier server configuration is incomplete." }, 503);
  }

  const sessionToken = getBearerToken(context.request);
  if (!sessionToken) return json(context.request, { error: "Sign in again before creating an access code." }, 401);

  const supabase = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken);
  if (authError || !user) return json(context.request, { error: "Your session has expired. Sign in again." }, 401);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("user_id", user.id)
    .single();
  if (profileError) return json(context.request, { error: "Unable to verify administrator access." }, 500);
  if (profile?.account_type !== "admin") return json(context.request, { error: "Administrator access is required." }, 403);

  const now = Math.floor(Date.now() / 1000);
  const token = await signHS256({
    header: { alg: "HS256", typ: "JWT" },
    payload: { sub: user.id, scope: TOKEN_SCOPE, iat: now, exp: now + TOKEN_TTL_SECONDS },
    secret: config.signingSecret,
  });
  const { data: pendingRows, count } = await supabase
    .from("dental_videos")
    .select("id", { count: "exact" })
    .is("video_type", null)
    .order("fetched_at", { ascending: true })
    .limit(500);

  return json(context.request, {
    token,
    expiresIn: TOKEN_TTL_SECONDS,
    pending: count ?? 0,
    pendingVideoIds: (pendingRows || []).map((row) => row.id),
  });
}

// Return only the identifiers required by the local classifier.
export async function onRequestGet(context: { request: Request; env: Env }) {
  const config = getServerConfig(context.env);
  if (!config) return json(context.request, { error: "Classifier server configuration is incomplete." }, 503);
  const authorization = await requireClassifierToken(context.request, config.signingSecret);
  if (!authorization.ok) return json(context.request, { error: authorization.error }, authorization.status);

  const requested = Number(new URL(context.request.url).searchParams.get("limit") || 10);
  const requestedOffset = Number(new URL(context.request.url).searchParams.get("offset") || 0);
  const limit = Number.isFinite(requested) ? Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(requested))) : 10;
  const offset = Number.isFinite(requestedOffset) ? Math.min(500, Math.max(0, Math.floor(requestedOffset))) : 0;
  const supabase = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("dental_videos")
    .select("id,video_id,title")
    .is("video_type", null)
    .order("fetched_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return json(context.request, { error: "Unable to load unclassified videos." }, 500);
  return json(context.request, { videos: data || [] });
}

// Accept orientation results, while allowing updates to video_type only.
export async function onRequestPatch(context: { request: Request; env: Env }) {
  const config = getServerConfig(context.env);
  if (!config) return json(context.request, { error: "Classifier server configuration is incomplete." }, 503);
  const authorization = await requireClassifierToken(context.request, config.signingSecret);
  if (!authorization.ok) return json(context.request, { error: authorization.error }, authorization.status);

  const body = await context.request.json().catch(() => null) as { results?: Array<{ id?: unknown; videoType?: unknown }> } | null;
  const results = Array.isArray(body?.results) ? body.results : [];
  if (results.length === 0 || results.length > MAX_BATCH_SIZE) {
    return json(context.request, { error: `Submit between 1 and ${MAX_BATCH_SIZE} classification results.` }, 400);
  }

  const normalized = results.map((entry) => ({ id: String(entry.id || ""), videoType: String(entry.videoType || "") }));
  if (normalized.some((entry) => !UUID_PATTERN.test(entry.id) || !ALLOWED_VIDEO_TYPES.has(entry.videoType))) {
    return json(context.request, { error: "One or more classification results are invalid." }, 400);
  }
  if (new Set(normalized.map((entry) => entry.id)).size !== normalized.length) {
    return json(context.request, { error: "Duplicate video IDs are not allowed in one batch." }, 400);
  }

  const supabase = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let updated = 0;
  const failed: string[] = [];
  const classified: Array<{ id: string; videoType: string }> = [];
  for (const entry of normalized) {
    const { data, error } = await supabase
      .from("dental_videos")
      .update({ video_type: entry.videoType })
      .eq("id", entry.id)
      .is("video_type", null)
      .select("id");
    if (error) failed.push(entry.id);
    else {
      updated += data?.length || 0;
      if (data?.length) classified.push(entry);
    }
  }

  return json(context.request, { updated, failed, classified }, failed.length > 0 ? 207 : 200);
}
