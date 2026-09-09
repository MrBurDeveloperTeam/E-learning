import { useEffect, useState } from 'react'

export function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')

  useEffect(() => {
    const update = () => setIsVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return isVisible
}
