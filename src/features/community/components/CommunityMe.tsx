import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, FileText, Heart, Pencil, Repeat2, Settings2, UserMinus, UserRoundCheck, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { CommunitySettings } from '@/features/community/components/CommunitySettings'
import { useCommunitySettings, useRemoveCommunitySettingRelation } from '@/features/community/hooks/useCommunity'
import type { CommunityManagedPost, CommunityPerson } from '@/features/community/types'
import type { Profile } from '@/types'
import { cn } from '@/lib/utils'
import { useProfileImage } from '@/hooks/useProfileImage'

type ProfileSection = 'posts' | 'likes' | 'reposts'

const profileSections = [
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'likes', label: 'Likes', icon: Heart },
  { id: 'reposts', label: 'Reposts', icon: Repeat2 },
] as const

export function CommunityMe({ userId, profile }: { userId: string; profile: Profile | null }) {
  const [showSettings, setShowSettings] = useState(false)
  const [connectionsView, setConnectionsView] = useState<'following' | 'friends' | null>(null)
  const [section, setSection] = useState<ProfileSection>('posts')
  const activityQuery = useCommunitySettings(userId, section)
  const ownPostsQuery = useCommunitySettings(userId, 'posts')
  const followingQuery = useCommunitySettings(userId, 'following')
  const friendsQuery = useCommunitySettings(userId, 'friends')
  const unfollowMutation = useRemoveCommunitySettingRelation(userId, 'following')
  const removeFriendMutation = useRemoveCommunitySettingRelation(userId, 'friends')
  const { profileImageUrl } = useProfileImage(true)
  const posts = (activityQuery.data ?? []) as CommunityManagedPost[]
  const displayName = profile?.full_name || profile?.name || profile?.username || 'Community member'
  const username = profile?.username || profile?.email?.split('@')[0] || 'member'
  const avatarUrl = profile?.avatar_url || profileImageUrl

  if (connectionsView) {
    const query = connectionsView === 'following' ? followingQuery : friendsQuery
    const people = (query.data ?? []) as CommunityPerson[]
    const mutation = connectionsView === 'following' ? unfollowMutation : removeFriendMutation
    return <div className="mt-7">
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <Button variant="ghost" size="icon" aria-label="Back to profile" onClick={() => setConnectionsView(null)}><ArrowLeft /></Button>
        <div><h3 className="text-2xl font-semibold">{connectionsView === 'following' ? 'Following' : 'Friends'}</h3><p className="mt-1 text-sm text-muted-foreground">Manage the people connected to your Community profile.</p></div>
      </div>
      {query.isLoading && <div className="flex min-h-52 items-center justify-center"><LoadingSpinner size="lg" /></div>}
      {query.isError && <div className="mt-5"><RetryCard onRetry={() => void query.refetch()} /></div>}
      {!query.isLoading && !query.isError && people.length === 0 && <div className="mt-5"><EmptyState icon={connectionsView === 'following' ? <UserRoundCheck /> : <UsersRound />} title={`No ${connectionsView} yet`} description="People you connect with will appear here." /></div>}
      {!query.isLoading && !query.isError && people.length > 0 && <div className="mt-5 space-y-3">{people.map((person) => {
        const name = person.full_name || person.name || 'Community member'
        return <article key={person.relation_id || person.user_id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <UserAvatar name={name} avatarUrl={person.avatar_url} size={48} />
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{name}</p><p className="text-xs text-muted-foreground">{connectionsView === 'following' ? 'Following' : 'Mutual connection'}</p></div>
          <Button variant="ghost" render={<Link to="/profile/$userId" params={{ userId: person.user_id }} />}>View profile</Button>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => void mutation.mutateAsync(person.relation_id || person.user_id).then(() => toast.success(connectionsView === 'following' ? 'Unfollowed.' : 'Friend removed.')).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not update this connection.'))}><UserMinus className="size-4" />{connectionsView === 'following' ? 'Unfollow' : 'Remove'}</Button>
        </article>
      })}</div>}
    </div>
  }

  if (showSettings) {
    return <div>
      <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <div><p className="font-semibold">Community settings</p><p className="mt-1 text-sm text-muted-foreground">Manage your saved activity, safety, privacy, and account preferences.</p></div>
        <Button variant="outline" onClick={() => setShowSettings(false)}>Back to profile</Button>
      </div>
      <CommunitySettings userId={userId} />
    </div>
  }

  return <div className="mt-7">
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/8 to-muted sm:h-36" />
      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-4">
            <div className="rounded-full border-4 border-card bg-card shadow-sm"><UserAvatar name={displayName} avatarUrl={avatarUrl} size={104} /></div>
            <div className="min-w-0 pb-1"><h3 className="truncate text-2xl font-semibold tracking-[-0.03em]">{displayName}</h3><p className="truncate text-sm text-muted-foreground">@{username}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link to="/settings" />}><Pencil className="size-4" /> Edit profile</Button>
            <Button variant="outline" onClick={() => setShowSettings(true)}><Settings2 className="size-4" /> Settings</Button>
          </div>
        </div>
        {profile?.bio && <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">{profile.bio}</p>}
        <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-lg sm:gap-4">
          <button type="button" onClick={() => setSection('posts')} className="rounded-2xl bg-muted/55 px-3 py-4 text-left transition-colors hover:bg-muted"><FileText className="mb-2 size-4 text-primary" /><strong className="block text-xl">{ownPostsQuery.isLoading ? '—' : ownPostsQuery.data?.length ?? 0}</strong><span className="text-xs text-muted-foreground">Posts</span></button>
          <button type="button" onClick={() => setConnectionsView('following')} className="rounded-2xl bg-muted/55 px-3 py-4 text-left transition-colors hover:bg-muted"><UserRoundCheck className="mb-2 size-4 text-primary" /><strong className="block text-xl">{followingQuery.isLoading ? '—' : followingQuery.data?.length ?? profile?.following_count ?? 0}</strong><span className="text-xs text-muted-foreground">Following</span></button>
          <button type="button" onClick={() => setConnectionsView('friends')} className="rounded-2xl bg-muted/55 px-3 py-4 text-left transition-colors hover:bg-muted"><UsersRound className="mb-2 size-4 text-primary" /><strong className="block text-xl">{friendsQuery.isLoading ? '—' : friendsQuery.data?.length ?? 0}</strong><span className="text-xs text-muted-foreground">Friends</span></button>
        </div>
      </div>
    </section>

    <div className="mt-6 flex border-b border-border" role="tablist" aria-label="Profile activity">
      {profileSections.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} onClick={() => setSection(item.id)} className={cn('flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors', section === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}><item.icon className="size-4" />{item.label}</button>)}
    </div>
    {activityQuery.isLoading && <div className="flex min-h-52 items-center justify-center"><LoadingSpinner size="lg" /></div>}
    {activityQuery.isError && <div className="mt-5"><RetryCard onRetry={() => void activityQuery.refetch()} /></div>}
    {!activityQuery.isLoading && !activityQuery.isError && posts.length === 0 && <div className="mt-5"><EmptyState icon={section === 'likes' ? <Heart /> : section === 'reposts' ? <Repeat2 /> : <FileText />} title={`No ${profileSections.find((item) => item.id === section)?.label.toLowerCase()} yet`} description="Your Community activity will appear here." /></div>}
    {!activityQuery.isLoading && !activityQuery.isError && posts.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => <article key={post.id} className="flex min-h-44 flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"><div className="flex flex-wrap gap-2"><Badge variant="secondary">{post.post_type}</Badge>{section === 'posts' && <Badge variant={post.status === 'published' ? 'default' : 'outline'}>{post.status.replaceAll('_', ' ')}</Badge>}</div><h4 className="mt-4 line-clamp-2 font-semibold">{post.title || 'Untitled post'}</h4>{post.body && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.body}</p>}<time className="mt-auto pt-4 text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</time></article>)}
    </div>}
  </div>
}
