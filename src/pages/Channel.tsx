import { useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { FollowButton } from '@/components/creator/FollowButton'
import { Navbar } from '@/components/layout/Navbar'
import { RetryCard } from '@/components/shared/RetryCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useProfile } from '@/hooks/useProfile'
import { useCreatorVideos } from '@/hooks/useVideos'
import { formatViewCount } from '@/lib/utils'

export function Channel() {
  const { userId } = useParams({ from: '/channel/$userId' })
  const profileQuery = useProfile(userId)
  const videosQuery = useCreatorVideos(userId)
  const profile = profileQuery.data
  const videos = videosQuery.data ?? []
  const videoCount = videos.length
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
                  {videoCount} videos
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

            <div className="px-4 md:px-6 py-6 pb-20 md:pb-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium text-[#1E3333]">Videos</h2>
                <span className="text-sm text-[#6B8E8E]">{videoCount}</span>
              </div>
              <VideoGrid
                videos={videos}
                columns={4}
                isLoading={videosQuery.isLoading}
                emptyTitle="No videos yet"
                emptyDescription="This creator hasn't uploaded any videos yet"
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
