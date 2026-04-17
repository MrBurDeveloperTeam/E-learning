import { createClient } from "@supabase/supabase-js";

export async function onRequest(context: any) {
  try {
    const SUPABASE_URL = context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const GEMINI_API_KEY = context.env.GEMINI_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase environment variables" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY environment variable" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Query uncategorized videos
    const { data: videos, error: fetchError } = await supabase
      .from("dental_videos")
      .select("id, title, description")
      .is("category", null);

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Database error fetching videos", details: fetchError }), { status: 500 });
    }

    if (!videos || videos.length === 0) {
      return new Response(JSON.stringify({ processed: 0, updated: 0, failed: 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Process in batches of 10
    const batchSize = 10;
    let updatedCount = 0;
    let failedCount = 0;

    const validCategories = [
      'Orthodontics', 'Oral Surgery', 'Endodontics', 'Periodontics',
      'Pediatric Dentistry', 'Prosthodontics', 'Oral Hygiene',
      'Radiology', 'General Dentistry'
    ];

    const promptMessage = `
System context: you are a dental education video classifier
Instruction: classify into exactly one category from the predefined list
Predefined list: ${validCategories.join(', ')}
Return strictly valid JSON format only, with no markdown formatting or code blocks:
{ "category": "...", "confidence": 0.0-1.0, "tags": ["...", "..."] }
`;

    // Process batched chunks sequentially
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      
      // Process videos within the batch concurrently
      const batchPromises = batch.map(async (video) => {
        try {
          const contentText = `Title: ${video.title}\nDescription: ${video.description}\n\n${promptMessage}`;
          
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: contentText }] }]
              })
            }
          );

          if (!geminiRes.ok) {
            console.error(`Gemini API Error for video ${video.id}:`, await geminiRes.text());
            failedCount++;
            return;
          }

          const geminiData = await geminiRes.json();
          let jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!jsonText) {
            console.error(`Invalid Gemini response for video ${video.id}`);
            failedCount++;
            return;
          }

          // Strip markdown code fences if Gemini returned them
          jsonText = jsonText.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
          
          let parsed;
          try {
            parsed = JSON.parse(jsonText);
          } catch (e) {
            console.error(`JSON parse error for video ${video.id}:`, jsonText);
            failedCount++;
            return;
          }

          let finalCategory = parsed.category;
          if (!validCategories.includes(finalCategory)) {
            finalCategory = 'General Dentistry';
          }
          
          const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
          const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
          const needsReview = confidence < 0.6;

          const { error: updateError } = await supabase
            .from("dental_videos")
            .update({
              category: finalCategory,
              confidence_score: confidence,
              tags: tags,
              needs_review: needsReview
            })
            .eq("id", video.id);

          if (updateError) {
            console.error(`Database update error for video ${video.id}:`, updateError);
            failedCount++;
          } else {
            updatedCount++;
          }
        } catch (err) {
          console.error(`Error processing video ${video.id}:`, err);
          failedCount++;
        }
      });

      // Wait for all videos in the current batch to be processed
      await Promise.all(batchPromises);

      // Add a 200ms delay between each batch to respect API rate limits
      if (i + batchSize < videos.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return new Response(JSON.stringify({
      processed: videos.length,
      updated: updatedCount,
      failed: failedCount
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Error in categorize-dental-videos function:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
