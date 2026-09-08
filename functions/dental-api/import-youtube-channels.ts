import { createClient } from '@supabase/supabase-js'

const CHANNELS = {
  mrburglobal: { handle: '@mrburglobal', label: 'MR.BUR Global', fallbackCategory: 'Dental Burs' },
  'kaneiko-global': { handle: '@kaneiko-global', label: 'KANEIKO Global', fallbackCategory: 'General Dentistry' },
} as const

type ChannelKey = keyof typeof CHANNELS
type ChannelLookup = { parameter: 'forHandle' | 'id' | 'forUsername'; value: string }
type Env = {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  YOUTUBE_API_KEY?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function normalizeLanguage(value: unknown) {
  if (typeof value !== 'string') return null
  const base = value.trim().toLowerCase().replace(/_/g, '-').split('-')[0]
  if (!/^[a-z]{2,3}$/.test(base) || base === 'und' || base === 'zxx') return null
  return base === 'iw' ? 'he' : base
}

function detectLanguage(video: any) {
  const snippet = video?.snippet || {}
  const declared = normalizeLanguage(snippet.defaultAudioLanguage) || normalizeLanguage(snippet.defaultLanguage)
  if (declared) return declared
  const text = `${snippet.title || ''} ${snippet.description || ''}`
  const lower = text.toLowerCase()
  if (/[ก-๙]/u.test(text)) return 'th'
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/u.test(text)) return 'ko'
  if (/[ぁ-ゖァ-ヺ]/u.test(text)) return 'ja'
  if (/[؀-ۿ]/u.test(text)) return 'ar'
  if (/[一-龯]/u.test(text)) return 'zh'
  if (/\b(kedokteran|dokter gigi|kesehatan gigi|perawatan gigi|gigi|mulut)\b/u.test(lower)) return 'id'
  return 'en'
}

function classifyCategory(video: any, fallback: string) {
  const text = `${video?.snippet?.title || ''} ${video?.snippet?.description || ''}`.toLowerCase()
  const rules: Array<[string, RegExp]> = [
    ['Implantology', /\b(implant|implantology|osseointegration|bone graft|sinus lift)\b/],
    ['Orthodontics', /\b(orthodont|braces|aligner|malocclusion)\b/],
    ['Endodontics', /\b(endodont|root canal|obturation|apicoectomy)\b/],
    ['Periodontology', /\b(periodont|gingiv|gum graft|scaling and root planing)\b/],
    ['Oral Surgery', /\b(oral surgery|extraction|wisdom tooth|suture|maxillofacial)\b/],
    ['Pediatric Dentistry', /\b(pediatric|paediatric|child dentistry|primary teeth|pulpotomy)\b/],
    ['Prosthodontics', /\b(prosthodont|denture|crown|bridge|veneer|dental laboratory)\b/],
    ['Oral Hygiene', /\b(oral hygiene|prophylaxis|toothbrush|floss|teeth cleaning)\b/],
    ['Dental Burs', /\b(dental bur|diamond bur|carbide bur|burs|rotary instrument)\b/],
    ['Handpieces', /\b(handpiece|air turbine|contra-angle|micromotor)\b/],
    ['Clinic Management', /\b(clinic management|practice management|dental business|patient management)\b/],
    ['Radiology', /\b(radiology|radiograph|x-ray|xray|cbct|panoramic)\b/],
  ]
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || fallback
}

function youtubeError(payload: any) {
  return payload?.error?.errors?.[0]?.reason || payload?.error?.message || 'YouTube request failed.'
}

