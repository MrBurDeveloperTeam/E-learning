import { createClient } from "@supabase/supabase-js";

export async function onRequest(context: any) {
  try {
    const SUPABASE_URL = context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const YOUTUBE_API_KEY = context.env.YOUTUBE_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase environment variables" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!YOUTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing YOUTUBE_API_KEY environment variable" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Admin auth enforcement ──
    const authHeader = context.request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .single();

    if (profile?.account_type !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }


    const keywords = [
      "dental surgery", 
      "orthodontics", 
      "endodontics", 
      "root canal", 
      "dental implant", 
      "pediatric dentistry", 
      "periodontics", 
      "oral surgery", 
      "dental hygiene", 
      "prosthodontics",
      "dental burs",
      "dental handpiece",
      "dental clinic management",
      "dental radiology"
    ];

    // ── 1. Search YouTube for video IDs (all time, relevance-based) ──
    // Paginate up to 2 pages per keyword (20 results each) for broader coverage.
    const PAGES_PER_KEYWORD = 2;
    let fetchedVideoIds: string[] = [];

    for (const keyword of keywords) {
      let pageToken: string | undefined = undefined;

      for (let page = 0; page < PAGES_PER_KEYWORD; page++) {
        let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(keyword)}&type=video&relevanceLanguage=en&key=${YOUTUBE_API_KEY}`;
        if (pageToken) {
          searchUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const searchRes = await fetch(searchUrl);

        if (!searchRes.ok) {
          console.error(`Error fetching for keyword "${keyword}" (page ${page + 1}):`, await searchRes.text());
          break; // Stop paginating this keyword
        }

        const searchData = await searchRes.json();
        const items = searchData.items || [];
        for (const item of items) {
          if (item.id && item.id.videoId) {
            fetchedVideoIds.push(item.id.videoId);
          }
        }

        // Advance to the next page, or stop if there isn't one
        pageToken = searchData.nextPageToken;
        if (!pageToken) break;
      }
    }

    // ── 2. Deduplicate by video_id ──
    const uniqueVideoIds = [...new Set(fetchedVideoIds)];
    const fetchedCount = uniqueVideoIds.length;

    if (fetchedCount === 0) {
      return new Response(JSON.stringify({ fetched: 0, inserted: 0, skipped: 0, alreadyInDb: 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ── 3. Pre-filter: check which video_ids already exist in Supabase ──
    // This avoids wasting YouTube API quota on videos.list calls for
    // videos we've already fetched before.
    const existingIds = new Set<string>();
    const checkBatchSize = 100;
    for (let i = 0; i < uniqueVideoIds.length; i += checkBatchSize) {
      const batch = uniqueVideoIds.slice(i, i + checkBatchSize);
      const { data: existingRows } = await supabase
        .from("dental_videos")
        .select("video_id")
        .in("video_id", batch);

      if (existingRows) {
        for (const row of existingRows) {
          existingIds.add(row.video_id);
        }
      }
    }

    const newVideoIds = uniqueVideoIds.filter(id => !existingIds.has(id));
    const alreadyInDb = existingIds.size;

    if (newVideoIds.length === 0) {
      return new Response(JSON.stringify({
        fetched: fetchedCount,
        inserted: 0,
        skipped: 0,
        alreadyInDb,
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ── 4. Fetch video details only for truly new videos ──
    let allVideosDetails: any[] = [];
    const batchSize = 50;
    for (let i = 0; i < newVideoIds.length; i += batchSize) {
      const batchIds = newVideoIds.slice(i, i + batchSize);
      const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batchIds.join(',')}&key=${YOUTUBE_API_KEY}`;
      
      const videosRes = await fetch(videosUrl);
      if (!videosRes.ok) {
        console.error(`Error fetching video details:`, await videosRes.text());
        continue;
      }
      
      const videosData = await videosRes.json();
      if (videosData.items) {
        allVideosDetails.push(...videosData.items);
      }
    }

    // ── 5. Format data for Supabase ──
    const rowsToInsert = allVideosDetails.map((vid: any) => {
      const thumbnails = vid.snippet.thumbnails || {};
      const bestThumbnail = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || "";

      return {
        video_id: vid.id,
        title: vid.snippet.title,
        description: vid.snippet.description,
        thumbnail_url: bestThumbnail,
        channel_name: vid.snippet.channelTitle,
        published_at: vid.snippet.publishedAt,
      };
    });

    if (rowsToInsert.length === 0) {
      return new Response(JSON.stringify({ fetched: fetchedCount, inserted: 0, skipped: 0, alreadyInDb }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ── 6. Upsert into Supabase — on conflict do nothing ──
    const { data, error } = await supabase
      .from("dental_videos")
      .upsert(rowsToInsert, { onConflict: "video_id", ignoreDuplicates: true })
      .select();

    if (error) {
      console.error("Supabase upsert error:", error);
      return new Response(JSON.stringify({ error: "Database error", details: error }), { status: 500 });
    }

    const insertedCount = data ? data.length : 0;

    return new Response(JSON.stringify({
      fetched: fetchedCount,
      inserted: insertedCount,
      skipped: fetchedCount - insertedCount - alreadyInDb,
      alreadyInDb,
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Error in fetch-dental-videos function:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
