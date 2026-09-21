import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../api/_shared/auth'

const PAGE_SIZE = 12
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VIDEO_TYPES = new Set(['short_video', 'video'])

type Env = { SUPABASE_URL?: string; VITE_SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...getCorsHeaders(request, 'GET, PATCH, DELETE, OPTIONS') },
  })
}

async function requireAdmin(request: Request, env: Env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { ok: false as const, status: 503, error: 'Server configuration is incomplete.' }
  const header = request.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null
  if (!token) return { ok: false as const, status: 401, error: 'Sign in again to continue.' }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { ok: false as const, status: 401, error: 'Your session has expired.' }
  const { data: profile } = await supabase.from('profiles').select('account_type').eq('user_id', user.id).single()
  if (profile?.account_type !== 'admin') return { ok: false as const, status: 403, error: 'Administrator access is required.' }
  return { ok: true as const, supabase }
}

export function onRequestOptions(context: { request: Request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request, 'GET, PATCH, DELETE, OPTIONS') })
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const auth = await requireAdmin(context.request, context.env)
  if (!auth.ok) return json(context.request, { error: auth.error }, auth.status)
  const url = new URL(context.request.url)
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1))
  const search = (url.searchParams.get('q') || '').trim().slice(0, 100).replace(/[%_,()]/g, ' ')
  const category = (url.searchParams.get('category') || '').trim()
  const videoType = (url.searchParams.get('videoType') || '').trim()
  const from = (page - 1) * PAGE_SIZE
  let query = auth.supabase
    .from('dental_videos')
    .select('id,video_id,title,thumbnail_url,channel_name,category,language,video_type,fetched_at', { count: 'exact' })
    .order('fetched_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (search) query = query.or(`title.ilike.%${search}%,channel_name.ilike.%${search}%,video_id.ilike.%${search}%`)
  if (category) query = query.eq('category', category)
  if (videoType === 'unclassified') query = query.is('video_type', null)
  else if (VIDEO_TYPES.has(videoType)) query = query.eq('video_type', videoType)
  const { data, count, error } = await query
  if (error) return json(context.request, { error: 'Unable to load imported videos.' }, 500)
  return json(context.request, { videos: data || [], total: count || 0, page, pageSize: PAGE_SIZE })
}

export async function onRequestPatch(context: { request: Request; env: Env }) {
  const auth = await requireAdmin(context.request, context.env)
  if (!auth.ok) return json(context.request, { error: auth.error }, auth.status)
  const body = await context.request.json().catch(() => null) as { id?: unknown; category?: unknown; videoType?: unknown } | null
  const id = String(body?.id || '')
  const category = String(body?.category || '')
  const videoType = String(body?.videoType || '')
  if (!UUID_PATTERN.test(id) || !category || !VIDEO_TYPES.has(videoType)) return json(context.request, { error: 'The video update is invalid.' }, 400)
  const { data, error } = await auth.supabase.from('dental_videos').update({ category, video_type: videoType }).eq('id', id).select('id,category,video_type').maybeSingle()
  if (error || !data) return json(context.request, { error: 'The video could not be updated.' }, 500)
  return json(context.request, { video: data })
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  const auth = await requireAdmin(context.request, context.env)
  if (!auth.ok) return json(context.request, { error: auth.error }, auth.status)
  const id = new URL(context.request.url).searchParams.get('id') || ''
  if (!UUID_PATTERN.test(id)) return json(context.request, { error: 'The video ID is invalid.' }, 400)
  const { data, error } = await auth.supabase.from('dental_videos').delete().eq('id', id).select('id').maybeSingle()
  if (error || !data) return json(context.request, { error: 'The video could not be removed.' }, 500)
  return json(context.request, { removed: id })
}
