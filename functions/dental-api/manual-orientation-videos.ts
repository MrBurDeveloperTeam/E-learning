import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../api/_shared/auth'

const PAGE_SIZE = 24
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_VIDEO_TYPES = new Set(['short_video', 'video'])

type Env = {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...getCorsHeaders(request, 'GET, PATCH, OPTIONS'),
    },
  })
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('Authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null
}

function config(env: Env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  return url && serviceKey ? { url, serviceKey } : null
}

async function requireAdmin(request: Request, env: Env) {
  const serverConfig = config(env)
  if (!serverConfig) return { ok: false as const, status: 503, error: 'Server configuration is incomplete.' }

  const token = bearerToken(request)
  if (!token) return { ok: false as const, status: 401, error: 'Sign in again to continue.' }

  const supabase = createClient(serverConfig.url, serverConfig.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { ok: false as const, status: 401, error: 'Your session has expired.' }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('user_id', user.id)
    .single()
  if (profileError) return { ok: false as const, status: 500, error: 'Unable to verify administrator access.' }
  if (profile?.account_type !== 'admin') return { ok: false as const, status: 403, error: 'Administrator access is required.' }

  return { ok: true as const, supabase }
}

export function onRequestOptions(context: { request: Request }) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, 'GET, PATCH, OPTIONS'),
  })
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const authorization = await requireAdmin(context.request, context.env)
  if (!authorization.ok) return json(context.request, { error: authorization.error }, authorization.status)

  const url = new URL(context.request.url)
  const requestedPage = Number(url.searchParams.get('page') || 1)
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
  const search = (url.searchParams.get('q') || '').trim().slice(0, 100)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = authorization.supabase
    .from('dental_videos')
    .select('id,video_id,title,thumbnail_url,channel_name,category,language,fetched_at', { count: 'exact' })
    .is('video_type', null)
    .order('fetched_at', { ascending: true })
    .range(from, to)

  if (search) {
    const safeSearch = search.replace(/[%_,()]/g, ' ')
    query = query.or(`title.ilike.%${safeSearch}%,channel_name.ilike.%${safeSearch}%,video_id.ilike.%${safeSearch}%`)
  }

  const { data, count, error } = await query
  if (error) return json(context.request, { error: 'Unable to load videos awaiting classification.' }, 500)

  return json(context.request, {
    videos: data || [],
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  })
}

export async function onRequestPatch(context: { request: Request; env: Env }) {
  const authorization = await requireAdmin(context.request, context.env)
  if (!authorization.ok) return json(context.request, { error: authorization.error }, authorization.status)

  const body = await context.request.json().catch(() => null) as { id?: unknown; videoType?: unknown } | null
  const id = String(body?.id || '')
  const videoType = String(body?.videoType || '')
  if (!UUID_PATTERN.test(id) || !ALLOWED_VIDEO_TYPES.has(videoType)) {
    return json(context.request, { error: 'The classification request is invalid.' }, 400)
  }

  const { data, error } = await authorization.supabase
    .from('dental_videos')
    .update({ video_type: videoType })
    .eq('id', id)
    .is('video_type', null)
    .select('id,video_type')
    .maybeSingle()

  if (error) return json(context.request, { error: 'The classification could not be saved.' }, 500)
  if (!data) return json(context.request, { error: 'This video has already been classified or no longer exists.' }, 409)

  return json(context.request, { video: data })
}
