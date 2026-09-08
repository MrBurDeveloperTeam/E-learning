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
}

type YouTubePlayer = {
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
  mute: () => void
  pauseVideo: () => void
  playVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
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

const MINIMUM_MIDROLL_VIDEO_SECONDS = 120

function getRandomMidrollSecond(duration: number): number | null {
  if (!Number.isFinite(duration) || duration < MINIMUM_MIDROLL_VIDEO_SECONDS) return null
  const earliest = Math.max(30, duration * 0.2)
  const latest = Math.min(duration - 30, duration * 0.75)
  if (latest <= earliest) return null
  return earliest + Math.random() * (latest - earliest)
}

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
  const video = await getVideoById(id)
  const historyKey = `dental-video-history-${video.video_type || 'unknown'}`
  let history: string[] = []
  try {
    const storedHistory = JSON.parse(window.sessionStorage.getItem(historyKey) || '[]')
    if (Array.isArray(storedHistory)) history = storedHistory.filter((item): item is string => typeof item === 'string')
  } catch {
    history = []
  }
  if (!history.includes(video.id)) history.push(video.id)
  window.sessionStorage.setItem(historyKey, JSON.stringify(history))
  const adjacent = await getAdjacentVideos(id, history).catch(() => emptyAdjacentVideos)

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
  const [isEntryAdvertisementPlaying, setIsEntryAdvertisementPlaying] = useState(false)
  const [isAdvertisementPlaying, setIsAdvertisementPlaying] = useState(false)
  const [isAdvertisementResolving, setIsAdvertisementResolving] = useState(true)
  const playerHostRef = useRef<HTMLDivElement | null>(null)
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null)
  const countedVideoRef = useRef<string | null>(null)
  const pendingVideoCountRef = useRef(1)
  const midrollSecondRef = useRef<number | null>(null)
  const midrollShownForVideoRef = useRef<string | null>(null)
  const entryAdvertisementPlayingRef = useRef(false)
  const advertisementPlayingRef = useRef(false)
  const resumeSecondRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setAdjacent(emptyAdjacentVideos)
    setAdvertisement(null)
    setIsEntryAdvertisementPlaying(false)
    setIsAdvertisementPlaying(false)
    entryAdvertisementPlayingRef.current = false
    advertisementPlayingRef.current = false
    midrollSecondRef.current = null
    midrollShownForVideoRef.current = null
    resumeSecondRef.current = 0
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
      pendingVideoCountRef.current = storedCount !== null && Number.isFinite(storedCount) ? storedCount + 1 : 1
    }

    setIsAdvertisementResolving(true)
    Promise.all([getAdvertisementForVideo(video), getAdvertisementFrequency()])
      .then(([matchedAdvertisement, frequency]) => {
        if (!cancelled) {
          if (!matchedAdvertisement) {
            setAdvertisement(null)
            setIsEntryAdvertisementPlaying(false)
            entryAdvertisementPlayingRef.current = false
            window.sessionStorage.setItem('dental-ad-video-count', String(pendingVideoCountRef.current))
            return
          }
          const viewedVideos = pendingVideoCountRef.current
          const shouldShow = viewedVideos >= frequency
          // Matching an advertisement and deciding whether to show the
          // frequency-based entry popup are intentionally separate. Long
          // videos can schedule a mid-roll even when the popup is not due.
          setAdvertisement(matchedAdvertisement)
          setIsEntryAdvertisementPlaying(shouldShow)
          entryAdvertisementPlayingRef.current = shouldShow
          if (!shouldShow) {
            window.sessionStorage.setItem('dental-ad-video-count', String(viewedVideos))
          }
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
    if (!video || !playerHost || isAdvertisementResolving) return

    let cancelled = false
    let player: YouTubePlayer | null = null
    let midrollTimer: number | null = null
    const playerMount = document.createElement('div')
    playerMount.className = 'h-full w-full'
    playerHost.replaceChildren(playerMount)

    const continuePlayback = () => {
      if (adjacent.next) {
        navigate({ to: '/dental-videos/$id', params: { id: adjacent.next.id } })
      }
    }

    const triggerMidrollIfDue = (target: YouTubePlayer) => {
      if (
        !advertisement ||
        advertisementPlayingRef.current ||
        midrollShownForVideoRef.current === video.id
      ) {
        return false
      }

      if (midrollSecondRef.current === null) {
        const duration = target.getDuration()
        midrollSecondRef.current = getRandomMidrollSecond(duration)
        if (midrollSecondRef.current === null) return false
      }

      const currentSecond = target.getCurrentTime()
      if (currentSecond < midrollSecondRef.current) return false

      resumeSecondRef.current = currentSecond
      midrollShownForVideoRef.current = video.id
      advertisementPlayingRef.current = true
      target.pauseVideo()
      setIsAdvertisementPlaying(true)
      return true
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
              youtubePlayerRef.current = target
              target.mute()
              if (entryAdvertisementPlayingRef.current) target.pauseVideo()
              else target.playVideo()
              midrollTimer = window.setInterval(() => {
                triggerMidrollIfDue(target)
              }, 100)
            },
            onStateChange: ({ data }) => {
              if (data === YT.PlayerState.ENDED && player && !triggerMidrollIfDue(player)) {
                continuePlayback()
              }
            },
            onError: continuePlayback,
          },
        })
      })
      .catch(() => {
        continuePlayback()
      })

    return () => {
      cancelled = true
      if (midrollTimer !== null) window.clearInterval(midrollTimer)
      youtubePlayerRef.current = null
      try {
        player?.destroy()
      } catch {
        // YouTube may already have detached its iframe during a fast route change.
      }
      playerHost.replaceChildren()
    }
  }, [advertisement, adjacent.next, isAdvertisementResolving, navigate, video])

  const completeEntryAdvertisement = () => {
    setIsEntryAdvertisementPlaying(false)
    entryAdvertisementPlayingRef.current = false
    window.sessionStorage.setItem('dental-ad-video-count', '0')
    youtubePlayerRef.current?.playVideo()
  }

  const completeAdvertisement = () => {
    setIsAdvertisementPlaying(false)
    advertisementPlayingRef.current = false
    const player = youtubePlayerRef.current
    if (!player) return
    player.seekTo(resumeSecondRef.current, true)
    player.playVideo()
  }

  useEffect(() => {
    const handleArrowNavigation = (event: KeyboardEvent) => {
      if (isEntryAdvertisementPlaying || isAdvertisementPlaying || isAdvertisementResolving) return
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
  }, [adjacent, isAdvertisementPlaying, isAdvertisementResolving, isEntryAdvertisementPlaying, navigate])

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

      {advertisement && isEntryAdvertisementPlaying ? (
        <AdvertisementOverlay
          advertisement={advertisement}
          onComplete={completeEntryAdvertisement}
        />
      ) : null}

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
            <nav
              className="grid grid-cols-2 gap-8 sm:gap-16"
              aria-label="Video navigation"
            >
              {adjacent.previous ? (
                <Link
                  to="/dental-videos/$id"
                  params={{ id: adjacent.previous.id }}
                  title={`Previous: ${adjacent.previous.title}`}
                  className="group flex min-w-0 items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2.5 text-left transition-colors hover:border-primary/45 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:px-5"
                >
                  <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                  <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">Previous</span>
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {adjacent.previous.title}
                    </span>
                  </span>
                </Link>
              ) : null}

              {adjacent.next ? (
                <Link
                  to="/dental-videos/$id"
                  params={{ id: adjacent.next.id }}
                  title={`Next: ${adjacent.next.title}`}
                  className="group col-start-2 flex min-w-0 items-center justify-end gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2.5 text-right transition-colors hover:border-primary/45 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:px-5"
                >
                  <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {adjacent.next.title}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">Next</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                </Link>
              ) : null}
            </nav>

            <div
              className="relative w-full overflow-hidden rounded-xl bg-black"
              style={{ paddingBottom: '56.25%' }}
            >
              <div
                ref={playerHostRef}
                className="absolute inset-0 h-full w-full"
                aria-label={video.title}
              />
              {advertisement && isAdvertisementPlaying ? (
                <AdvertisementOverlay
                  advertisement={advertisement}
                  embedded
                  onComplete={completeAdvertisement}
                />
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

    </>
  )
}
