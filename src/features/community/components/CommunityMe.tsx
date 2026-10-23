import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, FileText, Heart, Pencil, PlaySquare, Repeat2, UserMinus, UserRoundCheck, UsersRound, Video } from 'lucide-react'
// Close friends UI is intentionally disabled but preserved below in comments.
// import { Star, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { VideoGrid } from '@/components/video/VideoGrid'
import { CommunityFriendRequests } from '@/features/community/components/CommunityFriendRequests'
import { useCommunitySettings, useFriendRequests, useRemoveCommunitySettingRelation } from '@/features/community/hooks/useCommunity'
// Close friends hooks are intentionally disabled but preserved in useCommunity.ts.
// import { useCloseFriendAction, useCloseFriends } from '@/features/community/hooks/useCommunity'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CommunityManagedPost, CommunityPerson } from '@/features/community/types'
import type { Profile } from '@/types'
import { cn, formatViewCount } from '@/lib/utils'
import { useProfileImage } from '@/hooks/useProfileImage'
import { useCreatorVideos } from '@/hooks/useVideos'
import { ACCOUNT_SPECIALTY_NAMES, fetchAccountProfile } from '@/lib/accountProfile'
import { supabase } from '@/lib/supabase'
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility'

type ProfileSection = 'posts' | 'likes' | 'reposts'

const profileSections = [
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'likes', label: 'Likes', icon: Heart },
  { id: 'reposts', label: 'Reposts', icon: Repeat2 },
] as const

