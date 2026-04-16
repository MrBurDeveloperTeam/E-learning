import { Link, useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { FollowButton } from '@/components/creator/FollowButton'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VideoGrid } from '@/components/video/VideoGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { useFollowing } from '@/hooks/useFollow'
import { useFollowingVideos } from '@/hooks/useVideos'
import { formatViewCount, getDisplayName } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

export function Feed() {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { data: videos = [], isLoading, isError, refetch } = useFollowingVideos()
  const { data: following = [] } = useFollowing(profile?.user_id ?? '')

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <PageHeader
          title="Following"
          subtitle="Latest videos from creators you follow"
        />

        {!session && !isAuthLoading && (
          <div className="py-16 text-center">
            <Lock className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 mb-2 text-lg font-medium text-foreground">
              Sign in to see your feed
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Follow dental professionals to see their latest videos here
            </p>
            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm">
              Sign in
            </Link>
          </div>
        )}

        {session && isError && <RetryCard onRetry={() => void refetch()} />}

        {session && following.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-foreground">
                Channels you follow
              </h2>
              <span className="text-xs text-muted-foreground/60">{following.length}</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {following.map((entry) => {
                const creator = entry.profiles
                if (!creator) return null

                return (
                  <div
                    key={entry.following_id}
                    className="flex min-w-[280px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <Link
                      to="/channel/$userId"
                      params={{ userId: entry.following_id }}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <UserAvatar
                        name={getDisplayName(creator, 'Unknown creator')}
                        avatarUrl={creator.avatar_url}
                        size={40}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {getDisplayName(creator, 'Unknown creator')}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {creator.specialty ?? 'Dental professional'}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60">
                          {formatViewCount(creator.follower_count)} followers
                        </p>
                      </div>
                    </Link>

                    <FollowButton userId={entry.following_id} size="sm" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {session && !isError && videos.length === 0 && !isLoading && (
          <EmptyState
            title="Your feed is empty"
            description="Follow dental professionals to see their videos here"
            actionLabel="Discover creators"
            onAction={() => navigate({ to: '/' })}
          />
        )}

        {session && !isError && (
          <VideoGrid videos={videos} columns={4} isLoading={isLoading} />
        )}
      </div>
    </>
  )
}
