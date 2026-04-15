import { useState, useRef, useEffect } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/layout/Navbar'
import { FollowButton } from '@/components/creator/FollowButton'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useFollowing } from '@/hooks/useFollow'
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'
import { fetchTopPublicCreators } from '@/lib/queries/profiles'
import { VIDEO_CATEGORIES, type SortOption } from '@/types'
import { cn, getDisplayName } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { fetchVideosPaginated } from '@/lib/queries/videosPaginated'

export function Home() {
  const [category, setCategory] = useState<string>('All')
  const [sort, setSort] = useState<SortOption>('newest')
  const profile = useAuthStore((state) => state.profile)
  const categoryScrollRef = useHorizontalWheelScroll<HTMLDivElement>()

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
    queryKey: ['videos-infinite', category, sort],
    queryFn: ({ pageParam = 0 }) =>
      fetchVideosPaginated(
        { category: category === 'All' ? undefined : category, sort },
        pageParam
      ),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === 24 ? pages.length : undefined,
    initialPageParam: 0,
  })

  const videos = data?.pages.flat() ?? []

  // Intersection observer for infinite scroll
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

      <div className="sticky top-14 z-40 border-b border-[#D6E0E0] bg-[#F7FAFA] py-3">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <div
            ref={categoryScrollRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1"
          >
            {['All', ...VIDEO_CATEGORIES].map((item) => {
              const active = item === category

              return (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all duration-150 flex-shrink-0',
                    active
                      ? 'border-[#88C1BD] bg-[#88C1BD] font-medium text-[#1A4A47]'
                      : 'border-[#D4E8E7] bg-white text-[#6B8E8E] hover:border-[#88C1BD] hover:text-[#2D6E6A]'
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
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 border-b border-[#D6E0E0]">
          <p className="text-sm font-medium text-[#1E3333] mb-3">
            Creators to follow
          </p>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {creatorSuggestions.map((creator) => (
              <div
                key={creator.user_id}
                className="flex items-center gap-2.5 bg-white border border-[#D4E8E7] rounded-2xl px-3 py-2 flex-shrink-0 hover:border-[#88C1BD] transition-colors"
              >
                <UserAvatar
                  name={getDisplayName(creator, 'Unknown creator')}
                  avatarUrl={creator.avatar_url}
                  size={32}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#1E3333] truncate max-w-[100px]">
                    {getDisplayName(creator, 'Unknown creator')}
                  </p>
                  <p className="text-[10px] text-[#9BB5B5] truncate max-w-[100px]">
                    {creator.specialty ?? 'Dental creator'}
                  </p>
                </div>
                <FollowButton userId={creator.user_id} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 md:px-6 py-4">
        <p className="text-sm text-[#6B8E8E]">
          {category === 'All' ? 'Latest videos' : category}
        </p>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          className="hidden sm:block cursor-pointer bg-transparent text-sm text-[#6B8E8E] outline-none"
        >
          <option value="newest">Newest</option>
          <option value="most_viewed">Most viewed</option>
          <option value="most_liked">Most liked</option>
        </select>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 pb-20 md:pb-12">
        {isError ? (
          <RetryCard
            onRetry={() => void refetch()}
            message={
              error instanceof Error && error.message.includes('timed out')
                ? 'Loading videos timed out. Check your local connection or Supabase dev setup, then try again.'
                : 'Failed to load videos. Please try again.'
            }
          />
        ) : (
          <>
            <VideoGrid
              videos={videos}
              isLoading={isLoading}
              columns={4}
              emptyTitle="No videos yet"
              emptyDescription="Be the first to upload a dental video"
            />

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="h-10 mt-8">
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
