import { supabase } from '@/lib/supabase'
import type { DentalVideo } from '@/types/dentalVideo'

export type VideoAdvertisement = {
  id: string
  campaign_name: string
  advertiser_name: string
  media_type: 'image' | 'video'
  media_url: string
  alt_text: string
  target_category: string | null
  target_video_type: string | null
  target_language: string | null
  skip_after_seconds: number
  cta_label: string | null
  click_url: string | null
  open_in_new_tab: boolean
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() || null
}

function matches(target: string | null, value: string | null) {
  return target === null || normalize(target) === normalize(value)
}

export async function getAdvertisementsForVideo(video: DentalVideo) {
  const activeAdvertisements: VideoAdvertisement[] = []
  // Fetch every active ad so large inventories are not silently excluded.
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('video_advertisements')
      .select('id,campaign_name,advertiser_name,media_type,media_url,alt_text,target_category,target_video_type,target_language,skip_after_seconds,cta_label,click_url,open_in_new_tab')
      .eq('status', 'active')
      .order('id')
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    activeAdvertisements.push(...data as VideoAdvertisement[])
    if (data.length < pageSize) break
  }

  const exactOrGlobalMatches = activeAdvertisements.filter((advertisement) =>
    matches(advertisement.target_category, video.category) &&
    matches(advertisement.target_video_type, video.video_type) &&
    matches(advertisement.target_language, video.language)
  )

  if (!activeAdvertisements.length) return []

  // Prefer ads whose targeting is fully compatible with the video. If none
  // exists, fall back to the active ads sharing the most target attributes so
  // a scheduled ad opportunity is not silently lost.
  const targetingScore = (advertisement: VideoAdvertisement) => [
          normalize(advertisement.target_category) === normalize(video.category),
          normalize(advertisement.target_video_type) === normalize(video.video_type),
          normalize(advertisement.target_language) === normalize(video.language),
        ].filter(Boolean).length
  const bestFallbackScore = Math.max(...activeAdvertisements.map(targetingScore))
  const matchesForVideo = exactOrGlobalMatches.length
    ? exactOrGlobalMatches
    : activeAdvertisements.filter((advertisement) => targetingScore(advertisement) === bestFallbackScore)

  return matchesForVideo
}

export async function getAdvertisementFrequency() {
  const { data, error } = await supabase
    .from('video_advertisement_settings')
    .select('frequency_videos')
    .eq('id', true)
    .single()

  if (error) throw error
  return Math.max(1, Number(data.frequency_videos) || 3)
}
