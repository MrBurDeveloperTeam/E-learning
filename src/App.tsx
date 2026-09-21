import { useEffect, useMemo, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { router } from './routes'
import { useAuth } from './hooks/useAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import CatMascot from './components/CatMascot.jsx'
import MolarAIFloat from './components/MolarAIFloat.jsx'
import ElearningVirtualPet from './petExperience/ElearningVirtualPet'
import { PersonalizedInsightBridgeProvider } from './aiExperience/petDialogue/PersonalizedInsightBridge'
import MeowdokuLauncher from './games/MeowdokuLauncher'
import usePageDurationTracker, { type PageViewLogMeta } from './hooks/usePageDurationTracker'
import { logElearningActivity } from './lib/logActivityToOdoo'

// Human-readable label per route, checked most-specific-prefix-first, for
// the page_view activity description (e.g. "Viewed Watch Video page for
// 2m 10s"). Dynamic segments (video/channel/profile ids, category slugs)
// stay in the pagePath itself, same as the model's own '/videos/<id>'
// example — only the label is generic.
const PAGE_LABELS: Array<[string, string]> = [
  ['/watch/', 'Watch Video'],
  ['/channel/', 'Creator Channel'],
  ['/category/', 'Category'],
  ['/dental-videos/', 'Dental Video Detail'],
  ['/profile/', 'Profile'],
  ['/admin/applications', 'Admin Applications'],
  ['/admin/content', 'Admin Content Review'],
  ['/admin/users', 'Admin Users'],
  ['/admin/fetch-videos/manual-classification', 'Admin Manual Video Classification'],
  ['/admin/fetch-videos', 'Admin Fetch Videos'],
  ['/admin/advertisements', 'Admin Advertisements'],
  ['/admin/settings', 'Admin Platform Settings'],
  ['/admin', 'Admin Dashboard'],
  ['/explore', 'Explore'],
  ['/login', 'Login'],
  ['/register', 'Register'],
  ['/category', 'Categories'],
  ['/dental-videos', 'Dental Videos'],
  ['/search', 'Search'],
  ['/feed', 'Feed'],
  ['/saved', 'Saved'],
  ['/upload', 'Upload'],
  ['/studio', 'Studio'],
  ['/settings', 'Settings'],
  ['/billing', 'Billing'],
  ['/notifications', 'Notifications'],
  ['/community', 'Community'],
  ['/', 'Landing'],
]

function derivePageLabel(pathname: string): string {
  if (pathname === '/') return 'Landing'
  const match = PAGE_LABELS.find(([prefix]) => prefix !== '/' && pathname.startsWith(prefix))
  return match ? match[1] : pathname
}

function InnerApp() {
  // Initialize auth state (sets up onAuthStateChange listener)
  const { user, profile, session, isLoading } = useAuth({ initialize: true })
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [isVirtualPetOpen, setIsVirtualPetOpen] = useState(false)
  const [isMeowdokuOpen, setIsMeowdokuOpen] = useState(false)
  const isAuthRoute = currentPath === '/login' || currentPath === '/register'

  // All four games live in pet-function. E-learning only wires the
  // Meowdoku selector card to its shared launcher and owns open/close state.
  const extraGames = useMemo(
    () => [
      {
        id: 'meowdoku',
        title: 'Meowdoku',
        iconUrl: '/games/meowdoku/cover-148.png',
        onSelect: () => setIsMeowdokuOpen(true),
      },
    ],
    []
  )

  const aiContext = useMemo(() => {
    return [
      'Module: E-learning',
      `Current route: ${currentPath}`,
      `Signed in: ${session?.user ? 'yes' : 'no'}`,
      `User: ${profile?.full_name || user?.email?.split('@')[0] || 'Guest'}`,
      `Email: ${user?.email || 'Not signed in'}`,
      'Primary areas: Home, Explore, Categories, Dental Videos, Search, Saved, Upload, Studio, Profile, Settings',
    ].join('\n')
  }, [currentPath, profile?.full_name, session?.user, user?.email])

  // Logs how long the user spent on each route as a "page_view" activity
  // once they navigate away, hide the tab, or leave the page — see
  // hooks/usePageDurationTracker.ts. Gated on a signed-in email since
  // logActivityToOdoo silently skips (and logs a console warning) without one.
  usePageDurationTracker(
    currentPath,
    derivePageLabel(currentPath),
    Boolean(user?.email),
    (description: string, pageMeta: PageViewLogMeta) => {
      logElearningActivity('page_view', description, {
        pagePath: pageMeta.pagePath,
        pageDurationSeconds: pageMeta.pageDurationSeconds,
      })
    }
  )

  // Scroll to top on route navigation
  useEffect(() => {
    const unsubscribe = router.subscribe('onLoad', () => {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      setCurrentPath(window.location.pathname)
    })
    return unsubscribe
  }, [])

  return (
    <PersonalizedInsightBridgeProvider>
      <RouterProvider router={router} />
      {!isAuthRoute && (
        <div className={`${isVirtualPetOpen ? 'hidden' : 'contents'} ${currentPath === '/community' || currentPath.startsWith('/community/') ? 'community-ai-dock' : ''}`}>
          {/* key forces remount when auth state changes: 'guest' → userId
              This makes the entry-walk animation play after login, not before. */}
          <CatMascot
            key={session?.user?.id ?? 'guest'}
            disabled={isLoading || !session?.user}
            userId={session?.user?.id ?? null}
            authStatus={isLoading ? 'loading' : session?.user ? 'authenticated' : 'guest'}
            onCatClick={() => setIsVirtualPetOpen(true)}
          />
          <MolarAIFloat
            disabled={isLoading || !session?.user}
            userContext={aiContext}
            onPetToggle={() => setIsVirtualPetOpen(true)}
          />
        </div>
      )}
      <ElearningVirtualPet
        isOpen={isVirtualPetOpen}
        onClose={() => setIsVirtualPetOpen(false)}
        extraGames={extraGames}
      />
      <MeowdokuLauncher
        isOpen={isMeowdokuOpen}
        onClose={() => setIsMeowdokuOpen(false)}
        userId={session?.user?.id ?? null}
      />
    </PersonalizedInsightBridgeProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <InnerApp />
        <Toaster position="bottom-right" richColors />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
