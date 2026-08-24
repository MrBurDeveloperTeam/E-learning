import { signHS256 } from '../_shared/auth'

interface Env {
  ODOO_BASE?: string
  TICKETING_SSO_SECRET?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') || ''
  const cookies = cookieHeader.split(';').reduce<Record<string, string>>((result, part) => {
    const [name, ...valueParts] = part.trim().split('=')
    if (name) result[name] = decodeURIComponent(valueParts.join('='))
    return result
  }, {})
  const sessionId = cookies.session_id || cookies.mrbur_sso

  return sessionId ? `session_id=${encodeURIComponent(sessionId)}` : null
}

export const onRequestPost = async (context: {
  request: Request
  env: Env
}) => {
  const { request, env } = context
  const secret = env.TICKETING_SSO_SECRET

  if (!secret) {
    return jsonResponse({ ok: false, error: 'Ticketing SSO is not configured.' }, 503)
  }

  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) {
    return jsonResponse({ ok: false, error: 'Unable to verify your Snabbb account.' }, 401)
  }

  try {
    const odooBase = String(env.ODOO_BASE || 'https://mrbur.odoo.com').replace(/\/$/, '')
    const sessionResponse = await fetch(`${odooBase}/web/session/get_session_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {}, id: Date.now() }),
    })
    const sessionData: any = await sessionResponse.json().catch(() => null)
    const session = sessionData?.result

    if (!sessionResponse.ok || sessionData?.error || !session?.uid || !session?.partner_id) {
      return jsonResponse({ ok: false, error: 'Unable to verify your Snabbb account.' }, 401)
    }

    const now = Math.floor(Date.now() / 1000)
    const token = await signHS256({
      header: { alg: 'HS256', typ: 'JWT' },
      payload: {
        sub: String(session.uid),
        partner_id: session.partner_id,
        aud: 'snabbb-ticketing-portal',
        iat: now,
        exp: now + 60,
        jti: crypto.randomUUID(),
      },
      secret,
    })

    return jsonResponse({
      ok: true,
      url: `${odooBase}/snabbb/ticketing/sso?token=${encodeURIComponent(token)}`,
    })
  } catch (error) {
    console.error('Ticketing SSO error:', error)
    return jsonResponse({ ok: false, error: 'Ticketing sign-in is unavailable.' }, 502)
  }
}