export function CommunityMe({ userId, profile, openFollowRequests = false }: { userId: string; profile: Profile | null; openFollowRequests?: boolean }) {
  const isPageVisible = useDocumentVisibility()
  const queryClient = useQueryClient()
  const [followRequestsOpen, setFollowRequestsOpen] = useState(openFollowRequests)
  const [connectionsView, setConnectionsView] = useState<'following' | null>(null)
  const [section, setSection] = useState<ProfileSection>('posts')
  const [backgroundFailed, setBackgroundFailed] = useState(false)
  const activityQuery = useCommunitySettings(userId, section)
  const ownPostsQuery = useCommunitySettings(userId, 'posts')
  const followingQuery = useCommunitySettings(userId, 'following')
  // const closeFriendsQuery = useCloseFriends(userId)
  const followRequestsQuery = useFriendRequests(userId)
  const unfollowMutation = useRemoveCommunitySettingRelation(userId, 'following')
  // const closeFriendAction = useCloseFriendAction(userId)
  const { profileImageUrl } = useProfileImage(true)
  const accountProfileQuery = useQuery({
    queryKey: ['snabbb-account-profile', userId],
    queryFn: fetchAccountProfile,
    staleTime: 60_000,
  })
  const videosQuery = useCreatorVideos(userId)
  const posts = (activityQuery.data ?? []) as CommunityManagedPost[]
  const accountProfile = accountProfileQuery.data
  const accountFullName = accountProfile ? `${accountProfile.firstName} ${accountProfile.lastName}`.trim() : ''
  const displayName = accountFullName || profile?.full_name || profile?.name || profile?.username || 'Community member'
  const username = profile?.username || profile?.email?.split('@')[0] || 'member'
  const avatarUrl = accountProfile?.imageUrl || profileImageUrl || profile?.avatar_url
  const specialty = accountProfile?.categoryIds[0]
    ? ACCOUNT_SPECIALTY_NAMES[accountProfile.categoryIds[0]]
    : profile?.specialty
  const incomingFollowRequestCount = (followRequestsQuery.data ?? []).filter(request => request.direction === 'incoming').length

  useEffect(() => { setBackgroundFailed(false) }, [profile?.background_url])

  useEffect(() => {
    if (openFollowRequests) setFollowRequestsOpen(true)
  }, [openFollowRequests])

  useEffect(() => {
    if (!isPageVisible) return
    const refreshRequests = () => void queryClient.invalidateQueries({ queryKey: ['community-friend-requests', userId] })
    const channel = supabase
      .channel(`community-profile-follow-requests-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_friendships' }, refreshRequests)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_follows' }, refreshRequests)
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [isPageVisible, queryClient, userId])

  if (connectionsView) {
    const query = followingQuery
    const people = (query.data ?? []) as CommunityPerson[]
    return <div className="mt-7">
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <Button variant="ghost" size="icon" aria-label="Back to profile" onClick={() => setConnectionsView(null)}><ArrowLeft /></Button>
        <div><h3 className="text-2xl font-semibold">Following</h3><p className="mt-1 text-sm text-muted-foreground">People you follow in the Community.</p></div>
      </div>
      {query.isLoading && <div className="flex min-h-52 items-center justify-center"><LoadingSpinner size="lg" /></div>}
      {query.isError && <div className="mt-5"><RetryCard onRetry={() => void query.refetch()} /></div>}
      {!query.isLoading && !query.isError && people.length === 0 && <div className="mt-5"><EmptyState icon={<UserRoundCheck />} title="No following yet" description="People you connect with will appear here." /></div>}
      {!query.isLoading && !query.isError && people.length > 0 && <div className="mt-5 space-y-3">{people.map((person) => {
        const name = person.full_name || person.name || 'Community member'
        return <article key={person.relation_id || person.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <UserAvatar name={name} avatarUrl={person.avatar_url} userId={person.user_id} size={48} />
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{name}</p><p className="text-xs text-muted-foreground">{person.is_mutual ? 'Mutual follow' : 'Following'}</p></div>
          <Button variant="ghost" render={<Link to="/profile/$userId" params={{ userId: person.user_id }} />}>View profile</Button>
          {/*
          {connectionsView === 'following' && person.is_mutual && <Button variant="outline" disabled={closeFriendAction.isPending} onClick={() => void closeFriendAction.mutateAsync({targetUserId:person.user_id,active:!person.is_close_friend}).then(() => toast.success(person.is_close_friend ? 'Removed from Close friends.' : 'Added to Close friends.')).catch(error => toast.error(error instanceof Error ? error.message : 'Could not update Close friends.'))}><Star className="size-4" />{person.is_close_friend ? 'Remove close friend' : 'Add close friend'}</Button>}
          {connectionsView === 'following' ? <Button variant="outline" disabled={unfollowMutation.isPending||closeFriendAction.isPending} onClick={() => void (async()=>{try{if(person.is_close_friend)await closeFriendAction.mutateAsync({targetUserId:person.user_id,active:false});await unfollowMutation.mutateAsync(person.user_id);toast.success('Unfollowed.')}catch(error){toast.error(error instanceof Error ? error.message : 'Could not unfollow this member.')}})()}><UserMinus className="size-4" />Unfollow</Button> : <Button variant="outline" disabled={closeFriendAction.isPending} onClick={() => void closeFriendAction.mutateAsync({targetUserId:person.user_id,active:false}).then(() => toast.success('Removed from Close friends.')).catch(error => toast.error(error instanceof Error ? error.message : 'Could not update Close friends.'))}><UserMinus className="size-4" />Remove</Button>}
          */}
          <Button variant="outline" disabled={unfollowMutation.isPending} onClick={() => void unfollowMutation.mutateAsync(person.user_id).then(() => toast.success('Unfollowed.')).catch(error => toast.error(error instanceof Error ? error.message : 'Could not unfollow this member.'))}><UserMinus className="size-4" />Unfollow</Button>
        </article>
      })}</div>}
    </div>
  }

  return <div className="mt-7 space-y-6">
    <section aria-label="My profile overview" className="community-profile-card overflow-hidden rounded-3xl border border-border bg-card">
      <div className="relative h-28 overflow-hidden bg-gradient-to-r from-primary/20 via-primary/8 to-muted sm:h-36">
        {profile?.background_url && !backgroundFailed && (
          <img
            src={profile.background_url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setBackgroundFailed(true)}
          />
        )}
        <Link
          to="/settings"
          search={{ tab: 'profile', section: undefined }}
          aria-label="Change profile background"
          title="Change profile background"
          className="absolute bottom-3 right-3 flex size-12 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-4 sm:right-5"
        >
          <Pencil className="size-5" aria-hidden="true" />
        </Link>
      </div>
      <div className="px-5 pb-6 sm:px-7">
      <div className="flex flex-col gap-5 pt-5 sm:pt-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0 rounded-full border-4 border-card bg-card shadow-sm"><UserAvatar name={displayName} avatarUrl={avatarUrl} userId={userId} size={88} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h3 className="truncate text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{displayName}</h3>{profile?.is_verified && <VerifiedBadge />}</div>
            <p className="truncate text-sm text-muted-foreground">@{username}</p>
            {specialty && <p className="mt-1 text-sm text-muted-foreground">{specialty}{profile?.institution ? ` · ${profile.institution}` : ''}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant="outline" render={<Link to="/settings" search={{ tab: 'profile', section: undefined }} />}><Pencil className="size-4" /> Edit profile</Button>
          <Button variant="outline" onClick={() => setFollowRequestsOpen(true)}><UserRoundCheck className="size-4" /> Follow requests{incomingFollowRequestCount > 0 && <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">{incomingFollowRequestCount}</span>}</Button>
        </div>
      </div>
      {profile?.bio && <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">{profile.bio}</p>}
      <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 sm:gap-3">
        <button type="button" onClick={() => { setSection('posts'); document.getElementById('profile-activity')?.scrollIntoView() }} className="flex min-h-28 flex-col rounded-2xl border border-border bg-muted/55 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FileText className="mb-3 size-5 text-primary" /><strong className="block text-xl leading-none">{ownPostsQuery.isLoading || ownPostsQuery.isError ? '—' : ownPostsQuery.data?.length ?? 0}</strong><span className="mt-2 text-xs font-medium text-muted-foreground">Community posts</span></button>
        <button type="button" onClick={() => setConnectionsView('following')} className="flex min-h-28 flex-col rounded-2xl border border-border bg-muted/55 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><UserRoundCheck className="mb-3 size-5 text-primary" /><strong className="block text-xl leading-none">{followingQuery.isLoading || followingQuery.isError ? '—' : followingQuery.data?.length ?? 0}</strong><span className="mt-2 text-xs font-medium text-muted-foreground">Community following</span></button>
        <a href="#profile-videos" className="flex min-h-28 flex-col rounded-2xl border border-border bg-muted/55 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><PlaySquare className="mb-3 size-5 text-primary" /><strong className="block text-xl leading-none">{videosQuery.isLoading || videosQuery.isError ? '—' : videosQuery.data?.length ?? 0}</strong><span className="mt-2 text-xs font-medium text-muted-foreground">E-learning videos</span></a>
        <div className="flex min-h-28 flex-col rounded-2xl border border-border bg-muted/55 p-4"><UsersRound className="mb-3 size-5 text-primary" /><strong className="block text-xl leading-none">{formatViewCount(profile?.follower_count ?? 0)}</strong><span className="mt-2 text-xs font-medium text-muted-foreground">E-learning followers</span></div>
        <div className="flex min-h-28 flex-col rounded-2xl border border-border bg-muted/55 p-4"><UserRoundCheck className="mb-3 size-5 text-primary" /><strong className="block text-xl leading-none">{formatViewCount(profile?.following_count ?? 0)}</strong><span className="mt-2 text-xs font-medium text-muted-foreground">E-learning following</span></div>
      </div>
      </div>
    </section>

    <section id="profile-activity" aria-label="Community activity" className="scroll-mt-24 rounded-3xl border border-border bg-card p-4 sm:p-6">
      <div className="flex" role="tablist" aria-label="Profile activity">
        {profileSections.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} onClick={() => setSection(item.id)} className={cn('flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', section === item.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}><item.icon className="size-4" />{item.label}</button>)}
      </div>
      <div className="min-h-48">
      {activityQuery.isLoading && <div className="flex min-h-48 items-center justify-center"><LoadingSpinner size="lg" /></div>}
      {activityQuery.isError && <div className="mt-5"><RetryCard onRetry={() => void activityQuery.refetch()} /></div>}
      {!activityQuery.isLoading && !activityQuery.isError && posts.length === 0 && <div className="mt-5"><EmptyState icon={section === 'likes' ? <Heart /> : section === 'reposts' ? <Repeat2 /> : <FileText />} title={`No ${profileSections.find((item) => item.id === section)?.label.toLowerCase()} yet`} description="Your Community activity will appear here." /></div>}
      {!activityQuery.isLoading && !activityQuery.isError && posts.length > 0 && <div className="mt-5 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {posts.map((post) => <article key={post.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"><Link to="/community/post/$postId" params={{postId:post.id}} aria-label={`Open ${post.post_type} post`} className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">{post.preview_media?.media_type==='image'?<img src={post.preview_media.public_url} alt={post.preview_media.alt_text||''} loading="lazy" decoding="async" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"/>:post.preview_media?.media_type==='video'?<video src={post.preview_media.public_url} muted playsInline preload="metadata" aria-label={post.preview_media.alt_text||'Video post preview'} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"/>:<span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"><FileText className="size-8"/><span className="text-xs">Text post</span></span>}<span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end bg-gradient-to-t from-black/35 to-transparent p-3 pt-10 text-white">{post.preview_media?.media_type==='video'&&<span className="rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium">Video</span>}</span></Link></article>)}
      </div>}
      </div>
    </section>
    <section id="profile-videos" aria-labelledby="profile-videos-heading" className="scroll-mt-24 rounded-3xl border border-border bg-card p-5 sm:p-7">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">E-learning</p><h3 id="profile-videos-heading" className="mt-1 text-xl font-semibold">Videos</h3></div>
        <span className="text-sm text-muted-foreground">{videosQuery.isLoading ? '—' : videosQuery.data?.length ?? 0}</span>
      </div>
      {videosQuery.isError ? <RetryCard onRetry={() => void videosQuery.refetch()} /> : <VideoGrid videos={videosQuery.data ?? []} columns={3} isLoading={videosQuery.isLoading} skeletonCount={3} emptyTitle="No videos yet" emptyDescription="Your learning videos will appear here when you upload them." emptyIcon={<Video />} />}
    </section>
    <Dialog open={followRequestsOpen} onOpenChange={setFollowRequestsOpen}>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Follow requests</DialogTitle><DialogDescription>Approve or reject people who want to follow your private account.</DialogDescription></DialogHeader>
        <CommunityFriendRequests userId={userId} incomingOnly />
      </DialogContent>
    </Dialog>
  </div>
}
