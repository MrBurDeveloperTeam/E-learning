import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MUX_WEBHOOK_SECRET = Deno.env.get("MUX_WEBHOOK_SECRET")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { type, data } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (type === "video.asset.ready") {
      const uploadId = data.upload_id;
      const assetId = data.id;
      const playbackId = data.playback_ids?.[0]?.id;
      const duration = data.duration;

      if (playbackId) {
        if (uploadId) {
          await supabase
            .from("videos")
            .update({
              mux_playback_id: playbackId,
              mux_asset_id: assetId,
              duration_seconds: Math.round(duration ?? 0),
              status: "published",
            })
            .eq("mux_upload_id", uploadId);
        } else {
          await supabase
            .from("videos")
            .update({
              mux_playback_id: playbackId,
              duration_seconds: Math.round(duration ?? 0),
              status: "published",
            })
            .eq("mux_asset_id", assetId);
        }
      }
    }

    if (type === "video.asset.deleted") {
      const assetId = data.id;
      await supabase
        .from("videos")
        .update({ mux_playback_id: null, mux_asset_id: null, status: "removed" })
        .eq("mux_asset_id", assetId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Mux webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
