import { supabase } from '../supabase'
import type {
  SortOption,
  VideoSaveWithVideo,
  VideoWithCreator,
  VideoVisibility,
} from '../../types'

const VIDEO_QUERY_TIMEOUT_MS = 8000

type VideoQueryResult = {
  data: VideoWithCreator[] | null
  error: { code?: string; message?: string } | null
}

const videoSelect = `
  *,
  profiles:profiles!videos_creator_id_fkey(
    user_id,
    full_name,
    username,
    avatar_url,
    is_verified,
    is_creator,
    specialty,
    bio,
    follower_count,
    video_count
  )
`

function isNoRowsError(error: { code?: string } | null) {
  return error?.code === 'PGRST116'
}

function applyVideoSort(query: any, sort: SortOption) {
  if (sort === 'most_viewed') {
    return query.order('view_count', { ascending: false }).order('created_at', { ascending: false })
  }

  if (sort === 'most_liked') {
    return query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
  }

  return query.order('created_at', { ascending: false })
}

function withTimeout<T>(run: () => PromiseLike<T>, label: string, timeoutMs = VIDEO_QUERY_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} request timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    Promise.resolve().then(run).then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export async function fetchVideos({
  category,
  sort = 'newest',
}: {
  category?: string
  sort?: SortOption
} = {}): Promise<VideoWithCreator[]> {
  let query = supabase
    .from('videos')
    .select(videoSelect)
    .eq('status', 'published')
    .eq('visibility', 'public')

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await withTimeout<VideoQueryResult>(
    () => applyVideoSort(query, sort),
    'Videos'
  )

  if (error) throw error

  return (data ?? []) as VideoWithCreator[]
}

export async function fetchVideo(videoId: string): Promise<VideoWithCreator> {
  const { data, error } = await supabase
    .from('videos')
    .select(videoSelect)
    .eq('id', videoId)
    .single()

  if (error) throw error

  return data as VideoWithCreator
}

