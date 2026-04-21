import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, ShieldAlert, TimerReset, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  AdminFilterTabs,
  AdminStatCard,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives'
import { PageLayout } from '@/components/layout/PageLayout'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VideoThumbnail } from '@/components/shared/VideoThumbnail'
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

function getStatusTone(status: AdminVideoRow['status']) {
  if (status === 'published') return 'success' as const
  if (status === 'processing') return 'warning' as const
  if (status === 'removed') return 'danger' as const
  return 'default' as const
}

export function ContentReview() {
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
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

  return (
    <AdminLayout
      title="Content review"
      subtitle="Monitor video status, inspect creator uploads, and remove or restore content without changing the existing moderation flow."
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
          </div>
        </div>
      }
    >
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
    </AdminLayout>
  )
}
