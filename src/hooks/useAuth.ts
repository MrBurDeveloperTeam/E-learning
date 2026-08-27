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

function isCloudflarePreviewHostname(hostname: string) {
  const hostnameParts = hostname.toLowerCase().split('.')
  return hostnameParts.length > 3 && hostnameParts.slice(-2).join('.') === 'pages.dev'
}

function getAppLinkRedirectUrl(redirectUrl: string) {
  // Preview URLs have an extra deployment/branch label:
  // <preview>.<project>.pages.dev. The production alias is <project>.pages.dev.
  const isCloudflarePreview = isCloudflarePreviewHostname(window.location.hostname)
  if (!isCloudflarePreview) return redirectUrl

  // Odoo's app-link registry points at the production E-learning origin and
  // its /sso/login route. A Pages preview does not have that server route, so
  // send the one-time token to the SPA root where auth initialization exchanges it.
  const url = new URL(redirectUrl)
  const token = url.searchParams.get('token')
  if (!token) return redirectUrl

  const previewUrl = new URL('/', window.location.origin)
  previewUrl.searchParams.set('token', token)
  return previewUrl.toString()
}

async function fetchSsoExchange(token?: string | null) {
  try {
    const exchangePath = token
      ? `/api/sso/exchange?token=${encodeURIComponent(token)}`
      : '/api/sso/exchange'
    // A preview must exchange the token on its own Pages Function. Using the
    // production VITE_API_BASE_URL here would create the session elsewhere.
    const exchangeUrl = isCloudflarePreviewHostname(window.location.hostname)
      ? exchangePath
      : getApiUrl(exchangePath)
    const response = await fetch(exchangeUrl, {
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
            const searchParams = new URLSearchParams(window.location.search)
            const appLinkToken = searchParams.get('token')
            const ssoRes = await fetchSsoExchange(appLinkToken)
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
                } else if (appLinkToken) {
                  // Remove the one-time JWT from browser history/address bar
                  // after it has been exchanged successfully.
                  window.history.replaceState({}, '', '/')
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
    // ── Dev-mode bypass: sign in directly via Supabase on localhost ──
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocal) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      return // no redirect — stay on localhost
    }

    // Match Inventory's production login flow: authenticate the central Odoo
    // account through routes already handled by snabbb-worker, then launch the
    // E-learning app through Odoo's signed app-link redirect.
    const response = await fetch('https://app.snabbb.com/api/web/session/authenticate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: 'aht-systemadmin-mrbur-main-20994444',
          login: email.trim(),
          password,
        },
        id: 1,
      }),
    })

    const data = await response.json().catch(() => null)
    // snabbb-worker wraps Odoo's original response as
    // { ok, sessionInfo, data: { result } }; direct/local Odoo calls return
    // { result }. Accept both shapes so a successful login is not mistaken
    // for invalid credentials.
    const odooUser = data?.data?.result ?? data?.result ?? data?.sessionInfo
    if (!response.ok || data?.error || !odooUser?.uid) {
      throw new Error(
        data?.error?.message ||
        data?.error ||
        data?.data?.error?.message ||
        'Invalid login credentials',
      )
    }

    const appLinkResponse = await fetch('https://e-learning.snabbb.com/api/v1/sso/app_link', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          app_code: 'e-learning',
          email: odooUser.username || odooUser.email || email.trim().toLowerCase(),
          name: odooUser.name || odooUser.partner_display_name || email.split('@')[0],
          company_id: 2,
          portal: true,
        },
        id: 1,
      }),
    })

    const appLinkData = await appLinkResponse.json().catch(() => null)
    const redirectUrl = appLinkData?.result?.url
    if (!appLinkResponse.ok || appLinkData?.error || !redirectUrl) {
      throw new Error(
        appLinkData?.error?.message || appLinkData?.error || 'Unable to open E-learning session.',
      )
    }

    window.location.assign(getAppLinkRedirectUrl(redirectUrl))
    return { redirecting: true as const }
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

    // Registration belongs exclusively to the central Snabbb/Odoo account.
    // Supabase is mapped later by /api/login or the ambient SSO exchange, so
    // it must not send its own confirmation email here.
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

    const odooResult = odooData?.data?.result ?? odooData?.result
    if (odooResult?.ok === false) {
      throw new Error(odooResult?.message || odooResult?.error || 'Failed to create account')
    }

    return { pendingVerification: true, result: odooResult }
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
