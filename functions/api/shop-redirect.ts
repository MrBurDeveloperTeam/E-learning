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
 *   extracts the user's email, then calls Odoo's /api/v1/sso/app_link (which
 *   uses auth="none" + X-SSO-API-KEY — no Odoo session needed).  app_link
 *   provisions the user if they don't exist yet and returns a JWT + company_code.
 *   We pass those to app.snabbb.com/api/sso/odoo-exchange along with a `next`
 *   param pointing at the product page.  odoo-exchange exchanges the JWT for a
 *   mrbur.sso.token and redirects to /sso/callback?token=...&next=..., landing
 *   the user on the product page already logged in.
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

  if (!supaToken) {
    console.error('[shop-redirect] POST: no Bearer token in Authorization header')
    return new Response(JSON.stringify({ redirect_url: returnUrl, debug: 'no_bearer_token' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!supaSecret) {
    console.error('[shop-redirect] POST: SUPABASE_JWT_SECRET env var not set')
    return new Response(JSON.stringify({ redirect_url: returnUrl, debug: 'no_jwt_secret' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { ok: jwtOk, payload, error: jwtError } = await verifyHS256({ token: supaToken, secret: supaSecret })
  if (!jwtOk) {
    console.error('[shop-redirect] POST: JWT verify failed:', jwtError)
    return new Response(JSON.stringify({ redirect_url: returnUrl, debug: `jwt_${jwtError}` }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const email: string | undefined = payload?.email
  if (!email) {
    console.error('[shop-redirect] POST: no email in JWT payload')
    return new Response(JSON.stringify({ redirect_url: returnUrl, debug: 'no_email' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const name: string =
    payload?.user_metadata?.full_name ||
    payload?.user_metadata?.name ||
    email.split('@')[0] ||
    'User'

  const apiKey = env.ODOO_SSO_API_KEY || env.SSO_API_KEY || ''
  if (!apiKey) {
    console.error('[shop-redirect] POST: ODOO_SSO_API_KEY env var not set')
    return new Response(JSON.stringify({ redirect_url: returnUrl, debug: 'no_api_key' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // /api/v1/sso/app_link uses auth="none" + X-SSO-API-KEY — no Odoo
    // session needed.  It provisions the user if missing and returns a
    // signed JWT + company_code that odoo-exchange can redeem.
    const appLinkRes = await fetch(`${ODOO_BASE}/api/v1/sso/app_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SSO-API-KEY': apiKey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { app_code: 'shop', email, name },
      }),
    })

    console.log('[shop-redirect] app_link status:', appLinkRes.status)
    const appLinkData = await appLinkRes.json().catch(() => null)
    console.log('[shop-redirect] app_link result:', JSON.stringify(appLinkData?.result))

    const result = appLinkData?.result

    if (result?.ok && result?.url) {
      // Extract token + company_code from the URL Odoo built
      // (same extraction pattern used by AppCard.tsx in snabbb-apps-gallery)
      const ssoUrl = new URL(result.url)
      const token = ssoUrl.searchParams.get('token')
      const companyCode = ssoUrl.searchParams.get('company_code') || 'INT'

      if (token) {
        // Parse the product page path from the return_url so odoo-exchange
        // can forward it as `next` to /sso/token after logging the user in.
        const parsed = new URL(returnUrl)
        const next = parsed.pathname + parsed.search

        const exchangeUrl = new URL('https://app.snabbb.com/api/sso/odoo-exchange')
        exchangeUrl.searchParams.set('token', token)
        exchangeUrl.searchParams.set('company_code', companyCode)
        exchangeUrl.searchParams.set('next', next)

        console.log('[shop-redirect] success, exchange URL:', exchangeUrl.toString())
        return new Response(JSON.stringify({ redirect_url: exchangeUrl.toString() }), {
          headers: { 'Content-Type': 'application/json' },
        })
      } else {
        console.error('[shop-redirect] app_link URL missing token param:', result.url)
      }
    } else {
      console.error('[shop-redirect] app_link returned not-ok:', JSON.stringify(result))
    }
  } catch (err) {
    console.error('[shop-redirect] app_link fetch threw:', err)
  }

  // Fallback: send the user directly to the shop (unauthenticated)
  console.warn('[shop-redirect] falling back to direct URL:', returnUrl)
  return new Response(JSON.stringify({ redirect_url: returnUrl, debug: 'app_link_failed' }), {
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
