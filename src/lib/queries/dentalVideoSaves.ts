import { supabase } from '../supabase'
import type { DentalVideo } from '@/types/dentalVideo'

export async function checkDentalVideoSaved(userId: string, dentalVideoId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('dental_video_saves')
    .select('id')
    .eq('user_id', userId)
    .eq('dental_video_id', dentalVideoId)
    .maybeSingle()

  if (error) throw error
  return !!data
}

export async function saveDentalVideo(userId: string, dentalVideoId: string) {
  const { error } = await supabase
    .from('dental_video_saves')
    .upsert(
      { user_id: userId, dental_video_id: dentalVideoId },
      { onConflict: 'user_id,dental_video_id', ignoreDuplicates: true }
    )

  if (error) throw error
}

export async function unsaveDentalVideo(userId: string, dentalVideoId: string) {
  const { error } = await supabase
    .from('dental_video_saves')
    .delete()
    .eq('user_id', userId)
    .eq('dental_video_id', dentalVideoId)

  if (error) throw error
}

export interface SavedDentalVideo {
  saved_at: string
  video: DentalVideo
}

export async function fetchSavedDentalVideos(userId: string): Promise<SavedDentalVideo[]> {
  const { data, error } = await supabase
    .from('dental_video_saves')
    .select('created_at, dental_videos(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as Array<{
    created_at: string
    dental_videos: DentalVideo | DentalVideo[] | null
  }>)
    .map((row) => ({
      saved_at: row.created_at,
      video: Array.isArray(row.dental_videos) ? row.dental_videos[0] : row.dental_videos,
    }))
    .filter((item): item is SavedDentalVideo => !!item.video)
}
