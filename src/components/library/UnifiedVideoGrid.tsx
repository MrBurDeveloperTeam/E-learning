import { DentalVideoCard } from '@/components/dental/VideoCard'
import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { VideoCard } from '@/components/video/VideoCard'
import { ShimmerCard } from '@/components/ui/ShimmerCard'
import { cn } from '@/lib/utils'
import type { UnifiedVideoItem } from '@/lib/libraryFeed'

interface UnifiedVideoGridProps {
  items: UnifiedVideoItem[]
  isLoading?: boolean
  /** Next page is being fetched: shimmer cards are appended inside the grid. */
  isFetchingMore?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

// Mirrors the grid's Tailwind breakpoints: 1 / sm:2 / lg:3 / xl:4 columns.
function columnsForWidth(width: number) {
  return width >= 1280 ? 4 : width >= 1024 ? 3 : width >= 640 ? 2 : 1
}

function useGridColumns() {
  const [columns, setColumns] = useState(() =>
    typeof window === 'undefined' ? 4 : columnsForWidth(window.innerWidth)
  )
  useEffect(() => {
    const update = () => setColumns(columnsForWidth(window.innerWidth))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return columns
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
  isFetchingMore = false,
  emptyTitle = 'No videos found',
  emptyDescription = 'Try another category or search term.',
}: UnifiedVideoGridProps) {
  const columns = useGridColumns()

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

      {isFetchingMore && (
        // Fill the unfinished last row first (solid), then one whole extra row
        // that fades out vertically, 100% -> 1%.
        <>
          {Array.from({ length: (columns - (items.length % columns)) % columns }).map((_, index) => (
            <ShimmerCard key={`fill-${index}`} className="aspect-[4/3]" aria-hidden="true" />
          ))}
          {Array.from({ length: columns }).map((_, index) => (
            <ShimmerCard key={`next-${index}`} className="aspect-[4/3]" fade aria-hidden="true" />
          ))}
        </>
      )}
    </div>
  )
}
