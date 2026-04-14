import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from '@tanstack/react-router'
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
import { CreatorApplications } from '@/pages/admin/CreatorApplications'
import { ContentReview } from '@/pages/admin/ContentReview'
import { UserManagement } from '@/pages/admin/UserManagement'
import { NotFound } from '@/pages/NotFound'

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-[#F7FAFA]">
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
      <CreatorApplications />
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

const adminUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: () => (
    <ProtectedRoute requireAdmin>
      <UserManagement />
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
  adminRoute,
  adminApplicationsRoute,
  adminContentRoute,
  adminUsersRoute,
  notFoundRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
