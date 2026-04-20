import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Navbar } from '@/components/layout/Navbar'
import { SearchBar } from '@/components/dental/SearchBar'
import { DentalVideoCard } from '@/components/dental/VideoCard'
import { DentalVideoCardSkeleton } from '@/components/dental/VideoCardSkeleton'
import { Pagination } from '@/components/dental/Pagination'
import { RetryCard } from '@/components/shared/RetryCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { getCategories, getVideos } from '@/lib/dentalVideosApi'
import { cn } from '@/lib/utils'
import type { DentalVideo, DentalCategory, DentalVideosResponse } from '@/types/dentalVideo'

const VIDEOS_PER_PAGE = 12

export function DentalVideos() {
  // Read initial filters from URL search params (provided by TanStack Router validateSearch)
  const searchParams = useSearch({ from: '/dental-videos' })
  const navigate = useNavigate()

  const initialCategory = (searchParams as any).category ?? ''
  const initialQuery = (searchParams as any).q ?? ''
  const initialPage = Number((searchParams as any).page) || 1

  // ─── State ──────────────────────────────────────────
  const [category, setCategory] = useState<string>(initialCategory)
  const [query, setQuery] = useState<string>(initialQuery)
  const [page, setPage] = useState<number>(initialPage)
  const [categories, setCategories] = useState<DentalCategory[]>([])
  const [videosResponse, setVideosResponse] = useState<DentalVideosResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── SEO ────────────────────────────────────────────
  useEffect(() => {
    document.title = 'Dental Videos | DentalLearn'
  }, [])

  // ─── Sync filters → URL ─────────────────────────────
  const syncUrl = useCallback(
    (cat: string, q: string, p: number) => {
      void navigate({
        to: '/dental-videos',
        search: {
          category: cat,
          q: q,
          page: p,
        },
        replace: true,
      })
    },
    [navigate]
  )

  // ─── Fetch categories on mount ──────────────────────
  useEffect(() => {
    let cancelled = false
    setIsLoadingCategories(true)

    getCategories()
      .then((data) => {
        if (!cancelled) setCategories(data)
      })
      .catch(() => {
        // Non-critical — categories still work from video data
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCategories(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ─── Fetch videos when filters change ───────────────
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    getVideos({
      category: category || undefined,
      q: query || undefined,
      page,
      limit: VIDEOS_PER_PAGE,
    })
      .then((data) => {
        if (!cancelled) {
          setVideosResponse(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load videos')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [category, query, page])

  // ─── Filter handlers ────────────────────────────────
  function handleCategoryChange(cat: string) {
    setCategory(cat)
    setPage(1)
    syncUrl(cat, query, 1)
  }

  function handleSearchChange(q: string) {
    setQuery(q)
    setPage(1)
    syncUrl(category, q, 1)
  }

  function handleSearchClear() {
    setQuery('')
    setPage(1)
    syncUrl(category, '', 1)
  }

  function handlePageChange(p: number) {
    setPage(p)
    syncUrl(category, query, p)
  }

  const videos: DentalVideo[] = videosResponse?.data ?? []
  const totalPages = videosResponse?.totalPages ?? 0

  return (
    <>
      <Navbar />

      {/* Category filter row */}
      <div className="sticky top-14 z-40 border-b border-border bg-background/95 backdrop-blur py-3">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {/* "All" pill */}
            <button
              type="button"
              onClick={() => handleCategoryChange('')}
              className={cn(
                'whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all duration-150 flex-shrink-0',
                !category
                  ? 'border-primary bg-primary font-medium text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
              )}
            >
              All
            </button>

            {/* Category pills */}
            {categories.map((cat) => {
              const isActive = category === cat.category
              return (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => handleCategoryChange(cat.category)}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all duration-150 flex-shrink-0',
                    isActive
                      ? 'border-primary bg-primary font-medium text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
                  )}
                >
                  {cat.category}
                  <span className="ml-1.5 text-xs opacity-70">({cat.count})</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <SearchBar
            value={query}
            onChange={handleSearchChange}
            onClear={handleSearchClear}
          />
          <p className="hidden sm:block text-sm text-muted-foreground flex-shrink-0">
            {!isLoading && videosResponse
              ? `${videosResponse.total} video${videosResponse.total !== 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 pb-20 md:pb-12" id="dental-video-grid">
        {error ? (
          <RetryCard
            onRetry={() => {
              setError(null)
              setIsLoading(true)
              getVideos({
                category: category || undefined,
                q: query || undefined,
                page,
                limit: VIDEOS_PER_PAGE,
              })
                .then(setVideosResponse)
                .catch((err) =>
                  setError(err instanceof Error ? err.message : 'Failed to load videos')
                )
                .finally(() => setIsLoading(false))
            }}
            message={error}
          />
        ) : isLoading ? (
          /* Skeleton grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 9 }).map((_, i) => (
              <DentalVideoCardSkeleton key={i} />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <EmptyState
            title="No videos found"
            description={
              query
                ? `No results for "${query}". Try a different search term or clear the filter.`
                : category
                  ? `No videos in this category yet.`
                  : 'No dental videos available at the moment.'
            }
            actionLabel={query || category ? 'Clear filters' : undefined}
            onAction={
              query || category
                ? () => {
                    handleCategoryChange('')
                    handleSearchClear()
                  }
                : undefined
            }
            icon={
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
                <rect x="2" y="6" width="14" height="12" rx="2" />
              </svg>
            }
          />
        ) : (
          <>
            {/* Video grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {videos.map((video) => (
                <DentalVideoCard key={video.id} video={video} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </>
  )
}
