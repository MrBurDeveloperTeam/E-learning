import { useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { FollowButton } from '@/components/creator/FollowButton'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useProfile } from '@/hooks/useProfile'
import { useCreatorVideos } from '@/hooks/useVideos'
import { cn, formatViewCount } from '@/lib/utils'

export function Channel() {
  const { userId } = useParams({ from: '/channel/$userId' })
  const [tab, setTab] = useState<'videos' | 'about'>('videos')
  const profileQuery = useProfile(userId)
  const videosQuery = useCreatorVideos(userId)
  const profile = profileQuery.data
  const videos = videosQuery.data ?? []
  const totalViews = videos.reduce((sum, video) => sum + video.view_count, 0)
  const isLoading = profileQuery.isLoading || videosQuery.isLoading
  const isError = profileQuery.isError || videosQuery.isError

  // Dynamic document title
  useEffect(() => {
    if (profile?.full_name) {
      document.title = `${profile.full_name} — DentalLearn`
    }
    return () => {
      document.title = 'DentalLearn — Dental Video Community'
    }
  }, [profile?.full_name])

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-[1400px]">
        {isError && (
          <div className="px-4 md:px-6 py-8">
            <RetryCard
              onRetry={() => {
                void profileQuery.refetch()
                void videosQuery.refetch()
              }}
            />
          </div>
        )}

        {isLoading && (
          <div className="px-4 md:px-6 py-8">
            <div className="h-[140px] md:h-[200px] animate-pulse rounded-xl bg-[#D6E0E0]" />
          </div>
        )}

        {profile && !isError && !isLoading && (
          <>
            <div className="relative">
              <div className="relative h-[140px] md:h-[200px] overflow-hidden bg-gradient-to-br from-[#AEDAD8] to-[#2D6E6A]">
                {profile.background_url && (
                  <img
                    src={profile.background_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="absolute bottom-0 left-4 md:left-6 translate-y-1/2">
                <UserAvatar
                  name={profile.full_name ?? profile.username}
                  avatarUrl={profile.avatar_url}
                  size={64}
                  className="w-16 h-16 md:w-20 md:h-20 border-4 border-white text-2xl"
                  textClassName="text-2xl"
                />
              </div>

              <div className="absolute bottom-4 right-4 md:right-6">
                <FollowButton userId={userId} size="md" />
              </div>
            </div>

            <div className="px-4 md:px-6 pb-4 pt-12 md:pt-14">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl md:text-2xl font-medium text-[#1E3333]">
                  {profile.full_name ?? 'Unknown creator'}
                </h1>
                {profile.is_verified && <VerifiedBadge />}
              </div>
              <p className="mt-1 text-sm text-[#6B8E8E]">
                {profile.specialty ?? 'Dental professional'}
                {profile.institution ? ` · ${profile.institution}` : ''}
              </p>
              <div className="flex flex-wrap gap-4 mt-3">
                <span className="text-sm text-[#6B8E8E]">
                  {profile.video_count} videos
                </span>
                <span className="text-sm text-[#6B8E8E]">
                  {formatViewCount(profile.follower_count)} followers
                </span>
                <span className="text-sm text-[#6B8E8E]">
                  {formatViewCount(profile.following_count)} following
                </span>
              </div>
              {profile.bio && (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#3D5C5C]">
                  {profile.bio}
                </p>
              )}
            </div>

            <div className="border-b border-[#D4E8E7] px-4 md:px-6">
              <div className="flex overflow-x-auto scrollbar-hide gap-0">
                {(['videos', 'about'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    className={cn(
                      'border-b-2 px-4 py-3 text-sm capitalize transition-colors flex-shrink-0',
                      tab === value
                        ? 'border-[#88C1BD] text-[#2D6E6A]'
                        : 'border-transparent text-[#6B8E8E]'
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'videos' && (
              <div className="px-4 md:px-6 py-6 pb-20 md:pb-6">
                <VideoGrid
                  videos={videos}
                  columns={4}
                  isLoading={videosQuery.isLoading}
                  emptyTitle="No videos yet"
                  emptyDescription="This creator hasn't uploaded any videos yet"
                />
              </div>
            )}

            {tab === 'about' && (
              <div className="grid gap-6 px-4 md:px-6 py-6 pb-20 md:pb-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="max-w-2xl">
                  <h2 className="mb-3 text-base font-medium text-[#1E3333]">About</h2>
                  <p className="text-sm leading-relaxed text-[#3D5C5C]">
                    {profile.bio || 'No bio provided yet.'}
                  </p>
                  <div className="mt-6 space-y-2 text-sm text-[#6B8E8E]">
                    <p>Specialty: {profile.specialty ?? 'Not specified'}</p>
                    <p>Institution: {profile.institution ?? 'Not specified'}</p>

                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <MetricCard label="Videos" value={profile.video_count} />
                  <MetricCard label="Followers" value={formatViewCount(profile.follower_count)} />
                  <MetricCard label="Total views" value={formatViewCount(totalViews)} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
