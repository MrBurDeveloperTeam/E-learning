import { Link } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoCard } from '@/components/video/VideoCard'
import { VideoCardSkeleton } from '@/components/video/VideoCardSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { DentalVideoCard } from '@/components/dental/VideoCard'
import { useSavedDentalVideos } from '@/hooks/useDentalVideoSaves'
import { useSavedVideos } from '@/hooks/useVideos'
import { useAuthStore } from '@/store/authStore'
import type { VideoWithCreator } from '@/types'
import type { DentalVideo } from '@/types/dentalVideo'

type SavedItem =
  | { kind: 'uploaded'; savedAt: string; video: VideoWithCreator }
  | { kind: 'youtube'; savedAt: string; video: DentalVideo }

export function Saved() {
  const session = useAuthStore((state) => state.session)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { data: saves = [], isLoading, isError, refetch } = useSavedVideos()
  const { data: savedYoutube = [], isLoading: isYoutubeLoading } = useSavedDentalVideos()

  // One list, newest save first, regardless of where the video came from.
  const items: SavedItem[] = [
    ...saves
      .filter((save) => !!save.videos)
      .map((save): SavedItem => ({
        kind: 'uploaded',
        savedAt: save.created_at,
        video: save.videos as VideoWithCreator,
      })),
    ...savedYoutube.map((save): SavedItem => ({
      kind: 'youtube',
      savedAt: save.saved_at,
      video: save.video,
    })),
  ].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

  const isListLoading = isLoading || isYoutubeLoading

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <PageHeader title="Saved videos" />

        {!session && !isAuthLoading && (
          <div className="py-16 text-center">
            <Lock className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 mb-2 text-lg font-medium text-foreground">
              Sign in to view saved videos
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Save videos to keep them handy for later
            </p>
            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm">
              Sign in
            </Link>
          </div>
        )}

        {session && isError && <RetryCard onRetry={() => void refetch()} />}

        {session && !isError && isListLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <VideoCardSkeleton key={index} />
            ))}
          </div>
        )}

        {session && !isError && !isListLoading && items.length === 0 && (
          <EmptyState
            title="No saved videos"
            description="Save videos to watch them later"
          />
        )}

        {session && !isError && !isListLoading && items.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) =>
              item.kind === 'uploaded' ? (
                <VideoCard key={`u-${item.video.id}`} video={item.video} showCreator />
              ) : (
                <DentalVideoCard key={`y-${item.video.id}`} video={item.video} />
              )
            )}
          </div>
        )}
      </div>
    </>
  )
}
