import { createClient } from "@supabase/supabase-js";

const CATEGORY_SEARCH_TERMS = {
  "General Dentistry": ["general dentistry clinical tutorial", "dental examination treatment planning", "restorative dentistry procedure", "dental filling clinical technique"],
  Implantology: ["dental implant surgery tutorial", "guided dental implant placement", "implant restoration dentistry", "dental bone graft sinus lift"],
  Orthodontics: ["orthodontic treatment tutorial", "braces placement dentistry", "clear aligner clinical treatment", "orthodontic diagnosis lecture"],
  Endodontics: ["root canal treatment tutorial", "endodontic access cavity preparation", "root canal obturation technique", "rotary endodontics clinical"],
  Periodontology: ["periodontal surgery tutorial", "scaling and root planing clinical", "gum graft surgery dentistry", "periodontitis treatment lecture"],
  "Oral Surgery": ["oral surgery dental tutorial", "wisdom tooth extraction procedure", "surgical tooth extraction dentistry", "oral surgery suturing technique"],
  "Pediatric Dentistry": ["pediatric dentistry clinical tutorial", "pulpotomy primary teeth procedure", "stainless steel crown pediatric dentistry", "child dental behaviour management"],
  Prosthodontics: ["prosthodontics clinical tutorial", "complete denture procedure dentistry", "dental crown bridge preparation", "removable partial denture clinical"],
  "Oral Hygiene": ["dental hygiene clinical tutorial", "professional teeth cleaning procedure", "dental prophylaxis technique", "oral hygiene patient education dentistry"],
  "Dental Burs": ["dental burs selection tutorial", "dental bur types explained", "crown preparation dental burs", "dental burs clinical technique"],
  Handpieces: ["dental handpiece maintenance tutorial", "dental handpiece types explained", "high speed handpiece dentistry", "dental handpiece sterilization"],
  "Clinic Management": ["dental clinic management training", "dental practice management tutorial", "dental clinic workflow", "dental practice patient management"],
  Radiology: ["dental radiology interpretation lecture", "intraoral dental x ray technique", "panoramic radiograph dentistry", "CBCT dental imaging tutorial"],
  Others: ["oral medicine dentistry lecture", "dental anesthesia tutorial", "dental materials lecture", "dentistry clinical education"],
} as const;

type DentalCategory = keyof typeof CATEGORY_SEARCH_TERMS;
type ImportSize = 10 | 25 | 50;

const ALLOWED_IMPORT_SIZES = new Set<ImportSize>([10, 25, 50]);
const SEARCH_RESULTS_PER_PAGE = 50;
const MAX_PAGES_PER_TERM = 2;
const MINIMUM_DURATION_SECONDS = 180;
const DENTAL_RELEVANCE_TERMS = [
  "dental", "dentist", "dentistry", "tooth", "teeth", "oral", "orthodont",
  "endodont", "periodont", "prosthodont", "implant", "root canal", "gingiv",
  "occlusion", "dentur", "radiograph", "cbct",
];

