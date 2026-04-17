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
      "prosthodontics"
    ];

    let fetchedVideoIds: string[] = [];

    // 1. Fetch up to 10 videos per keyword from search.list
    for (const keyword of keywords) {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(keyword)}&type=video&relevanceLanguage=en&key=${YOUTUBE_API_KEY}`;
      const searchRes = await fetch(searchUrl);
      
      if (!searchRes.ok) {
        console.error(`Error fetching for keyword ${keyword}:`, await searchRes.text());
        continue; // Skip keywords that fail
      }
      
      const searchData = await searchRes.json();
      const items = searchData.items || [];
      for (const item of items) {
        if (item.id && item.id.videoId) {
          fetchedVideoIds.push(item.id.videoId);
        }
      }
    }

    // 2. Deduplicate by video_id
    const uniqueVideoIds = [...new Set(fetchedVideoIds)];
    const fetchedCount = uniqueVideoIds.length;

    if (fetchedCount === 0) {
      return new Response(JSON.stringify({ fetched: 0, inserted: 0, skipped: 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Batched request for videos.list details
    // YouTube API allows max 50 ids per request. Chunk the array.
    let allVideosDetails: any[] = [];
    const batchSize = 50;
    for (let i = 0; i < uniqueVideoIds.length; i += batchSize) {
      const batchIds = uniqueVideoIds.slice(i, i + batchSize);
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

    // 4. Format data for Supabase
    const rowsToInsert = allVideosDetails.map((vid: any) => {
      // Find the best quality thumbnail available
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
      return new Response(JSON.stringify({ fetched: fetchedCount, inserted: 0, skipped: fetchedCount }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5. Upsert into Supabase — on conflict do nothing
    const { data, error } = await supabase
      .from("dental_videos")
      .upsert(rowsToInsert, { onConflict: "video_id", ignoreDuplicates: true })
      .select();

    if (error) {
      console.error("Supabase upsert error:", error);
      return new Response(JSON.stringify({ error: "Database error", details: error }), { status: 500 });
    }

    const insertedCount = data ? data.length : 0;
    const skippedCount = fetchedCount - insertedCount;

    return new Response(JSON.stringify({
      fetched: fetchedCount,
      inserted: insertedCount,
      skipped: skippedCount
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
