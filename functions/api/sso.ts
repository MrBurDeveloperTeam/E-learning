import {
  issueSupabaseSession,
  verifyHS256,
  getTokenFromRequest,
  buildSetCookie,
  buildClearCookie,
  getCookieOptions,
} from './_shared/auth'
 
function json(body: unknown, status: number, headers: Record<string, string>, cookie?: string) {
  const responseHeaders = new Headers({ 'Content-Type': 'application/json', ...headers })
  if (cookie) responseHeaders.append('Set-Cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers: responseHeaders })
}

async function resolveCentralIdentity(token: string, env: any) {
  // App-link tokens are JWTs. Password login stores the Odoo session id in
  // the same shared cookie, so support both central identity representations.
  if (token.split('.').length === 3) {
    const secrets = [env.APP_JWT_SECRET, env.SUPABASE_JWT_SECRET].filter(Boolean)
    for (const secret of [...new Set(secrets)] as string[]) {
      const verified = await verifyHS256({ token, secret })
      if (verified.ok) {
        const payload = verified.payload || {}
        const email = String(payload.email || '').trim().toLowerCase()
        if (email) {
          return {
            email,
            name: String(payload.name || payload.user_metadata?.name || '').trim(),
            odooSub: payload.sub ?? null,
          }
        }
      }
    }
  }

  const odooBase = String(env.ODOO_BASE || 'https://mrbur.odoo.com').replace(/\/$/, '')
  const sessionRes = await fetch(`${odooBase}/web/session/get_session_info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: `session_id=${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {}, id: Date.now() }),
  })
  const sessionData = await sessionRes.json().catch(() => null) as any
  const result = sessionData?.result
  const email = String(result?.username || result?.email || '').trim().toLowerCase()
  if (!sessionRes.ok || sessionData?.error || !result?.uid || !email) return null

  return {
    email,
    name: String(result.name || result.partner_display_name || '').trim(),
    odooSub: result.uid,
  }
}

export const onRequestGet = async ({ request, env }: any) => {
  const origin = request.headers.get('Origin') || '*'
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cookie',
    'Cache-Control': 'no-store',
  }
  const cookieOptions = getCookieOptions(request, env)
  const token = getTokenFromRequest(request)

  if (!token) {
    return json(
      { error: 'missing_sso' },
      401,
      corsHeaders,
      buildClearCookie('mrbur_sso', cookieOptions),
    )
  }

  try {
    const identity = await resolveCentralIdentity(token, env)
    if (!identity) {
      return json(
        { error: 'invalid_sso' },
        401,
        corsHeaders,
        buildClearCookie('mrbur_sso', cookieOptions),
      )
    }

    const session = await issueSupabaseSession(env, identity)
    return json(
      session,
      200,
      corsHeaders,
      buildSetCookie('mrbur_sso', token, cookieOptions),
    )
  } catch (error) {
    return json(
      { error: 'sso_exchange_failed', message: error instanceof Error ? error.message : String(error) },
      500,
      corsHeaders,
    )
  }
}

export const onRequestOptions = async ({ request }: any) => {
  const origin = request.headers.get('Origin') || '*'
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cookie',
    },
  })
}
