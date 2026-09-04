import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, VolumeX } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { AdvertisementOverlay } from '@/components/dental/AdvertisementOverlay'
import { CategoryBadge } from '@/components/CategoryBadge'
import { RetryCard } from '@/components/shared/RetryCard'
import { Skeleton } from '@/components/ui/skeleton'
import { getAdjacentVideos, getVideoById } from '@/lib/dentalVideosApi'
import { getAdvertisementForVideo, getAdvertisementFrequency, type VideoAdvertisement } from '@/lib/videoAdvertisements'
import type { AdjacentDentalVideos, DentalVideo } from '@/types/dentalVideo'

function formatPublishedDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const emptyAdjacentVideos: AdjacentDentalVideos = {
  previous: null,
  next: null,
  sponsor: null,
}

type YouTubePlayer = {
  destroy: () => void
  mute: () => void
  playVideo: () => void
}

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars: Record<string, number>
      events: {
        onReady: (event: { target: YouTubePlayer }) => void
        onStateChange: (event: { data: number }) => void
        onError: () => void
      }
    }
  ) => YouTubePlayer
  PlayerState: { ENDED: number }
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.()
      if (window.YT) resolve(window.YT)
      else reject(new Error('YouTube player API did not load'))
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    )
    if (existingScript) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('Unable to load YouTube player'))
    document.head.appendChild(script)
  })

  return youtubeApiPromise
}

async function getVideoPage(id: string) {
  const [video, adjacent] = await Promise.all([
    getVideoById(id),
    getAdjacentVideos(id).catch(() => emptyAdjacentVideos),
  ])

  return { video, adjacent }
}

