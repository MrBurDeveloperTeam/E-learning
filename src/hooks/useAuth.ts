import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { useAuthStore } from '../store/authStore'
import { fetchProfile } from '../lib/queries/profiles'

interface UseAuthOptions {
  initialize?: boolean
}

function clearPersistedSupabaseSession() {
  if (typeof window === 'undefined') return

  const storageKeyPrefixes = ['supabase.auth.token']

  try {
    const projectRef = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
    if (projectRef) {
      storageKeyPrefixes.push(`sb-${projectRef}-auth-token`)
      storageKeyPrefixes.push(`sb-${projectRef}-auth-token-code-verifier`)
    }
  } catch {
    // Ignore invalid env values and fall back to generic cleanup.
  }

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys = Object.keys(storage)
    for (const key of keys) {
      if (storageKeyPrefixes.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key)
      }
    }
  }
}

// Helper to get API base URL
const getApiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function getApiUrl(path: string) {
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}${path}` : path
}

async function fetchSsoExchange() {
  try {
    const response = await fetch(getApiUrl('/api/sso/exchange'), {
      method: 'GET',
      credentials: 'include',
    })

    // Only return if we got a valid JSON response
    if (response.ok) {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return response
      }
    }

    return null
  } catch (error) {
    console.warn('[useAuth] fetchSsoExchange error:', error)
    return null
  }
}

export function useAuth({ initialize = false }: UseAuthOptions = {}) {
  const {
    user,
    profile,
    session,
    isLoading,
    setUser,
    setProfile,
    setSession,
    setIsLoading,
    signOut: clearStore,
  } = useAuthStore()

  useEffect(() => {
    if (!initialize) return

    let mounted = true

    // Safety timeout: if auth init takes too long (e.g. network issues,
    // Supabase is unreachable), force the app out of loading state so the
    // user can still interact with public pages.
    const safetyTimer = window.setTimeout(() => {
      if (mounted && useAuthStore.getState().isLoading) {
        console.warn('[useAuth] auth init timed out – forcing isLoading=false')
        setIsLoading(false)
      }
    }, 8000)

    async function init() {
      try {
        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (!mounted) return

        if (sessionError) {
          console.warn('[useAuth] getSession error:', sessionError.message)
          clearStore()
          return
        }

        if (currentSession?.user) {
          setUser(currentSession.user)
          setSession(currentSession)
          try {
            const p = await fetchProfile(currentSession.user.id)
            if (mounted) setProfile(p)
          } catch {
            // profile may not exist yet
          }
        } else {
          // Attempt seamless SSO if no Supabase session exists
          try {
            const ssoRes = await fetchSsoExchange()
            if (!ssoRes) {
              clearStore()
              return
            }

            if (ssoRes.ok) {
              const data = await ssoRes.json()
              if (data.access_token && data.refresh_token) {
                // Set the generated Supabase session
                const { error: setSessionError } = await supabase.auth.setSession({
                  access_token: data.access_token,
                  refresh_token: data.refresh_token,
                })
                if (setSessionError) {
                  console.warn('[useAuth] failed to set SSO session:', setSessionError)
                  clearStore()
                }
              } else {
                clearStore()
              }
            } else {
              clearStore()
            }
          } catch (ssoError) {
            console.warn('[useAuth] seamless SSO check failed:', ssoError)
            clearStore()
          }
        }
      } catch (err) {
        console.warn('[useAuth] init failed:', err)
        if (mounted) clearStore()
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return

      if (event === 'SIGNED_IN' && newSession?.user) {
        setUser(newSession.user)
        setSession(newSession)
        // Fetch profile outside the callback to avoid blocking the
        // auth state change listener (which can cause Web Lock deadlocks).
        void fetchProfile(newSession.user.id)
          .then((p) => { if (mounted) setProfile(p) })
          .catch(() => { /* profile may not exist yet */ })
          .finally(() => { if (mounted) setIsLoading(false) })
      } else if (event === 'SIGNED_OUT') {
        clearStore()
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession)
      }
    })

    return () => {
      mounted = false
      window.clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialize])

  async function signInWithEmail(email: string, password: string) {
    // E-learning uses Supabase authentication directly
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (data.session) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (setErr) throw setErr
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    })
    if (error) throw error
  }

  async function signUp(
    email: string,
    password: string,
    metadata?: {
      full_name?: string
      role?: 'member' | 'creator' | 'admin'
      account_type?: 'individual' | 'company' | 'admin'
    }
  ) {
    const name = metadata?.full_name || email.split('@')[0]

    // Step 1: Create user in Odoo via worker
    const odooRes = await fetch(getApiUrl('/api/e-learning/sign-up'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    const odooData = await odooRes.json()

    if (!odooRes.ok) {
      const errorMsg =
        odooData?.error ||
        odooData?.data?.error?.message ||
        odooData?.details?.message ||
        'Failed to create account'
      throw new Error(errorMsg)
    }

    // Step 2: Create confirmed Supabase user via worker admin endpoint.
    // This uses the service role key server-side, so email_confirm: true
    // is set and the user can sign in immediately without email verification.
    const sbRes = await fetch(getApiUrl('/api/auth/create-user'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name,
        account_type: metadata?.account_type || 'individual',
      }),
    })

    const sbData = await sbRes.json()

    if (!sbRes.ok) {
      throw new Error(sbData?.error || 'Failed to create Supabase account')
    }

    // Step 3: Sign in directly — user is confirmed so this works immediately
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) throw signInError

    if (signInData.session) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      })
      if (setErr) throw setErr
    }
  }

  async function signOutUser() {
    try {
      // Step 1: Call worker logout endpoint to clear SSO cookies and Odoo session
      await fetch(getApiUrl('/api/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      // Continue with local logout even if worker logout fails
      console.warn('[useAuth] Worker logout failed:', error)
    }

    // Step 2: Sign out from Supabase locally
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    // Step 3: Clear local session data
    clearPersistedSupabaseSession()
    clearStore()
    setIsLoading(false)
    queryClient.clear()

    // Step 4: Redirect to Snabbb main app
    window.location.href = 'https://app.snabbb.com/'

    if (error) throw error
  }

  return {
    user,
    profile,
    session,
    isLoading,
    signInWithEmail,
    signInWithGoogle,
    signUp,
    signOut: signOutUser,
  }
}