type YouTubeFailure = {
  stage: "search" | "details";
  keyword?: string;
  status: number;
  reason: string;
  message: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseYouTubeFailure(payload: any, status: number, stage: YouTubeFailure["stage"], keyword?: string): YouTubeFailure {
  const firstError = payload?.error?.errors?.[0];
  return {
    stage,
    keyword,
    status,
    reason: firstError?.reason || payload?.error?.status || "youtubeRequestFailed",
    message: firstError?.message || payload?.error?.message || "YouTube rejected the request.",
  };
}

function parseIsoDurationSeconds(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}

function isDentalVideo(video: any): boolean {
  const metadata = `${video?.snippet?.title || ""} ${video?.snippet?.description || ""}`.toLowerCase();
  return DENTAL_RELEVANCE_TERMS.some((term) => metadata.includes(term));
}

function describeYouTubeFailure(failure: YouTubeFailure): string {
  const context = failure.keyword ? ` for “${failure.keyword}”` : "";
  return `${failure.reason}${context}: ${failure.message}`;
}

export async function onRequest(context: any) {
  try {
    if (context.request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const YOUTUBE_API_KEY = context.env.YOUTUBE_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase is not configured for this deployment.", code: "SUPABASE_CONFIG_MISSING" }, 500);
    }
    if (!YOUTUBE_API_KEY) {
      return jsonResponse({ error: "YOUTUBE_API_KEY is missing from the Cloudflare deployment.", code: "YOUTUBE_API_KEY_MISSING" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const authHeader = context.request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonResponse({ error: "Sign in again before importing videos." }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Your session has expired. Sign in again and retry." }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .single();
    if (profileError) {
      console.error("fetch-dental-videos profile lookup error:", profileError);
      return jsonResponse({ error: "Unable to verify administrator access." }, 500);
    }
    if (profile?.account_type !== "admin") return jsonResponse({ error: "Administrator access is required." }, 403);

    const body = await context.request.json().catch(() => ({}));
    const category = body?.category as DentalCategory;
    const requestedLimit = Number(body?.limit ?? 25) as ImportSize;
    if (!category || !(category in CATEGORY_SEARCH_TERMS)) {
      return jsonResponse({ error: "Choose a valid dental category before importing.", code: "INVALID_CATEGORY" }, 400);
    }
    if (!ALLOWED_IMPORT_SIZES.has(requestedLimit)) {
      return jsonResponse({ error: "Import size must be 10, 25, or 50 videos.", code: "INVALID_LIMIT" }, 400);
    }

    const candidateIds = new Set<string>();
    const failures: YouTubeFailure[] = [];
    let successfulSearches = 0;

    for (const keyword of CATEGORY_SEARCH_TERMS[category]) {
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES_PER_TERM; page++) {
        const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
        const params: Record<string, string> = {
          part: "snippet",
          maxResults: String(SEARCH_RESULTS_PER_PAGE),
          q: keyword,
          type: "video",
          order: "relevance",
          relevanceLanguage: "en",
          safeSearch: "moderate",
          videoEmbeddable: "true",
          videoSyndicated: "true",
          key: YOUTUBE_API_KEY,
        };
        for (const [key, value] of Object.entries(params)) searchUrl.searchParams.set(key, value);
        if (pageToken) searchUrl.searchParams.set("pageToken", pageToken);

        const searchResponse = await fetch(searchUrl.toString());
        const searchPayload = await searchResponse.json().catch(() => ({}));
        if (!searchResponse.ok) {
          const failure = parseYouTubeFailure(searchPayload, searchResponse.status, "search", keyword);
          failures.push(failure);
          console.error("YouTube search failed:", failure);
          break;
        }

        successfulSearches++;
        for (const item of searchPayload.items || []) if (item?.id?.videoId) candidateIds.add(item.id.videoId);
        pageToken = searchPayload.nextPageToken;
        if (!pageToken) break;
      }
    }

    if (successfulSearches === 0) {
      const primaryFailure = failures[0];
      return jsonResponse({
        error: primaryFailure ? `YouTube search failed: ${describeYouTubeFailure(primaryFailure)}` : "YouTube returned no searchable results.",
        code: "YOUTUBE_SEARCH_FAILED",
        details: failures.map(describeYouTubeFailure),
      }, 502);
    }

    const uniqueVideoIds = [...candidateIds];
    if (uniqueVideoIds.length === 0) {
      return jsonResponse({ category, requested: requestedLimit, fetched: 0, eligible: 0, inserted: 0, alreadyInDb: 0, filteredOut: 0, skipped: 0, warnings: failures.map(describeYouTubeFailure) });
    }

    const existingIds = new Set<string>();
    for (let index = 0; index < uniqueVideoIds.length; index += 100) {
      const { data: existingRows, error: existingError } = await supabase
        .from("dental_videos")
        .select("video_id")
        .in("video_id", uniqueVideoIds.slice(index, index + 100));
      if (existingError) {
        console.error("fetch-dental-videos duplicate lookup error:", existingError);
        return jsonResponse({ error: "Could not check the video library for duplicates." }, 500);
      }
      for (const row of existingRows || []) existingIds.add(row.video_id);
    }

    const newVideoIds = uniqueVideoIds.filter((id) => !existingIds.has(id));
    const videoDetails: any[] = [];
    for (let index = 0; index < newVideoIds.length; index += 50) {
      const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      detailsUrl.searchParams.set("part", "snippet,contentDetails,status");
      detailsUrl.searchParams.set("id", newVideoIds.slice(index, index + 50).join(","));
      detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);

      const detailsResponse = await fetch(detailsUrl.toString());
      const detailsPayload = await detailsResponse.json().catch(() => ({}));
      if (!detailsResponse.ok) {
        const failure = parseYouTubeFailure(detailsPayload, detailsResponse.status, "details");
        failures.push(failure);
        console.error("YouTube video details failed:", failure);
        continue;
      }
      videoDetails.push(...(detailsPayload.items || []));
    }

    if (newVideoIds.length > 0 && videoDetails.length === 0) {
      const primaryFailure = failures.find((failure) => failure.stage === "details");
      return jsonResponse({
        error: primaryFailure ? `YouTube video details failed: ${describeYouTubeFailure(primaryFailure)}` : "YouTube did not return details for the selected videos.",
        code: "YOUTUBE_DETAILS_FAILED",
        details: failures.map(describeYouTubeFailure),
      }, 502);
    }

    const eligibleVideos = videoDetails.filter((video) => {
      const duration = parseIsoDurationSeconds(video?.contentDetails?.duration);
      const isLive = video?.snippet?.liveBroadcastContent !== "none";
      return video?.status?.embeddable === true && !isLive && duration >= MINIMUM_DURATION_SECONDS && isDentalVideo(video);
    });
    const selectedVideos = eligibleVideos.slice(0, requestedLimit);
    const rowsToInsert = selectedVideos.map((video) => {
      const thumbnails = video.snippet.thumbnails || {};
      return {
        video_id: video.id,
        title: video.snippet.title,
        description: video.snippet.description || "",
        thumbnail_url: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        channel_name: video.snippet.channelTitle,
        published_at: video.snippet.publishedAt,
        category,
        confidence_score: 1,
        tags: [category, "YouTube", "Auto imported"],
        needs_review: false,
      };
    });

    let insertedCount = 0;
    if (rowsToInsert.length > 0) {
      const { data, error: insertError } = await supabase
        .from("dental_videos")
        .upsert(rowsToInsert, { onConflict: "video_id", ignoreDuplicates: true })
        .select("video_id");
      if (insertError) {
        console.error("fetch-dental-videos upsert error:", insertError);
        return jsonResponse({ error: "The videos were found, but Supabase could not save them.", code: "DATABASE_INSERT_FAILED" }, 500);
      }
      insertedCount = data?.length || 0;
    }

    const filteredOut = videoDetails.length - eligibleVideos.length;
    return jsonResponse({
      category,
      requested: requestedLimit,
      fetched: uniqueVideoIds.length,
      eligible: eligibleVideos.length,
      inserted: insertedCount,
      alreadyInDb: existingIds.size,
      filteredOut,
      skipped: filteredOut + Math.max(0, selectedVideos.length - insertedCount),
      warnings: failures.map(describeYouTubeFailure),
    });
  } catch (error: any) {
    console.error("fetch-dental-videos unhandled error:", error);
    return jsonResponse({ error: "The import could not be completed. Check the Cloudflare function logs and retry.", code: "IMPORT_FAILED" }, 500);
  }
}
