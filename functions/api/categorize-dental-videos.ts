import { createClient } from "@supabase/supabase-js";

async function fetchWithRetry(
  urlBuilder: (key: string) => string,
  apiKeys: string[],
  options: RequestInit,
  retries = 5
): Promise<Response> {
  let keyIndex = 0;

  for (let i = 0; i < retries; i++) {
    const currentKey = apiKeys[keyIndex % apiKeys.length];
    const res = await fetch(urlBuilder(currentKey), options);
    
    if (res.status !== 429) return res;

    console.log(`API Key ${((keyIndex % apiKeys.length) + 1)}/${apiKeys.length} rate limited (429).`);
    keyIndex++;
    
    // If we haven't tried all keys in this cycle, try the next key immediately without backoff
    if (keyIndex % apiKeys.length !== 0) {
      console.log(`Switching to backup API key...`);
      i--; // Offset the loop increment so a full cycle of all keys counts as 1 retry
      continue;
    }

    // Exponential backoff only when ALL keys are exhausted: 4s, 8s, 16s, 32s, 64s
    const delay = Math.pow(2, i + 2) * 1000;
    console.log(`All API keys rate limited. Retrying in ${delay / 1000}s (attempt ${i + 1}/${retries})`);
    await new Promise(r => setTimeout(r, delay));
  }
  return fetch(urlBuilder(apiKeys[0]), options);
}

