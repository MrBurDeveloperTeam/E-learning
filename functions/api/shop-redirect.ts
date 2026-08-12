/**
 * /api/shop-redirect
 *
 * Two handlers:
 *
 * GET  ?return_url=<url>
 *   Legacy path — looks for an Odoo session_id cookie (present when the user
 *   has an active Snabbb session that already established an Odoo session).
 *   Falls back to ambient-redirect when no session is found.
 *
 * POST  body: { return_url: string }  +  Authorization: Bearer <supabase_jwt>
 *   Primary path used by FeaturedProductCard.  Verifies the Supabase JWT,
 *   extracts the user's email, and calls our Odoo addon's
 *   /snabbb/sso/token_for_email endpoint to obtain a single-use SSO token.
 *   Returns { redirect_url } pointing to mrbur.shop/snabbb/sso/callback which
 *   will log the user in and forward them to the product page.
 *
 *   This endpoint is at /api/shop-redirect (NOT /api/sso/shop-redirect) so
 *   Cloudflare Access does not intercept it.
 */

import { signHS256, verifyHS256 } from './_shared/auth'

const ODOO_BASE = 'https://mrbur.odoo.com'
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

// ─── POST: Supabase-JWT → Odoo SSO token → redirect URL ──────────────────────

export const onRequestPost = async (context: any) => {
  const { request, env } = context

  // Parse body
  let body: { return_url?: string } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const returnUrl = body.return_url
  if (!returnUrl) {
    return new Response(JSON.stringify({ error: 'missing return_url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify the Supabase JWT sent by the frontend
  const authHeader = request.headers.get('Authorization') || ''
  const supaToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const supaSecret = env.SUPABASE_JWT_SECRET || ''

  if (supaToken && supaSecret) {
    const { ok, payload } = await verifyHS256({ token: supaToken, secret: supaSecret })
    const email: string | undefined = ok ? payload?.email : undefined

    if (email) {
      // Ask our Odoo addon to create a single-use login token for this email
      const apiKey = env.ODOO_SSO_API_KEY || env.SSO_API_KEY || ''
      try {
        const tokenRes = await fetch(`${ODOO_BASE}/snabbb/sso/token_for_email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SSO-API-KEY': apiKey,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: { email },
          }),
        })
        const tokenData = await tokenRes.json().catch(() => null)
        const token: string | undefined = tokenData?.result?.token

        if (token) {
          const parsed = new URL(returnUrl)
          const callbackUrl = new URL(`${parsed.origin}/snabbb/sso/callback`)
          callbackUrl.searchParams.set('token', token)
          callbackUrl.searchParams.set('next', parsed.pathname + parsed.search)

          return new Response(JSON.stringify({ redirect_url: callbackUrl.toString() }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
      } catch (_) {
        // fall through to direct redirect
      }
    }
  }

  // Fallback: send the user directly to the shop (unauthenticated)
  return new Response(JSON.stringify({ redirect_url: returnUrl }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── GET: legacy session_id cookie path ───────────────────────────────────────

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
  const appSecret = env.APP_JWT_SECRET || env.SUPABASE_JWT_SECRET

  if (sessionId && appSecret) {
    const now = Math.floor(Date.now() / 1000)
    const token = await signHS256({
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { session_id: sessionId, exp: now + 120 },
      secret: appSecret,
    })

    const dest = new URL(`${ODOO_BASE}/snabbb/sso/elearning`)
    dest.searchParams.set('token', token)
    dest.searchParams.set('next', returnUrl)

    return new Response(null, {
      status: 302,
      headers: { Location: dest.toString() },
    })
  }

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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  })
}
