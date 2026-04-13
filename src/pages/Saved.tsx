import { Link } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoGrid } from '@/components/video/VideoGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import { useSavedVideos } from '@/hooks/useVideos'
import { useAuthStore } from '@/store/authStore'
import type { VideoWithCreator } from '@/types'

export function Saved() {
  const session = useAuthStore((state) => state.session)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { data: saves = [], isLoading, isError, refetch } = useSavedVideos()
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
            <Lock className="mx-auto h-8 w-8 text-[#88C1BD]" />
            <h2 className="mt-4 mb-2 text-lg font-medium text-[#1E3333]">
              Sign in to view saved videos
            </h2>
            <p className="mb-6 text-sm text-[#6B8E8E]">
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
            emptyTitle="No saved videos"
            emptyDescription="Save videos to watch them later"
          />
        )}
      </div>
    </>
  )
}
