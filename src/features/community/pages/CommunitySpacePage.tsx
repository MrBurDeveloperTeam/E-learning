import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Globe2, LockKeyhole, Megaphone, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { CommunityPostCard } from '@/features/community/components/CommunityPostCard'
import { CommunitySpaceSettingsDialog } from '@/features/community/components/CommunitySpaceSettingsDialog'
import { CreateCommunityPostDialog } from '@/features/community/components/CreateCommunityPostDialog'
import { useCommunityDirectory, useCommunityPosts, useJoinPublicCommunity } from '@/features/community/hooks/useCommunity'
import { useAuthStore } from '@/store/authStore'

export function CommunitySpacePage() {
  const { communitySlug } = useParams({ strict: false }) as { communitySlug: string }
  const user = useAuthStore((state) => state.user)
  const directory = useCommunityDirectory(user?.id)
  const community = directory.data?.find((item) => item.slug === communitySlug)
  const postsQuery = useCommunityPosts(user?.id, 'home', '', 'all', 'newest', community?.id ?? '__loading__')
  const posts = postsQuery.data?.pages.flat() ?? []
  const join = useJoinPublicCommunity(user?.id)

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {directory.isLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>
      ) : directory.isError ? (
        <main className="mx-auto max-w-3xl px-4 py-10"><RetryCard onRetry={() => void directory.refetch()} /></main>
      ) : !community ? (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <EmptyState icon={<UsersRound />} title="Community not found" description="It may be private, unavailable, or no longer active." />
          <div className="mt-5 flex justify-center"><Button render={<Link to="/community" search={{ tab: 'communities', q: undefined, topic: undefined, sort: undefined }} />}>Back to communities</Button></div>
        </main>
      ) : (
        <>
          <header className="border-b border-border/80 bg-card/60">
            <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
              <Button variant="ghost" render={<Link to="/community" search={{ tab: 'communities', q: undefined, topic: undefined, sort: undefined }} />}><ArrowLeft />All communities</Button>
              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    {community.visibility === 'private' ? <LockKeyhole className="size-6" /> : <Globe2 className="size-6" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Clinical community</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{community.name}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{community.description || 'A focused space for dental professionals to share knowledge and discuss clinical work.'}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {community.viewer_is_member ? <CreateCommunityPostDialog userId={user.id} communityId={community.id} communityName={community.name} /> : community.visibility === 'public' ? (
                    <Button disabled={join.isPending} onClick={() => void join.mutateAsync(community.id).then(() => toast.success(`Joined ${community.name}.`)).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not join this community.'))}>{join.isPending ? 'Joining…' : 'Join community'}</Button>
                  ) : null}
                  <CommunitySpaceSettingsDialog community={community} />
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto grid max-w-[1240px] gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,760px)_minmax(240px,1fr)]">
            <section aria-labelledby="community-feed-title">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Community feed</p><h2 id="community-feed-title" className="mt-1 text-xl font-semibold">Posts and discussions</h2></div>
              </div>
              <div className="space-y-4" aria-live="polite">
                {postsQuery.isLoading && <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>}
                {postsQuery.isError && <RetryCard onRetry={() => void postsQuery.refetch()} />}
                {!postsQuery.isLoading && !postsQuery.isError && posts.length === 0 && <EmptyState icon={<UsersRound />} title="No posts here yet" description={community.viewer_is_member ? 'Start the first discussion by sharing text, images, or a video.' : 'Join this community to take part in the discussion.'} />}
                {posts.map((post) => <CommunityPostCard key={post.id} post={post} userId={user.id} />)}
              </div>
              {postsQuery.hasNextPage && <div className="mt-6 flex justify-center"><Button variant="outline" disabled={postsQuery.isFetchingNextPage} onClick={() => void postsQuery.fetchNextPage()}>{postsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button></div>}
            </section>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="size-4 text-primary" />{community.member_count} {community.member_count === 1 ? 'member' : 'members'}</div>
                <p className="mt-2 text-xs capitalize text-muted-foreground">{community.visibility} community</p>
              </div>
              <div className="rounded-2xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4 text-primary" />Announcement</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{community.announcement || 'No announcement has been published yet.'}</p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6 text-muted-foreground">Keep patient-identifying information out of posts, images, and videos.</div>
            </aside>
          </main>
        </>
      )}
    </div>
  )
}
