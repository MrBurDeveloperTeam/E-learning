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

const SSO_EXCHANGE_PATHS = ['/api/sso', '/api/sso/exchange'] as const

// Helper to get API base URL
const getApiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function getApiUrl(path: string) {
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}${path}` : path
}

async function fetchSsoExchange() {
  for (const path of SSO_EXCHANGE_PATHS) {
    const response = await fetch(getApiUrl(path), {
      method: 'GET',
      credentials: 'include',
    })

    if (response.status === 404 || response.status === 405) {
      continue
    }

    return response
  }

  return null
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
    // Step 1: Create user in Odoo via worker endpoint
    const response = await fetch(getApiUrl('/api/e-learning/sign-up'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: metadata?.full_name || email.split('@')[0],
      }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      // Extract error message from various possible response formats
      const errorMsg = 
        data?.error || 
        data?.data?.error?.message || 
        data?.details?.message ||
        'Failed to create account'
      throw new Error(errorMsg)
    }

    // Step 2: Create user in Supabase
    // We do this in the frontend to ensure it happens
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: metadata?.full_name || email.split('@')[0],
          role: metadata?.role || 'member',
          account_type: metadata?.account_type || 'individual',
          odoo_user_id: data?.odoo?.user_id || null,
          sso: 'odoo',
        },
      },
    })

    if (signUpError) {
      // If user already exists in Supabase, try to sign in instead
      if (signUpError.message.includes('already registered') || 
          signUpError.message.includes('already exists')) {
        console.log('[useAuth] User already exists in Supabase, attempting sign-in')
      } else {
        throw signUpError
      }
    }

    // Step 3: Sign in with the newly created credentials
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // If sign-in fails, check if it's due to email confirmation
        if (signInError.message.includes('Email not confirmed') || 
            signInError.message.includes('not confirmed')) {
          // User needs to confirm email - don't throw error
          // The Register component will show the confirmation message
          return
        }
        
        // For other errors, throw them
        throw signInError
      }

      // If we got a session, set it
      if (signInData.session) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        })
        if (setErr) throw setErr
      }
    } catch (signInErr) {
      // If sign-in fails but user was created successfully,
      // log the error but don't fail the registration
      console.warn('[useAuth] User created but auto sign-in failed:', signInErr)
      // User can manually sign in from the login page
    }
  }

  async function signOutUser() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    clearPersistedSupabaseSession()
    clearStore()
    setIsLoading(false)
    queryClient.clear()

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
