import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { CircleUserRound, Compass, Home, MessageCircleMore, MessagesSquare, PlaySquare, Search, ShieldCheck, UserRoundCheck, X } from 'lucide-react'
import { CommunityPostCard } from '@/features/community/components/CommunityPostCard'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { useCommunityPosts, useCommunityPreferences, useDirectConversations } from '@/features/community/hooks/useCommunity'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FindPeopleDialog } from '@/features/community/components/FindPeopleDialog'
import '../styles/community-dashboard.css'
import '../styles/community-controls.css'

const CreateCommunityPostDialog = lazy(() => import('@/features/community/components/CreateCommunityPostDialog').then(module => ({ default: module.CreateCommunityPostDialog })))
const CommunityDirectory = lazy(() => import('@/features/community/components/CommunityDirectory').then(module => ({ default: module.CommunityDirectory })))
const CommunityMe = lazy(() => import('@/features/community/components/CommunityMe').then(module => ({ default: module.CommunityMe })))
const DirectMessages = lazy(() => import('@/features/community/components/DirectMessages').then(module => ({ default: module.DirectMessages })))

function CommunityPanelFallback() {
  return <div className="mt-7 flex min-h-64 items-center justify-center" role="status" aria-label="Loading Community section"><LoadingSpinner size="lg" /></div>
}

// Community Video feed is temporarily hidden. Keep its UI/feed code intact;
// set this flag to true to restore the navigation and ?tab=video access.
const COMMUNITY_VIDEO_FEED_ENABLED = false

const navigation = [
  { id: 'home', label: 'Home', icon: Home, available: true },
  { id: 'following', label: 'Following', icon: UserRoundCheck, available: true },
  { id: 'communities', label: 'Communities', icon: MessageCircleMore, available: true },
  { id: 'video', label: 'Video', icon: PlaySquare, available: true },
  { id: 'chat', label: 'Chat', icon: MessagesSquare, available: true },
  { id: 'me', label: 'Profile', icon: CircleUserRound, available: true },
].filter(item => item.id !== 'video' || COMMUNITY_VIDEO_FEED_ENABLED)

