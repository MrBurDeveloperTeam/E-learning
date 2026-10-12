import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Captions, CheckCircle2, Download, FileVideo, Languages, Loader2, PlugZap, RefreshCw, ShieldCheck, UploadCloud, X, Youtube } from 'lucide-react'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminSectionCard, AdminStatCard, AdminStatusBadge, AdminFilterTabs } from '@/components/admin/AdminPrimitives'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isAdminProfile } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { createYouTubeSubtitleJob, youtubeVideoId, downloadSubtitles, subtitleApiUrl, subtitleRequest, subtitleTime, uploadSubtitleVideo, validateSubtitleCues, type SubtitleCue, type SubtitleJob, type SubtitleResult } from '@/features/subtitles/subtitleApi'

import { YouTubeSubtitlePlayer, type YouTubeSubtitleHandle } from '@/features/subtitles/YouTubeSubtitlePlayer'

const inputClass = 'min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50'
const buttonClass = 'min-h-11 rounded-xl px-4'
const busyJob = (job?: SubtitleJob | null) => Boolean(job && ['running', 'downloading', 'uploading', 'cancelling'].includes(job.status))

export function AdminSubtitles() {
  const { profile } = useAuthStore()
  if (!isAdminProfile(profile)) return <PageLayout><AdminGuard /></PageLayout>
  return <SubtitleWorkspace />
}

