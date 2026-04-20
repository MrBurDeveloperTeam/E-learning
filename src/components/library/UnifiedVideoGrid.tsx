import { DentalVideoCard } from '@/components/dental/VideoCard'
import { DentalVideoCardSkeleton } from '@/components/dental/VideoCardSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { VideoCard } from '@/components/video/VideoCard'
import { VideoCardSkeleton } from '@/components/video/VideoCardSkeleton'
import type { UnifiedVideoItem } from '@/lib/libraryFeed'

interface UnifiedVideoGridProps {
  items: UnifiedVideoItem[]
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function UnifiedVideoGrid({
  items,
  isLoading = false,
  emptyTitle = 'No videos found',
  emptyDescription = 'Try another category or search term.',
}: UnifiedVideoGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) =>
          index % 2 === 0 ? (
            <VideoCardSkeleton key={`community-skeleton-${index}`} />
          ) : (
            <DentalVideoCardSkeleton key={`dental-skeleton-${index}`} />
          )
        )}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) =>
        item.kind === 'community' ? (
          <VideoCard key={item.id} video={item.video} />
        ) : (
          <DentalVideoCard key={item.id} video={item.video} />
        )
      )}
    </div>
  )
}
