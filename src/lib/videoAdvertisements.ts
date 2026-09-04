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
  priority: number
  weight: number
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

export async function getAdvertisementForVideo(video: DentalVideo) {
  const { data, error } = await supabase
    .from('video_advertisements')
    .select('id,campaign_name,advertiser_name,media_type,media_url,alt_text,target_category,target_video_type,target_language,priority,weight,skip_after_seconds,cta_label,click_url,open_in_new_tab')
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(100)

  if (error) throw error

  const activeAdvertisements = data as VideoAdvertisement[]
  const exactOrGlobalMatches = activeAdvertisements.filter((advertisement) =>
    matches(advertisement.target_category, video.category) &&
    matches(advertisement.target_video_type, video.video_type) &&
    matches(advertisement.target_language, video.language)
  )

  if (!activeAdvertisements.length) return null

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

  const highestPriority = Math.max(...matchesForVideo.map((advertisement) => advertisement.priority))
  const candidates = matchesForVideo.filter((advertisement) => advertisement.priority === highestPriority)
  const totalWeight = candidates.reduce((total, advertisement) => total + Math.max(advertisement.weight, 1), 0)
  let draw = Math.random() * totalWeight

  for (const candidate of candidates) {
    draw -= Math.max(candidate.weight, 1)
    if (draw <= 0) return candidate
  }

  return candidates[0]
}
