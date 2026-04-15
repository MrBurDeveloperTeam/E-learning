import { supabase } from '@/lib/supabase'
import type { SortOption } from '@/types'

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
    .select(
      `
      *,
      profiles (
        user_id, name, full_name, username,
        avatar_url, is_verified, is_creator, specialty
      )
    `
    )
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
  return data ?? []
}
