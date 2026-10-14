import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ODOO_SSO_API_KEY?: string
  SSO_API_KEY?: string
  ODOO_BASE?: string
}

type Ctx = {
  request: Request
  env: Env
  waitUntil: (p: Promise<unknown>) => void
}

// Edge cache (per Cloudflare colo). Avatars change rarely, so we keep them for
// a long time but revalidate in the background once an entry is "stale".
const EDGE_TTL_S = 24 * 60 * 60 // how long Cloudflare may keep the entry
const FRESH_MS = 10 * 60 * 1000 // after this, serve stale + refresh in background
const NEGATIVE_TTL_S = 60 // "no avatar" answers are cached briefly
const BROWSER_CACHE = 'public, max-age=600, stale-while-revalidate=86400'

type Built =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; status: number; message: string }

async function buildAvatar(userId: string, env: Env): Promise<Built> {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const odooApiKey = env.ODOO_SSO_API_KEY || env.SSO_API_KEY
  const missing = [
    !supabaseUrl && 'SUPABASE_URL',
    !env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    !odooApiKey && 'ODOO_SSO_API_KEY',
  ].filter(Boolean)
  if (missing.length) {
    return { ok: false, status: 503, message: `Avatar service unavailable: ${missing.join(', ')}` }
  }

  const admin = createClient(supabaseUrl!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [{ data: authData }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('profiles').select('email').eq('user_id', userId).maybeSingle(),
  ])
  // Auth email is the canonical Snabbb account identity. Older accounts do not
  // always have a profiles row, so retain the profile email only as a fallback.
  const email = authData?.user?.email || (profile?.email as string | null) || null
  if (!email) return { ok: false, status: 404, message: 'Avatar unavailable' }

  const upstream = await fetch(
    `${String(env.ODOO_BASE || 'https://mrbur.odoo.com').replace(/\/$/, '')}/api/v1/account/public_avatars`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SSO-API-KEY': odooApiKey! },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { emails: [email] }, id: 1 }),
    }
  )
  const result = (await upstream.json().catch(() => null)) as { result?: Record<string, string> } | null
  const encoded = result?.result?.[email.trim().toLowerCase()]
  if (!upstream.ok || !encoded) return { ok: false, status: 404, message: 'Avatar unavailable' }

  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49
  return {
    ok: true,
    bytes,
    contentType: isPng ? 'image/png' : isGif ? 'image/gif' : 'image/jpeg',
  }
}

function toClientResponse(built: Built, cacheStatus: string): Response {
  if (!built.ok) {
    return new Response(built.message, {
      status: built.status,
      headers: {
        'Cache-Control': built.status === 404 ? 'public, max-age=60' : 'no-store',
        'X-Avatar-Cache': cacheStatus,
      },
    })
  }
  return new Response(built.bytes, {
    headers: {
      'Content-Type': built.contentType,
      'Cache-Control': BROWSER_CACHE,
      'X-Content-Type-Options': 'nosniff',
      'X-Avatar-Cache': cacheStatus,
    },
  })
}

// Store the built result in the edge cache. Only successes and "no avatar"
// answers are cached; 5xx (misconfig / upstream failure) never are.
async function putEdge(cache: Cache, key: Request, built: Built) {
  if (!built.ok && built.status !== 404) return
  const ttl = built.ok ? EDGE_TTL_S : NEGATIVE_TTL_S
  const headers: Record<string, string> = {
    'Cache-Control': `public, max-age=${ttl}`,
    'X-Cached-At': String(Date.now()),
  }
  if (built.ok) headers['Content-Type'] = built.contentType
  await cache.put(
    key,
    built.ok
      ? new Response(built.bytes, { status: 200, headers })
      : new Response('Avatar unavailable', { status: 404, headers })
  )
}

export const onRequestGet = async ({ request, env, waitUntil }: Ctx) => {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return new Response('Invalid user', { status: 400 })

  const cache = (caches as unknown as { default: Cache }).default
  // Key on userId only so unrelated query params can't fragment the cache.
  const cacheKey = new Request(`https://avatar-cache.snabbb.internal/public-avatar/${userId.toLowerCase()}`, {
    method: 'GET',
  })

  const hit = await cache.match(cacheKey)
  if (hit) {
    const cachedAt = Number(hit.headers.get('X-Cached-At') || 0)
    const isStale = Date.now() - cachedAt > (hit.status === 404 ? NEGATIVE_TTL_S * 1000 : FRESH_MS)
    if (isStale) {
      // Serve instantly, refresh for the next viewer.
      waitUntil(
        buildAvatar(userId, env)
          .then((built) => putEdge(cache, cacheKey, built))
          .catch(() => undefined)
      )
    }
    if (hit.status === 404) return toClientResponse({ ok: false, status: 404, message: 'Avatar unavailable' }, 'HIT')
    return new Response(hit.body, {
      headers: {
        'Content-Type': hit.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': BROWSER_CACHE,
        'X-Content-Type-Options': 'nosniff',
        'X-Avatar-Cache': isStale ? 'STALE' : 'HIT',
      },
    })
  }

  const built = await buildAvatar(userId, env)
  waitUntil(putEdge(cache, cacheKey, built).catch(() => undefined))
  return toClientResponse(built, 'MISS')
}
