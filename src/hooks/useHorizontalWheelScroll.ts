import { useEffect, useRef } from 'react'

export function useHorizontalWheelScroll<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    let isPointerDown = false
    let isDragging = false
    let startX = 0
    let startScrollLeft = 0
    let suppressClick = false

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return
      }

      isPointerDown = true
      isDragging = false
      startX = event.clientX
      startScrollLeft = container.scrollLeft
      container.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown) {
        return
      }

      const distance = event.clientX - startX
      if (!isDragging && Math.abs(distance) < 4) {
        return
      }

      isDragging = true
      event.preventDefault()
      container.scrollLeft = startScrollLeft - distance
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (!isPointerDown) {
        return
      }

      suppressClick = isDragging
      isPointerDown = false
      isDragging = false
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId)
      }
    }

    const handleClick = (event: MouseEvent) => {
      if (!suppressClick) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      suppressClick = false
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
    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerup', handlePointerUp)
    container.addEventListener('pointercancel', handlePointerUp)
    container.addEventListener('click', handleClick, true)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerup', handlePointerUp)
      container.removeEventListener('pointercancel', handlePointerUp)
      container.removeEventListener('click', handleClick, true)
    }
  }, [])

  return containerRef
}
