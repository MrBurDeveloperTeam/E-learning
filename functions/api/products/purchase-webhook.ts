import { createClient } from "@supabase/supabase-js";

/**
 * Receives order status callbacks from Odoo for purchases made through a
 * featured E-Learning product link, records attribution, and — only for
 * orders Odoo reports as fully paid — awards Snabbb Credit to the doctor
 * who featured the product.
 *
 * ASSUMPTIONS ABOUT THE ODOO SIDE (please confirm with whoever owns the
 * Snabbb/Odoo checkout + wallet modules and adjust this file accordingly —
 * the parsing below is deliberately defensive so a field rename is a small
 * diff, not a rewrite):
 *
 *  1. When a viewer clicks a featured product, they land on a URL carrying
 *     `ref_video` and `ref_creator` params (see
 *     src/components/video/FeaturedProductCard.tsx). Odoo's checkout must
 *     persist those two values on the resulting sale order (e.g. as custom
 *     order fields or session metadata) so they can be echoed back here.
 *  2. Odoo calls this endpoint — POST /api/products/purchase-webhook — on
 *     order state transitions (created/paid/cancelled/refunded/failed),
 *     authenticated with a shared secret in the `X-Snabbb-Webhook-Secret`
 *     header (env.PRODUCT_WEBHOOK_SECRET).
 *  3. Crediting a doctor's Snabbb wallet happens via a POST to
 *     `${ODOO_BASE}/api/wallet/credit`, resolving the recipient by email
 *     (mirrors the email-keyed pattern already used by
 *     src/lib/logActivityToOdoo.ts and _shared/auth.ts createOdooUser),
 *     accepting an idempotency key so retried webhook deliveries never
 *     double-credit the same order.
 *
 * Payload accepted from Odoo (defensive aliases in parens):
 * {
 *   order_id | id:            string,   // Odoo sale order id
 *   order_line_id:            string?,
 *   product_ref | product_id: string,   // must match a video_products.product_ref
 *   ref_video | video_id:     string,
 *   status | state:           'paid' | 'cancelled' | 'refunded' | 'failed' | 'pending',
 *   amount | amount_total:    number,
 *   currency | currency_code: string?,
 *   buyer_email | partner_email: string?,
 *   buyer_partner_id | partner_id: string?,
 * }
 */

