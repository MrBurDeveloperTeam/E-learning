import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Home } from '@/pages/Home'
import { Landing } from '@/pages/Landing'
import { Watch } from '@/pages/Watch'
import { Upload } from '@/pages/Upload'
import { Channel } from '@/pages/Channel'
import { Categories } from '@/pages/Categories'
import { Category } from '@/pages/Category'
import { Search } from '@/pages/Search'
import { Feed } from '@/pages/Feed'
import { Saved } from '@/pages/Saved'
import { Studio } from '@/pages/Studio'
import { Profile } from '@/pages/Profile'
import { Settings } from '@/pages/Settings'
import { Billing } from '@/pages/Billing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import { Notifications } from '@/pages/Notifications'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { ContentReview } from '@/pages/admin/ContentReview'
import { UserManagement } from '@/pages/admin/UserManagement'
import { AdminFetchVideos } from '@/pages/admin/AdminFetchVideos'
import { PlatformSettings } from '@/pages/admin/PlatformSettings'
import { DentalVideos } from '@/pages/DentalVideos'
import { DentalVideoDetail } from '@/pages/DentalVideoDetail'
import { NotFound } from '@/pages/NotFound'

const CommunityPage = lazy(() => import('@/features/community/pages/CommunityPage').then(module => ({ default: module.CommunityPage })))
const CommunityAdminPage = lazy(() => import('@/features/community/pages/CommunityAdminPage').then(module => ({ default: module.CommunityAdminPage })))
const CommunityPostDetailPage = lazy(() => import('@/features/community/pages/CommunityPostDetailPage').then(module => ({ default: module.CommunityPostDetailPage })))
const CommunitySpacePage = lazy(() => import('@/features/community/pages/CommunitySpacePage').then(module => ({ default: module.CommunitySpacePage })))

function CommunityRouteFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-background"><div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" role="status" aria-label="Loading Community" /></div>
}

function LazyCommunityRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<CommunityRouteFallback />}>{children}</Suspense>
}

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  ),
})

// ─── Public routes ────────────────────────────────────

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
})

const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore',
  component: Home,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: Register,
})

// ─── Video routes ─────────────────────────────────────

const watchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/watch/$videoId',
  component: Watch,
})

const categoriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/category',
  component: Categories,
})

const categoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/category/$slug',
  component: Category,
})

// ─── Dental video routes ──────────────────────────────

const dentalVideosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dental-videos',
  component: DentalVideos,
  validateSearch: (search: Record<string, unknown>) => ({
    category: (search.category as string) ?? '',
    q: (search.q as string) ?? '',
    page: Number(search.page) || 1,
  }),
})

const dentalVideoDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dental-videos/$id',
  component: DentalVideoDetail,
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: Search,
})

// ─── Creator routes ───────────────────────────────────

const channelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/channel/$userId',
  component: Channel,
})

// ─── Authenticated routes ─────────────────────────────

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feed',
  component: Feed,
})

const savedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/saved',
  component: Saved,
})

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upload',
  component: Upload,
})

const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio',
  component: Studio,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile/$userId',
  component: Profile,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => (
    <ProtectedRoute>
      <Settings />
    </ProtectedRoute>
  ),
})

const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/billing',
  component: () => (
    <ProtectedRoute>
      <Billing />
    </ProtectedRoute>
  ),
})

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notifications',
  component: () => (
    <ProtectedRoute>
      <Notifications />
    </ProtectedRoute>
  ),
})

const communityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/community',
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === 'following' || search.tab === 'friends' || search.tab === 'communities' || search.tab === 'video' || search.tab === 'settings' ? search.tab : undefined,
    q: typeof search.q === 'string' && search.q ? search.q.slice(0, 120) : undefined,
    topic: typeof search.topic === 'string' && search.topic !== 'all' ? search.topic : undefined,
    sort: search.sort === 'newest' || search.sort === 'popular' ? search.sort : undefined,
  }),
  component: () => (
    <ProtectedRoute>
      <LazyCommunityRoute><CommunityPage /></LazyCommunityRoute>
    </ProtectedRoute>
  ),
})

const communityPostRoute = createRoute({getParentRoute:()=>rootRoute,path:'/community/post/$postId',component:()=><ProtectedRoute><LazyCommunityRoute><CommunityPostDetailPage/></LazyCommunityRoute></ProtectedRoute>})
const communitySpaceRoute = createRoute({getParentRoute:()=>rootRoute,path:'/community/$communitySlug',component:()=><ProtectedRoute><LazyCommunityRoute><CommunitySpacePage/></LazyCommunityRoute></ProtectedRoute>})

// ─── Admin routes ─────────────────────────────────────

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => (
    <ProtectedRoute requireAdmin>
      <AdminDashboard />
    </ProtectedRoute>
  ),
})

const adminApplicationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/applications',
  component: () => (
    <ProtectedRoute requireAdmin>
      <UserManagement />
    </ProtectedRoute>
  ),
})

const adminContentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/content',
  component: () => (
    <ProtectedRoute requireAdmin>
      <ContentReview />
    </ProtectedRoute>
  ),
})

const adminCommunityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/community',
  component: () => (
    <ProtectedRoute requireAdmin>
      <LazyCommunityRoute><CommunityAdminPage /></LazyCommunityRoute>
    </ProtectedRoute>
  ),
})

const adminUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: () => (
    <ProtectedRoute requireAdmin>
      <UserManagement />
    </ProtectedRoute>
  ),
})

const adminFetchVideosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/fetch-videos',
  component: () => (
    <ProtectedRoute requireAdmin>
      <AdminFetchVideos />
    </ProtectedRoute>
  ),
})

const adminSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/settings',
  component: () => (
    <ProtectedRoute requireAdmin>
      <PlatformSettings />
    </ProtectedRoute>
  ),
})

// ─── Not found ────────────────────────────────────────

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: NotFound,
})

// ─── Route tree ───────────────────────────────────────

const routeTree = rootRoute.addChildren([
  landingRoute,
  exploreRoute,
  loginRoute,
  registerRoute,
  watchRoute,
  categoriesRoute,
  categoryRoute,
  searchRoute,
  channelRoute,
  feedRoute,
  savedRoute,
  uploadRoute,
  studioRoute,
  profileRoute,
  settingsRoute,
  billingRoute,
  notificationsRoute,
  communityRoute,
  communityPostRoute,
  communitySpaceRoute,
  adminRoute,
  adminApplicationsRoute,
  adminContentRoute,
  adminCommunityRoute,
  adminUsersRoute,
  adminFetchVideosRoute,
  adminSettingsRoute,
  dentalVideosRoute,
  dentalVideoDetailRoute,
  notFoundRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