function parseChannelLookup(input: unknown): ChannelLookup | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw || raw.length > 300) return null
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(raw)) return { parameter: 'forHandle', value: raw }

  let url: URL
  try {
    url = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const hostname = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '')
  if (hostname !== 'youtube.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 1) return null

  if (/^@[A-Za-z0-9._-]{3,30}$/.test(parts[0])) return { parameter: 'forHandle', value: parts[0] }
  if (parts[0] === 'channel' && /^UC[A-Za-z0-9_-]{20,30}$/.test(parts[1] || '')) {
    return { parameter: 'id', value: parts[1] }
  }
  if (parts[0] === 'user' && /^[A-Za-z0-9._-]{1,100}$/.test(parts[1] || '')) {
    return { parameter: 'forUsername', value: parts[1] }
  }
  // Legacy /c/name links commonly match the channel's modern handle.
  if (parts[0] === 'c' && /^[A-Za-z0-9._-]{3,100}$/.test(parts[1] || '')) {
    return { parameter: 'forHandle', value: `@${parts[1]}` }
  }
  return null
}

async function youtubeJson(url: URL) {
  const response = await fetch(url.toString())
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(youtubeError(payload))
  return payload
}

export async function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY
  const youtubeKey = context.env.YOUTUBE_API_KEY
  if (!supabaseUrl || !serviceKey || !youtubeKey) return json({ error: 'Channel importer configuration is incomplete.' }, 503)

  const authorization = context.request.headers.get('Authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null
  if (!token) return json({ error: 'Sign in again before importing channels.' }, 401)

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json({ error: 'Your session has expired.' }, 401)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('user_id', user.id)
    .single()
  if (profileError) return json({ error: 'Unable to verify administrator access.' }, 500)
  if (profile?.account_type !== 'admin') return json({ error: 'Administrator access is required.' }, 403)

  const body = await context.request.json().catch(() => ({}))
  const channelKey = String(body?.channel || '') as ChannelKey
  const customLookup = parseChannelLookup(body?.channelUrl)
  const pageToken = typeof body?.pageToken === 'string' ? body.pageToken : ''
  if ((!(channelKey in CHANNELS) && !customLookup) || pageToken.length > 300) {
    return json({ error: 'Enter a valid YouTube channel link. Video and playlist links are not supported.' }, 400)
  }

  const fixedChannel = channelKey in CHANNELS ? CHANNELS[channelKey] : null
  const lookup: ChannelLookup = fixedChannel
    ? { parameter: 'forHandle', value: fixedChannel.handle }
    : customLookup!
  try {
    const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
    channelUrl.searchParams.set('part', 'snippet,contentDetails')
    channelUrl.searchParams.set(lookup.parameter, lookup.value)
    channelUrl.searchParams.set('key', youtubeKey)
    const channelPayload = await youtubeJson(channelUrl)
    const channelResource = channelPayload.items?.[0]
    const uploadsPlaylistId = channelResource?.contentDetails?.relatedPlaylists?.uploads
    const channelLabel = channelResource?.snippet?.title || fixedChannel?.label || lookup.value
    if (!uploadsPlaylistId) return json({ error: `YouTube channel ${channelLabel} was not found. Use its @handle or /channel/ link.` }, 404)

    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    playlistUrl.searchParams.set('part', 'contentDetails,snippet')
    playlistUrl.searchParams.set('playlistId', uploadsPlaylistId)
    playlistUrl.searchParams.set('maxResults', '50')
    playlistUrl.searchParams.set('key', youtubeKey)
    if (pageToken) playlistUrl.searchParams.set('pageToken', pageToken)
    const playlistPayload = await youtubeJson(playlistUrl)
    const listedIds = [...new Set((playlistPayload.items || [])
      .map((item: any) => item?.contentDetails?.videoId)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
    const playlistItemsByVideoId = new Map<string, any>((playlistPayload.items || [])
      .map((item: any) => [item?.contentDetails?.videoId, item])
      .filter(([id]: [unknown, any]) => typeof id === 'string'))

    if (listedIds.length === 0) {
      return json({ channel: channelKey || 'custom', channelLabel, found: 0, inserted: 0, duplicates: 0, unavailable: 0, videos: [], nextPageToken: playlistPayload.nextPageToken || null })
    }

    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    detailsUrl.searchParams.set('part', 'snippet,status')
    detailsUrl.searchParams.set('id', listedIds.join(','))
    detailsUrl.searchParams.set('key', youtubeKey)
    const detailsPayload = await youtubeJson(detailsUrl)
    const availableVideos = (detailsPayload.items || []).filter((video: any) => video?.status?.privacyStatus === 'public')
    const availableIds = new Set(availableVideos.map((video: any) => video.id))

    let existingRows: Array<{ video_id: string; title: string }> = []
    if (availableIds.size > 0) {
      const { data, error: existingError } = await supabase
        .from('dental_videos')
        .select('video_id,title')
        .in('video_id', [...availableIds])
      if (existingError) return json({ error: 'Unable to check the library for duplicate videos.' }, 500)
      existingRows = data || []
    }
    const existingIds = new Set((existingRows || []).map((row) => row.video_id))

    const rows = availableVideos
      .filter((video: any) => !existingIds.has(video.id))
      .map((video: any) => {
        const thumbnails = video.snippet?.thumbnails || {}
        const category = classifyCategory(video, fixedChannel?.fallbackCategory || 'General Dentistry')
        return {
          video_id: video.id,
          title: video.snippet?.title || 'Untitled YouTube video',
          description: video.snippet?.description || '',
          thumbnail_url: thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
          channel_name: video.snippet?.channelTitle || channelLabel,
          published_at: video.snippet?.publishedAt || new Date().toISOString(),
          category,
          language: detectLanguage(video),
          video_type: null,
          confidence_score: null,
          tags: [category, 'YouTube', 'Official channel import'],
        }
      })

    let insertedVideos: any[] = []
    if (rows.length > 0) {
      const { data, error: insertError } = await supabase
        .from('dental_videos')
        .upsert(rows, { onConflict: 'video_id', ignoreDuplicates: true })
        .select('id,video_id,title,thumbnail_url,channel_name,published_at,category,language')
      if (insertError) return json({ error: 'The channel videos could not be saved.' }, 500)
      insertedVideos = data || []
    }

    const insertedIds = new Set(insertedVideos.map((video) => video.video_id))
    const existingTitles = new Map(existingRows.map((video) => [video.video_id, video.title]))
    const detailTitles = new Map(availableVideos.map((video: any) => [video.id, video.snippet?.title || 'Untitled YouTube video']))
    const notAdded = listedIds.flatMap((videoId) => {
      if (insertedIds.has(videoId)) return []
      const playlistTitle = playlistItemsByVideoId.get(videoId)?.snippet?.title
      if (!availableIds.has(videoId)) {
        return [{
          video_id: videoId,
          title: playlistTitle && playlistTitle !== 'Private video' && playlistTitle !== 'Deleted video' ? playlistTitle : 'Unavailable YouTube video',
          reason: 'Private, deleted, restricted, or unavailable through the YouTube API',
          reasonCode: 'unavailable',
          youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
        }]
      }
      if (existingIds.has(videoId)) {
        return [{
          video_id: videoId,
          title: existingTitles.get(videoId) || detailTitles.get(videoId) || playlistTitle || 'Existing YouTube video',
          reason: 'Already exists in the video library',
          reasonCode: 'duplicate',
          youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
        }]
      }
      return [{
        video_id: videoId,
        title: detailTitles.get(videoId) || playlistTitle || 'YouTube video',
        reason: 'Not inserted because a duplicate was detected while saving',
        reasonCode: 'save_duplicate',
        youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
      }]
    })

    return json({
      channel: channelKey || 'custom',
      channelLabel,
      found: listedIds.length,
      inserted: insertedVideos.length,
      duplicates: existingIds.size + Math.max(0, rows.length - insertedVideos.length),
      unavailable: listedIds.length - availableIds.size,
      videos: insertedVideos,
      notAdded,
      nextPageToken: playlistPayload.nextPageToken || null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'YouTube channel import failed.'
    const quotaExceeded = /quota|dailyLimit/i.test(message)
    return json({
      error: quotaExceeded ? 'The YouTube API quota has been reached. Continue after the daily reset.' : message,
      code: quotaExceeded ? 'YOUTUBE_QUOTA_EXCEEDED' : 'YOUTUBE_CHANNEL_IMPORT_FAILED',
    }, quotaExceeded ? 429 : 502)
  }
}
