import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function onRequestOptions() {
  return new Response("ok", { headers: corsHeaders });
}

export async function onRequestPost(context: any) {
  try {
    const authHeader = context.request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the user is authenticated via Supabase
    const supabaseClient = createClient(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check Mux credentials
    const MUX_TOKEN_ID = context.env.MUX_TOKEN_ID;
    const MUX_TOKEN_SECRET = context.env.MUX_TOKEN_SECRET;

    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      return new Response(
        JSON.stringify({ error: "Mux credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Mux direct upload URL
    const response = await fetch("https://api.mux.com/video/v1/uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`),
      },
      body: JSON.stringify({
        cors_origin: "*",
        new_asset_settings: {
          playback_policy: ["public"],
          video_quality: "basic",
          normalize_audio: false,
          master_access: "temporary",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Mux API error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to create Mux upload URL" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const muxData = await response.json() as any;

    return new Response(
      JSON.stringify({
        uploadUrl: muxData.data.url,
        uploadId: muxData.data.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("get-mux-upload-url error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
