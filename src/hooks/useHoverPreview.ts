import { useCallback, useEffect, useRef, useState } from 'react'

const HOVER_DELAY_MS = 500

function canHoverPreview(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return (
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * YouTube-style hover preview: after the pointer rests on an element for a
 * short delay, `active` becomes true; it resets as soon as the pointer leaves.
 * Disabled on touch devices and when the user prefers reduced motion.
 */
export function useHoverPreview(enabled = true, delay = HOVER_DELAY_MS) {
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onMouseEnter = useCallback(() => {
    if (!enabled || !canHoverPreview()) return
    clear()
    timerRef.current = setTimeout(() => setActive(true), delay)
  }, [enabled, delay, clear])

  const onMouseLeave = useCallback(() => {
    clear()
    setActive(false)
  }, [clear])

  useEffect(() => clear, [clear])

  return { active, handlers: { onMouseEnter, onMouseLeave } }
}
