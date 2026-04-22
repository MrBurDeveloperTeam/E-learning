import { Link, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { FollowButton } from '@/components/creator/FollowButton'
import { Navbar } from '@/components/layout/Navbar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VideoGrid } from '@/components/video/VideoGrid'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProfile, usePublicProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { submitCreatorApplication } from '@/lib/creatorApplications'
import { useCreatorVideos } from '@/hooks/useVideos'
import { formatViewCount, getDisplayName } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import type { CreatorApplication } from '@/types'

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
  const [isRequestingVerification, setIsRequestingVerification] = useState(false)
  const user = useAuthStore((state) => state.user)
  const currentProfile = useAuthStore((state) => state.profile)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const queryClient = useQueryClient()
  const isOwnProfile = currentProfile?.user_id === userId || user?.id === userId
  const ownProfileQuery = useProfile(userId, isOwnProfile)
  const publicProfileQuery = usePublicProfile(userId)
  const profile =
    isOwnProfile
      ? ownProfileQuery.data ?? currentProfile
      : publicProfileQuery.data
  const profileName = getDisplayName(profile, 'DentalLearn member')
  const videosQuery = useCreatorVideos(profile?.is_creator ? userId : '')
  const creatorVideos = videosQuery.data ?? []
  const videoCount = creatorVideos.length
  const creatorApplicationQuery = useQuery({
    queryKey: ['creator-application', currentProfile?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_applications')
        .select('*')
        .eq('user_id', currentProfile!.user_id)
        .maybeSingle()

      if (error) throw error
      return (data ?? null) as CreatorApplication | null
    },
    enabled: isOwnProfile && !!currentProfile?.user_id && profile?.is_verified !== true,
  })
  const creatorApplication = creatorApplicationQuery.data
  const creatorApplicationStatus = creatorApplication?.status ?? null
  const isVerificationApproved =
    profile?.is_verified === true || creatorApplicationStatus === 'approved'
  const isLoading =
    (!profile && isOwnProfile && isAuthLoading) ||
    ownProfileQuery.isLoading ||
    publicProfileQuery.isLoading

  async function handleRequestVerification() {
    if (!currentProfile || isRequestingVerification) return

    try {
      setIsRequestingVerification(true)
      const data = await submitCreatorApplication(
        currentProfile.user_id,
        creatorApplication ?? null
      )

      console.log('[verification-request][profile] creator_applications upsert succeeded', data)
      queryClient.setQueryData(
        ['creator-application', currentProfile.user_id],
        data as CreatorApplication
      )
      queryClient.invalidateQueries({
        queryKey: ['creator-application', currentProfile.user_id],
      })
      toast.success('Verification request submitted.')
    } catch (error) {
      console.error('[verification-request][profile] creator_applications upsert failed', error)
      toast.error(error instanceof Error ? error.message : 'Unable to request verification')
    } finally {
      setIsRequestingVerification(false)
    }
  }

  if (isLoading) {
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
          <div className="card p-8 text-center text-sm text-muted-foreground">
            Profile not found.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
        <div className="card overflow-hidden mb-6">
          <div className="h-[100px] md:h-[120px] bg-gradient-to-br from-primary/40 to-primary/80">
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
                name={profileName}
                avatarUrl={profile.avatar_url}
                size={60}
                className="w-[60px] h-[60px] md:w-[72px] md:h-[72px] border-4 border-background text-xl"
                textClassName="text-xl"
              />

              {isOwnProfile ? (
                <div className="flex flex-col gap-2 w-full md:w-auto md:items-end">
                  <Link to="/settings">
                    <button className="btn-outline text-sm px-4 py-2 w-full md:w-auto">
                      Edit profile
                    </button>
                  </Link>
                  {isVerificationApproved ? (
                    <div className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 w-full md:w-auto">
                      <CheckCircle2 className="h-4 w-4" />
                      Verified
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestVerification}
                      disabled={
                        isRequestingVerification ||
                        creatorApplicationQuery.isLoading ||
                        creatorApplicationStatus === 'pending'
                      }
                      className="btn-primary text-sm px-4 py-2 w-full md:w-auto disabled:opacity-60"
                    >
                      {creatorApplicationStatus === 'pending'
                        ? 'Verification pending'
                        : creatorApplicationStatus === 'rejected' || creatorApplicationStatus === 'revoked'
                          ? 'Request verification again'
                          : isRequestingVerification
                            ? 'Requesting...'
                            : 'Request verification'}
                    </button>
                  )}
                </div>
              ) : currentProfile ? (
                <FollowButton userId={userId} />
              ) : null}
            </div>

            <h1 className="text-lg md:text-xl font-medium text-foreground">
              {profileName}
            </h1>

            {profile.username && (
              <p className="text-sm text-muted-foreground/70">@{profile.username}</p>
            )}

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {profile.specialty ?? 'Dental professional'}
              </p>
              {profile.is_verified && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium border border-primary/20">
                  Verified dental professional
                </span>
              )}
            </div>

            {/* Stats — 3-col grid on mobile, inline on desktop */}
            <div className="grid grid-cols-3 gap-2 mt-4 md:flex md:gap-6">
              {profile.is_creator && (
                <div className="text-center md:text-left">
                  <p className="text-base font-medium text-foreground">
                    {videoCount}
                  </p>
                  <p className="text-xs text-muted-foreground/60">Videos</p>
                </div>
              )}
              <div className="text-center md:text-left">
                <p className="text-base font-medium text-foreground">
                  {formatViewCount(profile.follower_count)}
                </p>
                <p className="text-xs text-muted-foreground/60">Followers</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-base font-medium text-foreground">
                  {formatViewCount(profile.following_count)}
                </p>
                <p className="text-xs text-muted-foreground/60">Following</p>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-lg">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mt-3">
              {profile.institution && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
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
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50 mb-2">
                    Professional details
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Specialty: {profile.specialty ?? 'Not specified'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Institution: {profile.institution ?? 'Not specified'}
                  </p>

                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50 mb-2">
                    Bio
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {profile.bio ?? 'No bio provided yet.'}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="card p-5 bg-card border-border">
            <p className="text-sm text-muted-foreground">
              This member is not a verified creator.
            </p>
            {isOwnProfile && !profile.is_verified && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {creatorApplicationStatus === 'pending'
                    ? 'Your verification request is pending admin review.'
                    : creatorApplicationStatus === 'rejected'
                      ? 'Your previous verification request was rejected. You can request verification again.'
                      : creatorApplicationStatus === 'revoked'
                        ? 'Your verification was revoked. You can request verification again.'
                        : 'Request verification to be reviewed by the admin team.'}
                </p>
                <button
                  type="button"
                  onClick={handleRequestVerification}
                  disabled={
                    isRequestingVerification ||
                    creatorApplicationQuery.isLoading ||
                    creatorApplicationStatus === 'pending'
                  }
                  className="btn-primary text-sm px-4 py-2 w-full sm:w-auto disabled:opacity-60"
                >
                  {creatorApplicationStatus === 'pending'
                    ? 'Verification pending'
                    : creatorApplicationStatus === 'rejected' || creatorApplicationStatus === 'revoked'
                      ? 'Request verification again'
                      : isRequestingVerification
                        ? 'Requesting...'
                        : 'Request verification'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </>
  )
}
