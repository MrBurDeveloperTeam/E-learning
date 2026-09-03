import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminSearchField, AdminSectionCard, AdminStatusBadge } from '@/components/admin/AdminPrimitives'
import { PageLayout } from '@/components/layout/PageLayout'
import { isAdminProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

type VideoType = 'short_video' | 'video'

type PendingVideo = {
  id: string
  video_id: string
  title: string
  thumbnail_url: string
  channel_name: string
  category: string | null
  language: string | null
  fetched_at: string
}

type PendingResponse = {
  videos: PendingVideo[]
  page: number
  pageSize: number
  total: number
  error?: string
}

const MANUAL_SELECTION_KEY = 'manual_video_classification_selection'

function readStoredSelection() {
  try {
    const value = JSON.parse(sessionStorage.getItem(MANUAL_SELECTION_KEY) || '[]')
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

export function ManualVideoClassification() {
  const profile = useAuthStore((state) => state.profile)
  const [videos, setVideos] = useState<PendingVideo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(96)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(readStoredSelection)
  const [classifiedThisVisit, setClassifiedThisVisit] = useState(0)

  const loadVideos = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Sign in again.')

      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set('q', search)
      const response = await fetch(`/dental-api/manual-orientation-videos?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => null) as PendingResponse | null
      if (!response.ok || !data) throw new Error(data?.error || 'Unable to load videos.')

      setVideos(data.videos)
      setTotal(data.total)
      if (data.videos.length === 0 && data.total > 0 && page > 1) setPage((current) => current - 1)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load videos.')
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search])

  useEffect(() => {
    sessionStorage.setItem(MANUAL_SELECTION_KEY, JSON.stringify([...selectedIds]))
  }, [selectedIds])

  useEffect(() => {
    if (isAdminProfile(profile)) void loadVideos()
  }, [loadVideos, profile])

  const saveClassifications = async (items: Array<Pick<PendingVideo, 'id'>>, videoType: VideoType, savingKey: string) => {
    if (savingId) return
    setSavingId(savingKey)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Sign in again.')

      const response = await fetch('/dental-api/manual-orientation-videos', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ results: items.map((item) => ({ id: item.id, videoType })) }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'The classification could not be saved.')

      const updated = typeof data?.updated === 'number' ? data.updated : items.length
      setClassifiedThisVisit((current) => current + updated)
      const submittedIds = new Set(items.map((item) => item.id))
      setSelectedIds((current) => new Set([...current].filter((id) => !submittedIds.has(id))))
      toast.success(updated === 1 ? 'Video classified' : `${updated} videos classified`, {
        description: `Saved as ${videoType === 'short_video' ? 'Short video' : 'Video'}.`,
      })
      await loadVideos()
    } catch (saveError) {
      toast.error('Classification not saved', {
        description: saveError instanceof Error ? saveError.message : 'Please try again.',
      })
    } finally {
      setSavingId(null)
    }
  }

  const classifyVideo = (item: PendingVideo, videoType: VideoType) => (
    saveClassifications([item], videoType, item.id)
  )

  const classifySelected = (videoType: VideoType) => {
    const selectedVideos = [...selectedIds].map((id) => ({ id }))
    if (selectedVideos.length === 0) return Promise.resolve()
    return saveClassifications(selectedVideos, videoType, 'bulk')
  }

  const allVisibleSelected = videos.length > 0 && videos.every((video) => selectedIds.has(video.id))

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!isAdminProfile(profile)) {
    return <PageLayout><AdminGuard /></PageLayout>
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminLayout
      title="Manual video classification"
      subtitle="Review videos that could not be classified automatically, then label each one by its visible orientation."
      actions={(
        <Link
          to="/admin/fetch-videos"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background/75 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Fetch videos
        </Link>
      )}
      heroAside={(
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge label={`${total} awaiting review`} tone={total > 0 ? 'warning' : 'success'} />
          <AdminStatusBadge label={`${classifiedThisVisit} classified this visit`} tone="success" />
        </div>
      )}
    >
      <AdminSectionCard>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(1)
            setSearch(searchInput.trim())
          }}
        >
          <AdminSearchField
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search title, channel, or YouTube ID"
            aria-label="Search unclassified videos"
          />
          <button type="submit" className="min-h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Search
          </button>
          <button
            type="button"
            onClick={() => void loadVideos()}
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-4 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 text-sm text-muted-foreground">
            Per page
            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1)
                setPageSize(Number(event.target.value))
              }}
              disabled={isLoading || Boolean(savingId)}
              className="bg-transparent font-medium text-foreground outline-none"
              aria-label="Videos per page"
            >
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
          </label>
        </form>
      </AdminSectionCard>

      {error && (
        <AdminSectionCard className="border-destructive/20 bg-destructive/5">
          <div role="alert" className="flex items-center justify-between gap-4">
            <p className="text-sm text-destructive">{error}</p>
            <button type="button" onClick={() => void loadVideos()} className="text-sm font-medium text-foreground underline">Try again</button>
          </div>
        </AdminSectionCard>
      )}

      <AdminSectionCard
        title="Videos awaiting orientation"
        description="Open or preview a video, then choose Short video for portrait orientation or Video for landscape and square orientation."
        action={<AdminStatusBadge label={`Page ${page} of ${totalPages}`} tone="default" />}
      >
        {!isLoading && videos.length > 0 && (
          <div className="mb-5 flex flex-col gap-3 rounded-[20px] border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedIds(allVisibleSelected ? new Set() : new Set(videos.map((video) => video.id)))}
                disabled={Boolean(savingId)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded border ${allVisibleSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}>
                  {allVisibleSelected && <Check className="h-3.5 w-3.5" />}
                </span>
                {allVisibleSelected ? 'Clear this page' : `Select all ${videos.length} on this page`}
              </button>
              <AdminStatusBadge
                label={`${selectedIds.size} selected`}
                tone={selectedIds.size > 0 ? 'info' : 'default'}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => void classifySelected('short_video')}
                disabled={selectedIds.size === 0 || Boolean(savingId)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-background px-3 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
              >
                {savingId === 'bulk' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                Set selected as Short video
              </button>
              <button
                type="button"
                onClick={() => void classifySelected('video')}
                disabled={selectedIds.size === 0 || Boolean(savingId)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {savingId === 'bulk' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
                Set selected as Video
              </button>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading unclassified videos…
          </div>
        ) : videos.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <MonitorPlay className="h-10 w-10 text-primary/60" />
            <p className="mt-4 font-medium text-foreground">No videos are waiting for manual classification</p>
            <p className="mt-1 text-sm text-muted-foreground">All currently available videos have a video type.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {videos.map((item) => {
              const isSaving = savingId === item.id
              const isSelected = selectedIds.has(item.id)
              return (
                <article
                  key={item.id}
                  className={`relative overflow-hidden rounded-[22px] border bg-background/60 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/80'}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelection(item.id)}
                    disabled={Boolean(savingId)}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? 'Deselect' : 'Select'} ${item.title}`}
                    className={`absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm backdrop-blur ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-white/70 bg-black/55 text-white hover:bg-black/70'}`}
                  >
                    {isSelected ? <Check className="h-5 w-5" /> : <span className="h-4 w-4 rounded border border-current" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelection(item.id)}
                    disabled={Boolean(savingId)}
                    aria-label={`${isSelected ? 'Deselect' : 'Select'} ${item.title}`}
                    className="group relative block aspect-video w-full overflow-hidden bg-muted text-left disabled:cursor-not-allowed"
                  >
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><MonitorPlay className="h-9 w-9 text-muted-foreground" /></div>
                    )}
                    <span className="absolute bottom-3 right-3 rounded-lg bg-black/75 px-2 py-1 text-xs font-medium text-white">
                      Click image to {isSelected ? 'deselect' : 'select'}
                    </span>
                  </button>
                  <div className="space-y-3 p-4">
                    <div>
                      <h2 className="line-clamp-2 min-h-12 text-sm font-semibold leading-6 text-foreground">{item.title}</h2>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{item.channel_name || 'Unknown channel'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.category && <AdminStatusBadge label={item.category} tone="default" />}
                      {item.language && <AdminStatusBadge label={item.language.toUpperCase()} tone="info" />}
                    </div>
                    <a
                      href={`https://www.youtube.com/watch?v=${encodeURIComponent(item.video_id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      Open on YouTube <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
                      <button
                        type="button"
                        onClick={() => void classifyVideo(item, 'short_video')}
                        disabled={Boolean(savingId)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                        Short video
                      </button>
                      <button
                        type="button"
                        onClick={() => void classifyVideo(item, 'video')}
                        disabled={Boolean(savingId)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
                        Video
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-5">
          <p className="text-sm text-muted-foreground">{total} videos remaining</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </AdminSectionCard>
    </AdminLayout>
  )
}
