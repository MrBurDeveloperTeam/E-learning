import { useEffect, useMemo, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { router } from './routes'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import { ErrorBoundary } from './components/ErrorBoundary'
import CatMascot from './components/CatMascot.jsx'
import MolarAIFloat from './components/MolarAIFloat.jsx'
import { VirtualPetContainer } from './VirtualPet/VirtualPetContainer'

function InnerApp() {
  // Initialize auth state (sets up onAuthStateChange listener)
  const { user, profile, session, isLoading } = useAuth({ initialize: true })
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [isVirtualPetOpen, setIsVirtualPetOpen] = useState(false)
  const isAuthRoute = currentPath === '/login' || currentPath === '/register'

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

  useEffect(() => {
    const channel = supabase.channel('app-health')
    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Scroll to top on route navigation
  useEffect(() => {
    const unsubscribe = router.subscribe('onLoad', () => {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      setCurrentPath(window.location.pathname)
    })
    return unsubscribe
  }, [])

  return (
    <>
      <RouterProvider router={router} />
      {!isAuthRoute && (
        <div className={isVirtualPetOpen ? 'hidden' : 'contents'}>
          {/* key forces remount when auth state changes: 'guest' → userId
              This makes the entry-walk animation play after login, not before. */}
          <CatMascot
            key={session?.user?.id ?? 'guest'}
            disabled={isLoading || !session?.user}
            onCatClick={() => setIsVirtualPetOpen(true)}
          />
          <MolarAIFloat
            disabled={isLoading || !session?.user}
            userContext={aiContext}
            onPetToggle={() => setIsVirtualPetOpen(true)}
          />
        </div>
      )}
      <VirtualPetContainer
        isOpen={isVirtualPetOpen}
        onClose={() => setIsVirtualPetOpen(false)}
      />
    </>
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
