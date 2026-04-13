import type { VideoWithCreator } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { VideoCard } from './VideoCard'
import { VideoCardSkeleton } from './VideoCardSkeleton'

interface VideoGridProps {
  videos: VideoWithCreator[]
  isLoading?: boolean
  skeletonCount?: number
  columns?: 2 | 3 | 4
  emptyTitle?: string
  emptyDescription?: string
  size?: 'default' | 'small'
  showCategory?: boolean
}

const columnClasses = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
}

export function VideoGrid({
  videos,
  isLoading = false,
  skeletonCount = 12,
  columns = 4,
  emptyTitle = 'No videos found',
  emptyDescription = 'Try another category or check back later.',
  size = 'default',
  showCategory = false,
}: VideoGridProps) {
  if (isLoading) {
    return (
      <div className={`grid gap-6 ${columnClasses[columns]}`}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <VideoCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  return (
    <div className={`grid gap-6 ${columnClasses[columns]}`}>
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          size={size}
          showCreator={size !== 'small'}
          showCategory={showCategory}
        />
      ))}
    </div>
  )
}
