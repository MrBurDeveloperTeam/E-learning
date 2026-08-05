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
    const normalizedEmail = email.trim().toLowerCase()

    // Preserve direct Supabase login for legacy E-learning accounts.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (!error && data.session) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (setErr) throw setErr
      return
    }

    // New ecosystem accounts exist in the main Snabbb/Odoo identity store,
    // not as password users in this Supabase project. Authenticate them using
    // the same main-app endpoint used by Inventory and Todo.
    const loginResponse = await fetch('https://app.snabbb.com/api/web/session/authenticate', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-SSO-API-KEY': 'my-sso-secret-123',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: 'aht-systemadmin-mrbur-main-20994444',
          login: normalizedEmail,
          password,
        },
        id: 1,
      }),
    })
    const loginData = await loginResponse.json().catch(() => null)
    const odooUser = loginData?.result

    if (!loginResponse.ok || loginData?.error || !odooUser?.uid) {
      throw new Error(
        loginData?.error?.data?.message ||
        loginData?.error?.message ||
        error?.message ||
        'Invalid login credentials',
      )
    }

    // Request the signed E-learning launch URL. Its redirect returns through
    // the existing /api/sso/exchange initialization path.
    const appLinkResponse = await fetch('https://e-learning.snabbb.com/api/v1/sso/app_link', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          app_code: 'e-learning',
          email: odooUser.username || normalizedEmail,
          name: odooUser.name || odooUser.partner_display_name || normalizedEmail,
          company_id: 2,
          portal: true,
        },
        id: 1,
      }),
    })
    const appLinkData = await appLinkResponse.json().catch(() => null)
    const launchUrl = appLinkData?.result?.url

    if (!appLinkResponse.ok || !launchUrl) {
      throw new Error(
        appLinkData?.error?.data?.message ||
        appLinkData?.error?.message ||
        'Unable to start the E-learning session.',
      )
    }

    window.location.assign(launchUrl)

    // Prevent the login page from navigating locally before the SSO handoff.
    await new Promise<void>(() => undefined)
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
      phone?: string
      position?: string
      company_name?: string
      referral_code?: string
      dob?: string
      country?: string
      agreed_to_terms?: boolean
    }
  ) {
    const name = metadata?.full_name || email.split('@')[0]

    // Step 1: Create user in Odoo via worker
    const odooRes = await fetch(getApiUrl('/api/e-learning/sign-up'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, phone: metadata?.phone, position: metadata?.position, account_type: metadata?.account_type || 'individual', company_name: metadata?.company_name, referral_code: metadata?.referral_code, dob: metadata?.dob, country: metadata?.country }),
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

    // The main Snabbb account owns verification. Supabase is created/synced
    // later by the Odoo login endpoint without sending a second email.
    return { user: null, session: null }
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
