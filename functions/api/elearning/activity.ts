// POST /api/elearning/activity — Cloudflare Pages Function.
//
// Forwards a single activity event (comment posted/deleted, creator
// followed/unfollowed, video uploaded/updated/deleted, creator application
// submitted) to Odoo. Mirrors the inventory/appointment/todo apps' activity
// syncs — same X-Snabbb-Api-Key + email auth model, same idempotency-key
// pattern via `external_ref`.
//
// Called from src/lib/logActivityToOdoo.ts, fire-and-forget. Never called
// directly by anything else.

const ODOO_ELEARNING_ACTIVITY_URL = 'https://mrbur.odoo.com/snabbb/api/elearning/activity'

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export const onRequestOptions = async (context: any) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.request),
  })
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context
  const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders(request) })

  let body: any = null
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers,
    })
  }

  const {
    external_ref: externalRef,
    actor_email: actorEmail,
    actor_name: actorName = null,
    supabase_user_id: supabaseUserId = null,
    action,
    details,
    occurred_at: occurredAt,
  } = body || {}

  if (!externalRef || !actorEmail || !action || !details || !occurredAt) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Missing required field(s): external_ref, actor_email, action, details, occurred_at',
      }),
      { status: 400, headers }
    )
  }

  try {
    const odooRes = await fetch(ODOO_ELEARNING_ACTIVITY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Snabbb-Api-Key': env.SNABBB_API_KEY,
      },
      body: JSON.stringify({
        external_ref: externalRef,
        email: actorEmail,
        actor_name: actorName,
        supabase_user_id: supabaseUserId,
        action,
        details,
        occurred_at: occurredAt,
      }),
    })

    const data: any = await odooRes.json().catch(() => null)

    if (!odooRes.ok || !data?.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: data?.error || 'activity_upstream_failed', upstream: data }),
        { status: odooRes.status || 400, headers }
      )
    }

    return new Response(JSON.stringify({ ok: true, external_ref: externalRef }), {
      status: 200,
      headers,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || 'activity_failed' }), {
      status: 500,
      headers,
    })
  }
}
