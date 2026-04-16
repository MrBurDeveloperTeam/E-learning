import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageLayout } from '@/components/layout/PageLayout'
import type { SidebarItem } from '@/components/layout/Sidebar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VideoThumbnail } from '@/components/shared/VideoThumbnail'
import { PageHeader } from '@/components/ui/PageHeader'
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
import { cn, formatViewCount, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import type { SidebarItem as SidebarItemType } from '@/components/layout/Sidebar'

type VideoStatusFilter = 'all' | 'published' | 'processing' | 'removed'

type AdminVideoRow = {
  id: string
  title: string
  tags: string[]
  category: string
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

function AdminGuard() {
  return (
    <div className="text-center py-16">
      <p className="text-destructive text-sm font-medium">Admin access required</p>
    </div>
  )
}

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 border-border bg-card">
      <p className="text-xs text-muted-foreground/60 mb-1">{label}</p>
      <p className="text-2xl font-medium text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

const statusStyles: Record<string, string> = {
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  removed: 'bg-destructive/10 text-destructive',
  unlisted: 'bg-muted text-muted-foreground',
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
  const adminSidebarItems: SidebarItemType[] = [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Content review', path: '/admin/content' },
    { label: 'User management', path: '/admin/users' },
    { label: 'Platform settings', path: '/admin/settings', disabled: true },
  ]

  return (
    <PageLayout
      showSidebar={true}
      sidebarItems={adminSidebarItems}
      sidebarVariant="admin"
    >
      <PageHeader title="Content review" />

      {contentQuery.isLoading ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 rounded-xl mb-5" />
          <Skeleton className="h-[500px] rounded-xl" />
        </>
      ) : (
        <>
          <div className="flex gap-1 mb-5">
            {([
              ['all', 'All'],
              ['published', 'Published'],
              ['processing', 'Processing'],
              ['removed', 'Removed'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm transition-colors',
                  filter === value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
            <StatsCard label="Total videos" value={allVideos.length} />
            <StatsCard
              label="Published"
              value={allVideos.filter((video) => video.status === 'published').length}
            />
            <StatsCard
              label="Processing"
              value={allVideos.filter((video) => video.status === 'processing').length}
            />
            <StatsCard
              label="Removed"
              value={allVideos.filter((video) => video.status === 'removed').length}
            />
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    'Video',
                    'Creator',
                    'Category',
                    'Views',
                    'Status',
                    'Date',
                    'Actions',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/60"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVideos.map((video) => (
                  <tr
                    key={video.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-20 flex-shrink-0">
                          <VideoThumbnail
                            src={video.thumbnail_url}
                            title={video.title}
                            durationSeconds={video.duration_seconds}
                            status={video.status}
                            className="aspect-video rounded-lg"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-1">
                            {video.title}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-1">
                            {(video.tags ?? []).join(', ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={video.profiles?.full_name}
                          avatarUrl={video.profiles?.avatar_url}
                          size={36}
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {video.profiles?.full_name ?? 'Unknown creator'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {video.profiles?.specialty ?? 'Dental professional'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="badge-specialty">{video.category}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {formatViewCount(video.view_count)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[video.status]}`}
                      >
                        {video.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground/60">
                      {timeAgo(video.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/watch/$videoId"
                          params={{ videoId: video.id }}
                        >
                          <button className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                            <Eye className="h-4 w-4" />
                          </button>
                        </Link>
                        {video.status === 'published' && (
                          <button
                            type="button"
                            onClick={() => setVideoToRemove(video.id)}
                            className="px-3 py-1.5 text-xs text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                        {video.status === 'removed' && (
                          <button
                            type="button"
                            onClick={() => restoreMutation.mutate(video.id)}
                            className="px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition-colors"
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
          </div>
        </>
      )}

      <Dialog
        open={!!videoToRemove}
        onOpenChange={(open) => !open && setVideoToRemove(null)}
      >
        <DialogContent showCloseButton={false} className="max-w-md rounded-2xl bg-card border-border p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Remove this video?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this video? The creator will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 bg-muted/30 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={() => setVideoToRemove(null)}
              className="btn-outline text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                videoToRemove
                  ? removeMutation.mutate(videoToRemove)
                  : undefined
              }
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 shadow-sm"
            >
              Remove video
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
