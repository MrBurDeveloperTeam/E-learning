import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { SearchBar } from '@/components/dental/SearchBar'
import { UnifiedVideoGrid } from '@/components/library/UnifiedVideoGrid'
import { Navbar } from '@/components/layout/Navbar'
import { FollowButton } from '@/components/creator/FollowButton'
import { RetryCard } from '@/components/shared/RetryCard'
import { useFollowing } from '@/hooks/useFollow'
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'
import { useMarkRead } from '@/hooks/useNotifications'
import { getCategories } from '@/lib/dentalVideosApi'
import { fetchUnifiedVideoPage } from '@/lib/libraryFeed'
import { fetchTopPublicCreators } from '@/lib/queries/profiles'
import { buildCombinedCategoryList } from '@/lib/videoLibrary'
import { cn, getDisplayName } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import usePageDurationTracker, { type PageViewLogMeta } from '@/hooks/usePageDurationTracker'
import { logElearningActivity } from '@/lib/logActivityToOdoo'
import { useElearningPersonalizedInsightState } from '@/aiExperience/hooks/useElearningPersonalizedInsight'
import { usePublishPersonalizedInsight, type PersonalizedInsightBridgeState } from '@/aiExperience/petDialogue/PersonalizedInsightBridge'
import type { ElearningInsightCandidate } from '@/aiExperience/resolver/resolveElearningInsight'
import { ChevronLeft, ChevronRight, Clapperboard, Languages } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VIDEO_LANGUAGE_OPTIONS } from '@/constants/videoLanguages'

const VIDEO_TYPES = [
  { value: 'All', label: 'All video types' },
  { value: 'short_video', label: 'Short videos' },
  { value: 'video', label: 'Videos' },
] as const

