import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { FollowButton } from '@/components/creator/FollowButton'
import { Navbar } from '@/components/layout/Navbar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VideoGrid } from '@/components/video/VideoGrid'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProfile } from '@/hooks/useProfile'
import { useCreatorVideos } from '@/hooks/useVideos'
import { formatViewCount } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

function BuildingIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"
      />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18" />
    </svg>
  )
}

export function Profile() {
  const { userId } = useParams({ from: '/profile/$userId' })
  const [tab, setTab] = useState<'videos' | 'about'>('videos')
  const currentProfile = useAuthStore((state) => state.profile)
  const profileQuery = useProfile(userId)
  const profile = profileQuery.data
  const videosQuery = useCreatorVideos(profile?.is_creator ? userId : '')
  const creatorVideos = videosQuery.data ?? []
  const videoCount = creatorVideos.length
  const isOwnProfile = currentProfile?.user_id === userId

  if (profileQuery.isLoading) {
    return (
      <>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
          <Skeleton className="h-[200px] md:h-[280px] rounded-xl" />
          <Skeleton className="mt-6 h-12 w-48 rounded-xl" />
          <Skeleton className="mt-3 h-20 w-full rounded-xl" />
        </div>
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-12">
          <div className="card p-8 text-center text-sm text-[#6B8E8E]">
            Profile not found.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
        <div className="card overflow-hidden mb-6">
          <div className="h-[100px] md:h-[120px] bg-gradient-to-br from-[#AEDAD8] to-[#2D6E6A]">
            {profile.background_url ? (
              <img
                src={profile.background_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div className="px-4 md:px-6 pb-5">
            <div className="flex items-end justify-between -mt-8 mb-4 gap-4">
              <UserAvatar
                name={profile.full_name ?? profile.username}
                avatarUrl={profile.avatar_url}
                size={60}
                className="w-[60px] h-[60px] md:w-[72px] md:h-[72px] border-4 border-white text-xl"
                textClassName="text-xl"
              />

              {isOwnProfile ? (
                <Link to="/settings">
                  <button className="btn-outline text-sm px-4 py-2 w-full md:w-auto">
                    Edit profile
                  </button>
                </Link>
              ) : currentProfile ? (
                <FollowButton userId={userId} />
              ) : null}
            </div>

            <h1 className="text-lg md:text-xl font-medium text-[#1E3333]">
              {profile.full_name ?? 'DentalLearn member'}
            </h1>

            {profile.username && (
              <p className="text-sm text-[#9BB5B5]">@{profile.username}</p>
            )}

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-sm text-[#6B8E8E]">
                {profile.specialty ?? 'Dental professional'}
              </p>
              {profile.is_verified && (
                <span className="text-[10px] bg-[#D4E8E7] text-[#2D6E6A] px-2 py-0.5 rounded-full font-medium">
                  Verified dental professional
                </span>
              )}
            </div>

            {/* Stats — 3-col grid on mobile, inline on desktop */}
            <div className="grid grid-cols-3 gap-2 mt-4 md:flex md:gap-6">
              {profile.is_creator && (
                <div className="text-center md:text-left">
                  <p className="text-base font-medium text-[#1E3333]">
                    {videoCount}
                  </p>
                  <p className="text-xs text-[#9BB5B5]">Videos</p>
                </div>
              )}
              <div className="text-center md:text-left">
                <p className="text-base font-medium text-[#1E3333]">
                  {formatViewCount(profile.follower_count)}
                </p>
                <p className="text-xs text-[#9BB5B5]">Followers</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-base font-medium text-[#1E3333]">
                  {formatViewCount(profile.following_count)}
                </p>
                <p className="text-xs text-[#9BB5B5]">Following</p>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-[#6B8E8E] mt-3 leading-relaxed max-w-lg">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mt-3">
              {profile.institution && (
                <span className="text-xs text-[#6B8E8E] flex items-center gap-1">
                  <BuildingIcon />
                  {profile.institution}
                </span>
              )}

            </div>
          </div>
        </div>

        {profile.is_creator ? (
          <Tabs value={tab} onValueChange={(value) => setTab(value as 'videos' | 'about')}>
            <TabsList>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            <TabsContent value="videos" className="mt-6">
              <VideoGrid
                videos={creatorVideos}
                columns={3}
                isLoading={videosQuery.isLoading}
                emptyTitle="No videos yet"
                emptyDescription="This creator hasn't uploaded any videos"
              />
            </TabsContent>

            <TabsContent value="about" className="mt-6">
              <div className="card p-6 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#9BB5B5] mb-2">
                    Professional details
                  </p>
                  <p className="text-sm text-[#6B8E8E]">
                    Specialty: {profile.specialty ?? 'Not specified'}
                  </p>
                  <p className="text-sm text-[#6B8E8E] mt-1">
                    Institution: {profile.institution ?? 'Not specified'}
                  </p>

                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#9BB5B5] mb-2">
                    Bio
                  </p>
                  <p className="text-sm text-[#6B8E8E] leading-relaxed">
                    {profile.bio ?? 'No bio provided yet.'}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="card p-5 text-sm text-[#6B8E8E]">
            This member is not a verified creator.
          </div>
        )}
      </div>
    </>
  )
}
