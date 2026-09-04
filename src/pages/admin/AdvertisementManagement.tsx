import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileImage,
  Image as ImageIcon,
  Link2,
  Megaphone,
  Monitor,
  MousePointerClick,
  Pencil,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  AdminFilterTabs,
  AdminSearchField,
  AdminSectionCard,
  AdminStatCard,
  AdminStatusBadge,
} from '@/components/admin/AdminPrimitives'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { VIDEO_LANGUAGE_OPTIONS, getVideoLanguageLabel } from '@/constants/videoLanguages'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { VIDEO_CATEGORIES } from '@/types'

type AdStatus = 'draft' | 'active' | 'paused' | 'hidden'
type EditableAdStatus = Exclude<AdStatus, 'hidden'>
type MediaType = 'image' | 'video'
type MediaSource = 'upload' | 'external'
type TargetVideoType = 'video' | 'short_video' | null
type ListFilter = 'all' | AdStatus

type Advertisement = {
  id: string
  campaign_name: string | null
  advertiser_name: string | null
  description: string | null
  status: AdStatus
  media_type: MediaType
  media_source: MediaSource
  media_url: string | null
  media_storage_path: string | null
  alt_text: string | null
  target_category: string | null
  target_video_type: TargetVideoType
  target_language: string | null
  priority: number
  weight: number
  display_duration_seconds: number
  skip_after_seconds: number
  cta_label: string | null
  click_url: string | null
  open_in_new_tab: boolean
  created_at: string
  updated_at: string
}

type AdEvent = {
  advertisement_id: string
  event_type: string
}

type FormState = {
  campaignName: string
  advertiserName: string
  mediaType: MediaType
  mediaSource: MediaSource
  externalUrl: string
  altText: string
  category: string
  videoType: string
  language: string
  priority: string
  weight: string
  skipAfter: string
  ctaEnabled: boolean
  ctaLabel: string
  clickUrl: string
  openInNewTab: boolean
}

type FieldErrors = Partial<Record<keyof FormState | 'media', string>>

const emptyForm: FormState = {
  campaignName: '',
  advertiserName: '',
  mediaType: 'image',
  mediaSource: 'upload',
  externalUrl: '',
  altText: '',
  category: 'all',
  videoType: 'all',
  language: 'all',
  priority: '100',
  weight: '100',
  skipAfter: '5',
  ctaEnabled: true,
  ctaLabel: 'Learn more',
  clickUrl: '',
  openInNewTab: true,
}

const statusTone: Record<AdStatus, 'default' | 'success' | 'warning' | 'info'> = {
  draft: 'default',
  active: 'success',
  paused: 'warning',
  hidden: 'info',
}

const fieldClass = 'h-11 rounded-xl bg-background/70 px-3.5 dark:bg-muted/30 dark:hover:bg-muted/45'
const selectClass = 'h-11 w-full rounded-xl px-3.5'
const labelClass = 'text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground'

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

