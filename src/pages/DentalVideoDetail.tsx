import { useState, useEffect } from 'react'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { Navbar } from '@/components/layout/Navbar'
import { CategoryBadge } from '@/components/CategoryBadge'
import { RetryCard } from '@/components/shared/RetryCard'
import { Skeleton } from '@/components/ui/skeleton'
import { getVideoById } from '@/lib/dentalVideosApi'
import type { DentalVideo } from '@/types/dentalVideo'

/**
 * Format an ISO date string to "Mar 2024" style.
 */
function formatPublishedDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function DentalVideoDetail() {
  const { id } = useParams({ from: '/dental-videos/$id' })

  const [video, setVideo] = useState<DentalVideo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── Fetch video ────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    getVideoById(id)
      .then((data) => {
        if (!cancelled) setVideo(data)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load video')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  // ─── SEO ────────────────────────────────────────────
  useEffect(() => {
    if (video) {
      document.title = `${video.title} | Dental Videos | DentalLearn`
    } else {
      document.title = 'Dental Videos | DentalLearn'
    }
  }, [video])

  // Build back link preserving filters from referrer search params
  const routerState = useRouterState()
  const previousPath = routerState.location.href
  const backTo = previousPath.includes('/dental-videos')
    ? '/dental-videos'
    : '/dental-videos'

  return (
    <>
      <Navbar />

      <div className="mx-auto max-w-[960px] px-4 md:px-6 py-6 pb-20 md:pb-12">
        {/* Back link */}
        <Link
          to="/dental-videos"
          search={{ category: '', q: '', page: 1 }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to videos
        </Link>

        {error ? (
          <RetryCard
            onRetry={() => {
              setError(null)
              setIsLoading(true)
              getVideoById(id)
                .then(setVideo)
                .catch((err) =>
                  setError(
                    err instanceof Error ? err.message : 'Failed to load video'
                  )
                )
                .finally(() => setIsLoading(false))
            }}
            message={error}
          />
        ) : isLoading ? (
          /* Loading skeleton */
          <div className="space-y-4">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-7 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ) : video ? (
          <div className="space-y-5">
            {/* YouTube player embed */}
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${video.video_id}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>

            {/* Title */}
            <h1 className="text-xl md:text-2xl font-medium text-foreground leading-snug">
              {video.title}
            </h1>

            {/* Channel + date */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-[#3D5C5C] dark:text-foreground">
                {video.channel_name}
              </span>
              <span className="text-[#9BB5B5] dark:text-muted-foreground">
                {formatPublishedDate(video.published_at)}
              </span>
            </div>

            {/* Category badge + confidence score */}
            <div className="flex flex-wrap items-center gap-2">
              {video.category && (
                <CategoryBadge
                  category={video.category}
                  needsReview={video.needs_review}
                />
              )}
              {video.confidence_score != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-medium border border-emerald-200 dark:border-emerald-800/60">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="m9 11 3 3L22 4" />
                  </svg>
                  {Math.round(video.confidence_score * 100)}% match
                </span>
              )}
            </div>

            {/* Tags */}
            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {video.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {video.description && (
              <div className="card p-4 mt-4">
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {video.description}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}
