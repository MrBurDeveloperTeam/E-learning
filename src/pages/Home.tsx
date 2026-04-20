import { useState, useRef, useEffect } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { SearchBar } from '@/components/dental/SearchBar'
import { UnifiedVideoGrid } from '@/components/library/UnifiedVideoGrid'
import { Navbar } from '@/components/layout/Navbar'
import { FollowButton } from '@/components/creator/FollowButton'
import { RetryCard } from '@/components/shared/RetryCard'
import { useFollowing } from '@/hooks/useFollow'
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'
import { getCategories } from '@/lib/dentalVideosApi'
import { fetchUnifiedVideoPage } from '@/lib/libraryFeed'
import { fetchTopPublicCreators } from '@/lib/queries/profiles'
import { buildCombinedCategoryList } from '@/lib/videoLibrary'
import { cn, getDisplayName } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export function Home() {
  const [category, setCategory] = useState<string>('All')
  const [query, setQuery] = useState('')
  const profile = useAuthStore((state) => state.profile)
  const categoryScrollRef = useHorizontalWheelScroll<HTMLDivElement>()
  const { data: dentalCategories = [] } = useQuery({
    queryKey: ['dental-categories'],
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  })
  const sharedCategories = ['All', ...buildCombinedCategoryList(dentalCategories)]

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
    queryKey: ['unified-videos', category, query],
    queryFn: ({ pageParam = 0 }) =>
      fetchUnifiedVideoPage({
        category: category === 'All' ? undefined : category,
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
  const creatorSuggestionsQuery = useQuery({
    queryKey: ['home-follow-suggestions', profile?.user_id],
    queryFn: () =>
      fetchTopPublicCreators({
        excludeUserId: profile?.user_id,
        limit: 6,
      }),
    enabled:
      !!profile?.user_id && (profile.following_count ?? 0) < 5,
  })

  const followingIds = new Set(
    following
      .map((row) => row.following_id)
      .filter((value): value is string => !!value)
  )
  const creatorSuggestions = (creatorSuggestionsQuery.data ?? [])
    .filter((creator) => creator.user_id !== profile?.user_id)
    .filter((creator) => !followingIds.has(creator.user_id))
    .slice(0, 6)

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
          <p className="mb-3 text-sm font-medium text-foreground">
            Creators to follow
          </p>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {creatorSuggestions.map((creator) => (
              <div
                key={creator.user_id}
                className="flex flex-shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2 transition-colors hover:border-primary"
              >
                <UserAvatar
                  name={getDisplayName(creator, 'Unknown creator')}
                  avatarUrl={creator.avatar_url}
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
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-medium text-foreground">All videos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {category === 'All'
                ? 'Browse every uploaded and curated video together.'
                : `Browsing all videos in ${category}.`}
            </p>
          </div>
          <SearchBar
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
          />
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
                  ? `No videos matched "${query}". Try another search term.`
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
