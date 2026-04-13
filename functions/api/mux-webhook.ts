import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      type: string;
      data: {
        id: string;
        upload_id?: string;
        playback_ids?: { id: string }[];
        duration?: number;
      };
    };

    const { type, data } = body;

    const supabase = createClient(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_SERVICE_ROLE_KEY
    );

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
        .update({
          mux_playback_id: null,
          mux_asset_id: null,
          status: "removed",
        })
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
};
