import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Bookmark, Compass, Home, MessageCircleMore, PlaySquare, Search, Settings, ShieldCheck, UserRoundCheck, UsersRound, X } from 'lucide-react'
import { CommunityPostCard } from '@/features/community/components/CommunityPostCard'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { useCommunityPosts, useCommunityPreferences } from '@/features/community/hooks/useCommunity'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CreateCommunityPostDialog = lazy(() => import('@/features/community/components/CreateCommunityPostDialog').then(module => ({ default: module.CreateCommunityPostDialog })))
const CommunityDirectory = lazy(() => import('@/features/community/components/CommunityDirectory').then(module => ({ default: module.CommunityDirectory })))
const CommunitySettings = lazy(() => import('@/features/community/components/CommunitySettings').then(module => ({ default: module.CommunitySettings })))

function CommunityPanelFallback() {
  return <div className="mt-7 flex min-h-64 items-center justify-center" role="status" aria-label="Loading Community section"><LoadingSpinner size="lg" /></div>
}

const navigation = [
  { id: 'home', label: 'Home', icon: Home, available: true },
  { id: 'following', label: 'Following', icon: UserRoundCheck, available: true },
  { id: 'friends', label: 'Friends', icon: UsersRound, available: true },
  { id: 'communities', label: 'Communities', icon: MessageCircleMore, available: true },
  { id: 'video', label: 'Video', icon: PlaySquare, available: true },
  { id: 'settings', label: 'Settings', icon: Settings, available: true },
]

