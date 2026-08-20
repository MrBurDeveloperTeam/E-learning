import { useEffect, useRef } from 'react'

/**
 * Tracks how long the user spends on each route/screen of the E-learning
 * app and reports the duration via a callback when the route changes, the
 * tab is hidden, or the page is left. Mirrors the same hook built for the
 * to-do app (src/hooks/usePageDurationTracker.ts in that repo) — same
 * accumulate-while-visible pattern, same minimum-seconds threshold — and
 * is callback-based since this app has no global DataStore singleton to
 * log through directly.
 */

const MIN_LOGGED_SECONDS = 3

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

export type PageViewLogMeta = {
  pagePath: string
  pageDurationSeconds: number
}

export default function usePageDurationTracker(
  pagePath: string | null | undefined,
  pageLabel: string | null | undefined,
  enabled: boolean,
  onLogged: (description: string, meta: PageViewLogMeta) => void
) {
  const activeSinceRef = useRef<number | null>(null)
  const accumulatedRef = useRef(0)
  const pathRef = useRef<string | null>(null)
  const labelRef = useRef<string | null>(null)
  const enabledRef = useRef(enabled)
  const onLoggedRef = useRef(onLogged)

  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { onLoggedRef.current = onLogged }, [onLogged])

  const logDuration = (pathKey: string | null, label: string | null, seconds: number) => {
    if (!enabledRef.current || !pathKey || !label || seconds < MIN_LOGGED_SECONDS) return
    const roundedSeconds = Math.round(seconds)
    onLoggedRef.current?.(`Viewed ${label} page for ${formatDuration(roundedSeconds)}`, {
      pagePath: pathKey,
      pageDurationSeconds: roundedSeconds,
    })
  }

  const pause = () => {
    if (activeSinceRef.current != null) {
      accumulatedRef.current += (Date.now() - activeSinceRef.current) / 1000
      activeSinceRef.current = null
    }
  }

  const resume = () => {
    if (pathRef.current && document.visibilityState === 'visible') {
      activeSinceRef.current = Date.now()
    }
  }

  useEffect(() => {
    pause()
    logDuration(pathRef.current, labelRef.current, accumulatedRef.current)
    accumulatedRef.current = 0
    pathRef.current = pagePath || null
    labelRef.current = pageLabel || null
    resume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePath, pageLabel])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') pause()
      else resume()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const flushOnExit = () => {
      pause()
      logDuration(pathRef.current, labelRef.current, accumulatedRef.current)
      accumulatedRef.current = 0
    }
    window.addEventListener('pagehide', flushOnExit)
    window.addEventListener('beforeunload', flushOnExit)
    return () => {
      window.removeEventListener('pagehide', flushOnExit)
      window.removeEventListener('beforeunload', flushOnExit)
      flushOnExit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