interface Env {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ODOO_BASE?: string;
  ODOO_SSO_API_KEY?: string;
  PRODUCT_WEBHOOK_SECRET?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Snabbb-Webhook-Secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstDefined<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

const ORDER_STATUS_MAP: Record<string, "pending" | "paid" | "cancelled" | "refunded" | "failed"> = {
  paid: "paid",
  done: "paid",
  sale: "paid",
  cancelled: "cancelled",
  canceled: "cancelled",
  refunded: "refunded",
  refund: "refunded",
  failed: "failed",
  error: "failed",
  pending: "pending",
  draft: "pending",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const expectedSecret = env.PRODUCT_WEBHOOK_SECRET;
    const providedSecret = request.headers.get("X-Snabbb-Webhook-Secret");
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase service role config for purchase webhook");
      return jsonResponse({ ok: false, error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: any = await request.json().catch(() => null);
    if (!body) return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);

    const odooOrderId = firstDefined<string>(body.order_id, body.id)?.toString();
    const productRef = firstDefined<string>(body.product_ref, body.product_id)?.toString();
    const videoId = firstDefined<string>(body.ref_video, body.video_id)?.toString();
    const rawStatus = firstDefined<string>(body.status, body.state)?.toString().toLowerCase();
    const amount = Number(firstDefined(body.amount, body.amount_total) ?? 0);
    const currency = firstDefined<string>(body.currency, body.currency_code)?.toString() ?? "MYR";
    const buyerEmail = firstDefined<string>(body.buyer_email, body.partner_email)?.toString() ?? null;
    const buyerPartnerId = firstDefined<string>(body.buyer_partner_id, body.partner_id)?.toString() ?? null;
    const orderLineId = firstDefined<string>(body.order_line_id)?.toString() ?? null;

    if (!odooOrderId || !productRef || !videoId || !rawStatus) {
      return jsonResponse(
        { ok: false, error: "Missing required fields: order_id, product_ref, ref_video, status" },
        400
      );
    }

    const orderStatus = ORDER_STATUS_MAP[rawStatus];
    if (!orderStatus) {
      return jsonResponse({ ok: false, error: `Unrecognized order status: ${rawStatus}` }, 400);
    }

    // Resolve the featured product + owning doctor, and make sure this product
    // is genuinely attached to the referenced video before crediting anyone.
    const { data: videoProduct, error: videoProductError } = await supabase
      .from("video_products")
      .select("id, creator_id, video_id, product_ref")
      .eq("video_id", videoId)
      .eq("product_ref", productRef)
      .maybeSingle();

    if (videoProductError) {
      console.error("Failed to look up video_products:", videoProductError);
      return jsonResponse({ ok: false, error: "Lookup failed" }, 500);
    }

    if (!videoProduct) {
      console.warn("No matching featured product for webhook payload", { videoId, productRef, odooOrderId });
      return jsonResponse(
        { ok: false, error: "No featured product matches ref_video/product_ref" },
        404
      );
    }

    const isPaid = orderStatus === "paid";

    // Credit is only ever computed for paid orders; everything else is
    // recorded for visibility but explicitly marked not eligible.
    let creditAmount: number | null = null;
    let creditStatus: "pending" | "awarded" | "failed" | "not_applicable" = "not_applicable";

    if (isPaid) {
      const { data: creditSettings, error: creditSettingsError } = await supabase
        .from("snabbb_credit_settings")
        .select("*")
        .eq("id", true)
        .single();

      if (creditSettingsError) {
        console.error("Failed to load credit settings:", creditSettingsError);
      }

      if (creditSettings?.is_active) {
        creditAmount =
          creditSettings.credit_type === "percentage"
            ? Math.round(((amount * Number(creditSettings.credit_value)) / 100) * 100) / 100
            : Number(creditSettings.credit_value);
        creditStatus = "pending";
      } else {
        creditStatus = "not_applicable";
      }
    }

    const { data: purchaseRow, error: upsertError } = await supabase
      .from("video_product_purchases")
      .upsert(
        {
          video_id: videoId,
          video_product_id: videoProduct.id,
          product_ref: productRef,
          doctor_id: videoProduct.creator_id,
          odoo_order_id: odooOrderId,
          odoo_order_line_id: orderLineId,
          buyer_partner_id: buyerPartnerId,
          buyer_email: buyerEmail,
          amount,
          currency,
          order_status: orderStatus,
          credit_amount: creditAmount,
          credit_status: creditStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "odoo_order_id,product_ref" }
      )
      .select("id, doctor_id, credit_amount, credit_status")
      .single();

    if (upsertError) {
      console.error("Failed to record purchase:", upsertError);
      return jsonResponse({ ok: false, error: "Failed to record purchase" }, 500);
    }

    // Award credit — best-effort call out to Odoo's wallet API. Failures here
    // do not fail the webhook response (the purchase is already recorded);
    // they're surfaced via credit_status = 'failed' for manual reconciliation.
    if (isPaid && creditStatus === "pending" && creditAmount && creditAmount > 0) {
      try {
        const { data: doctorProfile } = await supabase
          .from("profiles")
          .select("email, full_name, user_id")
          .eq("user_id", videoProduct.creator_id)
          .single();

        if (!doctorProfile?.email) throw new Error("Doctor has no email on file");

        const odooBase = String(env.ODOO_BASE || "https://mrbur.odoo.com").replace(/\/$/, "");
        const creditResponse = await fetch(`${odooBase}/api/wallet/credit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(env.ODOO_SSO_API_KEY ? { "X-SSO-API-KEY": env.ODOO_SSO_API_KEY } : {}),
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
              email: doctorProfile.email,
              amount: creditAmount,
              currency,
              // Idempotency key: retried webhook deliveries for the same order
              // must not double-credit the doctor.
              idempotency_key: `elearning-product-purchase-${odooOrderId}-${productRef}`,
              reason: "elearning_product_purchase",
              metadata: {
                video_id: videoId,
                product_ref: productRef,
                order_id: odooOrderId,
              },
            },
            id: Date.now(),
          }),
        });

        const creditData: any = await creditResponse.json().catch(() => null);
        if (!creditResponse.ok || creditData?.error || creditData?.result?.ok === false) {
          throw new Error(creditData?.error?.message || creditData?.result?.error || "Odoo wallet credit failed");
        }

        await supabase
          .from("video_product_purchases")
          .update({ credit_status: "awarded", credited_at: new Date().toISOString() })
          .eq("id", purchaseRow.id);
      } catch (creditError: any) {
        console.error("Failed to award Snabbb Credit:", creditError?.message || creditError);
        await supabase
          .from("video_product_purchases")
          .update({ credit_status: "failed" })
          .eq("id", purchaseRow.id);
      }
    }

    return jsonResponse({ ok: true, purchaseId: purchaseRow.id });
  } catch (error: any) {
    console.error("Purchase webhook error:", error);
    return jsonResponse({ ok: false, error: error?.message || "Unexpected error" }, 500);
  }
}
