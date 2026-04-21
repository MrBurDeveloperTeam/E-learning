import { useEffect, useState } from 'react'
import {
  BrainCircuit,
  CheckCircle,
  Loader2,
  Sparkles,
  XCircle,
  Youtube,
} from 'lucide-react'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  AdminSectionCard,
  AdminStatCard,
  AdminStatusBadge,
} from '@/components/admin/AdminPrimitives'
import { PageLayout } from '@/components/layout/PageLayout'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

function ResultSummary({
  fetched,
  inserted,
  skipped,
}: {
  fetched: number
  inserted: number
  skipped: number
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <AdminStatCard
        label="Fetched"
        value={fetched.toLocaleString()}
        icon={Youtube}
        hint="Videos returned from the source fetch"
      />
      <AdminStatCard
        label="Inserted"
        value={inserted.toLocaleString()}
        icon={CheckCircle}
        accent="success"
        hint="New rows added to dental_videos"
      />
      <AdminStatCard
        label="Skipped"
        value={skipped.toLocaleString()}
        icon={Sparkles}
        hint="Duplicates or entries already present"
      />
    </div>
  )
}

export function AdminFetchVideos() {
  const profile = useAuthStore((state) => state.profile)
  const [isFetching, setIsFetching] = useState(false)
  const [result, setResult] = useState<{
    fetched: number
    inserted: number
    skipped: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  const [isCategorizing, setIsCategorizing] = useState(false)
  const [categorizeResult, setCategorizeResult] = useState<{
    processed: number
    updated: number
    failed: number
    errors?: string[]
  } | null>(null)
  const [categorizeError, setCategorizeError] = useState<string | null>(null)
  const [uncategorizedCount, setUncategorizedCount] = useState<number>(0)

  useEffect(() => {
    const storedTimestamp = localStorage.getItem('last_fetched_youtube_videos')
    if (storedTimestamp) {
      setLastFetched(new Date(parseInt(storedTimestamp, 10)).toLocaleString())
    }
  }, [])

  const fetchUncategorizedCount = async () => {
    const { count, error: err } = await supabase
      .from('dental_videos')
      .select('*', { count: 'exact', head: true })
      .is('category', null)

    if (!err && count !== null) {
      setUncategorizedCount(count)
    }
  }

  useEffect(() => {
    void fetchUncategorizedCount()
  }, [])

  if (!isAdminProfile(profile)) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  const handleFetchVideos = async () => {
    setIsFetching(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/fetch-dental-videos', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
          errorData?.error ||
            'Failed to fetch videos from the Cloudflare Function API'
        )
      }

      const data = await response.json()
      setResult(data)

      const timestamp = Date.now().toString()
      localStorage.setItem('last_fetched_youtube_videos', timestamp)
      setLastFetched(new Date(parseInt(timestamp, 10)).toLocaleString())

      void fetchUncategorizedCount()
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred')
    } finally {
      setIsFetching(false)
    }
  }

  const handleCategorizeVideos = async () => {
    if (uncategorizedCount === 0) return

    setIsCategorizing(true)
    setCategorizeError(null)
    setCategorizeResult(null)

    try {
      const response = await fetch('/api/categorize-dental-videos', {
        method: 'POST',
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(
          errData?.error ||
            'Failed to categorize videos from the Cloudflare Function API'
        )
      }

      const data = await response.json()
      setCategorizeResult(data)
      void fetchUncategorizedCount()
    } catch (err: any) {
      setCategorizeError(err.message || 'An unknown error occurred')
    } finally {
      setIsCategorizing(false)
    }
  }

  return (
    <AdminLayout
      title="Video ingestion"
      subtitle="Run the YouTube import and AI categorization workflows from a cleaner operations view while preserving the current backend jobs."
      heroAside={
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
            Job readiness
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge
              label={
                lastFetched ? `Last fetched: ${lastFetched}` : 'No fetch recorded yet'
              }
              tone="default"
            />
            <AdminStatusBadge
              label={`${uncategorizedCount} uncategorized`}
              tone={uncategorizedCount > 0 ? 'warning' : 'success'}
            />
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <AdminSectionCard
          title="YouTube ingestion job"
          description="Search dental-specific keywords and upsert new videos into the dental_videos table."
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-red-500/10 text-red-600 dark:text-red-400">
                <Youtube className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <p className="text-sm leading-6 text-muted-foreground">
                  Run this when you want to pull the latest dental videos from the configured YouTube source terms.
                </p>
                {lastFetched && (
                  <p className="text-sm text-foreground">
                    Last fetched at <span className="font-semibold">{lastFetched}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AdminStatusBadge label="Source: YouTube" tone="info" />
              <button
                type="button"
                onClick={handleFetchVideos}
                disabled={isFetching}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching videos
                  </>
                ) : (
                  <>
                    <Youtube className="h-4 w-4" />
                    Fetch dental videos
                  </>
                )}
              </button>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="AI categorization job"
          description="Assign categories, tags, and confidence scores to uncategorized videos."
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <p className="text-sm leading-6 text-muted-foreground">
                  Use the existing categorization endpoint to enrich pending videos with structured metadata.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge
                    label={`${uncategorizedCount} pending`}
                    tone={uncategorizedCount > 0 ? 'warning' : 'success'}
                  />
                  <AdminStatusBadge label="AI assisted" tone="info" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">
                Categorization is only available when uncategorized videos exist.
              </span>
              <button
                type="button"
                onClick={handleCategorizeVideos}
                disabled={isCategorizing || uncategorizedCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isCategorizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Categorizing
                  </>
                ) : (
                  <>
                    <BrainCircuit className="h-4 w-4" />
                    Categorize videos
                  </>
                )}
              </button>
            </div>
          </div>
        </AdminSectionCard>
      </div>

      {error && (
        <AdminSectionCard className="border-destructive/20 bg-destructive/5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Error fetching videos
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </AdminSectionCard>
      )}

      {result && (
        <AdminSectionCard
          title="Fetch result"
          description="Summary stats returned by the existing ingestion endpoint."
        >
          <ResultSummary
            fetched={result.fetched}
            inserted={result.inserted}
            skipped={result.skipped}
          />
        </AdminSectionCard>
      )}

      {categorizeError && (
        <AdminSectionCard className="border-destructive/20 bg-destructive/5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Error categorizing videos
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {categorizeError}
              </p>
            </div>
          </div>
        </AdminSectionCard>
      )}

      {categorizeResult && (
        <AdminSectionCard
          title="Categorization result"
          description="Current output from the AI categorization workflow."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <AdminStatCard
              label="Processed"
              value={categorizeResult.processed.toLocaleString()}
              icon={BrainCircuit}
              hint="Videos sent through the categorization pass"
            />
            <AdminStatCard
              label="Updated"
              value={categorizeResult.updated.toLocaleString()}
              icon={CheckCircle}
              accent="success"
              hint="Videos successfully enriched with metadata"
            />
            <AdminStatCard
              label="Failed"
              value={categorizeResult.failed.toLocaleString()}
              icon={XCircle}
              accent={categorizeResult.failed > 0 ? 'danger' : 'default'}
              hint="Videos that could not be categorized"
            />
          </div>

          {categorizeResult.errors && categorizeResult.errors.length > 0 && (
            <div className="mt-5 rounded-[22px] border border-border/80 bg-background/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                Error details
              </p>
              <div className="mt-3 space-y-2">
                {categorizeResult.errors.map((entry, index) => (
                  <div
                    key={`${entry}-${index}`}
                    className="rounded-xl border border-destructive/10 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          )}
        </AdminSectionCard>
      )}
    </AdminLayout>
  )
}
