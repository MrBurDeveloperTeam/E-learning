import { Link, useParams } from '@tanstack/react-router'
import { useProfileImage } from '@/hooks/useProfileImage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Check, CheckCircle2, FileText, Heart, LockKeyhole, Repeat2, UserPlus } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile, usePublicProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { submitCreatorApplication } from '@/lib/creatorApplications'
import { useCreatorVideos } from '@/hooks/useVideos'
import { formatViewCount, getDisplayName } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import type { CreatorApplication } from '@/types'
import { Button } from '@/components/ui/button'
import { fetchCommunityActivityVisibility, fetchCommunityProfileAccess, fetchCommunityProfilePosts, fetchVisibleCommunityProfileActivity, followCommunityPerson, unfollowCommunityPerson } from '@/features/community/api/communityApi'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils'
import type { CommunityManagedPost } from '@/features/community/types'


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
  const [tab, setTab] = useState<'posts' | 'likes' | 'reposts'>('posts')
  const [isRequestingVerification, setIsRequestingVerification] = useState(false)
  const user = useAuthStore((state) => state.user)
  const currentProfile = useAuthStore((state) => state.profile)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const queryClient = useQueryClient()
  const isOwnProfile = currentProfile?.user_id === userId || user?.id === userId
  const { profileImageUrl } = useProfileImage(Boolean(user))
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
  const communityAccessQuery = useQuery({
    queryKey: ['community-profile-access', user?.id, userId],
    queryFn: () => fetchCommunityProfileAccess(userId),
    enabled: !!user?.id,
  })
  const canViewCommunityDetails = isOwnProfile || communityAccessQuery.data?.can_view_details === true
  const activityVisibilityQuery = useQuery({
    queryKey: ['community-profile-activity-visibility', user?.id, userId],
    queryFn: () => fetchCommunityActivityVisibility(userId),
    enabled: !!user?.id && canViewCommunityDetails,
  })
  const selectedActivityIsVisible = isOwnProfile || tab === 'posts' || activityVisibilityQuery.data?.[tab === 'likes' ? 'likes_visibility' : 'reposts_visibility'] === 'public'
  const profileActivityQuery = useQuery({
    queryKey: ['community-profile-activity', user?.id, userId, tab],
    queryFn: () => tab === 'posts' ? fetchCommunityProfilePosts(user?.id, userId) : fetchVisibleCommunityProfileActivity(userId, tab),
    enabled: canViewCommunityDetails && selectedActivityIsVisible,
  })
  const communityFollowMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sign in to follow this member.')
      if (communityAccessQuery.data?.viewer_is_following) await unfollowCommunityPerson(user.id, userId)
      return await followCommunityPerson(user.id, userId)
    },
    onSuccess: async (status) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community-profile-access', user?.id, userId] }),
        queryClient.invalidateQueries({ queryKey: ['community-people-search', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['community-settings', user?.id, 'following'] }),
        queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
      ])
      if (status === 'request_pending') toast.success('Follow request sent.')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not update follow status.'),
  })
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
                avatarUrl={
                  isOwnProfile && profileImageUrl
                    ? profileImageUrl
                    : profile.avatar_url
                }
                size={60}
                className="w-[60px] h-[60px] md:w-[72px] md:h-[72px] border-4 border-background text-xl"
                textClassName="text-xl"
              />

              {isOwnProfile ? (
                <div className="flex flex-col gap-2 w-full md:w-auto md:items-end">
                  <Link to="/settings">
                    <button className="btn-outline text-sm px-4 py-2 w-full md:w-auto [html.light_&]:text-[#6F9693]">
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
                <Button
                  type="button"
                  variant={communityAccessQuery.data?.viewer_is_following ? 'outline' : 'default'}
                  disabled={communityAccessQuery.isLoading || communityFollowMutation.isPending || communityAccessQuery.data?.viewer_request_pending}
                  onClick={() => communityFollowMutation.mutate()}
                >
                  {communityAccessQuery.data?.viewer_is_following ? <><Check className="size-4" />Following</> : communityAccessQuery.data?.viewer_request_pending ? <><Check className="size-4" />Request sent</> : <><UserPlus className="size-4" />{communityAccessQuery.data?.profile_visibility === 'private' ? 'Request to follow' : 'Follow'}</>}
                </Button>
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
                {canViewCommunityDetails ? profile.specialty ?? 'Dental professional' : 'Private account'}
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
                  {formatViewCount(communityAccessQuery.data?.follower_count ?? profile.follower_count)}
                </p>
                <p className="text-xs text-muted-foreground/60">Followers</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-base font-medium text-foreground">
                  {formatViewCount(communityAccessQuery.data?.following_count ?? profile.following_count)}
                </p>
                <p className="text-xs text-muted-foreground/60">Following</p>
              </div>
            </div>

            {canViewCommunityDetails && profile.bio && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-lg">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mt-3">
              {canViewCommunityDetails && profile.institution && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <BuildingIcon />
                  {profile.institution}
                </span>
              )}

            </div>
          </div>
        </div>

        {communityAccessQuery.isLoading && !isOwnProfile ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : communityAccessQuery.isError && !isOwnProfile ? (
          <div className="card p-8 text-center text-sm text-destructive">Could not determine this profile's privacy settings.</div>
        ) : !canViewCommunityDetails && !isOwnProfile ? (
          <div className="card flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <span className="mb-4 grid size-14 place-items-center rounded-full bg-muted"><LockKeyhole className="size-6 text-muted-foreground" /></span>
            <h2 className="text-lg font-semibold">This account is private</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Send a follow request. You can see this member's Community posts and profile details after they approve it.</p>
          </div>
        ) : (
          <section aria-label="Profile activity">
            <div className="flex border-b border-border" role="tablist" aria-label="Profile activity">
              {([
                {id:'posts',label:'Posts',icon:FileText},
                {id:'likes',label:'Likes',icon:Heart},
                {id:'reposts',label:'Reposts',icon:Repeat2},
              ] as const).map(item=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} onClick={()=>setTab(item.id)} className={cn('flex flex-1 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',tab===item.id?'border-primary text-foreground':'border-transparent text-muted-foreground hover:text-foreground')}><item.icon className="size-4"/>{item.label}</button>)}
            </div>
            {activityVisibilityQuery.isLoading && tab!=='posts' && <div className="flex min-h-52 items-center justify-center"><LoadingSpinner size="lg"/></div>}
            {!activityVisibilityQuery.isLoading && !selectedActivityIsVisible ? <div className="mt-5"><EmptyState icon={tab==='likes'?<Heart/>:<Repeat2/>} title={`${tab==='likes'?'Likes':'Reposts'} are private`} description="This member has chosen not to share this activity." /></div> : <>
              {profileActivityQuery.isLoading && <div className="flex min-h-52 items-center justify-center"><LoadingSpinner size="lg"/></div>}
              {profileActivityQuery.isError && <div className="card mt-5 p-6 text-center text-sm text-destructive">Could not load this member's activity.</div>}
              {!profileActivityQuery.isLoading&&!profileActivityQuery.isError&&(profileActivityQuery.data??[]).length===0&&<div className="mt-5"><EmptyState icon={tab==='likes'?<Heart/>:tab==='reposts'?<Repeat2/>:<FileText/>} title={`No ${tab} yet`} description="This member's Community activity will appear here."/></div>}
              {!profileActivityQuery.isLoading&&!profileActivityQuery.isError&&(profileActivityQuery.data??[]).length>0&&<div className="mt-5 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{(profileActivityQuery.data as CommunityManagedPost[]).map(post=><article key={post.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"><Link to="/community/post/$postId" params={{postId:post.id}} aria-label={`Open ${post.post_type} post`} className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">{post.preview_media?.media_type==='image'?<img src={post.preview_media.public_url} alt={post.preview_media.alt_text||''} loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"/>:post.preview_media?.media_type==='video'?<video src={post.preview_media.public_url} muted playsInline preload="metadata" aria-label={post.preview_media.alt_text||'Video post preview'} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"/>:<span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"><FileText className="size-8"/><span className="text-xs">Text post</span></span>}<span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end bg-gradient-to-t from-black/35 to-transparent p-3 pt-10 text-white">{post.preview_media?.media_type==='video'&&<span className="rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium">Video</span>}</span></Link></article>)}</div>}
            </>}
          </section>
        )}
      </div>
      </div>
    </>
  )
}
