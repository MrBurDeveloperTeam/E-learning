import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminSectionCard, AdminStatusBadge } from '@/components/admin/AdminPrimitives'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { VIDEO_CATEGORIES, type VideoCategory } from '@/types'

type VideoType = 'short_video' | 'video'
type ManagedVideo = { id: string; video_id: string; title: string; thumbnail_url: string; channel_name: string; category: VideoCategory | null; language: string | null; video_type: VideoType | null; fetched_at: string }
type ResponseBody = { videos?: ManagedVideo[]; total?: number; pageSize?: number; error?: string }

async function adminRequest(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Your session has expired. Sign in again to continue.')
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', ...init?.headers } })
}

export function ImportedVideoManagement() {
  const [videos, setVideos] = useState<ManagedVideo[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(12)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [type, setType] = useState('all')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('q', search)
      if (category !== 'all') params.set('category', category)
      if (type !== 'all') params.set('videoType', type)
      const response = await adminRequest(`/dental-api/manage-videos?${params}`)
      const body = await response.json() as ResponseBody
      if (!response.ok) throw new Error(body.error || 'Unable to load imported videos.')
      setVideos(body.videos || []); setTotal(body.total || 0); setPageSize(body.pageSize || 12); setError(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load imported videos.') }
    finally { setLoading(false) }
  }, [category, page, search, type])

  useEffect(() => { void load() }, [load])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const update = async (video: ManagedVideo, changes: Partial<Pick<ManagedVideo, 'category' | 'video_type'>>) => {
    const next = { ...video, ...changes, category: changes.category || video.category || 'General Dentistry' as VideoCategory }
    if (!next.video_type) return
    setSavingId(video.id)
    try {
      const response = await adminRequest('/dental-api/manage-videos', { method: 'PATCH', body: JSON.stringify({ id: video.id, category: next.category, videoType: next.video_type }) })
      const body = await response.json() as ResponseBody
      if (!response.ok) throw new Error(body.error || 'The change could not be saved.')
      setVideos((current) => current.map((item) => item.id === video.id ? next : item)); toast.success('Video classification updated')
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'The change could not be saved.') }
    finally { setSavingId(null) }
  }

  const remove = async (video: ManagedVideo) => {
    if (!window.confirm(`Remove “${video.title}” from the video library?`)) return
    setSavingId(video.id)
    try {
      const response = await adminRequest(`/dental-api/manage-videos?id=${encodeURIComponent(video.id)}`, { method: 'DELETE' })
      const body = await response.json() as ResponseBody
      if (!response.ok) throw new Error(body.error || 'The video could not be removed.')
      setVideos((current) => current.filter((item) => item.id !== video.id)); setTotal((value) => Math.max(0, value - 1)); toast.success('Video removed')
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'The video could not be removed.') }
    finally { setSavingId(null) }
  }

  return <AdminSectionCard title="Manage imported videos" description="Review every imported video, remove incorrect results, or correct its dental category and display type." action={<AdminStatusBadge label={`${total} videos`} tone="info" />}>
    <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query.trim()) }} className="mb-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_190px_auto]">
      <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, channel or YouTube ID" className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></div>
      <Select value={category} onValueChange={(value) => { setCategory(value ?? 'all'); setPage(1) }}><SelectTrigger className="h-11 rounded-xl bg-background/70"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All dental categories</SelectItem>{VIDEO_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={type} onValueChange={(value) => { setType(value ?? 'all'); setPage(1) }}><SelectTrigger className="h-11 rounded-xl bg-background/70"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All display types</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="short_video">Short video</SelectItem><SelectItem value="unclassified">Unclassified</SelectItem></SelectContent></Select>
      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"><Search className="h-4 w-4" />Search</button>
    </form>
    {error ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error} <button onClick={() => void load()} className="ml-2 underline">Try again</button></div> : loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading videos…</div> : videos.length === 0 ? <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">No matching videos found.</div> : <div className="divide-y divide-border/70 overflow-hidden rounded-[20px] border border-border/80 bg-background/55">{videos.map((video) => <article key={video.id} className="grid gap-4 p-4 lg:grid-cols-[120px_minmax(180px,1fr)_240px_170px_44px] lg:items-center">
      <img src={video.thumbnail_url} alt="" className="aspect-video w-full rounded-xl bg-muted object-cover lg:w-[120px]" />
      <div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold text-foreground">{video.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{video.channel_name}</p><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.video_id)}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Open on YouTube <ExternalLink className="h-3 w-3" /></a></div>
      <Select value={video.category || 'General Dentistry'} disabled={savingId === video.id} onValueChange={(value) => void update(video, { category: value as VideoCategory })}><SelectTrigger className="h-10 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent>{VIDEO_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={video.video_type || ''} disabled={savingId === video.id} onValueChange={(value) => void update(video, { video_type: value as VideoType })}><SelectTrigger className="h-10 rounded-xl bg-background"><SelectValue placeholder="Choose type" /></SelectTrigger><SelectContent><SelectItem value="video">Video</SelectItem><SelectItem value="short_video">Short video</SelectItem></SelectContent></Select>
      <button type="button" onClick={() => void remove(video)} disabled={savingId === video.id} aria-label={`Remove ${video.title}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/20 text-destructive hover:bg-destructive/10 disabled:opacity-50">{savingId === video.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
    </article>)}</div>}
    <div className="mt-4 flex items-center justify-between"><p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><button type="button" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page === 1 || loading} className="h-9 rounded-xl border border-border px-3 text-sm disabled:opacity-40">Previous</button><button type="button" onClick={() => setPage((v) => Math.min(totalPages, v + 1))} disabled={page >= totalPages || loading} className="h-9 rounded-xl border border-border px-3 text-sm disabled:opacity-40">Next</button><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh videos" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></div>
  </AdminSectionCard>
}
