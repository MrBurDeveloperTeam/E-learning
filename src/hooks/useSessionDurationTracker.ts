import { useEffect, useRef } from 'react'

/**
 * Tracks how long the user's session in this app lasted and reports it once,
 * as a "session_end" activity, when the session ends — mirroring the
 * inventory app's sendSessionEndRef flow:
 *
 *   - the session starts when a signed-in identity appears
 *   - it ends on `pagehide`, when the tab becomes hidden (`visibilitychange`),
 *     or when the identity goes away (sign-out / expired session)
 *   - the start timestamp is zeroed the moment it is sent, so pagehide +
 *     hidden + sign-out firing together can't double-send
 *   - page-close / tab-hidden sends pass `useBeacon = true` so the caller can
 *     use navigator.sendBeacon (a normal fetch is unreliable during unload)
 *
 * The identity is remembered while signed in and handed back to the callback,
 * so a sign-out (which clears the auth store/user *before* this effect runs)
 * still logs the session against the right person.
 *
 * Like the inventory app, the session timer does NOT restart when the tab
 * becomes visible again — one session_end per sign-in / app load.
 *
 * Callback-based (like usePageDurationTracker): the caller decides how the
 * event is delivered.
 */

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function useSessionDurationTracker<T>(
  identity: T | null,
  onSessionEnd: (details: string, durationSeconds: number, useBeacon: boolean, identity: T) => void
): (useBeacon?: boolean) => void {
  /** Wall-clock timestamp (ms) when the current session started. Null when no session is in progress. */
  const sessionStartRef = useRef<number | null>(null)
  /** Last non-null identity — survives the sign-out that nulls `identity`. */
  const identityRef = useRef<T | null>(identity)
  if (identity != null) identityRef.current = identity
  /** Always the latest callback, so pagehide/visibilitychange listeners never capture a stale closure. */
  const onSessionEndRef = useRef(onSessionEnd)
  onSessionEndRef.current = onSessionEnd

  const endSessionRef = useRef<(useBeacon?: boolean) => void>(() => {})
  endSessionRef.current = (useBeacon = false) => {
    const who = identityRef.current
    if (sessionStartRef.current == null || who == null) return // no session, or already sent
    const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000)
    sessionStartRef.current = null // zero out to prevent double-send
    onSessionEndRef.current(`Session ended after ${formatDuration(durationSeconds)}`, durationSeconds, useBeacon, who)
  }

  const isSignedIn = identity != null
  useEffect(() => {
    if (isSignedIn) {
      if (sessionStartRef.current == null) sessionStartRef.current = Date.now()
    } else {
      // Signed out (or session expired) with a session still open — close it now.
      endSessionRef.current(false)
    }
  }, [isSignedIn])

  useEffect(() => {
    const handlePageHide = () => endSessionRef.current(true)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') endSessionRef.current(true)
    }
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (useBeacon = false) => endSessionRef.current(useBeacon)
}
