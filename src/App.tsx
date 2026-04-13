import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { router } from './routes'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import { ErrorBoundary } from './components/ErrorBoundary'

function InnerApp() {
  // Initialize auth state (sets up onAuthStateChange listener)
  useAuth({ initialize: true })

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
    })
    return unsubscribe
  }, [])

  return <RouterProvider router={router} />
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