function AdvertisementPreview({
  form,
  previewUrl,
  onVideoDuration,
}: {
  form: FormState
  previewUrl: string
  onVideoDuration: (seconds: number) => void
}) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [elapsed, setElapsed] = useState(0)
  const skipAfter = Math.max(0, Number(form.skipAfter) || 0)
  const canSkip = elapsed >= skipAfter

  useEffect(() => {
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [previewUrl, form.skipAfter])

  return (
    <AdminSectionCard
      title="Live preview"
      description="Responsive-safe preview"
      action={
        <div className="flex rounded-xl border border-border/80 bg-muted/50 p-1 dark:bg-background/70">
          <button type="button" aria-label="Desktop preview" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} className={cn('rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', device === 'desktop' ? 'bg-card text-foreground shadow-sm dark:bg-muted' : 'text-muted-foreground hover:text-foreground')}><Monitor className="h-4 w-4" /></button>
          <button type="button" aria-label="Mobile preview" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')} className={cn('rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', device === 'mobile' ? 'bg-card text-foreground shadow-sm dark:bg-muted' : 'text-muted-foreground hover:text-foreground')}><Smartphone className="h-4 w-4" /></button>
        </div>
      }
      className="xl:sticky xl:top-5"
    >
      <div className={cn('mx-auto overflow-hidden rounded-[22px] bg-[#142222] transition-[max-width] duration-200 motion-reduce:transition-none', device === 'mobile' ? 'max-w-[250px]' : 'max-w-full')}>
        <div className="relative aspect-video overflow-hidden">
          {previewUrl ? (
            form.mediaType === 'image' ? (
              <img src={previewUrl} alt={form.altText || 'Advertisement preview'} className="h-full w-full object-cover" />
            ) : (
              <video
                src={previewUrl}
                controls
                muted
                className="h-full w-full object-cover"
                aria-label={form.altText || 'Advertisement preview'}
                onLoadedMetadata={(event) => {
                  const duration = Math.ceil(event.currentTarget.duration)
                  if (Number.isFinite(duration) && duration > 0) onVideoDuration(duration)
                }}
              />
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,#335d5a,#142222_65%)] px-6 text-center text-white/75">
              <FileImage className="h-9 w-9 text-primary" />
              <p className="text-sm">Add an image or video to preview the advertisement.</p>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">Ad · {form.advertiserName || 'Advertiser'}</span>
          <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
            {canSkip ? 'Skip ad' : `Skip in ${skipAfter - elapsed}s`}
          </span>
          {form.ctaEnabled && form.ctaLabel && (
            <span className="absolute bottom-3 left-3 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{form.ctaLabel}</span>
          )}
        </div>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        {[
          ['Advertisement', form.campaignName || '—'],
          ['Target', `${form.category === 'all' ? 'All categories' : form.category} · ${form.language === 'all' ? 'All languages' : getVideoLanguageLabel(form.language)}`],
          ['Video type', form.videoType === 'all' ? 'All video types' : form.videoType === 'short_video' ? 'Short video' : 'Video'],
          ['Delivery', `Priority ${form.priority || '—'} · Weight ${form.weight || '—'}`],
        ].map(([term, detail]) => (
          <div key={term} className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">{term}</dt><dd className="text-right font-medium text-foreground">{detail}</dd></div>
        ))}
      </dl>
    </AdminSectionCard>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><p className={labelClass}>{label}</p>{children}{error && <p className="text-xs text-destructive" role="alert">{error}</p>}</div>
}

export function AdvertisementManagement() {
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const isAdmin = useAuthStore((state) => state.isAdmin())
  const [ads, setAds] = useState<Advertisement[]>([])
  const [events, setEvents] = useState<AdEvent[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null)
  const [hideTarget, setHideTarget] = useState<Advertisement | null>(null)
  const [hiding, setHiding] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [objectUrl, setObjectUrl] = useState('')
  const [detectedVideoDuration, setDetectedVideoDuration] = useState<number | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ListFilter>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [frequencyVideos, setFrequencyVideos] = useState('3')
  const [savingFrequency, setSavingFrequency] = useState(false)
  const [loadError, setLoadError] = useState('')
  const formRef = useRef<HTMLDivElement>(null)

  const loadAdvertisements = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [adsResult, eventsResult] = await Promise.all([
        supabase.from('video_advertisements').select('*').order('created_at', { ascending: false }),
        supabase.from('video_advertisement_events').select('advertisement_id,event_type').limit(10000),
      ])
      if (adsResult.error) throw adsResult.error
      if (eventsResult.error) throw eventsResult.error
      setAds((adsResult.data || []) as Advertisement[])
      setEvents((eventsResult.data || []) as AdEvent[])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Advertisement data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAdvertisements() }, [])
  useEffect(() => {
    supabase.from('video_advertisement_settings').select('frequency_videos').eq('id', true).single()
      .then(({ data, error }) => {
        if (error) { setLoadError(error.message); return }
        setFrequencyVideos(String(data.frequency_videos || 3))
      })
  }, [])
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }, [objectUrl])

  const statsByAd = useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number }>()
    for (const event of events) {
      const current = map.get(event.advertisement_id) || { impressions: 0, clicks: 0 }
      if (event.event_type === 'impression') current.impressions += 1
      if (event.event_type === 'click') current.clicks += 1
      map.set(event.advertisement_id, current)
    }
    return map
  }, [events])

  const totalImpressions = events.filter((event) => event.event_type === 'impression').length
  const totalClicks = events.filter((event) => event.event_type === 'click').length
  const filteredAds = useMemo(() => ads.filter((ad) => {
    const matchesFilter = filter === 'all' ? ad.status !== 'hidden' : ad.status === filter
    const haystack = `${ad.campaign_name || ''} ${ad.advertiser_name || ''} ${ad.target_category || ''}`.toLowerCase()
    return matchesFilter && haystack.includes(search.trim().toLowerCase())
  }), [ads, filter, search])

  const previewUrl = form.mediaSource === 'upload' ? (objectUrl || editingAd?.media_url || '') : form.externalUrl

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    if (!file) return
    const expectedPrefix = form.mediaType === 'image' ? 'image/' : 'video/'
    if (!file.type.startsWith(expectedPrefix)) {
      setErrors((current) => ({ ...current, media: `Choose a ${form.mediaType} file.` }))
      event.target.value = ''
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrors((current) => ({ ...current, media: 'The file must be 50 MB or smaller.' }))
      event.target.value = ''
      return
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    setSelectedFile(file)
    setObjectUrl(URL.createObjectURL(file))
    setDetectedVideoDuration(null)
    setErrors((current) => ({ ...current, media: undefined }))
  }

  function validate(saveAsDraft: boolean) {
    if (saveAsDraft) {
      setErrors({})
      return true
    }

    const next: FieldErrors = {}
    if (!form.campaignName.trim()) next.campaignName = 'Enter an advertisement name.'
    if (!form.advertiserName.trim()) next.advertiserName = 'Enter the advertiser name.'
    if (!form.altText.trim()) next.altText = 'Add accessible text for this media.'
    if (form.mediaSource === 'external' && !isHttpsUrl(form.externalUrl)) next.externalUrl = 'Enter a valid HTTPS media URL.'
    if (form.mediaSource === 'upload' && !selectedFile && !editingAd?.media_storage_path) next.media = 'Choose a media file to upload.'
    const priority = Number(form.priority)
    const weight = Number(form.weight)
    const skip = Number(form.skipAfter)
    if (!Number.isInteger(priority) || priority < 0 || priority > 1000) next.priority = 'Use a whole number from 0 to 1000.'
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000) next.weight = 'Use a whole number from 1 to 1000.'
    if (!Number.isInteger(skip) || skip < 0 || skip > 300) next.skipAfter = 'Use a whole number from 0 to 300.'
    if (form.mediaType === 'video' && detectedVideoDuration === null) next.media = 'Wait for the video duration to be detected before saving.'
    if (form.mediaType === 'video' && detectedVideoDuration !== null && skip > detectedVideoDuration) next.skipAfter = `This video is ${detectedVideoDuration} seconds long. Choose a shorter skip time.`
    if (form.ctaEnabled) {
      if (!form.ctaLabel.trim()) next.ctaLabel = 'Enter the button text.'
      if (!isHttpsUrl(form.clickUrl)) next.clickUrl = 'Enter a valid HTTPS destination URL.'
    }
    setErrors(next)
    const firstKey = Object.keys(next)[0]
    if (firstKey) document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)?.focus()
    return Object.keys(next).length === 0
  }

  async function submit(event: FormEvent, forceDraft = false) {
    event.preventDefault()
    if (!user || saving || !validate(forceDraft)) return
    setSaving(true)
    let uploadedPath: string | null = null
    try {
      let mediaUrl = form.externalUrl.trim()
      let mediaStoragePath: string | null = null
      if (form.mediaSource === 'upload') {
        mediaUrl = editingAd?.media_url || ''
        mediaStoragePath = editingAd?.media_storage_path || null
        if (selectedFile) {
          const extension = selectedFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (form.mediaType === 'image' ? 'jpg' : 'mp4')
          uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`
          const upload = await supabase.storage.from('video-ad-media').upload(uploadedPath, selectedFile, { contentType: selectedFile.type, upsert: false })
          if (upload.error) throw upload.error
          mediaStoragePath = uploadedPath
          mediaUrl = supabase.storage.from('video-ad-media').getPublicUrl(uploadedPath).data.publicUrl
        }
      }
      const nextStatus: EditableAdStatus = forceDraft
        ? 'draft'
        : editingAd
          ? (editingAd.status === 'hidden' ? 'draft' : editingAd.status)
          : 'active'
      const payload = {
        campaign_name: form.campaignName.trim() || null, advertiser_name: form.advertiserName.trim() || null,
        status: nextStatus, media_type: form.mediaType, media_source: form.mediaSource,
        media_url: mediaUrl || null, media_storage_path: mediaStoragePath, alt_text: form.altText.trim() || null,
        target_category: form.category === 'all' ? null : form.category,
        target_video_type: form.videoType === 'all' ? null : form.videoType,
        target_language: form.language === 'all' ? null : form.language,
        priority: Number(form.priority), weight: Number(form.weight),
        // The database column remains for compatibility. Video duration is
        // detected from the media; image delivery is governed by the skip rule.
        display_duration_seconds: form.mediaType === 'video'
          ? (detectedVideoDuration ?? Math.max(Number(form.skipAfter) || 0, 10))
          : Math.max(Number(form.skipAfter), 10),
        skip_after_seconds: Number(form.skipAfter),
        cta_label: form.ctaEnabled ? form.ctaLabel.trim() : null, click_url: form.ctaEnabled ? form.clickUrl.trim() : null,
        open_in_new_tab: form.ctaEnabled && form.openInNewTab, updated_by: user.id,
      }
      if (editingAd) {
        const result = await supabase.from('video_advertisements').update(payload).eq('id', editingAd.id).select().single()
        if (result.error) throw result.error
        if (uploadedPath && editingAd.media_storage_path) await supabase.storage.from('video-ad-media').remove([editingAd.media_storage_path])
        toast.success(forceDraft ? 'Advertisement saved as draft' : nextStatus === 'draft' ? 'Advertisement updated as draft' : 'Advertisement updated')
      } else {
        const result = await supabase.from('video_advertisements').insert({ ...payload, created_by: user.id }).select().single()
        if (result.error) throw result.error
        toast.success(forceDraft ? 'Draft saved' : 'Advertisement created and activated')
      }
      resetForm()
      await loadAdvertisements()
    } catch (error) {
      if (uploadedPath) await supabase.storage.from('video-ad-media').remove([uploadedPath])
      toast.error(error instanceof Error ? error.message : 'Advertisement could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    setObjectUrl(''); setSelectedFile(null); setDetectedVideoDuration(null); setEditingAd(null); setErrors({}); setForm(emptyForm)
  }

  function editAd(ad: Advertisement) {
    setEditingAd(ad); setSelectedFile(null); setObjectUrl(''); setErrors({})
    setDetectedVideoDuration(ad.media_type === 'video' ? ad.display_duration_seconds : null)
    setForm({
      campaignName: ad.campaign_name || '', advertiserName: ad.advertiser_name || '',
      mediaType: ad.media_type, mediaSource: ad.media_source, externalUrl: ad.media_source === 'external' ? ad.media_url || '' : '', altText: ad.alt_text || '',
      category: ad.target_category || 'all', videoType: ad.target_video_type || 'all', language: ad.target_language || 'all',
      priority: String(ad.priority), weight: String(ad.weight), skipAfter: String(ad.skip_after_seconds),
      ctaEnabled: Boolean(ad.cta_label && ad.click_url), ctaLabel: ad.cta_label || '', clickUrl: ad.click_url || '', openInNewTab: ad.open_in_new_tab,
    })
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function changeStatus(ad: Advertisement, status: EditableAdStatus) {
    if (!user) return
    const result = await supabase.from('video_advertisements').update({ status, updated_by: user.id }).eq('id', ad.id)
    if (result.error) { toast.error(result.error.message); return }
    setAds((current) => current.map((item) => item.id === ad.id ? { ...item, status } : item))
    toast.success(`Advertisement ${status}`)
  }

  async function saveAdvertisementFrequency() {
    if (!user || savingFrequency) return
    const frequency = Number(frequencyVideos)
    if (!Number.isInteger(frequency) || frequency < 1 || frequency > 100) {
      toast.error('Enter a whole number from 1 to 100.')
      return
    }

    setSavingFrequency(true)
    try {
      const { error } = await supabase
        .from('video_advertisement_settings')
        .update({ frequency_videos: frequency, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', true)
      if (error) throw error
      toast.success(`Advertisements will now appear every ${frequency} videos.`)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Advertisement frequency could not be saved.'))
    } finally {
      setSavingFrequency(false)
    }
  }

  async function hideAdvertisement() {
    if (!user || !hideTarget || hideTarget.status === 'hidden' || hiding) return
    setHiding(true)
    const ad = hideTarget
    try {
      const result = await supabase
        .from('video_advertisements')
        .update({ status: 'hidden', updated_by: user.id })
        .eq('id', ad.id)
        .eq('status', ad.status)
      if (result.error) throw result.error
      setAds((current) => current.filter((item) => item.id !== ad.id))
      if (editingAd?.id === ad.id) resetForm()
      setHideTarget(null)
      toast.success(ad.status === 'active' ? 'Advertisement hidden and delivery stopped' : 'Advertisement hidden')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Advertisement could not be hidden.'))
    } finally {
      setHiding(false)
    }
  }

  if (!profile || !isAdmin) return <AdminGuard />

  return (
    <AdminLayout
      title="Advertisement management"
      subtitle="Create responsive interstitial ads matched to a video's category, language, and type. Delivery frequency is controlled once for all active advertisements."
      actions={<Button size="lg" className="h-11 rounded-xl px-4" onClick={() => { resetForm(); formRef.current?.scrollIntoView({ behavior: 'smooth' }) }}><Plus />New advertisement</Button>}
      heroAside={<div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Sparkles className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-foreground">Safe 16:9 delivery</p><p className="text-xs text-muted-foreground">Responsive on desktop and mobile</p></div></div>}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Active ads" value={ads.filter((ad) => ad.status === 'active').length} icon={CheckCircle2} accent="success" hint={`${ads.length} total advertisements`} />
        <AdminStatCard label="Drafts" value={ads.filter((ad) => ad.status === 'draft').length} icon={FileImage} hint="Waiting for activation" />
        <AdminStatCard label="Impressions" value={formatNumber(totalImpressions)} icon={Eye} accent="default" hint="Recorded ad displays" />
        <AdminStatCard label="Clicks" value={formatNumber(totalClicks)} icon={MousePointerClick} accent="warning" hint={`${totalImpressions ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'}% click-through rate`} />
      </div>

      <AdminSectionCard title="Advertisement frequency" description="Set one delivery interval for every active advertisement. Changes apply across the E-Learning video experience.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-sm space-y-2">
            <label htmlFor="advertisement-frequency" className={labelClass}>Show advertisements after how many videos</label>
            <Input id="advertisement-frequency" type="number" min="1" max="100" value={frequencyVideos} onChange={(event) => setFrequencyVideos(event.target.value)} className={fieldClass} />
            <p className="text-xs text-muted-foreground">For example, 5 displays one matched advertisement after every five learning videos.</p>
          </div>
          <Button type="button" size="lg" className="h-11 rounded-xl px-5" disabled={savingFrequency} onClick={() => void saveAdvertisementFrequency()}>
            {savingFrequency ? <RefreshCw className="animate-spin" /> : <Clock3 />}
            {savingFrequency ? 'Saving…' : 'Save frequency'}
          </Button>
        </div>
      </AdminSectionCard>

      <div ref={formRef} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <AdminSectionCard title={editingAd ? 'Edit advertisement' : 'Create advertisement'} description="Fields marked with * are required. All targeting values make the ad eligible for every matching video.">
          <form noValidate onSubmit={submit} className="space-y-7">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Megaphone className="h-4 w-4 text-primary" />Advertisement details</div>
              <FormField label="Advertisement name *" error={errors.campaignName}><Input data-field="campaignName" aria-invalid={Boolean(errors.campaignName)} value={form.campaignName} onChange={(e) => updateForm('campaignName', e.target.value)} placeholder="e.g. ProDent Q3 Awareness" className={fieldClass} /></FormField>
              <FormField label="Brand / advertiser *" error={errors.advertiserName}><Input data-field="advertiserName" aria-invalid={Boolean(errors.advertiserName)} value={form.advertiserName} onChange={(e) => updateForm('advertiserName', e.target.value)} placeholder="Brand name" className={fieldClass} /></FormField>
            </div>

            <div className="border-t border-border/70 pt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><ImageIcon className="h-4 w-4 text-primary" />Media</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Media type"><Select value={form.mediaType} onValueChange={(value) => { updateForm('mediaType', value as MediaType); setSelectedFile(null); setObjectUrl(''); setDetectedVideoDuration(null) }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">Image</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent></Select></FormField>
                <FormField label="Media source"><Select value={form.mediaSource} onValueChange={(value) => updateForm('mediaSource', value as MediaSource)}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="upload">Upload file</SelectItem><SelectItem value="external">External HTTPS URL</SelectItem></SelectContent></Select></FormField>
              </div>
              {form.mediaSource === 'upload' ? (
                <FormField label="Upload media *" error={errors.media}>
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-primary/5 px-4 py-5 text-center transition-colors hover:bg-primary/10 focus-within:ring-2 focus-within:ring-ring dark:border-primary/30 dark:bg-primary/10 dark:hover:bg-primary/15">
                    <UploadCloud className="h-6 w-6 text-primary" /><span className="mt-2 text-sm font-medium text-foreground">{selectedFile?.name || (editingAd?.media_storage_path ? 'Replace the current media' : `Choose a ${form.mediaType}`)}</span><span className="mt-1 text-xs text-muted-foreground">Maximum 50 MB</span>
                    <input data-field="media" type="file" className="sr-only" accept={form.mediaType === 'image' ? 'image/*' : 'video/*'} onChange={handleFile} />
                  </label>
                </FormField>
              ) : <FormField label="External media URL *" error={errors.externalUrl || errors.media}><div className="relative"><Link2 className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input data-field="externalUrl" aria-invalid={Boolean(errors.externalUrl || errors.media)} value={form.externalUrl} onChange={(e) => { updateForm('externalUrl', e.target.value); setDetectedVideoDuration(null); setErrors((current) => ({ ...current, media: undefined })) }} placeholder="https://cdn.example.com/ad.jpg" className={cn(fieldClass, 'pl-10')} /></div>{form.mediaType === 'video' && <p className="text-xs text-muted-foreground">The video duration is detected automatically when the preview loads.</p>}</FormField>}
              <FormField label="Accessibility description *" error={errors.altText}><Input data-field="altText" aria-invalid={Boolean(errors.altText)} value={form.altText} onChange={(e) => updateForm('altText', e.target.value)} placeholder="Describe the important visual content for screen-reader users" className={fieldClass} /><p className="text-xs text-muted-foreground">This is an accessible text description, not a separate audio track.</p></FormField>
            </div>

            <div className="border-t border-border/70 pt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Target className="h-4 w-4 text-primary" />Targeting & delivery</div>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField label="Category"><Select value={form.category} onValueChange={(value) => updateForm('category', value ?? 'all')}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{VIDEO_CATEGORIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></FormField>
                <FormField label="Language"><Select value={form.language} onValueChange={(value) => updateForm('language', value ?? 'all')}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{VIDEO_LANGUAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value.toLowerCase()}>{item.label}</SelectItem>)}</SelectContent></Select></FormField>
                <FormField label="Video type"><Select value={form.videoType} onValueChange={(value) => updateForm('videoType', value ?? 'all')}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All video types</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="short_video">Short video</SelectItem></SelectContent></Select></FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Priority (higher wins)" error={errors.priority}><Input data-field="priority" type="number" min="0" max="1000" value={form.priority} onChange={(e) => updateForm('priority', e.target.value)} className={fieldClass} /></FormField>
                <FormField label="Weight" error={errors.weight}><Input data-field="weight" type="number" min="1" max="1000" value={form.weight} onChange={(e) => updateForm('weight', e.target.value)} className={fieldClass} /></FormField>
                <FormField label="Allow skip after (seconds)" error={errors.skipAfter}><Input data-field="skipAfter" type="number" min="0" max="300" value={form.skipAfter} onChange={(e) => updateForm('skipAfter', e.target.value)} className={fieldClass} /><p className="text-xs text-muted-foreground">{form.mediaType === 'video' ? detectedVideoDuration ? `Video duration detected: ${detectedVideoDuration} seconds.` : 'Video duration will be detected automatically.' : 'The image remains visible until the viewer can skip it.'}</p></FormField>
              </div>
            </div>

            <div className="border-t border-border/70 pt-6 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/45 p-4 dark:border dark:border-border/70 dark:bg-muted/35"><div><p className="text-sm font-semibold text-foreground">Call to action</p><p className="mt-1 text-xs text-muted-foreground">Show a button that opens the advertiser's page.</p></div><Switch checked={form.ctaEnabled} onCheckedChange={(value) => updateForm('ctaEnabled', value)} aria-label="Enable call to action" /></div>
              {form.ctaEnabled && <><div className="grid gap-4 md:grid-cols-2"><FormField label="CTA button text *" error={errors.ctaLabel}><Input data-field="ctaLabel" value={form.ctaLabel} onChange={(e) => updateForm('ctaLabel', e.target.value)} placeholder="Learn more" className={fieldClass} /></FormField><FormField label="Destination URL *" error={errors.clickUrl}><Input data-field="clickUrl" value={form.clickUrl} onChange={(e) => updateForm('clickUrl', e.target.value)} placeholder="https://…" className={fieldClass} /></FormField></div><div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 p-4"><div><p className="text-sm font-medium text-foreground">Open in a new tab</p><p className="text-xs text-muted-foreground">Keeps the learning video open.</p></div><Switch checked={form.openInNewTab} onCheckedChange={(value) => updateForm('openInNewTab', value)} aria-label="Open destination in a new tab" /></div></>}
            </div>

            <div className="sticky bottom-0 z-10 -mx-5 flex flex-col-reverse gap-2 border-t border-border/80 bg-card/95 px-5 py-4 shadow-[0_-10px_30px_rgba(30,51,51,0.04)] backdrop-blur dark:bg-card/95 dark:shadow-[0_-12px_32px_rgba(0,0,0,0.22)] sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
              <Button type="button" variant="outline" size="lg" className="h-11 rounded-xl" onClick={resetForm} disabled={saving}><X />Cancel</Button>
              <Button type="button" variant="outline" size="lg" className="h-11 rounded-xl" onClick={(event) => void submit(event as unknown as FormEvent, true)} disabled={saving}><Save />Save draft</Button>
              <Button type="submit" size="lg" className="h-11 rounded-xl px-5" disabled={saving}>{saving ? <RefreshCw className="animate-spin" /> : editingAd ? <Save /> : <Plus />}{saving ? 'Saving…' : editingAd ? 'Update advertisement' : 'Create advertisement'}</Button>
            </div>
          </form>
        </AdminSectionCard>
        <AdvertisementPreview form={form} previewUrl={previewUrl} onVideoDuration={setDetectedVideoDuration} />
      </div>

      <AdminSectionCard title="All advertisements" description="Review delivery status and performance. Hidden advertisements remain recoverable from the Hidden tab." action={<Button variant="outline" size="lg" className="h-10 rounded-xl" onClick={() => void loadAdvertisements()} disabled={loading}><RefreshCw className={cn(loading && 'animate-spin')} />Refresh</Button>} contentClassName="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <AdminSearchField value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search advertisements…" aria-label="Search advertisements" className="max-w-xl" />
          <AdminFilterTabs value={filter} onChange={setFilter} options={(['all','active','draft','paused','hidden'] as ListFilter[]).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1), count: value === 'all' ? ads.filter((ad) => ad.status !== 'hidden').length : ads.filter((ad) => ad.status === value).length }))} />
        </div>
        {loadError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4" role="alert"><p className="font-medium text-destructive">Advertisements could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">{loadError}</p><Button variant="outline" className="mt-3" onClick={() => void loadAdvertisements()}>Try again</Button></div>}
        {!loadError && loading && ads.length === 0 && <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading advertisements…</div>}
        {!loadError && !loading && filteredAds.length === 0 && <div className="rounded-2xl border border-dashed border-border p-8 text-center"><Megaphone className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 font-medium text-foreground">{ads.length ? 'No matching advertisements' : 'No advertisements yet'}</p><p className="mt-1 text-sm text-muted-foreground">{ads.length ? 'Change or clear the current filters.' : 'Create the first advertisement using the form above.'}</p></div>}
        <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
          {filteredAds.map((ad) => {
            const stat = statsByAd.get(ad.id) || { impressions: 0, clicks: 0 }
            const ctr = stat.impressions ? ((stat.clicks / stat.impressions) * 100).toFixed(2) : '0.00'
            return <article key={ad.id} className="grid gap-4 bg-card p-4 transition-colors hover:bg-muted/20 dark:bg-card/80 dark:hover:bg-muted/35 lg:grid-cols-[92px_minmax(0,1fr)_auto] lg:items-center">
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-muted">{ad.media_url ? (ad.media_type === 'image' ? <img src={ad.media_url} alt="" className="h-full w-full object-cover" /> : <video src={ad.media_url} muted preload="metadata" className="h-full w-full object-cover" />) : <FileImage className="h-6 w-6 text-muted-foreground" />}</div>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-foreground">{ad.campaign_name || 'Untitled advertisement'}</h3><AdminStatusBadge label={ad.status[0].toUpperCase() + ad.status.slice(1)} tone={statusTone[ad.status]} dot /></div><p className="mt-1 text-sm text-muted-foreground">{ad.advertiser_name || 'Advertiser not set'} · {ad.target_category || 'All categories'} · {ad.target_language ? getVideoLanguageLabel(ad.target_language) : 'All languages'} · Priority {ad.priority}</p><p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />Updated {new Date(ad.updated_at).toLocaleDateString()}</p></div>
              <div className="flex flex-wrap items-center gap-2.5 lg:justify-end"><div className="mr-1 grid grid-cols-3 gap-4 text-center text-sm"><div><p className="font-semibold text-foreground">{formatNumber(stat.impressions)}</p><p className="text-[11px] text-muted-foreground">Impressions</p></div><div><p className="font-semibold text-foreground">{formatNumber(stat.clicks)}</p><p className="text-[11px] text-muted-foreground">Clicks</p></div><div><p className="font-semibold text-primary">{ctr}%</p><p className="text-[11px] text-muted-foreground">CTR</p></div></div><Button variant="outline" size="sm" className="h-9 rounded-xl border-border/80 bg-background px-3.5 shadow-sm hover:border-primary/35 hover:bg-primary/7" onClick={() => editAd(ad)}><Pencil />Edit</Button>{ad.status === 'active' ? <Button variant="outline" size="sm" className="h-9 rounded-xl border-amber-300/60 bg-amber-50 px-3.5 text-amber-800 shadow-sm hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/25 dark:text-amber-300 dark:hover:bg-amber-950/45" onClick={() => void changeStatus(ad, 'paused')}><Pause />Pause</Button> : <Button size="sm" className="h-9 rounded-xl bg-primary px-4 text-primary-foreground shadow-[0_6px_16px_rgba(45,110,106,0.18)] hover:bg-primary/85" onClick={() => void changeStatus(ad, 'active')}><Play />Activate</Button>}{ad.status !== 'hidden' && <Button variant="ghost" size="icon-sm" className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/8 hover:text-destructive" aria-label={`Hide ${ad.campaign_name || 'untitled advertisement'}`} onClick={() => setHideTarget(ad)}><Trash2 /></Button>}</div>
            </article>
          })}
        </div>
      </AdminSectionCard>

      <Dialog open={Boolean(hideTarget)} onOpenChange={(open) => { if (!open && !hiding) setHideTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide this advertisement?</DialogTitle>
            <DialogDescription>
              “{hideTarget?.campaign_name || 'Untitled advertisement'}” will no longer appear in the advertisement list. Its database record and uploaded media will be retained.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={hiding} />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={hiding} onClick={() => void hideAdvertisement()}>
              {hiding ? <RefreshCw className="animate-spin" /> : <Trash2 />}
              {hiding ? 'Hiding…' : 'Hide advertisement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
