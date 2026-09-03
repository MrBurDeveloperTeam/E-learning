import { useEffect, useRef, useState } from 'react'
import {
  BrainCircuit,
  CheckCircle,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  ScanLine,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  XCircle,
  Youtube,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  AdminSectionCard,
  AdminStatCard,
  AdminStatusBadge,
} from '@/components/admin/AdminPrimitives'
import { PageLayout } from '@/components/layout/PageLayout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isAdminProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { VIDEO_CATEGORIES, type VideoCategory } from '@/types'

type ImportSize = 10 | 25 | 50

type ImportedVideo = {
  id: string
  video_id: string
  title: string
  thumbnail_url: string
  channel_name: string
  published_at: string
  category: VideoCategory
}

type FetchResult = {
  category: VideoCategory
  requested: number
  fetched: number
  eligible: number
  inserted: number
  alreadyInDb: number
  filteredOut: number
  videos: ImportedVideo[]
  warnings?: string[]
}

type RequestError = {
  message: string
  details: string[]
  code?: string
}

type OrientationType = 'short_video' | 'video'

type OrientationReportVideo = {
  id: string
  video_id: string
  title: string
  thumbnail_url: string
  video_type: OrientationType
}

type OrientationReportEntry = {
  i: string
  t: OrientationType
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function decodeOrientationReport(hash: string): OrientationReportEntry[] | null {
  const prefix = '#orientation-results='
  if (!hash.startsWith(prefix)) return null

  try {
    const encoded = hash.slice(prefix.length).replace(/-/g, '+').replace(/_/g, '/')
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))))
    if (!Array.isArray(parsed?.i) || typeof parsed?.t !== 'string' || parsed.i.length === 0 || parsed.i.length > 500) return null
    if (parsed.t.length !== parsed.i.length || !/^[01]+$/.test(parsed.t)) return null

    const entries = parsed.i.map((compactId: unknown, index: number) => {
      if (typeof compactId !== 'string' || !/^[0-9a-f]{32}$/i.test(compactId)) return null
      const id = `${compactId.slice(0, 8)}-${compactId.slice(8, 12)}-${compactId.slice(12, 16)}-${compactId.slice(16, 20)}-${compactId.slice(20)}`
      if (!UUID_PATTERN.test(id)) return null
      return { i: id, t: parsed.t[index] === '1' ? 'short_video' : 'video' } satisfies OrientationReportEntry
    })
    return entries.every((entry: OrientationReportEntry | null): entry is OrientationReportEntry => entry !== null)
      ? entries
      : null
  } catch {
    return null
  }
}

function OrientationReport({ videos }: { videos: OrientationReportVideo[] }) {
  const shortVideoCount = videos.filter((video) => video.video_type === 'short_video').length

  return (
    <AdminSectionCard
      title="Latest orientation results"
      description="This temporary report is available only in this tab and is not stored as a separate database record."
      action={<AdminStatusBadge label={`${videos.length} classified`} tone="success" />}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <AdminStatCard label="Short videos" value={shortVideoCount} icon={ScanLine} accent="success" />
        <AdminStatCard label="Videos" value={videos.length - shortVideoCount} icon={Clapperboard} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <article key={video.id} className="flex gap-3 rounded-[20px] border border-border/80 bg-background/70 p-3">
            <img
              src={video.thumbnail_url}
              alt=""
              loading="lazy"
              className="aspect-video h-20 flex-shrink-0 rounded-xl bg-muted object-cover"
            />
            <div className="min-w-0 flex-1">
              <AdminStatusBadge
                label={video.video_type === 'short_video' ? 'Short video' : 'Video'}
                tone={video.video_type === 'short_video' ? 'success' : 'info'}
              />
              <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-foreground" title={video.title}>
                {video.title}
              </h3>
              <a
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.video_id)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View on YouTube <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </AdminSectionCard>
  )
}

