import { DentalVideoCard } from '@/components/dental/VideoCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { VideoCard } from '@/components/video/VideoCard'
import { ShimmerCard } from '@/components/ui/ShimmerCard'
import { cn } from '@/lib/utils'
import type { UnifiedVideoItem } from '@/lib/libraryFeed'

// Three rows: solid for the first two, then the last row fades 100% -> 1%.
const GRID_FADE_MASK =
  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 64%, rgba(0,0,0,0.01) 100%)'

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
    // Same grid as the real list (1 / 2 / 3 / 4 columns), three rows of empty
    // shimmer cards: 3, 6, 9 and 12 cells at the respective breakpoints. The grid
    // fades out vertically, so the last row goes from 100% to 1%.
    return (
      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        style={{ WebkitMaskImage: GRID_FADE_MASK, maskImage: GRID_FADE_MASK }}
        role="status"
        aria-busy="true"
        aria-label="Loading videos"
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <ShimmerCard
            key={index}
            className={cn(
              'aspect-[4/3]',
              index >= 9 ? 'hidden xl:block' : index >= 6 ? 'hidden lg:block' : index >= 3 ? 'hidden sm:block' : ''
            )}
          />
        ))}
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