export async function onRequest(context: any) {
  try {
    const SUPABASE_URL = context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const GEMINI_API_KEY_RAW = context.env.GEMINI_API_KEY || context.env.VITE_GEMINI_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase environment variables" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!GEMINI_API_KEY_RAW) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY environment variable" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Support multiple comma-separated keys for fallback
    const geminiApiKeys = GEMINI_API_KEY_RAW.split(',').map((k: string) => k.trim()).filter(Boolean);
    
    if (geminiApiKeys.length === 0) {
      return new Response(JSON.stringify({ error: "No valid Gemini API keys found" }), { status: 500 });
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


    // Query uncategorized videos
    const { data: videos, error: fetchError } = await supabase
      .from("dental_videos")
      .select("id, title, description, tags")
      .is("category", null)
      .limit(10); // Sequential processing with 4s delay: 10 videos ≈ 40s, within Cloudflare worker timeout

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Database error fetching videos", details: fetchError }), { status: 500 });
    }

    if (!videos || videos.length === 0) {
      return new Response(JSON.stringify({ processed: 0, updated: 0, failed: 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Process videos sequentially to respect free-tier rate limits (20 req/min)
    const DELAY_BETWEEN_REQUESTS_MS = 4000; // 1 request every 4 seconds = 15 req/min (safe margin)
    let updatedCount = 0;
    let failedCount = 0;

    const validCategories = [
      'Orthodontics', 'Oral Surgery', 'Endodontics', 'Periodontics',
      'Pediatric Dentistry', 'Prosthodontics', 'Oral Hygiene',
      'Radiology', 'General Dentistry', 'Implantology', 'Restorative'
    ];
    const fallbackCategory = 'General Dentistry';

    const assignFallbackCategory = async (videoId: string, tags: string[] = []) => {
      const { error } = await supabase
        .from("dental_videos")
        .update({
          category: fallbackCategory,
          confidence_score: 0,
          tags,
          needs_review: true
        })
        .eq("id", videoId);

      return error;
    };

    const systemPrompt = `You are a dental education video classifier. You will receive video metadata (title, description, tags) and must classify each video into EXACTLY ONE category.

Valid categories: ${validCategories.join(' | ')}

Category definitions:
- Orthodontics: braces, aligners, malocclusion, bite correction, retainers, tooth movement
- Oral Surgery: extractions, jaw surgery, biopsies, wisdom teeth, surgical procedures
- Endodontics: root canals, pulp treatment, periapical procedures, pulpotomy, pulpectomy
- Periodontics: gum disease, scaling, bone grafts, gingival treatment, periodontitis, deep cleaning
- Pediatric Dentistry: children's dental care, primary teeth, child patients, pediatric
- Prosthodontics: crowns, bridges, dentures, veneers, tooth replacement restorations, zirconium/zirconia restorations, impression techniques for prosthetics, porcelain fused to metal (PFM), fixed partial dentures
- Implantology: dental implants, osseointegration, implant placement surgery, abutments, sinus lift, All-on-4, All-on-6, immediate loading, flapless surgery
- Oral Hygiene: brushing, flossing, preventive care, patient education on home care
- Radiology: X-rays, CBCT, imaging interpretation, radiographic diagnosis
- Restorative: fillings, composite restorations, amalgam restorations, direct restorations, indirect restorations, inlays, onlays, tooth-colored fillings, cavity preparation, bonding procedures, restorative dentistry techniques
- General Dentistry: routine checkups, dental exams, teeth cleaning (non-periodontal), fluoride treatments, dental anxiety, tooth sensitivity, tooth decay prevention. Use ONLY when no specialist category above fits.

Critical decision rules:
1. KEYWORD MATCH IS THE STRONGEST SIGNAL: If the title, description, or tags contain a category name (e.g. "prosthodontics", "endodontics", "orthodontics", "implantology"), you MUST classify into that category with confidence >= 0.9.
2. Hashtags are keywords too — #prosthodontics means Prosthodontics.
3. Key distinction: Implantology = placing the implant fixture into bone. Prosthodontics = making/fitting the crown, bridge, denture, or other restoration.
4. Zirconium bridges, impression techniques for crowns/bridges, and prosthetic restorations = Prosthodontics.
5. General Dentistry is the last resort — only use it when NO other category fits.
6. Set confidence below 0.6 ONLY if you are genuinely uncertain.

You MUST return strictly valid JSON only. No markdown. No explanation. No code fences.
Format: { "category": "...", "confidence": 0.0-1.0, "tags": ["...", "..."] }`;

    // Keyword map for pre-detection hints sent to the model
    const categoryKeywords: Record<string, string[]> = {
      'Orthodontics': ['orthodontic', 'orthodontics', 'braces', 'aligner', 'malocclusion', 'retainer'],
      'Oral Surgery': ['oral surgery', 'extraction', 'wisdom teeth', 'jaw surgery', 'biopsy', 'surgical extraction'],
      'Endodontics': ['endodontic', 'endodontics', 'root canal', 'pulpotomy', 'pulpectomy', 'periapical'],
      'Periodontics': ['periodontic', 'periodontics', 'periodontitis', 'gum disease', 'scaling and root', 'bone graft', 'gingival'],
      'Pediatric Dentistry': ['pediatric', 'paediatric', 'children dental', 'child patient', 'primary teeth', 'baby teeth'],
      'Prosthodontics': ['prosthodontic', 'prosthodontics', 'crown', 'bridge', 'denture', 'veneer', 'zirconium', 'zirconia', 'impression technique', 'fixed partial', 'pfm', 'porcelain fused'],
      'Implantology': ['implantology', 'dental implant', 'implant placement', 'osseointegration', 'sinus lift', 'all-on-4', 'all-on-6', 'flapless'],
      'Oral Hygiene': ['oral hygiene', 'brushing', 'flossing', 'preventive care', 'plaque removal'],
      'Radiology': ['radiology', 'x-ray', 'xray', 'cbct', 'radiograph', 'imaging'],
      'Restorative': ['restorative', 'filling', 'composite restoration', 'amalgam restoration', 'inlay', 'onlay', 'bonding', 'direct restoration', 'indirect restoration', 'cavity preparation'],
    };

    function detectCategoryHint(title: string, description: string, tags: string[]): string | null {
      const combined = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const kw of keywords) {
          if (combined.includes(kw)) return category;
        }
      }
      return null;
    }

    // Process videos sequentially to respect API rate limits
    const errorDetails: string[] = [];
    
    for (let idx = 0; idx < videos.length; idx++) {
      const video = videos[idx];
      
      try {
        const cleanTitle = (video.title ?? '').replace(/#(\w+)/g, '$1');
        const cleanDescription = (video.description ?? '').replace(/#(\w+)/g, '$1');
        const videoTags = Array.isArray(video.tags) ? video.tags : [];
        const existingTagsLine = videoTags.length > 0
          ? `Tags: ${videoTags.join(', ')}\n`
          : '';

        // Pre-detect category from keywords to give the model a strong hint
        const detectedHint = detectCategoryHint(video.title ?? '', video.description ?? '', videoTags);
        const hintLine = detectedHint
          ? `\nHint: The keyword "${detectedHint.toLowerCase()}" was detected in the metadata. This strongly suggests the category "${detectedHint}".\n`
          : '';

        const userContent = `Classify this video:\n\nTitle: ${cleanTitle}\nDescription: ${cleanDescription}\n${existingTagsLine}${hintLine}\nRespond with JSON only.`;
        
        const geminiRes = await fetchWithRetry(
          (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          geminiApiKeys,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: userContent }] }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 1024,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
              }
            })
          }
        );

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.error(`Gemini API Error for video ${video.id} (status ${geminiRes.status}):`, errText);
          errorDetails.push(`Video "${video.title?.substring(0, 40)}": Gemini ${geminiRes.status} error`);
          const fallbackError = await assignFallbackCategory(video.id);
          if (fallbackError) failedCount++;
          else updatedCount++;
        } else {
          const geminiData = await geminiRes.json();
          let jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!jsonText) {
            console.error(`Invalid Gemini response for video ${video.id}:`, JSON.stringify(geminiData).substring(0, 300));
            errorDetails.push(`Video "${video.title?.substring(0, 40)}": Empty Gemini response`);
            const fallbackError = await assignFallbackCategory(video.id);
            if (fallbackError) failedCount++;
            else updatedCount++;
          } else {
            // Robustly extract JSON block in case there's markdown or extra text
            let cleanedJson = jsonText;
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleanedJson = jsonMatch[0];
            } else {
              cleanedJson = jsonText.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
            }
            
            let parsed;
            try {
              parsed = JSON.parse(cleanedJson);
            } catch (e: any) {
              console.error(`JSON parse error for video ${video.id}:`, jsonText);
              errorDetails.push(`Video "${video.title?.substring(0, 40)}": JSON parse error`);
              const fallbackError = await assignFallbackCategory(video.id);
              if (fallbackError) failedCount++;
              else updatedCount++;
              // Wait before next request
              if (idx < videos.length - 1) await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
              continue;
            }

            // Case-insensitive category matching (e.g. "prosthodontics" -> "Prosthodontics")
            let finalCategory = parsed.category;
            if (!validCategories.includes(finalCategory)) {
              const matched = validCategories.find(
                (c) => c.toLowerCase() === (finalCategory ?? '').toLowerCase()
              );
              finalCategory = matched ?? fallbackCategory;
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
              errorDetails.push(`Supabase update error: ${updateError.message}`);
              failedCount++;
            } else {
              console.log(`✓ Video ${idx + 1}/${videos.length}: "${video.title?.substring(0, 50)}" → ${finalCategory} (${confidence})`);
              updatedCount++;
            }
          }
        }
      } catch (err: any) {
        console.error(`Error processing video ${video.id}:`, err);
        errorDetails.push(`Video "${video.title?.substring(0, 40)}": ${err.message}`);
        const fallbackError = await assignFallbackCategory(video.id);
        if (fallbackError) failedCount++;
        else updatedCount++;
      }

      // Wait between requests to respect API rate limits
      if (idx < videos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
      }
    }

    return new Response(JSON.stringify({
      processed: videos.length,
      updated: updatedCount,
      failed: failedCount,
      errors: errorDetails.slice(0, 5) // return first 5 errors to frontend
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
