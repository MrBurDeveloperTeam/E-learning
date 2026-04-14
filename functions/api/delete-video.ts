import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Env = {
  MUX_TOKEN_ID?: string;
  MUX_TOKEN_SECRET?: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
};

type OwnedVideo = {
  id: string;
  mux_asset_id: string | null;
  mux_upload_id: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getMuxAuthHeader(env: Env) {
  if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) {
    throw new Error("Mux credentials not configured");
  }

  return "Basic " + btoa(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`);
}

async function deleteMuxAsset(assetId: string, env: Env) {
  const response = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
    method: "DELETE",
    headers: {
      Authorization: getMuxAuthHeader(env),
    },
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("Mux asset delete error:", errText);
    throw new Error("Failed to delete the video from Mux.");
  }
}

async function cleanupMuxVideo(video: OwnedVideo, env: Env) {
  if (video.mux_asset_id) {
    await deleteMuxAsset(video.mux_asset_id, env);
    return;
  }

  if (!video.mux_upload_id) {
    return;
  }

  const uploadResponse = await fetch(
    `https://api.mux.com/video/v1/uploads/${video.mux_upload_id}`,
    {
      method: "GET",
      headers: {
        Authorization: getMuxAuthHeader(env),
      },
    }
  );

  if (uploadResponse.status === 404) {
    return;
  }

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    console.error("Mux upload lookup error:", errText);
    throw new Error("Failed to verify the Mux upload before deleting the video.");
  }

  const uploadData = (await uploadResponse.json()) as {
    data?: { asset_id?: string; status?: string };
  };

  if (uploadData.data?.asset_id) {
    await deleteMuxAsset(uploadData.data.asset_id, env);
    return;
  }

  if (uploadData.data?.status !== "waiting") {
    return;
  }

  const cancelResponse = await fetch(
    `https://api.mux.com/video/v1/uploads/${video.mux_upload_id}/cancel`,
    {
      method: "PUT",
      headers: {
        Authorization: getMuxAuthHeader(env),
      },
    }
  );

  if (cancelResponse.status === 404) {
    return;
  }

  if (!cancelResponse.ok) {
    const errText = await cancelResponse.text();
    console.error("Mux upload cancel error:", errText);
    throw new Error("Failed to cancel the Mux upload before deleting the video.");
  }
}

export async function onRequestOptions() {
  return new Response("ok", { headers: corsHeaders });
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  try {
    const authHeader = context.request.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const body = (await context.request.json()) as { videoId?: string };
    const videoId = body.videoId?.trim();

    if (!videoId) {
      return jsonResponse({ error: "Missing videoId" }, 400);
    }

    const authClient = createClient(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: video, error: videoError } = await adminClient
      .from("videos")
      .select("id, mux_asset_id, mux_upload_id")
      .eq("id", videoId)
      .eq("creator_id", user.id)
      .maybeSingle();

    if (videoError) {
      console.error("delete-video lookup error:", videoError);
      return jsonResponse({ error: "Failed to look up the video." }, 500);
    }

    if (!video) {
      return jsonResponse(
        { error: "Video not found or you do not have permission to delete it." },
        404
      );
    }

    await cleanupMuxVideo(video as OwnedVideo, context.env);

    const { error: deleteError } = await adminClient
      .from("videos")
      .delete()
      .eq("id", videoId)
      .eq("creator_id", user.id);

    if (deleteError) {
      console.error("delete-video delete error:", deleteError);
      return jsonResponse({ error: "Failed to delete the video record." }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error("delete-video error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
}
