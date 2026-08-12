/**
 * GET /api/shop-redirect?return_url=<product-url>
 *
 * Bridge that passes the user's current Odoo session to mrbur.shop so they
 * land on the shop already authenticated after clicking a featured product.
 *
 * How it works:
 *  1. The user's browser sends the `session_id` cookie (set on .snabbb.com by
 *     the Snabbb platform when they logged in) as part of the request to this
 *     function, which runs on the same e-learning.snabbb.com origin.
 *  2. We package that session_id into a short-lived (2 min) HS256-signed JWT
 *     so mrbur.shop can verify it came from us without us exposing the raw
 *     value in the URL.
 *  3. We redirect to mrbur.shop/api/sso/elearning which validates the JWT,
 *     sets its own session_id cookie on .mrbur.shop, and continues to the
 *     product page — so the Odoo session is shared across both domains.
 *
 * Fallback: if there is no session_id cookie (user not logged in, or logged
 * in via Google OAuth only) we fall back to the original ambient-redirect on
 * app.snabbb.com which handles the Snabbb-native SSO path.
 */

import { signHS256 } from './_shared/auth'

const MRBUR_SHOP_SSO_URL = 'https://mrbur.shop/api/sso/elearning'
const AMBIENT_REDIRECT_FALLBACK = 'https://app.snabbb.com/api/sso/ambient-redirect'

function getCookieValue(req: Request, name: string): string | null {
  const cookie = req.headers.get('Cookie') || ''
  for (const part of cookie.split(';').map((s) => s.trim())) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1))
    }
  }
  return null
}

export const onRequestGet = async (context: any) => {
  const { request, env } = context

  const url = new URL(request.url)
  const returnUrl = url.searchParams.get('return_url')

  if (!returnUrl) {
    return new Response(JSON.stringify({ error: 'missing return_url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const sessionId = getCookieValue(request, 'session_id')
  // Mirror the fallback pattern used in sso.ts: prefer a dedicated
  // APP_JWT_SECRET if one is configured, otherwise use SUPABASE_JWT_SECRET.
  const appSecret = env.APP_JWT_SECRET || env.SUPABASE_JWT_SECRET

  if (sessionId && appSecret) {
    // Sign the existing Odoo session_id into a short-lived token so
    // mrbur.shop can verify it and set it as a cookie on its own domain.
    const now = Math.floor(Date.now() / 1000)
    const token = await signHS256({
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { session_id: sessionId, exp: now + 120 }, // 2-minute window
      secret: appSecret,
    })

    const dest = new URL(MRBUR_SHOP_SSO_URL)
    dest.searchParams.set('token', token)
    dest.searchParams.set('next', returnUrl)

    return new Response(null, {
      status: 302,
      headers: { Location: dest.toString() },
    })
  }

  // No Odoo session available — fall back to ambient-redirect which handles
  // the Snabbb-native SSO path (or degrades gracefully to an unauth redirect).
  const fallback = new URL(AMBIENT_REDIRECT_FALLBACK)
  fallback.searchParams.set('return_url', returnUrl)
  return new Response(null, {
    status: 302,
    headers: { Location: fallback.toString() },
  })
}

export const onRequestOptions = async (context: any) => {
  const origin = context.request.headers.get('Origin') || '*'
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}
