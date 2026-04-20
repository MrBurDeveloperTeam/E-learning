import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Search as SearchIcon, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CreatorCard } from '@/components/creator/CreatorCard'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useSearchCreators } from '@/hooks/useProfile'
import { useSearchVideos } from '@/hooks/useVideos'
import { cn } from '@/lib/utils'

type SearchTab = 'all' | 'videos' | 'creators'

export function Search() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { q?: string }
  const [query, setQuery] = useState(search.q ?? '')
  const [tab, setTab] = useState<SearchTab>('all')

  useEffect(() => {
    setQuery(search.q ?? '')
  }, [search.q])

  // Dynamic document title
  useEffect(() => {
    document.title = query
      ? `"${query}" — DentalLearn`
      : 'Search — DentalLearn'
    return () => {
      document.title = 'DentalLearn — Dental Video Community'
    }
  }, [query])

  const videosQuery = useSearchVideos(query)
  const creatorsQuery = useSearchCreators(query)
  const queryTooShort = query.trim().length > 0 && query.trim().length < 2
  const canSearch = query.trim().length >= 2
  const videos = videosQuery.data ?? []
  const creators = creatorsQuery.data ?? []
  const hasResults = videos.length > 0 || creators.length > 0
  const isLoading = canSearch && (videosQuery.isLoading || creatorsQuery.isLoading)
  const isError = videosQuery.isError || creatorsQuery.isError

  function updateQuery(next: string) {
    setQuery(next)
    navigate({
      to: '/search',
      search: { q: next || undefined },
      replace: true,
    })
  }

  return (
    <>
      <Navbar />

      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="border-b border-border py-4 md:py-6">
          <div className="relative mx-auto max-w-2xl">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              className="input-field w-full rounded-2xl py-3 pl-10 pr-10 text-base"
              placeholder="Search dental videos, topics, creators..."
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => updateQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto scrollbar-hide">
            {(['all', 'videos', 'creators'] as SearchTab[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm transition-colors flex-shrink-0',
                  tab === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {value === 'all'
                  ? 'All'
                  : value === 'videos'
                    ? 'Videos'
                    : 'Creators'}
              </button>
            ))}
          </div>
        </div>

        {!query.trim() && (
          <div className="py-16 text-center px-4">
            <p className="text-sm text-muted-foreground">
              Start typing to search for dental videos and creators
            </p>
          </div>
        )}

        {queryTooShort && (
          <div className="py-16 text-center px-4">
            <p className="text-sm text-muted-foreground">
              Enter at least 2 characters to search
            </p>
          </div>
        )}

        {isError && (
          <div className="py-8">
            <RetryCard
              onRetry={() => {
                void videosQuery.refetch()
                void creatorsQuery.refetch()
              }}
            />
          </div>
        )}

        {canSearch && !isError && (
          <div className="py-6 md:py-8 pb-20 md:pb-8">
            {isLoading && (
              <VideoGrid videos={[]} columns={4} isLoading skeletonCount={8} />
            )}

            {!isLoading && !hasResults && (
              <div className="py-16 text-center px-4">
                <p className="mb-2 text-base font-medium text-foreground">
                  No results for "{query}"
                </p>
                <p className="text-sm text-muted-foreground">
                  Try different keywords or browse by category
                </p>
                <Link to="/" className="btn-outline mt-4 inline-block px-5 py-2 text-sm">
                  Browse all videos
                </Link>
              </div>
            )}

            {!isLoading &&
              !isError &&
              hasResults &&
              (tab === 'all' || tab === 'creators') &&
              creators.length > 0 && (
                <div className="mb-8">
                  <p className="mb-3 text-sm font-medium text-foreground">
                    Creators{tab === 'creators' ? ` (${creators.length})` : ''}
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {(tab === 'all' ? creators.slice(0, 3) : creators).map((profile) => (
                      <CreatorCard key={profile.user_id} profile={profile} />
                    ))}
                  </div>
                </div>
              )}

            {!isLoading && !isError && hasResults && (tab === 'all' || tab === 'videos') && (
              <div>
                <p className="mb-3 text-sm font-medium text-foreground">
                  Videos ({videos.length})
                </p>
                <VideoGrid videos={videos} columns={4} />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
