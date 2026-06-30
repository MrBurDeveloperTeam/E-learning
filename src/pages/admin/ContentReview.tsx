import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  Play,
  ShieldAlert,
  Stethoscope,
  TimerReset,
  Video,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  AdminFilterTabs,
  AdminStatCard,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives'
import { CategoryBadge } from '@/components/CategoryBadge'
import { PageLayout } from '@/components/layout/PageLayout'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VideoThumbnail } from '@/components/shared/VideoThumbnail'
import { dentalCategories } from '@/constants/dentalCategories'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { formatViewCount, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'

/* ────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────── */

type ContentTab = 'platform' | 'dental'
type VideoStatusFilter = 'all' | 'published' | 'processing' | 'removed'

type AdminVideoRow = {
  id: string
  title: string
  tags: string[]
  category: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  view_count: number
  status: 'published' | 'processing' | 'removed' | 'unlisted'
  created_at: string
  profiles: {
    user_id: string
    full_name: string | null
    avatar_url: string | null
    specialty: string | null
  }
}

type DentalReviewRow = {
  id: string
  video_id: string
  title: string
  description: string
  thumbnail_url: string
  channel_name: string
  published_at: string
  category: string | null
  confidence_score: number | null
  tags: string[] | null
  needs_review: boolean
  fetched_at: string
}

type DentalCategoryFilter = 'all' | string

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */

function getStatusTone(status: AdminVideoRow['status']) {
  if (status === 'published') return 'success' as const
  if (status === 'processing') return 'warning' as const
  if (status === 'removed') return 'danger' as const
  return 'default' as const
}

function getConfidenceTone(score: number | null) {
  if (score === null) return 'default' as const
  if (score < 0.3) return 'danger' as const
  if (score < 0.6) return 'warning' as const
  return 'success' as const
}

function formatConfidence(score: number | null) {
  if (score === null) return 'N/A'
  return `${Math.round(score * 100)}%`
}

/* ────────────────────────────────────────────────────────
   Dental Video Detail Modal (full-page popup)
   ──────────────────────────────────────────────────────── */

function DentalVideoDetailModal({
  video,
  onClose,
  onApprove,
  onReassign,
  isApproving,
}: {
  video: DentalReviewRow | null
  onClose: () => void
  onApprove: (id: string) => void
  onReassign: (id: string, currentCategory: string) => void
  isApproving: boolean
}) {
  const [reassignCategory, setReassignCategory] = useState<string>('')
  const [showReassign, setShowReassign] = useState(false)

  const queryClient = useQueryClient()

  const reassignMutation = useMutation({
    mutationFn: async ({ videoId, category }: { videoId: string; category: string }) => {
      const { error } = await supabase
        .from('dental_videos')
        .update({ category, needs_review: false, confidence_score: 1.0 })
        .eq('id', videoId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Category reassigned and approved')
      setReassignCategory('')
      setShowReassign(false)
      queryClient.invalidateQueries({ queryKey: ['admin-dental-review'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dental-review-count'] })
      onClose()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reassign')
    },
  })

  // Reset internal state when modal opens/closes
  const handleClose = useCallback(() => {
    setReassignCategory('')
    setShowReassign(false)
    onClose()
  }, [onClose])

  if (!video) return null

  const confidencePercent = video.confidence_score !== null ? Math.round(video.confidence_score * 100) : null
  const confidenceTone = getConfidenceTone(video.confidence_score)
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.video_id}`
  const embedUrl = `https://www.youtube.com/embed/${video.video_id}?rel=0&modestbranding=1`

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-slate-950/70 dark:bg-black/90 backdrop-blur-md duration-300 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl h-[calc(100vh-2.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-[32px] border border-border/80 dark:border-white/15 bg-card/95 shadow-[0_20px_60px_-15px_rgba(30,51,51,0.2)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-0 overflow-hidden flex flex-col duration-300 ease-out data-open:animate-in data-open:fade-in-0 data-open:zoom-in-90 data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-bottom-4 sm:max-w-6xl"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border/80 bg-muted/35 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Play className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground truncate max-w-[600px]">
                {video.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Review this dental video's categorization (Theater Mode)
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row h-full">
            {/* Left: Video player (Theater Mode) */}
            <div className="lg:flex-1 lg:min-w-0 bg-secondary/30 dark:bg-gradient-to-b dark:from-black dark:via-zinc-950 dark:to-black flex flex-col items-center justify-center p-4 lg:p-8 relative overflow-hidden">
              {/* Subtle ambient glow in background */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(136,193,189,0.18)_0,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(136,193,189,0.08)_0,transparent_70%)] pointer-events-none" />

              <div className="w-full max-w-4xl relative z-10">
                <div className="relative w-full overflow-hidden rounded-2xl shadow-[0_12px_35px_rgba(30,51,51,0.15)] dark:shadow-[0_0_50px_rgba(0,0,0,0.9)] ring-1 ring-border/80 dark:ring-white/10" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={embedUrl}
                    title={video.title}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>

            {/* Right: Details panel */}
            <div className="lg:w-[420px] xl:w-[460px] lg:flex-shrink-0 border-t lg:border-t-0 lg:border-l border-border/80 overflow-y-auto">
              <div className="p-5 lg:p-6 space-y-6">
                {/* Video title (visible on desktop right panel) */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground leading-snug">
                    {video.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {video.description || 'No description available.'}
                  </p>
                </div>

                {/* Metadata grid */}
                <div className="space-y-4">
                  {/* Channel */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/65 w-24 flex-shrink-0 pt-0.5">
                      Channel
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {video.channel_name}
                    </span>
                  </div>

                  {/* Category */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/65 w-24 flex-shrink-0 pt-0.5">
                      Category
                    </span>
                    <CategoryBadge
                      category={video.category}
                      needsReview={true}
                    />
                  </div>

                  {/* Confidence */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/65 w-24 flex-shrink-0 pt-1">
                      Confidence
                    </span>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <AdminStatusBadge
                          label={formatConfidence(video.confidence_score)}
                          tone={confidenceTone}
                        />
                        {confidencePercent !== null && confidencePercent < 30 && (
                          <span className="text-xs text-destructive font-medium">Likely misclassified</span>
                        )}
                        {confidencePercent !== null && confidencePercent >= 30 && confidencePercent < 60 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Worth verifying</span>
                        )}
                      </div>
                      {/* Confidence bar */}
                      {confidencePercent !== null && (
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              confidencePercent < 30
                                ? 'bg-destructive'
                                : confidencePercent < 60
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${confidencePercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/65 w-24 flex-shrink-0 pt-0.5">
                      Tags
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {video.tags && video.tags.length > 0 ? (
                        video.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground/50">No tags assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Published */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/65 w-24 flex-shrink-0 pt-0.5">
                      Published
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(video.published_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Fetched */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/65 w-24 flex-shrink-0 pt-0.5">
                      Fetched
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {timeAgo(video.fetched_at)}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border/80" />

                {/* Reassign section (collapsible) */}
                {showReassign ? (
                  <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Reassign category</p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowReassign(false)
                          setReassignCategory('')
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        value={reassignCategory}
                        onChange={(e) => setReassignCategory(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-3 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Select a category…</option>
                        {dentalCategories.map((cat) => (
                          <option key={cat.id} value={cat.label}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (reassignCategory) {
                          reassignMutation.mutate({ videoId: video.id, category: reassignCategory })
                        }
                      }}
                      disabled={!reassignCategory || reassignMutation.isPending}
                      className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      Reassign & approve
                    </button>
                  </div>
                ) : null}

                {/* Action buttons */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => onApprove(video.id)}
                    disabled={isApproving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-500/20 dark:text-emerald-300 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Approve current category
                  </button>

                  {!showReassign && (
                    <button
                      type="button"
                      onClick={() => setShowReassign(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-500/10 dark:text-amber-300"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Reassign to different category
                    </button>
                  )}

                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Watch on YouTube
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ────────────────────────────────────────────────────────
   Dental Review Panel
   ──────────────────────────────────────────────────────── */

function DentalReviewPanel() {
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState<DentalCategoryFilter>('all')
  const [reassignVideoId, setReassignVideoId] = useState<string | null>(null)
  const [reassignCategory, setReassignCategory] = useState<string>('')
  const [selectedVideo, setSelectedVideo] = useState<DentalReviewRow | null>(null)

  // Fetch dental videos that need review
  const reviewQuery = useQuery({
    queryKey: ['admin-dental-review'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dental_videos')
        .select('*')
        .eq('needs_review', true)
        .order('fetched_at', { ascending: false })
        .limit(200)

      if (error) throw error
      return (data ?? []) as DentalReviewRow[]
    },
  })

  // Approve mutation — trusts the AI assignment
  const approveMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from('dental_videos')
        .update({ needs_review: false })
        .eq('id', videoId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Video approved')
      queryClient.invalidateQueries({ queryKey: ['admin-dental-review'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dental-review-count'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to approve')
    },
  })

  // Reassign mutation — changes category and approves
  const reassignMutation = useMutation({
    mutationFn: async ({ videoId, category }: { videoId: string; category: string }) => {
      const { error } = await supabase
        .from('dental_videos')
        .update({ category, needs_review: false, confidence_score: 1.0 })
        .eq('id', videoId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Category reassigned and approved')
      setReassignVideoId(null)
      setReassignCategory('')
      queryClient.invalidateQueries({ queryKey: ['admin-dental-review'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dental-review-count'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reassign')
    },
  })

  // Approve all mutation
  const approveAllMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      const { error } = await supabase
        .from('dental_videos')
        .update({ needs_review: false })
        .in('id', videoIds)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('All visible videos approved')
      queryClient.invalidateQueries({ queryKey: ['admin-dental-review'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dental-review-count'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to approve all')
    },
  })

  const allReviewVideos = reviewQuery.data ?? []

  // Build category filter options dynamically from the review queue
  const categoryGroups = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const v of allReviewVideos) {
      const cat = v.category ?? 'Uncategorized'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [allReviewVideos])

  const filteredVideos = useMemo(() => {
    if (categoryFilter === 'all') return allReviewVideos
    if (categoryFilter === 'Uncategorized') {
      return allReviewVideos.filter((v) => !v.category)
    }
    return allReviewVideos.filter((v) => v.category === categoryFilter)
  }, [allReviewVideos, categoryFilter])

  const filterOptions: { value: string; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: allReviewVideos.length },
    ...Object.entries(categoryGroups).map(([cat, count]) => ({
      value: cat,
      label: cat,
      count,
    })),
  ]

  // Video that is currently being reassigned
  const reassignVideo = allReviewVideos.find((v) => v.id === reassignVideoId)

  if (reviewQuery.isLoading) {
    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-[26px]" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-[24px]" />
        <Skeleton className="h-[520px] rounded-[28px]" />
      </>
    )
  }

  // Stat counts
  const totalFlagged = allReviewVideos.length
  const lowConfidence = allReviewVideos.filter(
    (v) => v.confidence_score !== null && v.confidence_score < 0.3
  ).length
  const medConfidence = allReviewVideos.filter(
    (v) => v.confidence_score !== null && v.confidence_score >= 0.3 && v.confidence_score < 0.6
  ).length

  return (
    <>
      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard
          label="Flagged for review"
          value={totalFlagged.toLocaleString()}
          icon={AlertTriangle}
          accent={totalFlagged > 0 ? 'warning' : 'default'}
          hint="Dental videos that need admin review"
        />
        <AdminStatCard
          label="Low confidence"
          value={lowConfidence.toLocaleString()}
          icon={ShieldAlert}
          accent={lowConfidence > 0 ? 'danger' : 'default'}
          hint="Confidence below 30% — likely misclassified"
        />
        <AdminStatCard
          label="Medium confidence"
          value={medConfidence.toLocaleString()}
          icon={Stethoscope}
          accent={medConfidence > 0 ? 'warning' : 'default'}
          hint="Confidence 30–60% — worth verifying"
        />
      </div>

      {/* Empty state */}
      {totalFlagged === 0 ? (
        <div className="admin-surface flex flex-col items-center justify-center gap-4 rounded-[28px] px-6 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Check className="h-8 w-8" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">All caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No dental videos need review right now. New flagged videos will appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        <AdminTableShell
          title="Dental review queue"
          description="Videos flagged by the AI categorizer for manual review. Approve to keep the current assignment, or reassign to a different category."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <AdminFilterTabs
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={filterOptions}
              />
              <button
                type="button"
                onClick={() => approveAllMutation.mutate(filteredVideos.map((v) => v.id))}
                disabled={approveAllMutation.isPending || filteredVideos.length === 0}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50"
              >
                Approve all ({filteredVideos.length})
              </button>
            </div>
          }
        >
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border/80 bg-muted/35">
                {['Video', 'Channel', 'Category', 'Confidence', 'Tags', 'Fetched', 'Actions'].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filteredVideos.map((video) => (
                <tr
                  key={video.id}
                  className="border-b border-border/70 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedVideo(video)}
                >
                  {/* Video */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-24 flex-shrink-0">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="aspect-video w-full rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-muted">
                            <Video className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 max-w-[200px]">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {video.title}
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {video.description?.slice(0, 80)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Channel */}
                  <td className="px-5 py-4">
                    <p className="text-sm text-foreground">{video.channel_name}</p>
                  </td>

                  {/* Category */}
                  <td className="px-5 py-4">
                    <CategoryBadge
                      category={video.category}
                      needsReview={true}
                    />
                  </td>

                  {/* Confidence */}
                  <td className="px-5 py-4">
                    <AdminStatusBadge
                      label={formatConfidence(video.confidence_score)}
                      tone={getConfidenceTone(video.confidence_score)}
                    />
                  </td>

                  {/* Tags */}
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                      {video.tags && video.tags.length > 0 ? (
                        video.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground/50">No tags</span>
                      )}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    {timeAgo(video.fetched_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`https://www.youtube.com/watch?v=${video.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                        title="Watch on YouTube"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => approveMutation.mutate(video.id)}
                        disabled={approveMutation.isPending}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50"
                        title="Approve current category"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReassignVideoId(video.id)
                          setReassignCategory(video.category ?? '')
                        }}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
                        title="Reassign to a different category"
                      >
                        Reassign
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}

      {/* Reassign Dialog */}
      <Dialog
        open={!!reassignVideoId}
        onOpenChange={(open) => {
          if (!open) {
            setReassignVideoId(null)
            setReassignCategory('')
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-lg rounded-[28px] border-border/80 bg-card p-0 overflow-hidden"
        >
          <DialogHeader className="border-b border-border/80 bg-muted/35 px-6 py-5">
            <DialogTitle className="text-lg text-foreground">
              Reassign category
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Choose the correct category for this dental video. It will be approved and removed from
              the review queue.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            {reassignVideo && (
              <div className="rounded-[22px] border border-border/80 bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground line-clamp-2">
                  {reassignVideo.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current: {reassignVideo.category ?? 'Uncategorized'} ·{' '}
                  Confidence: {formatConfidence(reassignVideo.confidence_score)}
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="reassign-category"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                New category
              </label>
              <div className="relative">
                <select
                  id="reassign-category"
                  value={reassignCategory}
                  onChange={(e) => setReassignCategory(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-3 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select a category…</option>
                  {dentalCategories.map((cat) => (
                    <option key={cat.id} value={cat.label}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 border-t border-border/80 bg-muted/35 px-6 py-4">
            <button
              type="button"
              onClick={() => {
                setReassignVideoId(null)
                setReassignCategory('')
              }}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (reassignVideoId && reassignCategory) {
                  reassignMutation.mutate({
                    videoId: reassignVideoId,
                    category: reassignCategory,
                  })
                }
              }}
              disabled={!reassignCategory || reassignMutation.isPending}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Reassign & approve
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Full-page Video Detail Modal ──────────────── */}
      <DentalVideoDetailModal
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onApprove={(id) => {
          approveMutation.mutate(id)
          setSelectedVideo(null)
        }}
        onReassign={(id, category) => {
          setReassignVideoId(id)
          setReassignCategory(category)
          setSelectedVideo(null)
        }}
        isApproving={approveMutation.isPending}
      />
    </>
  )
}

/* ────────────────────────────────────────────────────────
   Main Content Review Component
   ──────────────────────────────────────────────────────── */

export function ContentReview() {
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ContentTab>('platform')
  const [filter, setFilter] = useState<VideoStatusFilter>('all')
  const [videoToRemove, setVideoToRemove] = useState<string | null>(null)

  const contentQuery = useQuery({
    queryKey: ['admin-content-review'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('videos')
        .select(
          `
          *,
          profiles:profiles!videos_creator_id_fkey(
            user_id, full_name, avatar_url, specialty
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return (data ?? []) as AdminVideoRow[]
    },
    enabled: isAdminProfile(profile),
  })

  // Dental review count for tab badge
  const dentalReviewCountQuery = useQuery({
    queryKey: ['admin-dental-review-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('dental_videos')
        .select('*', { count: 'exact', head: true })
        .eq('needs_review', true)

      if (error) throw error
      return count ?? 0
    },
    enabled: isAdminProfile(profile),
  })

  const removeMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from('videos')
        .update({ status: 'removed' })
        .eq('id', videoId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Video removed')
      setVideoToRemove(null)
      queryClient.invalidateQueries({ queryKey: ['admin-content-review'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from('videos')
        .update({ status: 'published' })
        .eq('id', videoId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Video restored')
      queryClient.invalidateQueries({ queryKey: ['admin-content-review'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    },
  })

  const filteredVideos = useMemo(() => {
    const videos = contentQuery.data ?? []
    if (filter === 'all') return videos
    return videos.filter((video) => video.status === filter)
  }, [contentQuery.data, filter])

  if (!isAdminProfile(profile)) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  const allVideos = contentQuery.data ?? []
  const publishedCount = allVideos.filter((video) => video.status === 'published').length
  const processingCount = allVideos.filter((video) => video.status === 'processing').length
  const removedCount = allVideos.filter((video) => video.status === 'removed').length
  const dentalReviewCount = dentalReviewCountQuery.data ?? 0

  return (
    <AdminLayout
      title="Content review"
      subtitle="Monitor video status, inspect creator uploads, review dental video categorizations, and take action without changing the existing moderation flow."
      sidebarBadges={{}}
      heroAside={
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
            Review posture
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge label={`${processingCount} processing`} tone="warning" />
            <AdminStatusBadge label={`${removedCount} removed`} tone="danger" />
            <AdminStatusBadge label={`${publishedCount} published`} tone="success" />
            {dentalReviewCount > 0 && (
              <AdminStatusBadge
                label={`${dentalReviewCount} dental review`}
                tone="warning"
                dot={true}
              />
            )}
          </div>
        </div>
      }
    >
      {/* ── Tab Switcher ────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-background/70 p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('platform')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'platform'
              ? 'bg-card text-foreground shadow-[0_10px_30px_rgba(30,51,51,0.08)] ring-1 ring-border/70'
              : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
          }`}
        >
          <Video className="h-4 w-4" />
          <span>Platform videos</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dental')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'dental'
              ? 'bg-card text-foreground shadow-[0_10px_30px_rgba(30,51,51,0.08)] ring-1 ring-border/70'
              : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
          }`}
        >
          <Stethoscope className="h-4 w-4" />
          <span>Dental video review</span>
          {dentalReviewCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              {dentalReviewCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Platform Videos Tab ──────────────────────── */}
      {activeTab === 'platform' && (
        <>
          {contentQuery.isLoading ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-36 rounded-[26px]" />
                ))}
              </div>
              <Skeleton className="h-20 rounded-[24px]" />
              <Skeleton className="h-[520px] rounded-[28px]" />
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminStatCard
                  label="Total videos"
                  value={allVideos.length.toLocaleString()}
                  icon={Video}
                  hint="Latest 100 videos from the review index"
                />
                <AdminStatCard
                  label="Published"
                  value={publishedCount.toLocaleString()}
                  icon={ShieldAlert}
                  accent="success"
                  hint="Currently visible in the library"
                />
                <AdminStatCard
                  label="Processing"
                  value={processingCount.toLocaleString()}
                  icon={TimerReset}
                  accent={processingCount > 0 ? 'warning' : 'default'}
                  hint="Still processing before publication"
                />
                <AdminStatCard
                  label="Removed"
                  value={removedCount.toLocaleString()}
                  icon={ShieldAlert}
                  accent={removedCount > 0 ? 'danger' : 'default'}
                  hint="Removed from the live platform"
                />
              </div>

              <AdminTableShell
                title="Review queue"
                description="Filter the moderation table by status and take action directly from each row."
                action={
                  <AdminFilterTabs
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { value: 'all', label: 'All', count: allVideos.length },
                      { value: 'published', label: 'Published', count: publishedCount },
                      { value: 'processing', label: 'Processing', count: processingCount },
                      { value: 'removed', label: 'Removed', count: removedCount },
                    ]}
                  />
                }
              >
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/35">
                      {['Video', 'Creator', 'Category', 'Views', 'Status', 'Date', 'Actions'].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65"
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVideos.map((video) => (
                      <tr
                        key={video.id}
                        className="border-b border-border/70 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 flex-shrink-0">
                              <VideoThumbnail
                                src={video.thumbnail_url}
                                title={video.title}
                                durationSeconds={video.duration_seconds}
                                status={video.status}
                                className="aspect-video rounded-xl"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {video.title}
                              </p>
                              <p className="mt-1 truncate text-sm text-muted-foreground">
                                {video.tags?.slice(0, 2).join(', ') || 'No tags'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={video.profiles?.full_name}
                              avatarUrl={video.profiles?.avatar_url}
                              size={40}
                            />
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {video.profiles?.full_name ?? 'Unknown creator'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {video.profiles?.specialty ?? 'Dental professional'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <AdminStatusBadge
                            label={video.category ?? 'Uncategorized'}
                            tone={video.category ? 'info' : 'default'}
                          />
                        </td>
                        <td className="px-5 py-4 text-sm text-foreground">
                          {formatViewCount(video.view_count)}
                        </td>
                        <td className="px-5 py-4">
                          <AdminStatusBadge
                            label={video.status}
                            tone={getStatusTone(video.status)}
                            dot={true}
                          />
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {timeAgo(video.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              to="/watch/$videoId"
                              params={{ videoId: video.id }}
                              className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            {video.status === 'published' && (
                              <button
                                type="button"
                                onClick={() => setVideoToRemove(video.id)}
                                className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                              >
                                Remove
                              </button>
                            )}
                            {video.status === 'removed' && (
                              <button
                                type="button"
                                onClick={() => restoreMutation.mutate(video.id)}
                                disabled={restoreMutation.isPending}
                                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            </>
          )}

          <Dialog
            open={!!videoToRemove}
            onOpenChange={(open) => !open && setVideoToRemove(null)}
          >
            <DialogContent
              showCloseButton={false}
              className="max-w-lg rounded-[28px] border-border/80 bg-card p-0 overflow-hidden"
            >
              <DialogHeader className="border-b border-border/80 bg-muted/35 px-6 py-5">
                <DialogTitle className="text-lg text-foreground">
                  Remove this video?
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  This changes the video status to removed while keeping the existing moderation flow intact.
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 py-5">
                <div className="rounded-[22px] border border-destructive/10 bg-destructive/5 p-4 text-sm leading-6 text-muted-foreground">
                  The creator record remains in place, but the video will no longer stay published.
                </div>
              </div>
              <DialogFooter className="gap-3 border-t border-border/80 bg-muted/35 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setVideoToRemove(null)}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    videoToRemove ? removeMutation.mutate(videoToRemove) : undefined
                  }
                  disabled={removeMutation.isPending}
                  className="rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  Remove video
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ── Dental Video Review Tab ──────────────────── */}
      {activeTab === 'dental' && <DentalReviewPanel />}
    </AdminLayout>
  )
}
