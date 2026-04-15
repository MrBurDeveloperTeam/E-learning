import { fetchPublicCreatorProfiles } from '@/lib/queries/profiles'
import { supabase } from '@/lib/supabase'
import type { SortOption, Video, VideoWithCreator } from '@/types'

async function attachPublicCreators(videos: Video[]): Promise<VideoWithCreator[]> {
  const creatorsById = await fetchPublicCreatorProfiles(
    videos.map((video) => video.creator_id)
  )

  return videos.map((video) => {
    const creator = creatorsById.get(video.creator_id)

    return {
      ...video,
      profiles: {
        user_id: creator?.user_id ?? video.creator_id,
        name: creator?.name ?? null,
        full_name: creator?.full_name ?? null,
        username: creator?.username ?? null,
        avatar_url: creator?.avatar_url ?? null,
        is_verified: creator?.is_verified ?? false,
        is_creator: creator?.is_creator ?? false,
        specialty: creator?.specialty ?? null,
        bio: creator?.bio ?? null,
        follower_count: creator?.follower_count ?? 0,
        video_count: creator?.video_count ?? 0,
      },
    }
  })
}

export async function fetchVideosPaginated(
  filters?: {
    category?: string
    sort?: SortOption
  },
  page = 0,
  pageSize = 24
) {
  let query = supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.sort === 'most_viewed') {
    query = query.order('view_count', { ascending: false })
  } else if (filters?.sort === 'most_liked') {
    query = query.order('like_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query
  if (error) throw error

  return attachPublicCreators((data ?? []) as Video[])
}