export function CommunityPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { tab?: string;q?:string;topic?:string;sort?:'relevant'|'newest'|'popular' }
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const requestedTab = search.tab === 'video' && !COMMUNITY_VIDEO_FEED_ENABLED ? 'home' : search.tab
  const activeTab = requestedTab === 'following' || requestedTab === 'communities' || requestedTab === 'video' || requestedTab === 'chat' || requestedTab === 'me' || requestedTab === 'settings' ? (requestedTab === 'settings' ? 'me' : requestedTab) : 'home'
  const feedMode = activeTab === 'communities' || activeTab === 'chat' || activeTab === 'me' ? 'home' : activeTab
  const [postSearch,setPostSearch]=useState(search.q??'')
  const topic=search.topic??'all',sort=search.sort??'relevant'
  useEffect(()=>{setPostSearch(search.q??'')},[search.q])
  useEffect(()=>{if(postSearch===(search.q??''))return;const timer=window.setTimeout(()=>void navigate({to:'/community',search:{tab:activeTab==='home'?undefined:activeTab,q:postSearch.trim(),topic,sort},replace:true}),300);return()=>window.clearTimeout(timer)},[activeTab,navigate,postSearch,search.q,sort,topic])
  const postsQuery = useCommunityPosts(user?.id, feedMode, search.q??'',topic,sort)
  const preferences=useCommunityPreferences(user?.id??'')
  const directConversations = useDirectConversations(user?.id)
  const unreadMessageCount = (directConversations.data ?? []).reduce((total, conversation) => total + conversation.unread_count, 0)
  const posts = postsQuery.data?.pages.flat() ?? []
  const isAdmin = isAdminProfile(profile)
  useEffect(()=>{if(activeTab!=='chat')return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[activeTab])

  return (
    <div className={cn('bg-background',activeTab==='chat'?'h-screen overflow-hidden':'min-h-screen')}>
      <Navbar />
      <div data-community-tab={activeTab} className={cn('community-dashboard mx-auto grid w-full max-w-[1440px] grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:px-6',activeTab==='chat'&&'h-[calc(100vh-4.375rem)] overflow-hidden')}>
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
                <span className="relative shrink-0">
                  <item.icon className="size-4" />
                  {item.id === 'chat' && unreadMessageCount > 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-background bg-destructive" aria-hidden="true" />}
                </span>
                <span>{item.label}</span>
                {item.id === 'chat' && unreadMessageCount > 0 && <span className="sr-only">{unreadMessageCount} unread messages</span>}
                {!item.available && <span className="ml-auto text-[9px] uppercase tracking-wide">Soon</span>}
              </button>
            ))}
            {isAdmin && (
              <Link to="/admin/community" className="mt-4 flex w-full items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-left text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300">
                <ShieldCheck className="size-4" /> Management
              </Link>
            )}
          </nav>
        </aside>

        <main className={cn('community-dashboard-main min-w-0 px-4 py-6 sm:px-6 md:px-0 md:py-8',activeTab==='chat'&&'flex min-h-0 flex-col overflow-hidden')}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {activeTab === 'following' ? 'Following feed' : activeTab === 'communities' ? 'Community directory' : activeTab === 'video' ? 'Video feed' : activeTab === 'chat' ? 'Messages' : activeTab === 'me' ? 'My profile' : 'Home feed'}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                {activeTab === 'following' ? 'From people you follow' : activeTab === 'communities' ? 'Find your clinical circle' : activeTab === 'video' ? 'Video, tuned to your interests' : activeTab === 'chat' ? 'Your conversations' : activeTab === 'me' ? 'Your Community profile' : 'What dentistry is discussing'}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {activeTab === 'following'
                  ? 'Posts from the professionals and peers you follow.'
                  : activeTab === 'communities'
                      ? 'Browse public communities and revisit the spaces you have joined.'
                      : activeTab === 'video'
                        ? 'Topics you engage with appear more often, while other clinical areas stay in the mix.'
                        : activeTab === 'chat'
                          ? 'Start and continue private conversations with other Community members.'
                        : activeTab === 'me'
                          ? 'View your profile, connections, posts, and personal Community settings.'
                  : 'Clinical conversations, ranked by community engagement.'}
              </p>
            </div>
            {user && activeTab !== 'communities' && activeTab !== 'video' && activeTab !== 'chat' && activeTab !== 'me' && <div className="hidden items-center gap-2 sm:flex">{activeTab === 'home' && <FindPeopleDialog userId={user.id} />}<Suspense fallback={null}><CreateCommunityPostDialog userId={user.id} /></Suspense></div>}
          </div>

          {user && activeTab !== 'communities' && activeTab !== 'video' && activeTab !== 'chat' && activeTab !== 'me' && <div className="mt-5 flex gap-2 sm:hidden">{activeTab === 'home' && <FindPeopleDialog userId={user.id} />}<Suspense fallback={null}><CreateCommunityPostDialog userId={user.id} /></Suspense></div>}

          {activeTab !== 'communities' && activeTab !== 'chat' && activeTab !== 'me' && <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px_150px]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={postSearch} onChange={event=>setPostSearch(event.target.value)} placeholder="Search posts, topics, or #tags" className="pl-9 pr-9"/>{postSearch&&<Button size="icon-sm" variant="ghost" aria-label="Clear Community search" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={()=>setPostSearch('')}><X/></Button>}</div><Select value={topic} onValueChange={value=>void navigate({to:'/community',search:{tab:activeTab==='home'?undefined:activeTab,q:search.q??'',topic:value??'all',sort},replace:true})}><SelectTrigger aria-label="Filter by topic"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All topics</SelectItem>{['general_dentistry','implantology','orthodontics','endodontics','periodontology','oral_surgery','prosthodontics','pediatric_dentistry','digital_dentistry','practice_management'].map(value=><SelectItem key={value} value={value}>{value.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><Select value={sort} onValueChange={value=>void navigate({to:'/community',search:{tab:activeTab==='home'?undefined:activeTab,q:search.q??'',topic,sort:(value??'relevant') as typeof sort},replace:true})}><SelectTrigger aria-label="Sort posts"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="relevant">Relevant</SelectItem><SelectItem value="popular">Popular</SelectItem><SelectItem value="newest">Newest</SelectItem></SelectContent></Select></div>}

          {activeTab === 'communities' && user ? <Suspense fallback={<CommunityPanelFallback />}><CommunityDirectory userId={user.id} /></Suspense> : activeTab === 'chat' && user ? <div className="min-h-0 flex-1"><Suspense fallback={<CommunityPanelFallback />}><DirectMessages userId={user.id} conversations={directConversations.data} conversationsLoading={directConversations.isLoading} /></Suspense></div> : activeTab === 'me' && user ? <Suspense fallback={<CommunityPanelFallback />}><CommunityMe userId={user.id} profile={profile} openFollowRequests={new URLSearchParams(window.location.search).get('requests') === '1'} /></Suspense> : <div className="mt-7 space-y-4" aria-live="polite">
            {postsQuery.isLoading && <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>}
            {postsQuery.isError && <RetryCard onRetry={() => void postsQuery.refetch()} />}
            {!postsQuery.isLoading && !postsQuery.isError && posts.length === 0 && (
              <EmptyState
                icon={activeTab === 'following' ? <UserRoundCheck /> : activeTab === 'video' ? <PlaySquare /> : <Compass />}
                title={activeTab === 'following' ? 'No posts from followed users yet' : activeTab === 'video' ? 'No community videos yet' : 'No posts yet'}
                description={activeTab === 'following'
                  ? 'Follow more people or return later when they publish a post.'
                  : activeTab === 'video'
                      ? 'Community videos will appear here.'
                  : 'Create the first post to start the conversation.'}
              />
            )}
            {posts.map((post) => <CommunityPostCard key={post.id} post={post} userId={user?.id} autoplayVideos={activeTab==='video'&&preferences.data?.autoplay_videos} showCommunityBadge={activeTab==='home'} />)}
          </div>}

          {activeTab !== 'communities' && activeTab !== 'chat' && activeTab !== 'me' && postsQuery.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" disabled={postsQuery.isFetchingNextPage} onClick={() => void postsQuery.fetchNextPage()}>
                {postsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </main>

      </div>
    </div>
  )
}
