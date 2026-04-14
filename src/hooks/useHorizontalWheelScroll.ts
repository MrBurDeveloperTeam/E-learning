import { useEffect, useRef } from 'react'

export function useHorizontalWheelScroll<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (container.scrollWidth <= container.clientWidth) {
        return
      }

      if (event.deltaY === 0 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return
      }

      event.preventDefault()
      container.scrollLeft += event.deltaY
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return containerRef
}
