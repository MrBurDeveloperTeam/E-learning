import { Link, useNavigate } from '@tanstack/react-router'
import { Edit3, Eye, Lock, Trash2, Upload } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { VideoThumbnail } from '@/components/shared/VideoThumbnail'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { useDeleteVideo, useMyVideos } from '@/hooks/useVideos'
import { formatViewCount, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const statusStyles = {
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-500',
  unlisted: 'bg-muted text-muted-foreground',
  removed: 'bg-destructive/10 text-destructive',
} as const

export function Studio() {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { data: myVideos = [], isLoading, isError, refetch } = useMyVideos()
  const deleteMutation = useDeleteVideo()
  const totalViews = myVideos.reduce((sum, video) => sum + video.view_count, 0)
  const totalLikes = myVideos.reduce((sum, video) => sum + video.like_count, 0)
  const totalComments = myVideos.reduce(
    (sum, video) => sum + video.comment_count,
    0
  )
  const isCreator = !!profile?.is_creator && !!profile?.is_verified
  const monthBuckets = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index))
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const label = date.toLocaleString('en-MY', { month: 'short' })
    const views = myVideos
      .filter((video) => {
        const createdAt = new Date(video.created_at)
        return (
          createdAt.getFullYear() === date.getFullYear() &&
          createdAt.getMonth() === date.getMonth()
        )
      })
      .reduce((sum, video) => sum + video.view_count, 0)

    return { key, label, views }
  })
  const maxBucketViews = Math.max(
    ...monthBuckets.map((bucket) => bucket.views),
    0
  )
  // Show last 4 months on mobile, all 6 on desktop
  const mobileBuckets = monthBuckets.slice(-4)
  const topVideos = [...myVideos]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5)

  async function handleDelete(videoId: string) {
    if (!window.confirm('Delete this video?')) return
    await deleteMutation.mutateAsync(videoId)
  }

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6 md:py-8 pb-20 md:pb-8">
        {!session && !isAuthLoading && (
          <div className="py-16 text-center">
            <Lock className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 mb-2 text-lg font-medium text-foreground">
              Sign in to access creator studio
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Creator studio is available to verified creators
            </p>
            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm">
              Sign in
            </Link>
          </div>
        )}

        {session && !isCreator && !isAuthLoading && (
          <div className="card p-8 text-center bg-card border border-border">
            <h2 className="text-lg font-medium text-foreground">
              Creator studio is not available
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Only verified creators can manage videos and analytics here.
            </p>
          </div>
        )}

        {session && isCreator && (
          <>
            <PageHeader
              title="Creator studio"
              subtitle="Manage your videos and track performance"
              actions={
                <Link to="/upload">
                  <button className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                    <Upload className="h-4 w-4" />
                    Upload video
                  </button>
                </Link>
              }
            />

            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Total videos" value={myVideos.length} />
              <MetricCard label="Total views" value={formatViewCount(totalViews)} />
              <MetricCard label="Total likes" value={formatViewCount(totalLikes)} />
              <MetricCard label="Followers" value={formatViewCount(profile?.follower_count ?? 0)} />
            </div>

            {isError && <RetryCard onRetry={() => void refetch()} />}

            {!isError && (
              <>
                <div className="mb-8">
                  <p className="text-sm font-medium text-foreground mb-4">
                    Performance overview
                  </p>

                  <div className="card border-border bg-card p-5">
                    <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-4">
                      Views by month
                    </p>
                    {/* Desktop chart — all 6 months */}
                    <div className="hidden md:flex items-end gap-1.5 h-24">
                      {monthBuckets.map((bucket) => {
                        const percentage =
                          maxBucketViews > 0
                            ? Math.round((bucket.views / maxBucketViews) * 100)
                            : 0

                        return (
                          <div
                            key={bucket.key}
                            className="flex-1 flex flex-col items-center gap-1"
                          >
                            <div
                              className="w-full bg-primary/80 rounded-t-sm transition-all duration-500"
                              style={{
                                height: `${percentage}%`,
                                minHeight: bucket.views > 0 ? '4px' : '0',
                              }}
                            />
                            <p className="text-[10px] text-muted-foreground/60">
                              {bucket.label}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                    {/* Mobile chart — last 4 months */}
                    <div className="flex md:hidden items-end gap-1.5 h-16">
                      {mobileBuckets.map((bucket) => {
                        const percentage =
                          maxBucketViews > 0
                            ? Math.round((bucket.views / maxBucketViews) * 100)
                            : 0

                        return (
                          <div
                            key={bucket.key}
                            className="flex-1 flex flex-col items-center gap-1"
                          >
                            <div
                              className="w-full bg-primary/80 rounded-t-sm transition-all duration-500"
                              style={{
                                height: `${percentage}%`,
                                minHeight: bucket.views > 0 ? '4px' : '0',
                              }}
                            />
                            <p className="text-[10px] text-muted-foreground/60">
                              {bucket.label}
                            </p>
                          </div>
                        )
                      })}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground/60">
                          Avg. views per video
                        </p>
                        <p className="text-base font-medium text-foreground">
                          {Math.round(
                            totalViews / Math.max(myVideos.length, 1)
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/60">Like rate</p>
                        <p className="text-base font-medium text-foreground">
                          {totalViews > 0
                            ? `${((totalLikes / totalViews) * 100).toFixed(1)}%`
                            : '0%'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/60">Comment rate</p>
                        <p className="text-base font-medium text-foreground">
                          {totalViews > 0
                            ? `${((totalComments / totalViews) * 100).toFixed(1)}%`
                            : '0%'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-border bg-card overflow-hidden mb-6">
                  <div className="px-5 py-4 border-b border-border">
                    <p className="text-sm font-medium text-foreground">
                      Top videos by views
                    </p>
                  </div>
                  <div className="divide-y divide-border/40">
                    {topVideos.length === 0 ? (
                      <div className="px-5 py-6 text-sm text-muted-foreground/60">
                        Upload videos to see your top performers here.
                      </div>
                    ) : (
                      topVideos.map((video, index) => (
                        <div
                          key={video.id}
                          className="flex items-center gap-4 px-5 py-3"
                        >
                          <span className="text-sm font-medium text-muted-foreground/60 w-5">
                            {index + 1}
                          </span>
                          <div className="w-16 flex-shrink-0">
                            <VideoThumbnail
                              src={video.thumbnail_url}
                              title={video.title}
                              durationSeconds={video.duration_seconds}
                              status={video.status}
                              className="aspect-video rounded-md"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {video.title}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-medium text-foreground">
                              {formatViewCount(video.view_count)} views
                            </p>
                            <p className="text-xs text-muted-foreground/60">
                              {formatViewCount(video.like_count)} likes
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <p className="text-sm font-medium text-foreground">My videos</p>
                    <span className="text-xs text-muted-foreground">All statuses</span>
                  </div>

                  {/* Mobile card list */}
                  <div className="md:hidden divide-y divide-border/40">
                    {isLoading && (
                      <div className="p-4 text-center text-sm text-muted-foreground/60">
                        Loading videos...
                      </div>
                    )}
                    {!isLoading && myVideos.length === 0 && (
                      <EmptyState
                        title="No videos yet"
                        description="Upload your first video to get started"
                        actionLabel="Upload video"
                        onAction={() => navigate({ to: '/upload' })}
                      />
                    )}
                    {!isLoading &&
                      myVideos.map((video) => (
                        <div key={video.id} className="p-4 flex gap-3">
                          <div className="w-20 flex-shrink-0">
                            <VideoThumbnail
                              src={video.thumbnail_url}
                              title={video.title}
                              durationSeconds={video.duration_seconds}
                              status={video.status}
                              className="aspect-video rounded-lg"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="line-clamp-2 text-sm font-medium text-foreground">
                              {video.title}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {formatViewCount(video.view_count)} views · {formatViewCount(video.like_count)} likes · {timeAgo(video.created_at)}
                            </p>
                            <div className="flex items-center gap-1 mt-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[video.status]}`}>
                                {video.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate({
                                    to: '/watch/$videoId',
                                    params: { videoId: video.id },
                                  })
                                }
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate({
                                    to: '/upload',
                                    search: { videoId: video.id },
                                  })
                                }
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(video.id)}
                                className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {['Video', 'Views', 'Likes', 'Comments', 'Status', 'Date', 'Actions'].map((heading) => (
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
                        {isLoading && (
                          <tr>
                            <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground/60">
                              Loading videos...
                            </td>
                          </tr>
                        )}

                        {!isLoading && myVideos.length === 0 && (
                          <tr>
                            <td colSpan={7}>
                              <EmptyState
                                title="No videos yet"
                                description="Upload your first video to get started"
                                actionLabel="Upload video"
                                onAction={() => navigate({ to: '/upload' })}
                              />
                            </td>
                          </tr>
                        )}

                        {!isLoading &&
                          myVideos.map((video) => (
                            <tr
                              key={video.id}
                              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/5"
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
                                  <div>
                                    <p className="line-clamp-1 text-sm font-medium text-foreground">
                                      {video.title}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-sm text-muted-foreground">
                                {formatViewCount(video.view_count)}
                              </td>
                              <td className="px-5 py-3 text-sm text-muted-foreground">
                                {formatViewCount(video.like_count)}
                              </td>
                              <td className="px-5 py-3 text-sm text-muted-foreground">
                                {formatViewCount(video.comment_count)}
                              </td>
                              <td className="px-5 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[video.status]}`}>
                                  {video.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-xs text-muted-foreground/60">
                                {timeAgo(video.created_at)}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate({
                                        to: '/watch/$videoId',
                                        params: { videoId: video.id },
                                      })
                                    }
                                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate({
                                        to: '/upload',
                                        search: { videoId: video.id },
                                      })
                                    }
                                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(video.id)}
                                    className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
