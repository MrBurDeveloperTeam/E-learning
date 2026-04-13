import { Link, useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoGrid } from '@/components/video/VideoGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { useFollowingVideos } from '@/hooks/useVideos'
import { useAuthStore } from '@/store/authStore'

export function Feed() {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { data: videos = [], isLoading, isError, refetch } = useFollowingVideos()

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <PageHeader
          title="Following"
          subtitle="Latest videos from creators you follow"
        />

        {!session && !isAuthLoading && (
          <div className="py-16 text-center">
            <Lock className="mx-auto h-8 w-8 text-[#88C1BD]" />
            <h2 className="mt-4 mb-2 text-lg font-medium text-[#1E3333]">
              Sign in to see your feed
            </h2>
            <p className="mb-6 text-sm text-[#6B8E8E]">
              Follow dental professionals to see their latest videos here
            </p>
            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm">
              Sign in
            </Link>
          </div>
        )}

        {session && isError && <RetryCard onRetry={() => void refetch()} />}

        {session && !isError && videos.length === 0 && !isLoading && (
          <EmptyState
            title="Your feed is empty"
            description="Follow dental professionals to see their videos here"
            actionLabel="Discover creators"
            onAction={() => navigate({ to: '/' })}
          />
        )}

        {session && !isError && (
          <VideoGrid videos={videos} columns={4} isLoading={isLoading} />
        )}
      </div>
    </>
  )
}
