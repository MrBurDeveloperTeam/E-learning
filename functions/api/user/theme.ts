const VALID_THEMES = new Set(['light', 'dark', 'system'])
const COOKIE_NAME = 'snabbb-theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function parseTheme(value: unknown): string | null {
  if (!value) return null
  const raw = String(value).trim().toLowerCase()
  return VALID_THEMES.has(raw) ? raw : null
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie') || ''
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...valueParts] = part.trim().split('=')
    if (!key) return acc
    acc[key] = decodeURIComponent(valueParts.join('='))
    return acc
  }, {})
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  }
}

function getThemeCookieDomain(request: Request, env: any): string | null {
  const configured = String(env?.SNABBB_COOKIE_DOMAIN || env?.THEME_COOKIE_DOMAIN || '').trim()
  if (configured) return configured

  const { hostname } = new URL(request.url)
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) return null
  if (hostname === 'snabbb.com' || hostname.endsWith('.snabbb.com')) return '.snabbb.com'
  return null
}

function buildThemeCookie(request: Request, env: any, theme: string): string {
  const { protocol } = new URL(request.url)
  const domain = getThemeCookieDomain(request, env)
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(theme)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ]

  if (domain) parts.push(`Domain=${domain}`)
  if (protocol === 'https:') parts.push('Secure')

  return parts.join('; ')
}

function getOdooCookieHeader(request: Request): string {
  const cookies = parseCookies(request)
  const cookieParts: string[] = []

  if (cookies.session_id) cookieParts.push(`session_id=${encodeURIComponent(cookies.session_id)}`)
  // This app stores the Odoo session id in mrbur_sso after login.
  if (cookies.mrbur_sso && !cookies.session_id) cookieParts.push(`session_id=${encodeURIComponent(cookies.mrbur_sso)}`)

  const originalCookie = request.headers.get('Cookie')
  if (originalCookie) cookieParts.push(originalCookie)

  return cookieParts.join('; ')
}

async function proxyOdooTheme(request: Request, env: any, bodyText?: string) {
  const base = String(env?.ODOO_BASE || 'https://mrbur.odoo.com').replace(/\/$/, '')
  const cookieHeader = getOdooCookieHeader(request)

  return fetch(`${base}/api/user/theme`, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      Accept: 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    ...(request.method === 'POST' ? { body: bodyText ?? (await request.text()) } : {}),
  })
}

export const onRequestOptions = async (context: any) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.request),
  })
}

export const onRequestGet = async (context: any) => {
  const { request, env } = context
  const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders(request) })

  try {
    const upstream = await proxyOdooTheme(request, env)
    const text = await upstream.text()
    let data: any = null
    try { data = JSON.parse(text) } catch { data = null }

    const theme = parseTheme(data?.theme)
    if (upstream.ok && theme) {
      headers.append('Set-Cookie', buildThemeCookie(request, env, theme))
      return new Response(JSON.stringify({ ok: true, authenticated: true, theme }), {
        status: 200,
        headers,
      })
    }

    return new Response(JSON.stringify({ ok: false, authenticated: false, theme: null }), {
      status: upstream.status || 401,
      headers,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, authenticated: false, error: error?.message || 'theme_sync_unavailable' }), {
      status: 503,
      headers,
    })
  }
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context
  const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders(request) })

  let body: any = null
  let bodyText = ''
  try {
    bodyText = await request.text()
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers,
    })
  }

  const theme = parseTheme(body?.theme)
  if (!theme) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid theme' }), {
      status: 400,
      headers,
    })
  }

  headers.append('Set-Cookie', buildThemeCookie(request, env, theme))

  try {
    const upstream = await proxyOdooTheme(request, env, JSON.stringify({ theme }))
    const data = await upstream.json().catch(() => null) as any
    const upstreamTheme = parseTheme(data?.theme) || theme

    return new Response(JSON.stringify({
      ok: upstream.ok,
      authenticated: Boolean(data?.authenticated || data?.ok),
      theme: upstreamTheme,
      synced: upstream.ok,
    }), {
      status: upstream.ok ? 200 : 202,
      headers,
    })
  } catch {
    return new Response(JSON.stringify({ ok: true, authenticated: false, theme, synced: false }), {
      status: 202,
      headers,
    })
  }
}
