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
import { formatViewCount, timeAgo } from '@/lib/utils'
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
      <p className="text-[#DC2626] text-sm">Admin access required</p>
    </div>
  )
}

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-[#9BB5B5] mb-1">{label}</p>
      <p className="text-2xl font-medium text-[#1E3333]">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

const statusStyles: Record<string, string> = {
  published: 'bg-[#D1FAE5] text-[#059669]',
  processing: 'bg-[#FEF3C7] text-[#D97706]',
  removed: 'bg-[#FEE2E2] text-[#DC2626]',
  unlisted: 'bg-[#EDF2F2] text-[#6B8E8E]',
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
                className={
                  filter === value
                    ? 'bg-[#EAF4F3] text-[#2D6E6A] rounded-full px-4 py-1.5 text-sm'
                    : 'text-[#6B8E8E] rounded-full px-4 py-1.5 text-sm hover:bg-[#EDF2F2]'
                }
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
                <tr className="border-b border-[#D4E8E7]">
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
                      className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#9BB5B5]"
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
                    className="border-b border-[#EDF2F2] last:border-0"
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
                          <p className="text-sm font-medium text-[#1E3333] line-clamp-1">
                            {video.title}
                          </p>
                          <p className="text-xs text-[#9BB5B5] mt-1 line-clamp-1">
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
                          <p className="text-sm font-medium text-[#1E3333]">
                            {video.profiles?.full_name ?? 'Unknown creator'}
                          </p>
                          <p className="text-xs text-[#6B8E8E]">
                            {video.profiles?.specialty ?? 'Dental professional'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="badge-specialty">{video.category}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-[#6B8E8E]">
                      {formatViewCount(video.view_count)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[video.status]}`}
                      >
                        {video.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#9BB5B5]">
                      {timeAgo(video.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/watch/$videoId"
                          params={{ videoId: video.id }}
                        >
                          <button className="rounded-lg p-2 text-[#6B8E8E] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]">
                            <Eye className="h-4 w-4" />
                          </button>
                        </Link>
                        {video.status === 'published' && (
                          <button
                            type="button"
                            onClick={() => setVideoToRemove(video.id)}
                            className="px-3 py-1.5 text-xs text-[#DC2626] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors"
                          >
                            Remove
                          </button>
                        )}
                        {video.status === 'removed' && (
                          <button
                            type="button"
                            onClick={() => restoreMutation.mutate(video.id)}
                            className="px-3 py-1.5 text-xs text-[#059669] border border-[#D1FAE5] rounded-lg hover:bg-[#D1FAE5] transition-colors"
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
        <DialogContent showCloseButton={false} className="max-w-md rounded-2xl bg-white p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Remove this video?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this video? The creator will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 bg-white">
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
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C]"
            >
              Remove video
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
