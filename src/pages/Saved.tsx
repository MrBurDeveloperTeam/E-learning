import { Link } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoGrid } from '@/components/video/VideoGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import { DentalVideoCard } from '@/components/dental/VideoCard'
import { useSavedDentalVideos } from '@/hooks/useDentalVideoSaves'
import { useSavedVideos } from '@/hooks/useVideos'
import { useAuthStore } from '@/store/authStore'
import type { VideoWithCreator } from '@/types'

export function Saved() {
  const session = useAuthStore((state) => state.session)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { data: saves = [], isLoading, isError, refetch } = useSavedVideos()
  const { data: savedYoutube = [] } = useSavedDentalVideos()
  const videos = saves
    .map((save) => save.videos)
    .filter(Boolean) as VideoWithCreator[]

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

        {session && !isError && (
          <VideoGrid
            videos={videos}
            isLoading={isLoading}
            columns={4}
            emptyTitle={savedYoutube.length > 0 ? 'No saved uploaded videos' : 'No saved videos'}
            emptyDescription="Save videos to watch them later"
          />
        )}

        {session && savedYoutube.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-medium text-foreground">Saved YouTube videos</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {savedYoutube.map((video) => (
                <DentalVideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