export async function fetchRelatedVideos(
  videoId: string,
  category?: string | null
): Promise<VideoWithCreator[]> {
  let primaryQuery = supabase
    .from('videos')
    .select(videoSelect)
    .neq('id', videoId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .limit(8)

  if (category) {
    primaryQuery = primaryQuery.eq('category', category)
  }

  const { data, error } = await withTimeout<VideoQueryResult>(
    () => primaryQuery.order('created_at', { ascending: false }),
    'Related videos'
  )

  if (error) throw error

  const related = (data ?? []) as VideoWithCreator[]
  if (related.length >= 6 || !category) {
    return related
  }

  const { data: fallback, error: fallbackError } = await withTimeout<VideoQueryResult>(
    () =>
      supabase
        .from('videos')
        .select(videoSelect)
        .neq('id', videoId)
        .neq('category', category)
        .eq('status', 'published')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(8 - related.length),
    'Related videos'
  )

  if (fallbackError) throw fallbackError

  return [...related, ...((fallback ?? []) as VideoWithCreator[])]
}

export async function searchVideos(query: string): Promise<VideoWithCreator[]> {
  const term = query.trim()
  if (term.length < 2) return []

  const escaped = term.replace(/[%_,]/g, '')
  const { data, error } = await supabase
    .from('videos')
    .select(videoSelect)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .or(
      `title.ilike.%${escaped}%,description.ilike.%${escaped}%,category.ilike.%${escaped}%`
    )
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as VideoWithCreator[]
}

export async function fetchCreatorVideos(userId: string): Promise<VideoWithCreator[]> {
  const { data, error } = await supabase
    .from('videos')
    .select(videoSelect)
    .eq('creator_id', userId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as VideoWithCreator[]
}

export async function fetchMyVideos(userId: string): Promise<VideoWithCreator[]> {
  const { data, error } = await supabase
    .from('videos')
    .select(videoSelect)
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as VideoWithCreator[]
}

export async function fetchSavedVideos(userId: string): Promise<VideoSaveWithVideo[]> {
  const { data, error } = await supabase
    .from('video_saves')
    .select(`
      user_id,
      video_id,
      created_at,
      videos:videos!video_saves_video_id_fkey(
        *,
        profiles:profiles!videos_creator_id_fkey(
          user_id,
          full_name,
          username,
          avatar_url,
          is_verified,
          is_creator,
          specialty,
          bio,
          follower_count,
          video_count
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []).filter((row) => row.videos) as unknown) as VideoSaveWithVideo[]
}

export async function fetchFollowingVideos(userId: string): Promise<VideoWithCreator[]> {
  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)

  if (followsError) throw followsError

  const followingIds = (follows ?? []).map((row) => row.following_id)
  if (followingIds.length === 0) return []

  const { data, error } = await supabase
    .from('videos')
    .select(videoSelect)
    .in('creator_id', followingIds)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as VideoWithCreator[]
}

export async function likeVideo(userId: string, videoId: string) {
  const { error } = await supabase
    .from('video_likes')
    .insert({ user_id: userId, video_id: videoId })

  if (error) throw error
}

export async function unlikeVideo(userId: string, videoId: string) {
  const { error } = await supabase
    .from('video_likes')
    .delete()
    .eq('user_id', userId)
    .eq('video_id', videoId)

  if (error) throw error
}

export async function checkVideoLiked(userId: string, videoId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('video_likes')
    .select('video_id')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .maybeSingle()

  if (error && !isNoRowsError(error)) throw error

  return !!data
}

export async function saveVideo(userId: string, videoId: string) {
  const { error } = await supabase
    .from('video_saves')
    .insert({ user_id: userId, video_id: videoId })

  if (error) throw error
}

export async function unsaveVideo(userId: string, videoId: string) {
  const { error } = await supabase
    .from('video_saves')
    .delete()
    .eq('user_id', userId)
    .eq('video_id', videoId)

  if (error) throw error
}

export async function checkVideoSaved(userId: string, videoId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('video_saves')
    .select('video_id')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .maybeSingle()

  if (error && !isNoRowsError(error)) throw error

  return !!data
}

export async function recordVideoView(userId: string, videoId: string) {
  const { error } = await supabase
    .from('video_views')
    .insert({ user_id: userId, video_id: videoId })

  if (error && error.code !== '23505') throw error
}

export async function deleteVideo(videoId: string) {
  const { error } = await supabase.from('videos').delete().eq('id', videoId)
  if (error) throw error
}

export async function deleteOwnVideo(userId: string, videoId: string) {
  const { data, error } = await supabase
    .from('videos')
    .delete()
    .eq('id', videoId)
    .eq('creator_id', userId)
    .select('id')

  if (error) throw error
  if (!data?.length) {
    throw new Error('Video not found or you do not have permission to delete it.')
  }
}

export type UpdateVideoParams = {
  user_id: string
  videoId: string
  title: string
  description?: string
  category: string
  tags: string[]
  visibility: VideoVisibility
  thumbnail_url?: string | null
}

export async function updateVideo(params: UpdateVideoParams) {
  const updates: Record<string, unknown> = {
    title: params.title,
    description: params.description || null,
    category: params.category,
    tags: params.tags,
    visibility: params.visibility,
    updated_at: new Date().toISOString(),
  }

  if (params.thumbnail_url !== undefined) {
    updates.thumbnail_url = params.thumbnail_url
  }

  const { data, error } = await supabase
    .from('videos')
    .update(updates)
    .eq('id', params.videoId)
    .eq('creator_id', params.user_id)
    .select('id')
    .single()

  if (error) throw error
  return data
}

export type CreateVideoParams = {
  creator_id: string
  title: string
  description?: string
  category: string
  tags: string[]
  visibility: 'public' | 'followers_only'
  mux_upload_id: string
  thumbnail_url?: string | null
}

export async function createVideo(params: CreateVideoParams) {
  const { data, error } = await supabase
    .from('videos')
    .insert({
      creator_id: params.creator_id,
      title: params.title,
      description: params.description || null,
      category: params.category,
      tags: params.tags,
      visibility: params.visibility,
      mux_upload_id: params.mux_upload_id,
      thumbnail_url: params.thumbnail_url ?? null,
      status: 'processing',
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function uploadVideoThumbnail(userId: string, file: File) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/video-thumbnails/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: false })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  return urlData.publicUrl
}