function ResultSummary({ result }: { result: FetchResult }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <AdminStatCard
        label="Found"
        value={result.fetched.toLocaleString()}
        icon={Youtube}
        hint="Unique YouTube search results"
      />
      <AdminStatCard
        label="Eligible"
        value={result.eligible.toLocaleString()}
        icon={SearchCheck}
        hint="Passed quality and playback checks"
      />
      <AdminStatCard
        label="Inserted"
        value={result.inserted.toLocaleString()}
        icon={CheckCircle}
        accent="success"
        hint={`Added directly to ${result.category}`}
      />
      <AdminStatCard
        label="Already in DB"
        value={result.alreadyInDb.toLocaleString()}
        icon={Sparkles}
        hint="Existing videos safely skipped"
      />
      <AdminStatCard
        label="Filtered out"
        value={result.filteredOut.toLocaleString()}
        icon={Filter}
        hint="Short, live, unavailable, or unrelated"
      />
    </div>
  )
}

function ImportedVideoList({ videos }: { videos: ImportedVideo[] }) {
  if (videos.length === 0) {
    return (
      <div className="mt-5 rounded-[20px] border border-border/80 bg-background/55 p-5 text-sm text-muted-foreground">
        No new videos were added in this import. The matching results may already be in the library.
      </div>
    )
  }

  return (
    <section className="mt-6 border-t border-border/70 pt-6" aria-labelledby="imported-videos-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="imported-videos-heading" className="text-base font-semibold text-foreground">
            Videos added in this import
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Review the exact records that were saved to your library.</p>
        </div>
        <AdminStatusBadge label={`${videos.length} added`} tone="success" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <article key={video.id} className="overflow-hidden rounded-[20px] border border-border/80 bg-background/70">
            <div className="aspect-video overflow-hidden bg-muted">
              <img
                src={video.thumbnail_url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              />
            </div>
            <div className="flex min-h-48 flex-col p-4">
              <AdminStatusBadge label={video.category} tone="info" />
              <h4 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-foreground" title={video.title}>
                {video.title}
              </h4>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="truncate" title={video.channel_name}>{video.channel_name}</p>
                <p>Published {new Date(video.published_at).toLocaleDateString()}</p>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.video_id)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Youtube className="h-4 w-4 text-red-600 dark:text-red-400" />
                Open on YouTube
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function AdminFetchVideos() {
  const profile = useAuthStore((state) => state.profile)
  const [category, setCategory] = useState<VideoCategory>('General Dentistry')
  const [importSize, setImportSize] = useState<ImportSize>(25)
  const [isFetching, setIsFetching] = useState(false)
  const [result, setResult] = useState<FetchResult | null>(null)
  const [error, setError] = useState<RequestError | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  const [isCategorizing, setIsCategorizing] = useState(false)
  const [categorizeResult, setCategorizeResult] = useState<{
    processed: number
    updated: number
    failed: number
    errors?: string[]
  } | null>(null)
  const [categorizeError, setCategorizeError] = useState<string | null>(null)
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [isCreatingClassifierCode, setIsCreatingClassifierCode] = useState(false)
  const [orientationPending, setOrientationPending] = useState<number | null>(null)
  const [orientationReport, setOrientationReport] = useState<OrientationReportVideo[] | null>(null)
  const [isLoadingOrientationReport, setIsLoadingOrientationReport] = useState(false)
  const [orientationReportError, setOrientationReportError] = useState<string | null>(null)
  const orientationReportConsumed = useRef(false)

  useEffect(() => {
    const storedTimestamp = localStorage.getItem('last_fetched_youtube_videos')
    if (storedTimestamp) {
      setLastFetched(new Date(Number(storedTimestamp)).toLocaleString())
    }
  }, [])

  const fetchUncategorizedCount = async () => {
    const { count, error: countError } = await supabase
      .from('dental_videos')
      .select('*', { count: 'exact', head: true })
      .is('category', null)

    if (!countError && count !== null) setUncategorizedCount(count)
  }

  useEffect(() => {
    void fetchUncategorizedCount()
  }, [])

  useEffect(() => {
    if (!isAdminProfile(profile) || orientationReportConsumed.current) return
    const entries = decodeOrientationReport(window.location.hash)
    if (!window.location.hash.startsWith('#orientation-results=')) return

    orientationReportConsumed.current = true
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    if (!entries) {
      setOrientationReportError('The temporary classification report is invalid. Run the classifier again to create a new report.')
      return
    }

    const loadReport = async () => {
      setIsLoadingOrientationReport(true)
      setOrientationReportError(null)
      try {
        const reportTypes = new Map(entries.map((entry) => [entry.i, entry.t]))
        const rows: Omit<OrientationReportVideo, 'video_type'>[] = []

        for (let offset = 0; offset < entries.length; offset += 100) {
          const ids = entries.slice(offset, offset + 100).map((entry) => entry.i)
          const { data, error: reportError } = await supabase
            .from('dental_videos')
            .select('id,video_id,title,thumbnail_url')
            .in('id', ids)
          if (reportError) throw reportError
          rows.push(...(data || []))
        }

        const byId = new Map(rows.map((video) => [video.id, video]))
        setOrientationReport(entries.flatMap((entry) => {
          const video = byId.get(entry.i)
          const videoType = reportTypes.get(entry.i)
          return video && videoType ? [{ ...video, video_type: videoType }] : []
        }))
      } catch {
        setOrientationReportError('The videos were classified, but this temporary report could not be loaded. Refreshing will not undo the classifications.')
      } finally {
        setIsLoadingOrientationReport(false)
      }
    }

    void loadReport()
  }, [profile])

  if (!isAdminProfile(profile)) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  const handleFetchVideos = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isFetching) return

    setIsFetching(true)
    setError(null)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Sign in again and retry.')

      const response = await fetch('/dental-api/fetch-dental-videos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category, limit: importSize }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError({
          message: data?.error || 'The video import request failed.',
          details: Array.isArray(data?.details) ? data.details : [],
          code: typeof data?.code === 'string' ? data.code : undefined,
        })
        return
      }

      setResult({
        category: data.category ?? category,
        requested: data.requested ?? importSize,
        fetched: data.fetched ?? 0,
        eligible: data.eligible ?? 0,
        inserted: data.inserted ?? 0,
        alreadyInDb: data.alreadyInDb ?? 0,
        filteredOut: data.filteredOut ?? 0,
        videos: Array.isArray(data.videos) ? data.videos : [],
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      })

      const timestamp = Date.now().toString()
      localStorage.setItem('last_fetched_youtube_videos', timestamp)
      setLastFetched(new Date(Number(timestamp)).toLocaleString())
    } catch (requestError) {
      setError({
        message: requestError instanceof Error
          ? requestError.message
          : 'The video import request failed.',
        details: [],
      })
    } finally {
      setIsFetching(false)
    }
  }

  const handleCategorizeVideos = async () => {
    if (uncategorizedCount === 0 || isCategorizing) return

    setIsCategorizing(true)
    setCategorizeError(null)
    setCategorizeResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Sign in again and retry.')

      const response = await fetch('/api/categorize-dental-videos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'The AI categorization request failed.')
      }

      setCategorizeResult(data)
      void fetchUncategorizedCount()
    } catch (requestError) {
      setCategorizeError(
        requestError instanceof Error
          ? requestError.message
          : 'The AI categorization request failed.'
      )
    } finally {
      setIsCategorizing(false)
    }
  }

  const handleCopyClassifierCode = async () => {
    if (isCreatingClassifierCode) return
    setIsCreatingClassifierCode(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Sign in again and retry.')

      const response = await fetch('/dental-api/orientation-videos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || typeof data?.token !== 'string') {
        throw new Error(data?.error || 'Unable to create a classifier access code.')
      }

      const accessCode = `${window.location.origin}|${data.token}`
      await navigator.clipboard.writeText(accessCode)
      setOrientationPending(typeof data.pending === 'number' ? data.pending : null)
      toast.success('Temporary classifier code copied', {
        description: 'Paste it into the classifier within 15 minutes.',
      })
    } catch (requestError) {
      toast.error('Classifier code was not copied', {
        description: requestError instanceof Error ? requestError.message : 'Try again from a secure browser window.',
      })
    } finally {
      setIsCreatingClassifierCode(false)
    }
  }

  const handleDownloadClassifier = () => {
    const scriptUrl = `${window.location.origin}/downloads/DentalVideoClassifier.ps1`
    const launcher = [
      '@echo off',
      'setlocal',
      'set "CLASSIFIER_SCRIPT=%TEMP%\\DentalVideoClassifier.ps1"',
      'echo Downloading the latest DentalLearn classifier...',
      `powershell.exe -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri '${scriptUrl}' -OutFile '%CLASSIFIER_SCRIPT%'"`,
      'if errorlevel 1 (',
      '  echo Unable to download the classifier. Check your internet connection and try again.',
      '  pause',
      '  exit /b 1',
      ')',
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CLASSIFIER_SCRIPT%"',
      'if errorlevel 1 pause',
      'endlocal',
    ].join('\r\n')
    const downloadUrl = URL.createObjectURL(new Blob([launcher], { type: 'application/octet-stream' }))
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = 'DentalVideoClassifier.cmd'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(downloadUrl)
  }

  return (
    <AdminLayout
      title="Video ingestion"
      subtitle="Automatically find focused dental education videos and add them to the selected library category."
      heroAside={
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
            Job readiness
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge
              label={lastFetched ? `Last fetched: ${lastFetched}` : 'No fetch recorded yet'}
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
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <AdminSectionCard
          title="Automatic YouTube import"
          description="Choose one specialty. The importer runs English-first searches plus Thai, Chinese, Korean, Japanese, and Malay searches, then files accepted videos directly into that category."
        >
          <form noValidate onSubmit={handleFetchVideos} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-2">
                <label htmlFor="youtube-import-category" className="text-sm font-medium text-foreground">
                  Dental category
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as VideoCategory)}
                  disabled={isFetching}
                >
                  <SelectTrigger
                    id="youtube-import-category"
                    className="h-11 w-full rounded-xl bg-background/70 px-3.5"
                    aria-label="Dental category"
                  >
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent align="start" className="rounded-xl">
                    {VIDEO_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="youtube-import-size" className="text-sm font-medium text-foreground">
                  Import up to
                </label>
                <Select
                  value={String(importSize)}
                  onValueChange={(value) => setImportSize(Number(value) as ImportSize)}
                  disabled={isFetching}
                >
                  <SelectTrigger
                    id="youtube-import-size"
                    className="h-11 w-full rounded-xl bg-background/70 px-3.5"
                    aria-label="Maximum videos to import"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" className="rounded-xl">
                    <SelectItem value="10">10 videos</SelectItem>
                    <SelectItem value="25">25 videos</SelectItem>
                    <SelectItem value="50">50 videos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-[20px] border border-border/80 bg-background/65 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                  <Youtube className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Quality checks included</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Excludes duplicates, livestreams, videos under 3 minutes, unavailable embeds, and results without dental relevance.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge label="Source: YouTube" tone="info" />
                <AdminStatusBadge label="No AI categorization" tone="success" />
              </div>
              <button
                type="submit"
                disabled={isFetching}
                aria-busy={isFetching}
                className="inline-flex min-h-11 min-w-[190px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finding videos…
                  </>
                ) : (
                  <>
                    <SearchCheck className="h-4 w-4" />
                    Find and import videos
                  </>
                )}
              </button>
            </div>
          </form>
        </AdminSectionCard>

        <AdminSectionCard
          title="Legacy AI categorization"
          description="Use this only for videos imported before category-first search was added."
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <p className="text-sm leading-6 text-muted-foreground">
                  New category-first imports bypass this step. Existing uncategorized records can still be enriched here.
                </p>
                <AdminStatusBadge
                  label={`${uncategorizedCount} pending`}
                  tone={uncategorizedCount > 0 ? 'warning' : 'success'}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCategorizeVideos}
              disabled={isCategorizing || uncategorizedCount === 0}
              aria-busy={isCategorizing}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCategorizing ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Categorizing…</>
              ) : (
                <><BrainCircuit className="h-4 w-4" />Categorize legacy videos</>
              )}
            </button>
          </div>
        </AdminSectionCard>
      </div>

      <AdminSectionCard
        title="Video orientation classifier"
        description="Use the Windows classifier to label portrait videos as Short videos and landscape or square videos as Videos. Duration is ignored."
      >
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-primary/12 text-primary">
              <ScanLine className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <p className="text-sm leading-6 text-muted-foreground">
                Download the classifier once, then copy a temporary access code each time you run it. The tool reads video dimensions without downloading the videos and can only submit orientation results.
              </p>
              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge
                  label={orientationPending === null ? 'Pending count available with access code' : `${orientationPending} awaiting orientation`}
                  tone={orientationPending && orientationPending > 0 ? 'warning' : 'default'}
                />
                <AdminStatusBadge label="Windows" tone="info" />
                <AdminStatusBadge label="15-minute access" tone="success" />
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[240px]">
            <button
              type="button"
              onClick={handleDownloadClassifier}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Download className="h-4 w-4" />
              Download classifier
            </button>
            <button
              type="button"
              onClick={handleCopyClassifierCode}
              disabled={isCreatingClassifierCode}
              aria-busy={isCreatingClassifierCode}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreatingClassifierCode ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Creating code…</>
              ) : (
                <><Copy className="h-4 w-4" />Copy temporary code</>
              )}
            </button>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-border/80 bg-background/55 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm leading-6 text-muted-foreground">
            The downloaded file contains no database administrator key. Keep the temporary code private; it expires automatically and only authorizes orientation classification.
          </p>
        </div>
      </AdminSectionCard>

      {isLoadingOrientationReport && (
        <AdminSectionCard title="Loading latest orientation results">
          <div className="flex min-h-28 items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading the videos classified in this run…
          </div>
        </AdminSectionCard>
      )}

      {orientationReportError && (
        <AdminSectionCard className="border-destructive/20 bg-destructive/5">
          <div role="alert" className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">Classification report unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{orientationReportError}</p>
            </div>
          </div>
        </AdminSectionCard>
      )}

      {orientationReport && orientationReport.length > 0 && (
        <div aria-live="polite">
          <OrientationReport videos={orientationReport} />
        </div>
      )}

      {error && (
        <AdminSectionCard className="border-destructive/20 bg-destructive/5">
          <div role="alert" className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {error.code === 'YOUTUBE_QUOTA_EXCEEDED'
                  ? 'Daily YouTube quota reached'
                  : 'YouTube import failed'}
              </p>
              <p className="mt-1 break-words text-sm text-muted-foreground">{error.message}</p>
              {error.details.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {error.details.slice(0, 4).map((detail, index) => (
                    <li key={`${detail}-${index}`} className="break-words">{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </AdminSectionCard>
      )}

      {result && (
        <AdminSectionCard
          title={`Import result · ${result.category}`}
          description={`Requested up to ${result.requested} new videos. Accepted videos were assigned directly to the selected category.`}
        >
          <div aria-live="polite">
            <ResultSummary result={result} />
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-5 rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm font-semibold text-foreground">Import completed with warnings</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.warnings.slice(0, 4).map((warning, index) => (
                    <li key={`${warning}-${index}`} className="break-words">{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <ImportedVideoList videos={result.videos} />
        </AdminSectionCard>
      )}

      {categorizeError && (
        <AdminSectionCard className="border-destructive/20 bg-destructive/5">
          <div role="alert" className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">Categorization failed</p>
              <p className="mt-1 text-sm text-muted-foreground">{categorizeError}</p>
            </div>
          </div>
        </AdminSectionCard>
      )}

      {categorizeResult && (
        <AdminSectionCard
          title="Categorization result"
          description="Result for existing uncategorized videos."
        >
          <div className="grid gap-4 md:grid-cols-3" aria-live="polite">
            <AdminStatCard label="Processed" value={categorizeResult.processed.toLocaleString()} icon={BrainCircuit} hint="Videos sent through categorization" />
            <AdminStatCard label="Updated" value={categorizeResult.updated.toLocaleString()} icon={CheckCircle} accent="success" hint="Videos successfully enriched" />
            <AdminStatCard label="Failed" value={categorizeResult.failed.toLocaleString()} icon={XCircle} accent={categorizeResult.failed > 0 ? 'danger' : 'default'} hint="Videos that need another attempt" />
          </div>
          {categorizeResult.errors && categorizeResult.errors.length > 0 && (
            <div className="mt-5 rounded-[20px] border border-destructive/10 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-foreground">Error details</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {categorizeResult.errors.map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ul>
            </div>
          )}
        </AdminSectionCard>
      )}
    </AdminLayout>
  )
}
