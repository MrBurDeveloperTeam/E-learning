import { getVideos } from '@/lib/dentalVideosApi'
import { fetchVideosPaginated } from '@/lib/queries/videosPaginated'
import { getDentalCategoryFilter, normalizeLibraryCategory } from '@/lib/videoLibrary'
import type { VideoWithCreator } from '@/types'
import type { DentalVideo } from '@/types/dentalVideo'

export type UnifiedVideoItem =
  | {
      kind: 'community'
      id: string
      sortDate: string
      video: VideoWithCreator
    }
  | {
      kind: 'dental'
      id: string
      sortDate: string
      video: DentalVideo
    }

export type UnifiedVideoPage = {
  items: UnifiedVideoItem[]
  hasMore: boolean
}

function getDentalSortDate(video: DentalVideo) {
  return video.published_at || video.fetched_at
}

export async function fetchUnifiedVideoPage({
  category,
  q,
  page = 0,
  pageSize = 24,
}: {
  category?: string
  q?: string
  page?: number
  pageSize?: number
}): Promise<UnifiedVideoPage> {
  const normalizedCategory = normalizeLibraryCategory(category)
  const dentalCategory = getDentalCategoryFilter(normalizedCategory)

  const [communityVideos, dentalResponse] = await Promise.all([
    fetchVideosPaginated(
      { category: normalizedCategory, q },
      page,
      pageSize
    ),
    getVideos({
      category: dentalCategory,
      q,
      page: page + 1,
      limit: pageSize,
      sort: 'newest',
    }),
  ])

  const items: UnifiedVideoItem[] = [
    ...communityVideos.map((video) => ({
      kind: 'community' as const,
      id: `community-${video.id}`,
      sortDate: video.created_at,
      video,
    })),
    ...dentalResponse.data.map((video) => ({
      kind: 'dental' as const,
      id: `dental-${video.id}`,
      sortDate: getDentalSortDate(video),
      video: {
        ...video,
        category: normalizeLibraryCategory(video.category) ?? video.category,
      },
    })),
  ].sort(
    (left, right) =>
      new Date(right.sortDate).getTime() - new Date(left.sortDate).getTime()
  )

  return {
    items,
    hasMore:
      communityVideos.length === pageSize ||
      dentalResponse.page < dentalResponse.totalPages,
  }
}