function SubtitleWorkspace() {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => sessionStorage.getItem('subtitle-engine-token') || '')
  const [tokenInput, setTokenInput] = useState(token)
  const [inputMode, setInputMode] = useState<'file' | 'youtube'>('youtube')
  const [youtubeUrl, setYouTubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [model, setModel] = useState('large-v3')
  const [precision, setPrecision] = useState('int8')
  const [prompt, setPrompt] = useState('')
  const [offline, setOffline] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cues, setCues] = useState<SubtitleCue[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const youtubeRef = useRef<YouTubeSubtitleHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadAbort = useRef<(() => void) | null>(null)
  const loadedResult = useRef('')
  const jobsQuery = useQuery({
    queryKey: ['subtitle-jobs', token],
    queryFn: () => subtitleRequest<SubtitleJob[]>('/jobs', token),
    enabled: Boolean(token), retry: false, refetchInterval: 2500,
  })
  const jobs = jobsQuery.data || []
  const job = jobs.find(item => item.id === selectedId)
  const connected = Boolean(token && jobsQuery.isSuccess && !jobsQuery.error)
  const anyBusy = jobs.some(item => busyJob(item))
  const resultQuery = useQuery({
    queryKey: ['subtitle-result', token, selectedId],
    queryFn: () => subtitleRequest<SubtitleResult>(`/jobs/${selectedId}/result`, token),
    enabled: connected && job?.status === 'done', retry: false,
  })
  useEffect(() => {
    if (resultQuery.data && loadedResult.current !== selectedId) {
      setCues(resultQuery.data.cues.map(cue => ({ ...cue, start: Number(cue.start.toFixed(3)), end: Number(cue.end.toFixed(3)) }))); setDirty(false); loadedResult.current = selectedId || ''
    }
  }, [resultQuery.data, selectedId])
  useEffect(() => () => { uploadAbort.current?.() }, [])

  function connect() {
    const next = tokenInput.trim()
    if (!next) { setError('Paste the connection token from your local subtitle engine.'); return }
    sessionStorage.setItem('subtitle-engine-token', next)
    setToken(next); setError(''); void queryClient.invalidateQueries({ queryKey: ['subtitle-jobs'] })
  }
  function chooseFile(next?: File) {
    if (!next) return
    if (!/\.(mp4|mkv|mov|avi|webm|mp3|wav|m4a)$/i.test(next.name) || next.size === 0 || next.size > 5 * 1024 ** 3) {
      setError('Choose a non-empty video or audio file up to 5 GB.'); return
    }
    setFile(next); setError('')
  }
  function selectJob(identifier: string) {
    if (identifier === selectedId) return
    if (dirty && !window.confirm('Discard unsaved subtitle edits and open this job?')) return
    setSelectedId(identifier); setCues([]); setDirty(false); loadedResult.current = ''; setCurrentTime(0); setError(''); setNotice('')
  }
  async function generate() {
    if (!connected || (inputMode === 'file' && !file)) return
    if (inputMode === 'youtube' && !youtubeVideoId(youtubeUrl)) {
      setError('Paste a valid YouTube, Shorts or youtu.be video link. Channels and playlists are not supported.'); return
    }
    if (dirty && !window.confirm('Discard unsaved subtitle edits and start a new job?')) return
    setUploading(true); setUploadProgress(0); setError(''); setNotice('')
    try {
      const options = { model, precision, prompt, offline }
      let result: { id: string }
      if (inputMode === 'youtube') result = await createYouTubeSubtitleJob(youtubeUrl.trim(), options, token)
      else {
        const upload = uploadSubtitleVideo(file!, options, token, setUploadProgress)
        uploadAbort.current = upload.abort
        result = await upload.promise
      }
      setSelectedId(result.id); setCues([]); setDirty(false); setCurrentTime(0); loadedResult.current = ''
      await queryClient.invalidateQueries({ queryKey: ['subtitle-jobs', token] })
    } catch (exception) { setError(exception instanceof Error ? exception.message : 'Could not start this job.') }
    finally { setUploading(false); uploadAbort.current = null }
  }
  async function cancel() {
    if (uploading) { uploadAbort.current?.(); return }
    if (!job) return
    try {
      await subtitleRequest(`/jobs/${job.id}/cancel`, token, { method: 'POST' })
      await queryClient.invalidateQueries({ queryKey: ['subtitle-jobs', token] })
    } catch (exception) { setError(exception instanceof Error ? exception.message : 'Could not cancel this job.') }
  }
  async function save() {
    if (!job) return
    const invalid = validateSubtitleCues(cues)
    if (invalid) { setError(invalid); return }
    setSaving(true); setError(''); setNotice('')
    try {
      await subtitleRequest(`/jobs/${job.id}/result`, token, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cues }) })
      setDirty(false); setNotice('Subtitle edits saved. Exports now include your corrections.')
      queryClient.setQueryData(['subtitle-result', token, selectedId], { ...resultQuery.data, cues })
    } catch (exception) { setError(exception instanceof Error ? exception.message : 'Could not save subtitles.') }
    finally { setSaving(false) }
  }
  async function exportFile(extension: string) {
    if (!job) return
    setExporting(true); setError('')
    try { await downloadSubtitles(job, extension, token) }
    catch (exception) { setError(exception instanceof Error ? exception.message : 'Export failed.') }
    finally { setExporting(false) }
  }
  function editCue(index: number, field: keyof SubtitleCue, value: string) {
    setCues(current => current.map((cue, i) => i === index ? { ...cue, [field]: field === 'text' ? value : (value.trim() === '' ? NaN : Number(value)) } : cue))
    setDirty(true); setNotice('')
  }
  const currentCue = cues.find(cue => currentTime >= cue.start && currentTime < cue.end)
  const apiError = jobsQuery.error instanceof Error ? jobsQuery.error.message : ''
  const resultError = resultQuery.error instanceof Error ? resultQuery.error.message : ''
  const ready = connected && job?.status === 'done' && loadedResult.current === selectedId

  return <AdminLayout title="AI subtitles" subtitle="Generate accurate English subtitles, review them alongside your video, and export a polished caption file."
    heroAside={<div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">Subtitle workspace</p><div className="flex flex-wrap gap-2"><AdminStatusBadge label={connected ? 'Engine connected' : 'Engine offline'} tone={connected ? 'success' : 'default'} dot /><AdminStatusBadge label="English → English" tone="info" /></div><p className="text-sm text-muted-foreground">Your videos stay on this computer.</p></div>}>
    <div className="grid gap-4 sm:grid-cols-3">
      <AdminStatCard label="Recognition model" value={job?.model || model} hint="Accuracy-first English transcription" icon={Captions} />
      <AdminStatCard label="Subtitle language" value="English" hint="Original dialogue, ready for review" icon={Languages} />
      <AdminStatCard label="Completed jobs" value={jobs.filter(item => item.status === 'done').length} hint="Saved by your local engine" icon={CheckCircle2} accent="success" />
    </div>

    <AdminSectionCard title="Connect your subtitle engine" description="Start tools/subtitles/start-api.cmd on this computer, then paste the token from tools/subtitles/.session-token."
      action={<AdminStatusBadge label={connected ? 'Connected' : 'Connection required'} tone={connected ? 'success' : 'warning'} />}>
      <div className="flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Engine connection token</span><input type="password" autoComplete="off" className={inputClass} value={tokenInput} onChange={event => setTokenInput(event.target.value)} placeholder="Paste your engine connection token" onKeyDown={event => { if (event.key === 'Enter') connect() }} /></label><Button className={buttonClass} onClick={connect}><PlugZap />Connect engine</Button><Button variant="outline" className={buttonClass} disabled={!token} onClick={() => { void jobsQuery.refetch() }} aria-label="Refresh engine connection"><RefreshCw /></Button></div>
      {apiError && <p className="mt-3 text-sm text-destructive" role="alert">{apiError}</p>}
    </AdminSectionCard>

    {(error || resultError) && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive" role="alert">{error || resultError}</div>}
    {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-foreground" role="status">{notice}</div>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]">
      <AdminSectionCard title="Import a video" description="Upload a file or paste a public YouTube video link.">
        <AdminFilterTabs value={inputMode} onChange={value => { if (!uploading) setInputMode(value) }} options={[{ value: 'youtube', label: 'YouTube link' }, { value: 'file', label: 'Upload file' }]} className="mb-4" />
        {inputMode === 'file' ? <>
        <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} accept=".mp4,.mkv,.mov,.avi,.webm,.mp3,.wav,.m4a" onChange={event => chooseFile(event.target.files?.[0])} disabled={uploading} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!uploading) chooseFile(event.dataTransfer.files[0]) }}
          className={cn('flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-border bg-background/60 p-6 text-center transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50', dragging && 'border-primary bg-primary/10')}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UploadCloud className="h-6 w-6" /></span>
          <span className="max-w-full break-all text-sm font-semibold text-foreground">{file ? file.name : 'Drop a video here, or browse files'}</span>
          <span className="text-xs text-muted-foreground">{file ? `${(file.size / 1024 ** 2).toFixed(1)} MB · Ready to generate` : 'MP4, MKV, MOV, AVI, WebM or audio · Up to 5 GB'}</span>
        </button>
        </> : <div className="rounded-[22px] border border-border bg-background/60 p-5">
          <div className="mb-4 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Youtube className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Caption a YouTube video</p><p className="mt-1 text-xs text-muted-foreground">Paste a link. No manual download needed.</p></div></div>
          <label><span className="mb-2 block text-sm font-medium">YouTube video link</span><input type="url" className={inputClass} value={youtubeUrl} disabled={uploading} onChange={event => setYouTubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Public videos and Shorts, up to 4 hours. Live streams and videos requiring sign-in are not supported.</p>
        </div>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label id="subtitle-model-label" className="mb-2 block text-sm font-medium">Recognition model</label><Select value={model} onValueChange={value => { if (value) setModel(value) }} disabled={uploading}><SelectTrigger aria-labelledby="subtitle-model-label" className="min-h-11 w-full"><SelectValue>{model === 'large-v3' ? 'Large v3' : model === 'medium.en' ? 'Medium English' : 'Small English'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="large-v3">Large v3 · Highest quality preset</SelectItem><SelectItem value="medium.en">Medium English</SelectItem><SelectItem value="small.en">Small English · Faster</SelectItem></SelectContent></Select></div>
          <div><label id="subtitle-precision-label" className="mb-2 block text-sm font-medium">Processing preset</label><Select value={precision} onValueChange={value => { if (value) setPrecision(value) }} disabled={uploading}><SelectTrigger aria-labelledby="subtitle-precision-label" className="min-h-11 w-full"><SelectValue>{precision === 'int8' ? 'Balanced memory' : 'Full precision'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="int8">Balanced memory (INT8)</SelectItem><SelectItem value="float32">Full precision (more memory)</SelectItem></SelectContent></Select></div>
        </div>
        <label className="mt-4 block"><span className="mb-2 block text-sm font-medium">Names and terminology <span className="font-normal text-muted-foreground">(optional)</span></span><input className={inputClass} value={prompt} maxLength={2000} disabled={uploading} onChange={event => setPrompt(event.target.value)} placeholder="e.g. endodontics, Dr. Lee, dental implants" /></label>
        <label className="mt-4 flex items-start gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={offline} disabled={uploading} onChange={event => setOffline(event.target.checked)} className="mt-1 accent-primary" />Use downloaded models only. Uncheck to download a model on first use.</label>
        <div className="mt-5 flex flex-wrap items-center gap-3"><Button className={buttonClass} disabled={(inputMode === 'file' ? !file : !youtubeUrl.trim()) || !connected || anyBusy || uploading} onClick={() => { void generate() }}>{uploading ? <Loader2 className="animate-spin" /> : <Captions />}{uploading ? (inputMode === 'youtube' ? 'Starting YouTube job…' : 'Importing video…') : 'Generate subtitles'}</Button>{((uploading && inputMode === 'file') || busyJob(job)) && <Button variant="outline" className={buttonClass} onClick={() => { void cancel() }} disabled={job?.status === 'cancelling'}><X />Cancel</Button>}</div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Long videos take more time. Review names, quiet speech and overlapping dialogue before publishing.</p>
      </AdminSectionCard>

      <div className="space-y-5">
        <AdminSectionCard title="Processing status" description={job ? job.filename : 'Your next captioning job will appear here.'}>
          {uploading || job ? <div className="space-y-4"><div className="flex items-center justify-between gap-2"><AdminStatusBadge label={uploading ? 'Importing' : job?.status === 'done' ? 'Ready for review' : job?.status === 'downloading' ? 'Reading YouTube audio' : job?.status || 'Waiting'} tone={job?.status === 'done' ? 'success' : job?.status === 'error' ? 'danger' : 'info'} dot /><span className="text-sm font-semibold tabular-nums">{Math.round(uploading ? uploadProgress : job?.progress || 0)}%</span></div><div role="progressbar" aria-label={uploading ? 'Video import progress' : job?.stage === 'download' ? 'YouTube audio download progress' : 'Transcription progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(uploading ? uploadProgress : job?.progress || 0)} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${uploading ? uploadProgress : job?.progress || 0}%` }} /></div><p className="break-words text-sm leading-6 text-muted-foreground" role="status">{uploading ? 'Transferring the video to your local engine…' : job?.message}</p>{job?.status === 'done' && <p className="text-sm font-medium">{job.cue_count} subtitle cues generated</p>}</div> : <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0" />Local processing with no paid transcription API.</div>}
        </AdminSectionCard>
        <AdminSectionCard title="Recent jobs" description="Open a completed job to continue reviewing.">
          {!jobs.length && <p className="text-sm text-muted-foreground">{connected ? 'No jobs yet. Import your first video to get started.' : 'Connect the engine to view saved jobs.'}</p>}
          <div className="max-h-64 space-y-2 overflow-y-auto">{jobs.map(item => <button type="button" key={item.id} onClick={() => selectJob(item.id)} className={cn('flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border/70 p-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', selectedId === item.id && 'border-primary/30 bg-primary/10')}><FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.filename}</span><span className="text-xs text-muted-foreground">{item.model} · {item.status}</span></span>{item.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : busyJob(item) ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}</button>)}</div>
        </AdminSectionCard>
      </div>
    </div>

    <AdminSectionCard title="Review and export" description="Play the video, adjust timing and wording, then save your corrections."
      action={<div className="flex flex-wrap gap-2"><Button variant="outline" className={buttonClass} disabled={!ready || !dirty || saving} onClick={() => { void save() }}>{saving && <Loader2 className="animate-spin" />}Save edits</Button>{['srt', 'vtt', 'txt'].map(extension => <Button key={extension} variant="outline" className={buttonClass} disabled={!ready || dirty || saving || exporting} onClick={() => { void exportFile(extension) }}><Download />{extension.toUpperCase()}</Button>)}</div>}>
      {!ready ? <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-[22px] border border-border/60 bg-muted/20 text-center"><Captions className="h-8 w-8 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">{resultQuery.isFetching ? 'Loading your subtitles…' : 'Completed subtitles will appear here for review.'}</p></div> : <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="min-w-0"><div className="relative overflow-hidden rounded-[22px] bg-black">{job?.source_type === 'youtube' && job.youtube_id ? <YouTubeSubtitlePlayer key={job.id} ref={youtubeRef} videoId={job.youtube_id} onTime={setCurrentTime} onError={() => setError('YouTube playback is unavailable or embedding is disabled. You can still review and export the generated subtitles.')} /> : <video key={job?.id} ref={videoRef} controls preload="metadata" className="aspect-video w-full" src={`${subtitleApiUrl}/jobs/${job?.id}/video?key=${job?.media_key}`} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onSeeked={event => setCurrentTime(event.currentTarget.currentTime)} onError={() => setError('This browser cannot play this video format. You can still edit and export subtitles, then load the SRT in VLC.')} />}<div className="pointer-events-none absolute inset-x-5 bottom-14 text-center" aria-live="off">{currentCue && <span className="inline-block whitespace-pre-line rounded-lg bg-black/75 px-3 py-1 text-sm font-semibold text-white sm:text-lg">{currentCue.text}</span>}</div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Click a subtitle time to jump to that moment. YouTube preview streams from the original video; file playback depends on the codec.</p>{job?.source_url && <a href={job.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-medium text-primary underline">Open original YouTube video</a>}{dirty && <AdminStatusBadge label="Unsaved edits · save before exporting" tone="warning" className="mt-3" />}</div>
        <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">{cues.map((cue, index) => <div key={index} className={cn('rounded-2xl border border-border/70 bg-background/60 p-3', currentTime >= cue.start && currentTime < cue.end && 'border-primary/50 bg-primary/5')}><div className="mb-2 flex flex-wrap items-center gap-2"><button type="button" className="min-h-9 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => { if (Number.isFinite(cue.start)) { if (job?.source_type === 'youtube') youtubeRef.current?.seek(cue.start); else if (videoRef.current) videoRef.current.currentTime = cue.start; setCurrentTime(cue.start) } }}>#{index + 1} · {Number.isFinite(cue.start) ? subtitleTime(cue.start) : '--:--'}</button><label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">Start<input aria-label={`Subtitle ${index + 1} start in seconds`} type="number" min="0" step="0.01" className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-foreground" value={Number.isFinite(cue.start) ? cue.start : ''} disabled={saving} onChange={event => editCue(index, 'start', event.target.value)} /></label><label className="flex items-center gap-1 text-xs text-muted-foreground">End<input aria-label={`Subtitle ${index + 1} end in seconds`} type="number" min="0" step="0.01" className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-foreground" value={Number.isFinite(cue.end) ? cue.end : ''} disabled={saving} onChange={event => editCue(index, 'end', event.target.value)} /></label></div><textarea aria-label={`Subtitle ${index + 1} text`} className={cn(inputClass, 'min-h-16 resize-y')} value={cue.text} disabled={saving} onChange={event => editCue(index, 'text', event.target.value)} /></div>)}</div>
      </div>}
    </AdminSectionCard>
  </AdminLayout>
}
