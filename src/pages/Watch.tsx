import MuxPlayer from '@mux/mux-player-react'
import { Link, useParams, useNavigate } from '@tanstack/react-router'
import { Bookmark, Lock, Share2, ThumbsUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CommentSection } from '@/components/comments/CommentSection'
import { FollowButton } from '@/components/creator/FollowButton'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { VideoCard } from '@/components/video/VideoCard'
import { VideoCardSkeleton } from '@/components/video/VideoCardSkeleton'
import { cn, formatViewCount, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import {
  useRecordView,
  useRelatedVideos,
  useVideo,
  useVideoLike,
  useVideoSave,
} from '@/hooks/useVideos'

export function Watch() {
  const { videoId } = useParams({ from: '/watch/$videoId' })
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const isAuthenticated = !!session
  const [expanded, setExpanded] = useState(false)
  const hasRecordedView = useRef(false)

  const videoQuery = useVideo(videoId)
  const video = videoQuery.data
  const relatedQuery = useRelatedVideos(videoId, video?.category)
  const { isLiked, toggleLike, isPending: likePending } = useVideoLike(videoId)
  const { isSaved, toggleSave, isPending: savePending } = useVideoSave(videoId)
  const recordView = useRecordView()

  // Dynamic document title
  useEffect(() => {
    if (video?.title) {
      document.title = `${video.title} — DentalLearn`
    }
    return () => {
      document.title = 'DentalLearn — Dental Video Community'
    }
  }, [video?.title])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard!')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  function handleLike() {
    if (!isAuthenticated) {
      navigate({ to: '/login' })
      return
    }
    toggleLike.mutate()
  }

  function handleSave() {
    if (!isAuthenticated) {
      navigate({ to: '/login' })
      return
    }
    toggleSave.mutate()
  }

  return (
    <>
      <Navbar />
      <div className="max-w-[1400px] mx-auto lg:px-6 lg:py-6">
        {videoQuery.isError && (
          <div className="px-4 lg:px-0">
            <RetryCard onRetry={() => void videoQuery.refetch()} />
          </div>
        )}

        {(videoQuery.isLoading || isAuthLoading) && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] px-4 lg:px-0">
            <div className="space-y-4">
              <div className="aspect-video animate-pulse rounded-none lg:rounded-xl bg-[#D6E0E0]" />
              <div className="space-y-2">
                <div className="h-6 w-3/4 animate-pulse rounded bg-[#D6E0E0]" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-[#D6E0E0]" />
              </div>
            </div>
            <div className="hidden lg:block space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <VideoCardSkeleton key={index} size="horizontal" />
              ))}
            </div>
          </div>
        )}

        {video && !videoQuery.isError && !isAuthLoading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              {/* Video player — no border-radius on mobile */}
              <div className="w-full aspect-video bg-black lg:rounded-xl overflow-hidden">
                {isAuthenticated && video.mux_playback_id ? (
                  <MuxPlayer
                    playbackId={video.mux_playback_id}
                    streamType="on-demand"
                    autoPlay={false}
                    className="h-full w-full"
                    onPlay={() => {
                      if (!hasRecordedView.current) {
                        recordView.mutate(videoId)
                        hasRecordedView.current = true
                      }
                    }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#1E3333] px-6 text-center">
                    <Lock className="h-8 w-8 text-white" />
                    <p className="font-medium text-white">Sign in to watch this video</p>
                    <p className="max-w-xs text-sm text-[#9BB5B5]">
                      Create a free account to watch dental videos from verified professionals
                    </p>
                    <Link to="/register">
                      <button className="rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-[#1E3333] transition-colors hover:bg-[#EAF4F3]">
                        Create free account
                      </button>
                    </Link>
                    <Link to="/login" className="text-sm text-[#9BB5B5] hover:text-white">
                      Already have an account? Sign in
                    </Link>
                  </div>
                )}
              </div>

              {/* Info section — horizontal padding on mobile */}
              <div className="mt-3 px-4 lg:px-0">
                <h1 className="text-lg md:text-xl font-medium leading-snug text-[#1E3333]">
                  {video.title}
                </h1>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="flex flex-wrap items-center gap-1 text-sm text-[#6B8E8E]">
                    <span>{formatViewCount(video.view_count)} views</span>
                    <span>·</span>
                    <span>{timeAgo(video.created_at)}</span>
                    <span>·</span>
                    <span className="badge-specialty">{video.category}</span>
                  </p>

                  {/* Action buttons — icon-only on mobile */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={likePending}
                      onClick={handleLike}
                      className={cn(
                        'flex items-center gap-2 rounded-full border px-3 sm:px-4 py-2 text-sm font-medium transition-all',
                        isLiked
                          ? 'border-[#88C1BD] bg-[#EAF4F3] text-[#2D6E6A]'
                          : 'border-[#D4E8E7] bg-white text-[#6B8E8E] hover:border-[#88C1BD] hover:text-[#2D6E6A]'
                      )}
                    >
                      <ThumbsUp className={cn('h-4 w-4', isLiked && 'fill-current')} />
                      <span className="hidden sm:inline">
                        {video.like_count > 0 && formatViewCount(video.like_count)}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={savePending}
                      onClick={handleSave}
                      className={cn(
                        'flex items-center gap-2 rounded-full border px-3 sm:px-4 py-2 text-sm font-medium transition-all',
                        isSaved
                          ? 'border-[#88C1BD] bg-[#EAF4F3] text-[#2D6E6A]'
                          : 'border-[#D4E8E7] bg-white text-[#6B8E8E] hover:border-[#88C1BD] hover:text-[#2D6E6A]'
                      )}
                    >
                      <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />
                      <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="flex items-center gap-2 rounded-full border border-[#D4E8E7] bg-white px-3 sm:px-4 py-2 text-sm text-[#6B8E8E] transition-all hover:border-[#88C1BD] hover:text-[#2D6E6A]"
                    >
                      <Share2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Creator card */}
              <div className="mt-4 flex items-start justify-between border-t border-[#D6E0E0] pt-4 px-4 lg:px-0">
                <Link
                  to="/channel/$userId"
                  params={{ userId: video.creator_id }}
                  className="group flex items-center gap-3"
                >
                  <UserAvatar
                    name={video.profiles?.full_name ?? video.profiles?.username}
                    avatarUrl={video.profiles?.avatar_url}
                    size={44}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-[#1E3333] transition-colors group-hover:text-[#2D6E6A]">
                        {video.profiles?.full_name ?? 'Unknown creator'}
                      </p>
                      {video.profiles?.is_verified && <VerifiedBadge />}
                    </div>
                    <p className="text-xs text-[#6B8E8E]">
                      {video.profiles?.specialty ?? 'Dental professional'} ·{' '}
                      {formatViewCount(video.profiles?.follower_count ?? 0)} followers
                    </p>
                  </div>
                </Link>

                <FollowButton userId={video.creator_id} />
              </div>

              {/* Description */}
              <div
                className={cn(
                  'mt-3 rounded-xl bg-[#F7FAFA] p-4 mx-4 lg:mx-0',
                  !expanded && 'cursor-pointer'
                )}
                onClick={() => {
                  if (!expanded) setExpanded(true)
                }}
              >
                <p
                  className={cn(
                    'whitespace-pre-line text-sm leading-relaxed text-[#3D5C5C]',
                    !expanded && 'line-clamp-3'
                  )}
                >
                  {video.description || 'No description provided.'}
                </p>

                {video.description && video.description.length > 200 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setExpanded((current) => !current)
                    }}
                    className="mt-2 text-xs font-medium text-[#2D6E6A]"
                  >
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>

              {video.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 px-4 lg:px-0">
                  {video.tags.map((tag) => (
                    <Link key={tag} to="/search" search={{ q: tag }}>
                      <span className="rounded-full bg-[#EDF2F2] px-2.5 py-1 text-xs text-[#6B8E8E] transition-colors hover:bg-[#D4E8E7] hover:text-[#2D6E6A]">
                        #{tag}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Comments */}
              <div className="px-4 lg:px-0 mt-4">
                {isAuthenticated ? (
                  <CommentSection videoId={videoId} commentCount={video.comment_count} />
                ) : (
                  <div className="rounded-xl bg-[#F7FAFA] py-8 text-center">
                    <p className="text-sm text-[#6B8E8E]">
                      <Link to="/login" className="text-[#88C1BD]">
                        Sign in
                      </Link>{' '}
                      to read and post comments
                    </p>
                  </div>
                )}
              </div>

              {/* Related videos — mobile only (below comments) */}
              <div className="lg:hidden mt-6 px-4 pb-20">
                <p className="text-sm font-medium text-[#1E3333] mb-3">
                  Related videos
                </p>
                <div className="space-y-3">
                  {relatedQuery.isLoading &&
                    Array.from({ length: 4 }).map((_, index) => (
                      <VideoCardSkeleton key={index} size="horizontal" />
                    ))}
                  {relatedQuery.data?.map((relatedVideo) => (
                    <VideoCard
                      key={relatedVideo.id}
                      video={relatedVideo}
                      size="horizontal"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right sidebar — desktop only */}
            <div className="hidden lg:block space-y-3">
              <p className="text-sm font-medium text-[#1E3333]">Related videos</p>

              {relatedQuery.isError && <RetryCard onRetry={() => void relatedQuery.refetch()} />}

              {relatedQuery.isLoading &&
                Array.from({ length: 6 }).map((_, index) => (
                  <VideoCardSkeleton key={index} size="horizontal" />
                ))}

              {relatedQuery.data?.map((relatedVideo) => (
                <VideoCard
                  key={relatedVideo.id}
                  video={relatedVideo}
                  size="horizontal"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
