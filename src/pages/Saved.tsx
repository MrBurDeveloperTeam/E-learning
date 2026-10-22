import { lazy, Suspense } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { Bookmark, Lock, Play } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoCard } from '@/components/video/VideoCard'
import { VideoCardSkeleton } from '@/components/video/VideoCardSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
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

const CommunitySavedPosts = lazy(() => import('@/features/community/components/CommunitySavedPosts').then((module) => ({ default: module.CommunitySavedPosts })))

export function Saved() {
  const session = useAuthStore((state) => state.session)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { tab } = useSearch({ from: '/saved' })

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <PageHeader title="Saved" subtitle="Find the videos and Community posts you saved." />
        <nav aria-label="Saved content" className="mb-6 flex gap-2 border-b border-border">
          <Link to="/saved" search={{ tab: undefined }} aria-current={tab !== 'posts' ? 'page' : undefined} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab !== 'posts' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Play size={16} aria-hidden="true" /> Videos
          </Link>
          <Link to="/saved" search={{ tab: 'posts' }} aria-current={tab === 'posts' ? 'page' : undefined} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === 'posts' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Bookmark size={16} aria-hidden="true" /> Community posts
          </Link>
        </nav>

        {!session && !isAuthLoading && (
          <div className="py-16 text-center">
            <Lock className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 mb-2 text-lg font-medium text-foreground">Sign in to view saved items</h2>
            <p className="mb-6 text-sm text-muted-foreground">Save videos and Community posts to find them here later.</p>
            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm">Sign in</Link>
          </div>
        )}

        {isAuthLoading && <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>}
        {session && (tab === 'posts' ? (
          <Suspense fallback={<div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>}>
            <CommunitySavedPosts userId={session.user.id} />
          </Suspense>
        ) : <SavedVideos />)}
      </div>
    </>
  )
}

function SavedVideos() {
  const { data: saves = [], isLoading, isError, refetch } = useSavedVideos()
  const { data: savedYoutube = [], isLoading: isYoutubeLoading, isError: isYoutubeError, refetch: refetchYoutube } = useSavedDentalVideos()

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
        {(isError || isYoutubeError) && <RetryCard onRetry={() => { void refetch(); void refetchYoutube() }} />}

        {!isError && !isYoutubeError && isListLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <VideoCardSkeleton key={index} />
            ))}
          </div>
        )}

        {!isError && !isYoutubeError && !isListLoading && items.length === 0 && (
          <EmptyState
            title="No saved videos"
            description="Save videos to watch them later"
          />
        )}

        {!isError && !isYoutubeError && !isListLoading && items.length > 0 && (
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
    </>
  )
}
