import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageLayout } from '@/components/layout/PageLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { cn, formatViewCount, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import type { SidebarItem } from '@/components/layout/Sidebar'
import type { Profile, VideoWithCreator } from '@/types'

function AdminGuard() {
  return (
    <div className="text-center py-16">
      <p className="text-destructive text-sm font-medium">Admin access required</p>
    </div>
  )
}

function StatsCard({
  label,
  value,
  accent = 'default',
}: {
  label: string
  value: number
  accent?: 'default' | 'warning'
}) {
  return (
    <div
      className={cn(
        'card p-4 border-border bg-card shadow-sm',
        accent === 'warning' && 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/30'
      )}
    >
      <p className="text-xs text-muted-foreground/60 mb-1">{label}</p>
      <p className="text-2xl font-medium text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
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
          totalVideosResult,
          totalCreatorsResult,
          pendingVerificationsResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true }),
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
        ])

        for (const result of [
          totalUsersResult,
          totalVideosResult,
          totalCreatorsResult,
          pendingVerificationsResult,
        ]) {
          if (result.error) throw result.error
        }

        return {
          totalUsers: totalUsersResult.count ?? 0,
          totalVideos: totalVideosResult.count ?? 0,
          totalCreators: totalCreatorsResult.count ?? 0,
          pendingVerifications: pendingVerificationsResult.count ?? 0,
        }
      }

      async function fetchAllVideos() {
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
          .limit(10)

        if (error) throw error
        return (data ?? []) as VideoWithCreator[]
      }

      async function fetchRecentUsers() {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) throw error
        return (data ?? []) as Profile[]
      }

      const [stats, recentVideos, recentUsers] = await Promise.all([
        fetchPlatformStats(),
        fetchAllVideos(),
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

  const pendingVerifications =
    dashboardQuery.data?.stats.pendingVerifications ?? 0

  const adminSidebarItems: SidebarItem[] = [
    { label: 'Dashboard', path: '/admin' },
    {
      label: 'Creator applications',
      path: '/admin/applications',
      badge: pendingVerifications,
    },
    { label: 'Content review', path: '/admin/content' },
    {
      label: 'User management',
      path: '/admin/users',
    },
    {
      label: 'Fetch YouTube videos',
      path: '/admin/fetch-videos',
    },
    {
      label: 'Platform settings',
      path: '/admin/settings',
      disabled: true,
    },
  ]

  return (
    <PageLayout
      showSidebar={true}
      sidebarItems={adminSidebarItems}
      sidebarVariant="admin"
    >
      <PageHeader
        title="Admin dashboard"
        subtitle="Platform overview and management"
      />

      {dashboardQuery.isLoading ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
            <StatsCard
              label="Total users"
              value={dashboardQuery.data?.stats.totalUsers ?? 0}
            />
            <StatsCard
              label="Published videos"
              value={dashboardQuery.data?.stats.totalVideos ?? 0}
            />
            <StatsCard
              label="Verified creators"
              value={dashboardQuery.data?.stats.totalCreators ?? 0}
            />
            <StatsCard
              label="Pending verifications"
              value={pendingVerifications}
              accent={pendingVerifications > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card overflow-hidden border-border bg-card">
                <div className="px-5 py-4 border-b border-border bg-muted/30">
                  <p className="text-sm font-medium text-foreground">
                    Recent uploads
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {dashboardQuery.data?.recentVideos.map((video) => (
                    <div key={video.id} className="px-5 py-3 hover:bg-muted/50 transition-colors">
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {video.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {video.profiles.full_name ?? video.profiles.username} ·{' '}
                        {timeAgo(video.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card overflow-hidden border-border bg-card">
                <div className="px-5 py-4 border-b border-border bg-muted/30">
                  <p className="text-sm font-medium text-foreground">
                    New users
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {dashboardQuery.data?.recentUsers.map((user) => (
                    <div key={user.user_id} className="px-5 py-3 hover:bg-muted/50 transition-colors">
                      <p className="text-sm font-medium text-foreground">
                        {user.full_name ?? user.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {user.email} · {timeAgo(user.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-5 h-fit border-border bg-card">
              <p className="text-sm font-medium text-foreground mb-4">
                Quick actions
              </p>
              <div className="space-y-3">
                <Link to="/admin/applications" className="block">
                  <button className="btn-primary w-full text-sm">
                    Review pending creators
                  </button>
                </Link>
                <Link to="/admin/content" className="block">
                  <button className="btn-outline w-full text-sm">
                    Review content
                  </button>
                </Link>
              </div>

              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground/60 mb-2">
                  Platform snapshot
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatViewCount(
                    dashboardQuery.data?.stats.totalVideos ?? 0
                  )}{' '}
                  published videos across{' '}
                  {formatViewCount(
                    dashboardQuery.data?.stats.totalCreators ?? 0
                  )}{' '}
                  verified creators.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  )
}
