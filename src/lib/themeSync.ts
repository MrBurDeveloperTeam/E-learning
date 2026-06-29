/**
 * themeSync.ts — Single source of truth for Snabbb theme sync.
 *
 * Snabbb mini-app strategy:
 * 1. Read the cross-subdomain `snabbb-theme` cookie first.
 * 2. Read the Worker-injected theme: window.__SNABBB_THEME__.
 * 3. Read Snabbb's Zustand localStorage key safely as a read-only fallback.
 * 4. Store this E-learning mini-app's fallback in localStorage['theme'] only.
 * 5. Apply the resolved theme to <html data-theme="..."> and Tailwind's .dark class globally.
 * 6. Sync with Odoo in the background for cross-device persistence.
 */

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const THEME_COOKIE_NAME = 'snabbb-theme'
const LOCAL_THEME_KEY = 'theme' // mini-app safe key — do NOT write to localStorage['snabbb-theme']
const LEGACY_THEME_KEY = 'vite-ui-theme'
const VALID_THEME_VALUES = new Set<ThemePreference>(['light', 'dark', 'system'])
const SYNC_EVENT_NAME = 'snabbb:theme-sync'
const POST_MESSAGE_TYPE = 'SNABBB_THEME_SYNC'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const ODOO_THEME_ENDPOINT = '/api/user/theme'

const APP_SOURCE = 'elearning'

declare global {
  interface Window {
    __SNABBB_THEME__?: string
  }
}

const getCookieDomain = (): string => {
  if (typeof window === 'undefined') return ''
  const { hostname } = window.location

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) return ''
  if (hostname === 'snabbb.com' || hostname.endsWith('.snabbb.com')) return '.snabbb.com'

  return ''
}

export const normalizeTheme = (value: unknown): ThemePreference | null => {
  if (!value) return null

  let raw = String(value).trim()

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') raw = parsed
    else if (parsed?.state?.theme) raw = parsed.state.theme
    else if (parsed?.theme) raw = parsed.theme
  } catch {
    // Raw string — use as-is.
  }

  const normalized = String(raw).trim().toLowerCase() as ThemePreference
  return VALID_THEME_VALUES.has(normalized) ? normalized : null
}

export const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const resolveTheme = (theme: unknown): ResolvedTheme => {
  const normalized = normalizeTheme(theme)
  if (normalized === 'system') return getSystemTheme()
  return normalized === 'dark' ? 'dark' : 'light'
}

export const readThemeCookie = (): ThemePreference | null => {
  if (typeof document === 'undefined') return null

  const match = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${THEME_COOKIE_NAME}=`))

  if (!match) return null
  return normalizeTheme(decodeURIComponent(match.split('=').slice(1).join('=')))
}

export const writeThemeCookie = (theme: unknown): void => {
  if (typeof document === 'undefined') return

  const normalized = normalizeTheme(theme) || 'light'
  const domain = getCookieDomain()
  const domainPart = domain ? `; Domain=${domain}` : ''
  const securePart = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''

  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(normalized)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${domainPart}${securePart}`
}

const safeLocalStorageGet = (key: string): string | null => {
  try {
    return window.localStorage?.getItem(key)
  } catch {
    return null
  }
}

const safeLocalStorageSet = (key: string, value: string): void => {
  try {
    window.localStorage?.setItem(key, value)
  } catch {
    // Private browsing / blocked storage — ignore.
  }
}

export const readStoredTheme = (): ThemePreference | null => {
  if (typeof window === 'undefined') return null

  // The shared cookie is the live cross-subdomain source of truth.
  // It must win over Worker-injected values because injected HTML can be stale.
  const cookieTheme = readThemeCookie()
  if (cookieTheme) return cookieTheme

  const injectedTheme = normalizeTheme(window.__SNABBB_THEME__)
  if (injectedTheme) return injectedTheme

  // Read-only: owned by Snabbb's Zustand store on app.snabbb.com.
  const snabbbTheme = normalizeTheme(safeLocalStorageGet('snabbb-theme'))
  if (snabbbTheme) return snabbbTheme

  const localTheme = normalizeTheme(safeLocalStorageGet(LOCAL_THEME_KEY))
  if (localTheme) return localTheme

  // Backward compatibility for this E-learning app's previous provider key.
  const legacyTheme = normalizeTheme(safeLocalStorageGet(LEGACY_THEME_KEY))
  if (legacyTheme) return legacyTheme

  return null
}

export const writeStoredTheme = (theme: unknown): void => {
  if (typeof window === 'undefined') return

  const normalized = normalizeTheme(theme) || 'light'
  safeLocalStorageSet(LOCAL_THEME_KEY, normalized)
  safeLocalStorageSet(LEGACY_THEME_KEY, normalized)
}

export const persistTheme = (theme: unknown): void => {
  writeThemeCookie(theme)
  writeStoredTheme(theme)
}

export const applyThemeToDocument = (theme: unknown): void => {
  if (typeof document === 'undefined') return

  const normalized = normalizeTheme(theme) || 'light'
  const resolved = resolveTheme(normalized)
  const root = document.documentElement

  root.setAttribute('data-theme', resolved)
  root.dataset.themePreference = normalized
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

export const broadcastTheme = (theme: unknown): void => {
  if (typeof window === 'undefined') return

  const normalized = normalizeTheme(theme) || 'light'
  const payload = {
    type: POST_MESSAGE_TYPE,
    theme: normalized,
    resolvedTheme: resolveTheme(normalized),
    source: APP_SOURCE,
    timestamp: Date.now(),
  }

  window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail: payload }))

  try {
    window.postMessage(payload, window.location.origin)
    if (window.opener && !window.opener.closed) window.opener.postMessage(payload, '*')
    if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*')
  } catch {
    // Ignore postMessage restrictions.
  }
}

let odooSyncInFlight = false

export const syncThemeFromOdoo = async (onThemeChange?: (theme: ThemePreference) => void): Promise<void> => {
  if (odooSyncInFlight) return
  odooSyncInFlight = true

  try {
    const res = await fetch(ODOO_THEME_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) return

    const data = await res.json()
    if (!data?.authenticated && !data?.ok) return

    const odooTheme = normalizeTheme(data.theme)
    if (!odooTheme) return

    const cookieTheme = readThemeCookie()
    // Appointment-style behavior: if a shared cookie already exists, it is the
    // live source of truth. Do not let an older Odoo value overwrite it.
    if (cookieTheme) return

    writeThemeCookie(odooTheme)
    writeStoredTheme(odooTheme)
    onThemeChange?.(odooTheme)
  } catch {
    // Network/Odoo unavailable — cookie/local theme remains active.
  } finally {
    odooSyncInFlight = false
  }
}

export const pushThemeToOdoo = async (theme: unknown): Promise<void> => {
  const normalized = normalizeTheme(theme)
  if (!normalized) return

  try {
    await fetch(ODOO_THEME_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: normalized }),
    })
  } catch {
    // Fire-and-forget: cookie/local storage are still updated.
  }
}

export const THEME_SYNC = {
  appSource: APP_SOURCE,
  cookieName: THEME_COOKIE_NAME,
  eventName: SYNC_EVENT_NAME,
  messageType: POST_MESSAGE_TYPE,
  localStorageKey: LOCAL_THEME_KEY,
  legacyLocalStorageKey: LEGACY_THEME_KEY,
  odooEndpoint: ODOO_THEME_ENDPOINT,
} as const
