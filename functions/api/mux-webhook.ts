import { createClient } from "@supabase/supabase-js";

async function verifyMuxSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceInSeconds = 300
): Promise<{ valid: boolean; error?: string }> {
  if (!signatureHeader) {
    return { valid: false, error: "Missing Mux-Signature header" };
  }
  if (!secret) {
    return { valid: false, error: "Missing Mux webhook secret" };
  }

  const pairs = signatureHeader.split(",");
  let timestamp: string | undefined;
  const signatures: string[] = [];

  for (const pair of pairs) {
    const [key, value] = pair.trim().split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return { valid: false, error: "Malformed Mux-Signature header" };
  }

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, error: "Invalid timestamp in Mux-Signature header" };
  }

  // Tolerance check to protect against replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceInSeconds) {
    return {
      valid: false,
      error: "Webhook timestamp is outside the allowed tolerance window",
    };
  }

  // Compute expected HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}.${rawBody}`);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const expectedSignature = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const isValid = signatures.some((sig) => sig === expectedSignature);
  if (!isValid) {
    return { valid: false, error: "Signature mismatch" };
  }

  return { valid: true };
}

export async function onRequestPost(context: any) {
  try {
    const rawBody = await context.request.text();
    const signatureHeader =
      context.request.headers.get("Mux-Signature") ||
      context.request.headers.get("mux-signature");
    const webhookSecret =
      context.env.MUX_WEBHOOK_SECRET ||
      context.env.MUX_SIGNING_SECRET ||
      context.env.MUX_WEBHOOK_SIGNING_SECRET;

    if (!webhookSecret) {
      console.error(
        "MUX_WEBHOOK_SECRET is not configured in Cloudflare Pages environment variables"
      );
      return new Response(
        JSON.stringify({ error: "Mux webhook secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { valid, error } = await verifyMuxSignature(
      rawBody,
      signatureHeader,
      webhookSecret
    );

    if (!valid) {
      console.warn("Mux webhook signature verification failed:", error);
      return new Response(
        JSON.stringify({ error: error || "Invalid webhook signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { type, data } = body;

    const supabase = createClient(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (type === "video.asset.ready") {
      const uploadId = data?.upload_id;
      const assetId = data?.id;
      const playbackId = data?.playback_ids?.[0]?.id;
      const duration = data?.duration;

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
      const assetId = data?.id;
      if (assetId) {
        await supabase
          .from("videos")
          .update({
            mux_playback_id: null,
            mux_asset_id: null,
            status: "removed",
          })
          .eq("mux_asset_id", assetId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Mux webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: err?.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

