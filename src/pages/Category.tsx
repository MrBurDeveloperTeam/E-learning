import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { SearchBar } from '@/components/dental/SearchBar'
import { UnifiedVideoGrid } from '@/components/library/UnifiedVideoGrid'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'
import { getCategories } from '@/lib/dentalVideosApi'
import { fetchUnifiedVideoPage } from '@/lib/libraryFeed'
import { buildCombinedCategoryList } from '@/lib/videoLibrary'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { SLUG_TO_CATEGORY } from '@/types'
import { categoryToSlug, slugToCategory } from '@/lib/utils'

export function Category() {
  const { slug } = useParams({ from: '/category/$slug' })
  const [query, setQuery] = useState('')
  const categoryScrollRef = useHorizontalWheelScroll<HTMLDivElement>()
  const categoryName = SLUG_TO_CATEGORY[slug] ?? slugToCategory(slug)
  const { data: dentalCategories = [] } = useQuery({
    queryKey: ['dental-categories'],
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  })
  const sharedCategories = buildCombinedCategoryList(dentalCategories)
  const loadMoreRef = useRef<HTMLDivElement>(null)

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
    queryKey: ['category-unified-videos', categoryName, query],
    queryFn: ({ pageParam = 0 }) =>
      fetchUnifiedVideoPage({
        category: categoryName,
        q: query || undefined,
        page: pageParam,
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length : undefined,
    initialPageParam: 0,
  })

  const items = data?.pages.flatMap((page) => page.items) ?? []

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

  useEffect(() => {
    document.title = `${categoryName} | DentalLearn`
    return () => {
      document.title = 'DentalLearn | Dental Video Community'
    }
  }, [categoryName])

  return (
    <>
      <Navbar />

      <div className="border-b border-border bg-primary/5">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
          <p className="mb-1 text-xs text-muted-foreground/60">
            <Link to="/" className="transition-colors hover:text-primary">Home</Link> / <Link to="/category" className="transition-colors hover:text-primary">Categories</Link> / {categoryName}
          </p>
          <h1 className="text-2xl font-medium text-foreground">{categoryName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All videos in {categoryName}, including uploads and curated dental videos.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-6 pb-20 md:px-6 md:py-8 md:pb-8">
        <div
          ref={categoryScrollRef}
          className="mb-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          {sharedCategories.map((category) => {
            const itemSlug = categoryToSlug(category)
            const isActive = itemSlug === slug

            return (
              <Link
                key={category}
                to="/category/$slug"
                params={{ slug: itemSlug }}
                className={
                  isActive
                    ? 'whitespace-nowrap rounded-full border border-primary bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground'
                    : 'whitespace-nowrap rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary'
                }
              >
                {category}
              </Link>
            )
          })}
        </div>

        <div className="mb-5">
          <SearchBar
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            placeholder={`Search in ${categoryName}...`}
          />
        </div>

        {isError ? (
          <RetryCard
            onRetry={() => void refetch()}
            message={
              error instanceof Error
                ? error.message
                : 'Failed to load this category. Please try again.'
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
                  ? `No videos in ${categoryName} matched "${query}".`
                  : `No videos are available in ${categoryName} yet.`
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