export function Home() {
  const [category, setCategory] = useState<string>('All')
  const [language, setLanguage] = useState<string>('All')
  const [videoType, setVideoType] = useState<string>('All')
  const [query, setQuery] = useState('')
  const profile = useAuthStore((state) => state.profile)
  const user = useAuthStore((state) => state.user)
  const categoryScrollRef = useHorizontalWheelScroll<HTMLDivElement>()
  const creatorScrollRef = useHorizontalWheelScroll<HTMLDivElement>()
  const creatorScrollbarRef = useRef<HTMLDivElement>(null)
  const creatorScrollbarThumbRef = useRef<HTMLDivElement>(null)
  const creatorScrollbarDragRef = useRef<{
    startX: number
    startScrollLeft: number
    maxScroll: number
    trackWidth: number
    thumbWidth: number
  } | null>(null)
  const [creatorScrollbar, setCreatorScrollbar] = useState({
    thumbWidth: 100,
    thumbLeft: 0,
    maxScroll: 0,
    scrollLeft: 0,
  })
  const navigate = useNavigate()
  // Phase-2B: Followed Creator Posted, Latest Video Performance, Most
  // Viewed Video. Pure, synchronous, reevaluates whenever the shared
  // notifications/following React Query caches change (mark-read,
  // realtime insert, unfollow) or the own-video-analytics query resolves
  // — no session dedupe on the analytics candidates. See
  // src/aiExperience/hooks/useElearningPersonalizedInsight.ts. Uses the
  // readiness-carrying variant (not_ready vs ready+candidates) so the
  // proactive Cat reminder bridge below can tell "still loading" apart
  // from "resolved, no candidates".
  const elearningInsightState = useElearningPersonalizedInsightState()
  const markNotificationRead = useMarkRead()

  // Takes the candidate to act on explicitly — never closes over
  // `elearningInsight` — so this stays correct even when the caller is Cat
  // showing a different (dismissal-revealed) candidate than the inline
  // banner's current winner. This is what guarantees the CTA always marks
  // the RIGHT notification read and navigates to the RIGHT video — see
  // PersonalizedInsightBridge.tsx's onAction doc for why this matters.
  const handleElearningInsightAction = useCallback((candidate: ElearningInsightCandidate | null) => {
    if (!candidate) return

    if (candidate.triggerId === 'elearning_followed_creator_posted') {
      const { notificationId, notificationSource, videoId } = candidate.facts
      // Fire-and-forget mark-read + immediate navigate, mirroring the
      // exact existing behavior in NotificationBell.tsx/Notifications.tsx
      // (neither awaits the mutation before navigating). On failure,
      // useMarkRead's own onError toast fires and — since this mutation
      // has no optimistic update — the notifications cache is left
      // unchanged, so `is_read` was never flipped client-side and this
      // candidate naturally remains eligible on the next evaluation,
      // rather than being silently and permanently dismissed.
      markNotificationRead.mutate({ id: notificationId, source: notificationSource })
      void navigate({ to: '/watch/$videoId', params: { videoId } })
      return
    }

    // Latest Video Performance / Most Viewed Video: navigation only, no
    // mutation — these candidates have no read/dedupe state to update.
    const { videoId } = candidate.facts
    void navigate({ to: '/watch/$videoId', params: { videoId } })
    // `markNotificationRead.mutate` (not the whole mutation object) is the
    // dependency: `useMarkRead()` returns a fresh `useMutation(...)` result
    // object every render (unmemoized — see src/hooks/useNotifications.ts),
    // but React Query guarantees `.mutate`'s own identity is stable across
    // renders of the same mutation hook instance. Depending on the whole
    // object would recreate this callback (and therefore `bridgeState`
    // below) every render for no semantic reason.
  }, [markNotificationRead.mutate, navigate])

  // Publishes readiness (not_ready | ready+candidate/candidates) + this
  // exact action handler to CatMascot (mounted outside Home, in App.tsx)
  // via a read-only context — no new query, no duplicated resolver/action
  // logic. Publishing `not_ready` explicitly (rather than nothing) is what
  // lets CatMascot tell "Home is still loading, wait" apart from "Home
  // isn't mounted at all, don't wait" — see
  // src/aiExperience/petDialogue/PersonalizedInsightBridge.tsx.
  // Memoized so this object keeps the same reference across renders where
  // none of its real semantic inputs changed.
  const bridgeState: PersonalizedInsightBridgeState = useMemo(
    () =>
      elearningInsightState.status === 'ready'
        ? {
            status: 'ready',
            candidates: elearningInsightState.candidates,
            onAction: handleElearningInsightAction,
          }
        : { status: 'not_ready' },
    [elearningInsightState, handleElearningInsightAction],
  )
  usePublishPersonalizedInsight(bridgeState)
  const { data: dentalCategories = [] } = useQuery({
    queryKey: ['dental-categories'],
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  })
  const sharedCategories = ['All', ...buildCombinedCategoryList(dentalCategories)]

  // Logs how long the user spends browsing each category tab on this page
  // (App.tsx's own route-level tracker only sees "/explore" as a whole and
  // can't see category switches, since `category` is local state here, not
  // part of the URL). Fires its own page_view once the user switches tabs,
  // hides the tab, or leaves the page — see hooks/usePageDurationTracker.ts.
  usePageDurationTracker(
    `/explore?category=${encodeURIComponent(category)}`,
    category === 'All' ? 'Explore: All Videos' : `Explore: ${category}`,
    Boolean(user?.email),
    (description: string, pageMeta: PageViewLogMeta) => {
      logElearningActivity('page_view', description, {
        pagePath: pageMeta.pagePath,
        pageDurationSeconds: pageMeta.pageDurationSeconds,
      })
    }
  )

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['unified-videos', category, videoType, language, query],
    queryFn: ({ pageParam = 0 }) =>
      fetchUnifiedVideoPage({
        category: category === 'All' ? undefined : category,
        language: language === 'All' ? undefined : language,
        videoType: videoType === 'All' ? undefined : videoType as 'short_video' | 'video',
        q: query || undefined,
        page: pageParam,
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length : undefined,
    initialPageParam: 0,
  })

  const items = data?.pages.flatMap((page) => page.items) ?? []
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const { data: following = [] } = useFollowing(profile?.user_id ?? '')
  const creatorSuggestionsQuery = useInfiniteQuery({
    queryKey: ['home-follow-suggestions', profile?.user_id],
    queryFn: ({ pageParam = 0 }) =>
      fetchTopPublicCreators({
        excludeUserId: profile?.user_id,
        limit: 10,
        offset: pageParam * 10,
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === 10 ? pages.length : undefined,
    initialPageParam: 0,
    enabled:
      !!profile?.user_id && (profile.following_count ?? 0) < 5,
  })

  const followingIds = new Set(
    following
      .map((row) => row.following_id)
      .filter((value): value is string => !!value)
  )
  const creatorSuggestions = (creatorSuggestionsQuery.data?.pages ?? [])
    .flatMap((page) => page)
    .filter((creator) => creator.user_id !== profile?.user_id)
    .filter((creator) => !followingIds.has(creator.user_id))
  const hasMoreCreatorSuggestions = creatorSuggestionsQuery.hasNextPage

  const updateCreatorScrollbar = useCallback(() => {
    const container = creatorScrollRef.current
    if (!container) return

    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)
    const thumbWidth = maxScroll === 0
      ? 100
      : Math.max(18, (container.clientWidth / container.scrollWidth) * 100)
    const scrollRatio = maxScroll === 0 ? 0 : container.scrollLeft / maxScroll

    setCreatorScrollbar({
      thumbWidth,
      thumbLeft: scrollRatio * (100 - thumbWidth),
      maxScroll,
      scrollLeft: container.scrollLeft,
    })
  }, [])

  useLayoutEffect(() => {
    const container = creatorScrollRef.current
    if (!container) return

    updateCreatorScrollbar()
    container.addEventListener('scroll', updateCreatorScrollbar, { passive: true })
    const resizeObserver = new ResizeObserver(updateCreatorScrollbar)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', updateCreatorScrollbar)
      resizeObserver.disconnect()
    }
  }, [creatorSuggestions.length, updateCreatorScrollbar])

  const handleCreatorScrollbarTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || creatorScrollbar.maxScroll === 0) return

    const track = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - track.left) / track.width))
    const container = creatorScrollRef.current
    if (container) {
      container.scrollLeft = ratio * creatorScrollbar.maxScroll
    }
  }

  const handleCreatorScrollbarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (creatorScrollbar.maxScroll === 0) return

    const track = creatorScrollbarRef.current
    const container = creatorScrollRef.current
    if (!track || !container) return

    creatorScrollbarDragRef.current = {
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      maxScroll: creatorScrollbar.maxScroll,
      trackWidth: track.clientWidth,
      thumbWidth: creatorScrollbar.thumbWidth,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handleCreatorScrollbarPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = creatorScrollbarDragRef.current
    const container = creatorScrollRef.current
    if (!drag || !container) return

    const draggableWidth = drag.trackWidth * (1 - drag.thumbWidth / 100)
    if (draggableWidth <= 0) return

    const distance = event.clientX - drag.startX
    container.scrollLeft = drag.startScrollLeft + (distance / draggableWidth) * drag.maxScroll
  }

  const handleCreatorScrollbarPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    creatorScrollbarDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleCreatorScrollbarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const container = creatorScrollRef.current
    if (!container) return

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      container.scrollLeft += 120
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      container.scrollLeft -= 120
    } else if (event.key === 'Home') {
      event.preventDefault()
      container.scrollLeft = 0
    } else if (event.key === 'End') {
      event.preventDefault()
      container.scrollLeft = container.scrollWidth
    }
  }

  const scrollCreatorsBy = (distance: number) => {
    const container = creatorScrollRef.current
    if (container) {
      container.scrollLeft += distance
    }
  }

  return (
    <>
      <Navbar />

      <div className="sticky top-14 z-40 border-b border-border bg-background/95 py-3 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <div
            ref={categoryScrollRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1"
          >
            {sharedCategories.map((item) => {
              const active = item === category

              return (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={cn(
                    'flex-shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all duration-150',
                    active
                      ? 'border-primary bg-primary font-medium text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
                  )}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {profile && profile.following_count < 5 && creatorSuggestions.length > 0 && (
        <div className="mx-auto max-w-[1400px] border-b border-border px-4 py-4 md:px-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground">
              Creators to follow
            </p>
            {hasMoreCreatorSuggestions && (
              <button
                type="button"
                onClick={() => creatorSuggestionsQuery.fetchNextPage()}
                disabled={creatorSuggestionsQuery.isFetchingNextPage}
                className="btn-outline inline-flex h-9 w-24 shrink-0 items-center justify-center gap-2 px-3 py-1.5 text-xs"
                aria-controls="creator-follow-suggestions"
                aria-busy={creatorSuggestionsQuery.isFetchingNextPage}
              >
                {creatorSuggestionsQuery.isFetchingNextPage ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  'Load more'
                )}
              </button>
            )}
          </div>
          <div
            ref={creatorScrollRef}
            id="creator-follow-suggestions"
            className="scrollbar-hide flex cursor-grab select-none gap-3 overflow-x-auto pb-1 active:cursor-grabbing touch-pan-y"
          >
            {creatorSuggestions.map((creator) => (
              <div
                key={creator.user_id}
                className="flex w-fit min-w-[210px] flex-shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2 transition-colors hover:border-primary"
              >
                <UserAvatar
                  name={getDisplayName(creator, 'Unknown creator')}
                  avatarUrl={creator.avatar_url}
                  userId={creator.user_id}
                  size={32}
                />
                <div className="min-w-0">
                  <p className="max-w-[100px] truncate text-xs font-medium text-foreground">
                    {getDisplayName(creator, 'Unknown creator')}
                  </p>
                  <p className="max-w-[100px] truncate text-[10px] text-[#9BB5B5]">
                    {creator.specialty ?? 'Dental creator'}
                  </p>
                </div>
                <FollowButton userId={creator.user_id} size="sm" />
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollCreatorsBy(-240)}
              disabled={creatorScrollbar.maxScroll === 0 || creatorScrollbar.scrollLeft === 0}
              aria-label="Scroll creators left"
              className="flex h-4 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <div
              ref={creatorScrollbarRef}
              role="scrollbar"
              tabIndex={0}
              aria-controls="creator-follow-suggestions"
              aria-label="Scroll creators to follow"
              aria-valuemin={0}
              aria-valuemax={creatorScrollbar.maxScroll}
              aria-valuenow={creatorScrollbar.scrollLeft}
              onClick={handleCreatorScrollbarTrackClick}
              onKeyDown={handleCreatorScrollbarKeyDown}
              className="relative h-1.5 min-w-0 flex-1 cursor-pointer rounded-full bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div
                ref={creatorScrollbarThumbRef}
                onPointerDown={handleCreatorScrollbarPointerDown}
                onPointerMove={handleCreatorScrollbarPointerMove}
                onPointerUp={handleCreatorScrollbarPointerUp}
                onPointerCancel={handleCreatorScrollbarPointerUp}
                style={{
                  left: `${creatorScrollbar.thumbLeft}%`,
                  width: `${creatorScrollbar.thumbWidth}%`,
                }}
                className="absolute inset-y-0 rounded-full bg-primary transition-[left,width] duration-100 hover:bg-primary/90"
                aria-hidden="true"
              />
            </div>
            <button
              type="button"
              onClick={() => scrollCreatorsBy(240)}
              disabled={creatorScrollbar.maxScroll === 0 || creatorScrollbar.scrollLeft >= creatorScrollbar.maxScroll}
              aria-label="Scroll creators right"
              className="flex h-4 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-4 md:px-6">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-center lg:grid-cols-[minmax(0,1fr)_180px_200px_minmax(280px,448px)]">
          <div className="sm:col-span-2 lg:col-span-1">
            <h1 className="text-lg font-medium text-foreground">All videos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {category === 'All'
                ? 'Browse every uploaded and curated video together.'
                : `Browsing all videos in ${category}.`}
            </p>
          </div>
          <div className="relative">
            <Clapperboard
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Select
              value={videoType}
              onValueChange={(value) => setVideoType(value ?? 'All')}
            >
              <SelectTrigger
                className="h-12 w-full cursor-pointer rounded-xl bg-card pl-9 pr-3"
                aria-label="Filter videos by video type"
              >
                <SelectValue>
                  {VIDEO_TYPES.find((item) => item.value === videoType)?.label
                    ?? 'All video types'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" className="rounded-xl bg-muted dark:bg-card">
                {VIDEO_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Languages
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value ?? 'All')}
            >
              <SelectTrigger
                className="h-12 w-full cursor-pointer rounded-xl bg-card pl-9 pr-3"
                aria-label="Filter videos by language"
              >
                <SelectValue>
                  {VIDEO_LANGUAGE_OPTIONS.find((item) => item.value === language)?.label
                    ?? 'All languages'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" className="rounded-xl bg-muted dark:bg-card">
                {VIDEO_LANGUAGE_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              onClear={() => setQuery('')}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-20 md:px-6 md:pb-12">
        {isError ? (
          <RetryCard
            onRetry={() => void refetch()}
            message={
              error instanceof Error
                ? error.message
                : 'Failed to load videos. Please try again.'
            }
          />
        ) : (
          <>
            <UnifiedVideoGrid
              items={items}
              isLoading={isLoading}
              emptyTitle="No videos found"
              emptyDescription={
                query
                  ? `No matching ${videoType === 'All' ? 'videos' : VIDEO_TYPES.find((item) => item.value === videoType)?.label.toLowerCase() ?? 'videos'} were found for "${query}". Try another search term.`
                  : videoType !== 'All'
                    ? `No ${VIDEO_TYPES.find((item) => item.value === videoType)?.label.toLowerCase() ?? 'videos'} are available for this selection.`
                  : language !== 'All'
                    ? `No ${VIDEO_LANGUAGE_OPTIONS.find((item) => item.value === language)?.label ?? language} videos are available for this selection.`
                  : category === 'All'
                    ? 'No videos are available yet.'
                    : `No videos are available in ${category} yet.`
              }
            />

            <div ref={loadMoreRef} className="mt-8 h-10">
              {isFetchingNextPage && (
                <div className="flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