export function CommunityPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { tab?: string;q?:string;topic?:string;sort?:'relevant'|'newest'|'popular' }
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const activeTab = search.tab === 'following' || search.tab === 'friends' || search.tab === 'communities' || search.tab === 'video' || search.tab === 'settings' ? search.tab : 'home'
  const feedMode = activeTab === 'communities' || activeTab === 'settings' ? 'home' : activeTab
  const [postSearch,setPostSearch]=useState(search.q??'')
  const topic=search.topic??'all',sort=search.sort??'relevant'
  useEffect(()=>{setPostSearch(search.q??'')},[search.q])
  useEffect(()=>{if(postSearch===(search.q??''))return;const timer=window.setTimeout(()=>void navigate({to:'/community',search:{tab:activeTab==='home'?undefined:activeTab,q:postSearch.trim(),topic,sort},replace:true}),300);return()=>window.clearTimeout(timer)},[activeTab,navigate,postSearch,search.q,sort,topic])
  const postsQuery = useCommunityPosts(user?.id, feedMode, search.q??'',topic,sort)
  const preferences=useCommunityPreferences(user?.id??'')
  const posts = postsQuery.data?.pages.flat() ?? []
  const isAdmin = isAdminProfile(profile)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 md:grid-cols-[220px_minmax(0,720px)] xl:grid-cols-[220px_minmax(0,720px)_280px] md:gap-6 md:px-6">
        <aside className="hidden border-r border-border/70 py-7 pr-5 md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)] md:self-start md:overflow-y-auto">
          <div className="mb-6 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Community</p>
            <h1 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Clinical exchange</h1>
          </div>
          <nav aria-label="Community navigation" className="space-y-1">
            {navigation.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={!item.available}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => {
                  if (!item.available) return
                  void navigate({ to: '/community', search: { tab: item.id === 'home' ? undefined : item.id, q: search.q??'', topic, sort } })
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  activeTab === item.id
                    ? 'bg-primary/12 font-semibold text-foreground'
                    : item.available
                      ? 'cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground'
                      : 'cursor-not-allowed text-muted-foreground/55',
                )}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
                {!item.available && <span className="ml-auto text-[9px] uppercase tracking-wide">Soon</span>}
              </button>
            ))}
            {isAdmin && (
              <Link to="/admin/content" className="mt-4 flex w-full items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-left text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300">
                <ShieldCheck className="size-4" /> Management
              </Link>
            )}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 md:px-0 md:py-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {activeTab === 'following' ? 'Following feed' : activeTab === 'friends' ? 'Friends feed' : activeTab === 'communities' ? 'Community directory' : activeTab === 'video' ? 'Video feed' : activeTab === 'settings' ? 'Community settings' : 'Home feed'}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                {activeTab === 'following' ? 'From people you follow' : activeTab === 'friends' ? 'What your friends found useful' : activeTab === 'communities' ? 'Find your clinical circle' : activeTab === 'video' ? 'Video, tuned to your interests' : activeTab === 'settings' ? 'Manage your Community activity' : 'What dentistry is discussing'}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {activeTab === 'following'
                  ? 'Posts from the professionals and peers you follow.'
                  : activeTab === 'friends'
                    ? 'Posts your accepted friends liked or reposted.'
                    : activeTab === 'communities'
                      ? 'Browse public communities, revisit joined spaces, and access private conversations.'
                      : activeTab === 'video'
                        ? 'Topics you engage with appear more often, while other clinical areas stay in the mix.'
                        : activeTab === 'settings'
                          ? 'Review your posts and manage likes, reposts, follows, and friends in one place.'
                  : 'Clinical conversations, ranked by community engagement.'}
              </p>
            </div>
            {user && activeTab !== 'communities' && activeTab !== 'video' && activeTab !== 'settings' && <div className="hidden sm:block"><Suspense fallback={null}><CreateCommunityPostDialog userId={user.id} /></Suspense></div>}
          </div>

          {user && activeTab !== 'communities' && activeTab !== 'video' && activeTab !== 'settings' && <div className="mt-5 sm:hidden"><Suspense fallback={null}><CreateCommunityPostDialog userId={user.id} /></Suspense></div>}

          {activeTab !== 'communities' && activeTab !== 'settings' && <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px_150px]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={postSearch} onChange={event=>setPostSearch(event.target.value)} placeholder="Search posts, topics, or #tags" className="pl-9 pr-9"/>{postSearch&&<Button size="icon-sm" variant="ghost" aria-label="Clear Community search" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={()=>setPostSearch('')}><X/></Button>}</div><Select value={topic} onValueChange={value=>void navigate({to:'/community',search:{tab:activeTab==='home'?undefined:activeTab,q:search.q??'',topic:value??'all',sort},replace:true})}><SelectTrigger aria-label="Filter by topic"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All topics</SelectItem>{['general_dentistry','implantology','orthodontics','endodontics','periodontology','oral_surgery','prosthodontics','pediatric_dentistry','digital_dentistry','practice_management'].map(value=><SelectItem key={value} value={value}>{value.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><Select value={sort} onValueChange={value=>void navigate({to:'/community',search:{tab:activeTab==='home'?undefined:activeTab,q:search.q??'',topic,sort:(value??'relevant') as typeof sort},replace:true})}><SelectTrigger aria-label="Sort posts"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="relevant">Relevant</SelectItem><SelectItem value="popular">Popular</SelectItem><SelectItem value="newest">Newest</SelectItem></SelectContent></Select></div>}

          {activeTab === 'communities' && user ? <Suspense fallback={<CommunityPanelFallback />}><CommunityDirectory userId={user.id} /></Suspense> : activeTab === 'settings' && user ? <Suspense fallback={<CommunityPanelFallback />}><CommunitySettings userId={user.id} /></Suspense> : <div className="mt-7 space-y-4" aria-live="polite">
            {postsQuery.isLoading && <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>}
            {postsQuery.isError && <RetryCard onRetry={() => void postsQuery.refetch()} />}
            {!postsQuery.isLoading && !postsQuery.isError && posts.length === 0 && (
              <EmptyState
                icon={activeTab === 'following' ? <UserRoundCheck /> : activeTab === 'friends' ? <UsersRound /> : activeTab === 'video' ? <PlaySquare /> : <Compass />}
                title={activeTab === 'following' ? 'No posts from followed users yet' : activeTab === 'friends' ? 'No friend activity yet' : activeTab === 'video' ? 'No community videos yet' : 'No posts yet'}
                description={activeTab === 'following'
                  ? 'Follow more people or return later when they publish a post.'
                  : activeTab === 'friends'
                    ? 'Accepted friends’ likes and reposts will appear here.'
                    : activeTab === 'video'
                      ? 'Community videos will appear here.'
                  : 'Create the first post to start the conversation.'}
              />
            )}
            {posts.map((post) => <CommunityPostCard key={post.id} post={post} userId={user?.id} autoplayVideos={activeTab==='video'&&preferences.data?.autoplay_videos} />)}
          </div>}

          {activeTab !== 'communities' && activeTab !== 'settings' && postsQuery.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" disabled={postsQuery.isFetchingNextPage} onClick={() => void postsQuery.fetchNextPage()}>
                {postsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </main>

        <aside className="hidden py-8 xl:block">
          <div className="sticky top-20 rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Community standard</p>
            <h2 className="mt-2 text-base font-semibold">Protect patient trust</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Remove patient-identifying details before posting clinical material. Posts are published immediately and may be reviewed if reported.</p>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-xs text-secondary-foreground">
              <Bookmark className="size-4 text-primary" /> Saved posts stay private to you.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
