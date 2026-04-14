import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'
import { useVideos } from '@/hooks/useVideos'
import {
  CATEGORY_SLUGS,
  SLUG_TO_CATEGORY,
  VIDEO_CATEGORIES,
  type SortOption,
} from '@/types'
import { slugToCategory } from '@/lib/utils'

export function Category() {
  const { slug } = useParams({ from: '/category/$slug' })
  const [sort, setSort] = useState<SortOption>('newest')
  const categoryScrollRef = useHorizontalWheelScroll<HTMLDivElement>()
  const categoryName = SLUG_TO_CATEGORY[slug] ?? slugToCategory(slug)
  const { data: videos = [], isLoading, isError, error, refetch } = useVideos({
    category: categoryName,
    sort,
  })

  // Dynamic document title
  useEffect(() => {
    document.title = `${categoryName} — DentalLearn`
    return () => {
      document.title = 'DentalLearn — Dental Video Community'
    }
  }, [categoryName])

  return (
    <>
      <Navbar />

      <div className="border-b border-[#D4E8E7] bg-[#EAF4F3]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 md:px-6 py-6 md:py-8">
          <div>
            <p className="mb-1 text-xs text-[#9BB5B5]">
              <Link to="/">Home</Link> / <Link to="/category">Categories</Link> / {categoryName}
            </p>
            <h1 className="text-2xl font-medium text-[#1E3333]">{categoryName}</h1>
            <p className="mt-1 text-sm text-[#6B8E8E]">{videos.length} videos</p>
          </div>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            className="cursor-pointer bg-transparent text-sm text-[#6B8E8E] outline-none"
          >
            <option value="newest">Newest</option>
            <option value="most_viewed">Most viewed</option>
            <option value="most_liked">Most liked</option>
          </select>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6 md:py-8 pb-20 md:pb-8">
        <div
          ref={categoryScrollRef}
          className="mb-6 flex gap-2 overflow-x-auto pb-1"
        >
          {VIDEO_CATEGORIES.map((category) => {
            const itemSlug = CATEGORY_SLUGS[category]
            const isActive = itemSlug === slug

            return (
              <Link
                key={category}
                to="/category/$slug"
                params={{ slug: itemSlug }}
                className={
                  isActive
                    ? 'whitespace-nowrap rounded-full border border-[#88C1BD] bg-[#88C1BD] px-4 py-1.5 text-sm font-medium text-[#1A4A47]'
                    : 'whitespace-nowrap rounded-full border border-[#D4E8E7] bg-white px-4 py-1.5 text-sm text-[#6B8E8E] transition-colors hover:border-[#88C1BD] hover:text-[#2D6E6A]'
                }
              >
                {category}
              </Link>
            )
          })}
        </div>

        {isError ? (
          <RetryCard
            onRetry={() => void refetch()}
            message={
              error instanceof Error && error.message.includes('timed out')
                ? 'Loading this category timed out. Check your local connection or Supabase dev setup, then try again.'
                : 'Failed to load this category. Please try again.'
            }
          />
        ) : (
          <VideoGrid videos={videos} columns={4} isLoading={isLoading} />
        )}
      </div>
    </>
  )
}
