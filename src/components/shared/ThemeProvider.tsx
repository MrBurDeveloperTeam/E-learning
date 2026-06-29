import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  applyThemeToDocument,
  broadcastTheme,
  normalizeTheme,
  persistTheme,
  pushThemeToOdoo,
  readThemeCookie,
  readStoredTheme,
  resolveTheme,
  syncThemeFromOdoo,
  THEME_SYNC,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/themeSync"

type Theme = ThemePreference

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey: _storageKey,
  ...props
}: ThemeProviderProps) {
  const getInitialTheme = () => readStoredTheme() || defaultTheme

  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getInitialTheme()))

  const applySyncedTheme = useCallback((nextTheme: ThemePreference, options?: { broadcast?: boolean }) => {
    setThemeState((currentTheme) => (currentTheme === nextTheme ? currentTheme : nextTheme))
    applyThemeToDocument(nextTheme)
    setResolvedTheme(resolveTheme(nextTheme))
    if (options?.broadcast) broadcastTheme(nextTheme)
  }, [])

  useEffect(() => {
    const nextResolvedTheme = resolveTheme(theme)
    applyThemeToDocument(theme)
    setResolvedTheme(nextResolvedTheme)

    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const syncSystemTheme = () => {
      applyThemeToDocument("system")
      setResolvedTheme(resolveTheme("system"))
      broadcastTheme("system")
    }

    mediaQuery.addEventListener("change", syncSystemTheme)
    return () => mediaQuery.removeEventListener("change", syncSystemTheme)
  }, [theme])

  useEffect(() => {
    syncThemeFromOdoo((odooTheme) => {
      applySyncedTheme(odooTheme, { broadcast: true })
    })
  }, [applySyncedTheme])

  useEffect(() => {
    let lastCookie = readThemeCookie()

    const syncFromCookie = () => {
      const nextTheme = readThemeCookie()
      if (!nextTheme) return

      const currentPreference = normalizeTheme(document.documentElement.dataset.themePreference)
      const needsCorrection = currentPreference !== nextTheme

      if (nextTheme !== lastCookie || needsCorrection) {
        lastCookie = nextTheme
        applySyncedTheme(nextTheme)
      }
    }

    // First run corrects stale Worker-injected or local theme immediately.
    syncFromCookie()

    const cookieInterval = window.setInterval(syncFromCookie, 1000)
    const handleFocus = () => syncFromCookie()
    const handleVisibilityChange = () => {
      if (!document.hidden) syncFromCookie()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(cookieInterval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [applySyncedTheme])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !['theme', 'vite-ui-theme', 'snabbb-theme'].includes(event.key)) return
      const nextTheme = normalizeTheme(event.newValue)
      if (!nextTheme) return
      applySyncedTheme(nextTheme)
    }

    const handleThemeSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme?: unknown; source?: string }>
      if (customEvent.detail?.source === THEME_SYNC.appSource) return
      const nextTheme = normalizeTheme(customEvent.detail?.theme)
      if (!nextTheme) return
      applySyncedTheme(nextTheme)
    }

    const handlePostMessage = (event: MessageEvent) => {
      const data = event.data
      if (data?.type !== THEME_SYNC.messageType || data?.source === THEME_SYNC.appSource) return
      const nextTheme = normalizeTheme(data.theme)
      if (!nextTheme) return
      applySyncedTheme(nextTheme)
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(THEME_SYNC.eventName, handleThemeSync)
    window.addEventListener('message', handlePostMessage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(THEME_SYNC.eventName, handleThemeSync)
      window.removeEventListener('message', handlePostMessage)
    }
  }, [applySyncedTheme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (nextTheme: Theme) => {
      const normalizedTheme = normalizeTheme(nextTheme) || defaultTheme
      setThemeState(normalizedTheme)
      persistTheme(normalizedTheme)
      applyThemeToDocument(normalizedTheme)
      setResolvedTheme(resolveTheme(normalizedTheme))
      broadcastTheme(normalizedTheme)
      pushThemeToOdoo(normalizedTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
