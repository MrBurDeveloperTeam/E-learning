import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  PlayCircle,
  Users,
} from 'lucide-react'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  AdminSectionCard,
  AdminStatCard,
  AdminStatusBadge,
} from '@/components/admin/AdminPrimitives'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PageLayout } from '@/components/layout/PageLayout'
import { supabase } from '@/lib/supabase'
import { formatViewCount, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import type { Profile, VideoWithCreator } from '@/types'

function ActionLink({
  to,
  label,
  description,
}: {
  to: '/admin/content' | '/admin/users' | '/admin/fetch-videos'
  label: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-[22px] border border-border/80 bg-background/80 px-4 py-4 transition-all hover:border-primary/20 hover:bg-primary/5"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  )
}

export function AdminDashboard() {
  const profile = useAuthStore((state) => state.profile)
  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      async function fetchPlatformStats() {
        const [
          totalUsersResult,
          publishedVideosResult,
          totalCreatorsResult,
          pendingVerificationsResult,
          processingVideosResult,
          removedVideosResult,
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published'),
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('is_creator', true),
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('is_verified', false)
            .eq('account_type', 'individual')
            .eq('is_creator', false),
          supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'processing'),
          supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'removed'),
        ])

        for (const result of [
          totalUsersResult,
          publishedVideosResult,
          totalCreatorsResult,
          pendingVerificationsResult,
          processingVideosResult,
          removedVideosResult,
        ]) {
          if (result.error) throw result.error
        }

        return {
          totalUsers: totalUsersResult.count ?? 0,
          publishedVideos: publishedVideosResult.count ?? 0,
          totalCreators: totalCreatorsResult.count ?? 0,
          pendingVerifications: pendingVerificationsResult.count ?? 0,
          processingVideos: processingVideosResult.count ?? 0,
          removedVideos: removedVideosResult.count ?? 0,
        }
      }

      async function fetchRecentVideos() {
        const { data, error } = await supabase
          .from('videos')
          .select(
            `
            *,
            profiles:profiles!videos_creator_id_fkey(
              user_id, full_name, username, avatar_url, specialty,
              is_verified, is_creator, bio, follower_count, video_count
            )
          `
          )
          .order('created_at', { ascending: false })
          .limit(8)

        if (error) throw error
        return (data ?? []) as VideoWithCreator[]
      }

      async function fetchRecentUsers() {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(8)

        if (error) throw error
        return (data ?? []) as Profile[]
      }

      const [stats, recentVideos, recentUsers] = await Promise.all([
        fetchPlatformStats(),
        fetchRecentVideos(),
        fetchRecentUsers(),
      ])

      return { stats, recentVideos, recentUsers }
    },
    enabled: isAdminProfile(profile),
  })

  if (!isAdminProfile(profile)) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  const stats = dashboardQuery.data?.stats
  const pendingVerifications = stats?.pendingVerifications ?? 0
  const processingVideos = stats?.processingVideos ?? 0
  const removedVideos = stats?.removedVideos ?? 0

  return (
    <AdminLayout
      title="Platform overview"
      subtitle="Monitor creator verification, content health, and ingestion activity from one clean operations view."
      sidebarBadges={{
        pendingUsers: pendingVerifications,
      }}
      heroAside={
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
            Live snapshot
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-lg font-semibold text-foreground">
                {formatViewCount(stats?.publishedVideos ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Published videos</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {formatViewCount(stats?.totalCreators ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Creators</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {formatViewCount(stats?.totalUsers ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
          </div>
        </div>
      }
    >
      {dashboardQuery.isLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-[26px]" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Skeleton className="h-[320px] rounded-[28px]" />
            <Skeleton className="h-[320px] rounded-[28px]" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-[300px] rounded-[28px]" />
            <Skeleton className="h-[300px] rounded-[28px]" />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label="Total users"
              value={(stats?.totalUsers ?? 0).toLocaleString()}
              icon={Users}
              hint="Registered accounts across the platform"
            />
            <AdminStatCard
              label="Published videos"
              value={(stats?.publishedVideos ?? 0).toLocaleString()}
              icon={PlayCircle}
              hint="Visible and available in the main library"
            />
            <AdminStatCard
              label="Verified creators"
              value={(stats?.totalCreators ?? 0).toLocaleString()}
              icon={CheckCircle2}
              accent="success"
              hint="Profiles currently approved for creator access"
            />
            <AdminStatCard
              label="Pending verifications"
              value={pendingVerifications.toLocaleString()}
              icon={Clock3}
              accent={pendingVerifications > 0 ? 'warning' : 'default'}
              hint={
                pendingVerifications > 0
                  ? 'Applications currently waiting for review'
                  : 'No creator applications waiting right now'
              }
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <AdminSectionCard
              title="Needs attention"
              description="Priority queues that require admin review or follow-up."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Link
                  to="/admin/content"
                  className="rounded-[24px] border border-border/80 bg-background/80 p-4 transition-all hover:border-primary/20 hover:bg-primary/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      Content review
                    </p>
                    <div className="flex items-center gap-2">
                      <AdminStatusBadge
                        label={`${processingVideos} processing`}
                        tone={processingVideos > 0 ? 'warning' : 'default'}
                      />
                      <AdminStatusBadge
                        label={`${removedVideos} removed`}
                        tone={removedVideos > 0 ? 'danger' : 'default'}
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Monitor processing inventory and any videos already removed.
                  </p>
                </Link>

                <Link
                  to="/admin/users"
                  className="rounded-[24px] border border-border/80 bg-background/80 p-4 transition-all hover:border-primary/20 hover:bg-primary/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      User management
                    </p>
                    <AdminStatusBadge
                      label={
                        pendingVerifications > 0
                          ? `${pendingVerifications} pending`
                          : 'Clear'
                      }
                      tone={pendingVerifications > 0 ? 'warning' : 'success'}
                      dot={true}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Review pending applicants and manage creator access from one place.
                  </p>
                </Link>
              </div>
            </AdminSectionCard>

            <AdminSectionCard
              title="Operator actions"
              description="Direct entry points for common admin tasks."
            >
              <div className="space-y-3">
                <ActionLink
                  to="/admin/content"
                  label="Moderate content"
                  description="Check content status, preview videos, and remove or restore."
                />
                <ActionLink
                  to="/admin/users"
                  label="Review user access"
                  description="Open the pending queue and process creator approvals."
                />
                <ActionLink
                  to="/admin/fetch-videos"
                  label="Run ingestion"
                  description="Trigger YouTube fetch or AI categorization workflows."
                />
              </div>
            </AdminSectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <AdminSectionCard
              title="Recent uploads"
              description="Newest videos across the creator network."
            >
              <div className="space-y-3">
                {dashboardQuery.data?.recentVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-start justify-between gap-4 rounded-[22px] border border-border/70 bg-background/75 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {video.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {video.profiles.full_name ?? video.profiles.username}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <AdminStatusBadge label={video.status} tone="info" />
                      <p className="mt-2 text-xs text-muted-foreground/70">
                        {timeAgo(video.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </AdminSectionCard>

            <AdminSectionCard
              title="New users"
              description="Most recent accounts created on the platform."
            >
              <div className="space-y-3">
                {dashboardQuery.data?.recentUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between gap-4 rounded-[22px] border border-border/70 bg-background/75 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        name={user.full_name ?? user.email}
                        avatarUrl={user.avatar_url}
                        size={42}
                        className="bg-primary/10 text-primary"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {user.full_name ?? user.email}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
                        Joined
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {timeAgo(user.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </AdminSectionCard>
          </div>

          <AdminSectionCard
            title="Operations posture"
            description="A lightweight summary of the current platform state."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Activity className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Publishing health</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {formatViewCount(stats?.publishedVideos ?? 0)} published videos
                  are currently available across{' '}
                  {formatViewCount(stats?.totalCreators ?? 0)} creators.
                </p>
              </div>
              <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  <p className="text-sm font-semibold">Verification queue</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {pendingVerifications > 0
                    ? `${pendingVerifications} applications are waiting for review.`
                    : 'No pending creator applications are waiting for action.'}
                </p>
              </div>
              <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <PlayCircle className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Ingestion follow-up</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {processingVideos} videos are still processing and {removedVideos}{' '}
                  have been removed from the live library.
                </p>
              </div>
            </div>
          </AdminSectionCard>
        </>
      )}
    </AdminLayout>
  )
}