export function DentalVideoDetail() {
  const { id } = useParams({ from: '/dental-videos/$id' })
  const navigate = useNavigate()

  const [video, setVideo] = useState<DentalVideo | null>(null)
  const [adjacent, setAdjacent] =
    useState<AdjacentDentalVideos>(emptyAdjacentVideos)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [advertisement, setAdvertisement] = useState<VideoAdvertisement | null>(null)
  const [isAdvertisementResolving, setIsAdvertisementResolving] = useState(true)
  const playerHostRef = useRef<HTMLDivElement | null>(null)
  const countedVideoRef = useRef<string | null>(null)
  const pendingVideoCountRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setAdjacent(emptyAdjacentVideos)
    setAdvertisement(null)
    setIsAdvertisementResolving(true)

    getVideoPage(id)
      .then(({ video: videoData, adjacent: adjacentData }) => {
        if (!cancelled) {
          setVideo(videoData)
          setAdjacent(adjacentData)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load video')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!video) return
    let cancelled = false

    if (countedVideoRef.current !== video.id) {
      countedVideoRef.current = video.id
      const storedValue = window.sessionStorage.getItem('dental-ad-video-count')
      const storedCount = storedValue === null ? null : Number(storedValue)
      pendingVideoCountRef.current = storedCount !== null && Number.isFinite(storedCount) ? storedCount + 1 : null
    }

    setIsAdvertisementResolving(true)
    Promise.all([getAdvertisementForVideo(video), getAdvertisementFrequency()])
      .then(([matchedAdvertisement, frequency]) => {
        if (!cancelled) {
          if (!matchedAdvertisement) {
            setAdvertisement(null)
            return
          }
          const viewedVideos = pendingVideoCountRef.current ?? frequency
          const shouldShow = viewedVideos >= frequency
          setAdvertisement(shouldShow ? matchedAdvertisement : null)
          window.sessionStorage.setItem('dental-ad-video-count', shouldShow ? '0' : String(viewedVideos))
        }
      })
      .catch(() => {
        if (!cancelled) setAdvertisement(null)
      })
      .finally(() => {
        if (!cancelled) setIsAdvertisementResolving(false)
      })

    return () => { cancelled = true }
  }, [video])

  useEffect(() => {
    const playerHost = playerHostRef.current
    if (!video || !playerHost || advertisement || isAdvertisementResolving) return

    let cancelled = false
    let player: YouTubePlayer | null = null
    const playerMount = document.createElement('div')
    playerMount.className = 'h-full w-full'
    playerHost.replaceChildren(playerMount)

    const continuePlayback = () => {
      if (!adjacent.next) return

      navigate({
        to: '/dental-videos/$id',
        params: { id: adjacent.next.id },
      })
    }

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        player = new YT.Player(playerMount, {
          videoId: video.video_id,
          playerVars: {
            autoplay: 1,
            mute: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: ({ target }) => {
              target.mute()
              target.playVideo()
            },
            onStateChange: ({ data }) => {
              if (data === YT.PlayerState.ENDED) continuePlayback()
            },
            onError: continuePlayback,
          },
        })
      })
      .catch(() => {
        if (adjacent.next) navigate({ to: '/dental-videos/$id', params: { id: adjacent.next.id } })
      })

    return () => {
      cancelled = true
      try {
        player?.destroy()
      } catch {
        // YouTube may already have detached its iframe during a fast route change.
      }
      playerHost.replaceChildren()
    }
  }, [advertisement, adjacent.next, isAdvertisementResolving, navigate, video])

  useEffect(() => {
    const handleArrowNavigation = (event: KeyboardEvent) => {
      if (advertisement || isAdvertisementResolving) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')
      ) {
        return
      }

      const destination =
        event.key === 'ArrowLeft'
          ? adjacent.previous
          : event.key === 'ArrowRight'
            ? adjacent.next
            : null

      if (destination) {
        event.preventDefault()
        navigate({ to: '/dental-videos/$id', params: { id: destination.id } })
      }
    }

    window.addEventListener('keydown', handleArrowNavigation)
    return () => window.removeEventListener('keydown', handleArrowNavigation)
  }, [advertisement, adjacent, isAdvertisementResolving, navigate])

  useEffect(() => {
    if (video) {
      document.title = `${video.title} | Dental Videos | DentalLearn`
    } else {
      document.title = 'Dental Videos | DentalLearn'
    }
  }, [video])

  return (
    <>
      <Navbar />

      <div className="mx-auto max-w-[960px] px-4 py-6 pb-20 md:px-6 md:pb-12">
        <Link
          to="/explore"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
          Back to library
        </Link>

        {error ? (
          <RetryCard
            onRetry={() => {
              setError(null)
              setIsLoading(true)
              getVideoPage(id)
                .then(({ video: videoData, adjacent: adjacentData }) => {
                  setVideo(videoData)
                  setAdjacent(adjacentData)
                })
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
            <div
              className="relative w-full overflow-hidden rounded-xl bg-black"
              style={{ paddingBottom: '56.25%' }}
            >
              <div
                ref={playerHostRef}
                className="absolute inset-0 h-full w-full"
                aria-label={video.title}
              />

              {adjacent.previous ? (
                <Link
                  to="/dental-videos/$id"
                  params={{ id: adjacent.previous.id }}
                  aria-label={`Previous video: ${adjacent.previous.title}`}
                  title={`Previous: ${adjacent.previous.title}`}
                  className="absolute left-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/60 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-[#2D6E6A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:left-4"
                >
                  <ChevronLeft className="h-7 w-7" aria-hidden="true" />
                </Link>
              ) : null}

              {adjacent.next ? (
                <Link
                  to="/dental-videos/$id"
                  params={{ id: adjacent.next.id }}
                  aria-label={`Next video: ${adjacent.next.title}`}
                  title={`Next: ${adjacent.next.title}`}
                  className="absolute right-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/60 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-[#2D6E6A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:right-4"
                >
                  <ChevronRight className="h-7 w-7" aria-hidden="true" />
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <VolumeX className="h-4 w-4" aria-hidden="true" />
                Autoplay starts muted. Use the player controls to turn sound on.
              </span>
              <span className="hidden sm:inline">Use ← and → to change videos</span>
            </div>

            <h1 className="text-xl font-medium leading-snug text-foreground md:text-2xl">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-[#3D5C5C] dark:text-foreground">
                {video.channel_name}
              </span>
              <span className="text-[#9BB5B5] dark:text-muted-foreground">
                {formatPublishedDate(video.published_at)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {video.category && (
                <CategoryBadge
                  category={video.category}
                  needsReview={video.needs_review}
                />
              )}
              {video.confidence_score != null && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300">
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

            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {video.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {video.description && (
              <div className="card mt-4 p-4">
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {video.description}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {advertisement && <AdvertisementOverlay advertisement={advertisement} onComplete={() => setAdvertisement(null)} />}
    </>
  )
}
