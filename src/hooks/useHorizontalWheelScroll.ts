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
    let activePointerId: number | null = null
    let startX = 0
    let startScrollLeft = 0
    let suppressClick = false

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
        return
      }

      isPointerDown = true
      isDragging = false
      activePointerId = event.pointerId
      suppressClick = false
      startX = event.clientX
      startScrollLeft = container.scrollLeft
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown || event.pointerId !== activePointerId) {
        return
      }

      const distance = event.clientX - startX
      if (!isDragging && Math.abs(distance) < 4) {
        return
      }

      // Capturing on pointerdown retargets an ordinary button click to this
      // container. Capture only after a real drag has crossed the threshold.
      if (!isDragging) {
        isDragging = true
        container.setPointerCapture(event.pointerId)
      }
      event.preventDefault()
      container.scrollLeft = startScrollLeft - distance
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (!isPointerDown || event.pointerId !== activePointerId) {
        return
      }

      suppressClick = isDragging
      isPointerDown = false
      isDragging = false
      activePointerId = null
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId)
      }
    }

    const handleClick = (event: MouseEvent) => {
      if (!suppressClick || event.detail === 0) {
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
    // A non-drag release can occur outside the container before capture starts.
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    container.addEventListener('click', handleClick, true)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      container.removeEventListener('click', handleClick, true)
    }
  }, [])

  return containerRef
}
