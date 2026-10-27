import { DentalVideoCard } from '@/components/dental/VideoCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { VideoCard } from '@/components/video/VideoCard'
import { ShimmerCard } from '@/components/ui/ShimmerCard'
import { cn } from '@/lib/utils'
import type { UnifiedVideoItem } from '@/lib/libraryFeed'

interface UnifiedVideoGridProps {
  items: UnifiedVideoItem[]
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * Loading placeholder for the video grid: empty shimmer cards on the same
 * 1 / 2 / 3 / 4 column grid as the real list, `rows` rows tall (so 1-4 cards
 * per row depending on screen width). The last row fades vertically, 100% -> 1%.
 * Used for the initial load (3 rows) and while fetching the next page (1 row).
 */
export function UnifiedVideoGridLoading({ rows = 3 }: { rows?: number }) {
  const solidUntil = Math.max(0, Math.round(((rows - 1) / rows) * 100) - 2)
  const mask = `linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${solidUntil}%, rgba(0,0,0,0.01) 100%)`
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
      role="status"
      aria-busy="true"
      aria-label="Loading videos"
    >
      {Array.from({ length: rows * 4 }).map((_, index) => (
        <ShimmerCard
          key={index}
          className={cn(
            'aspect-[4/3]',
            index >= rows * 3 ? 'hidden xl:block' : index >= rows * 2 ? 'hidden lg:block' : index >= rows ? 'hidden sm:block' : ''
          )}
        />
      ))}
    </div>
  )
}

export function UnifiedVideoGrid({
  items,
  isLoading = false,
  emptyTitle = 'No videos found',
  emptyDescription = 'Try another category or search term.',
}: UnifiedVideoGridProps) {
  if (isLoading) return <UnifiedVideoGridLoading rows={3} />

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
