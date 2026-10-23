import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Move, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const OUTPUT_WIDTH = 1600
const OUTPUT_HEIGHT = 400

type Position = { x: number; y: number }
type Size = { width: number; height: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getLayout(image: Size, frame: Size, zoom: number, position: Position) {
  const scale = Math.max(frame.width / image.width, frame.height / image.height) * zoom
  const width = image.width * scale
  const height = image.height * scale
  const panX = (width - frame.width) / 2
  const panY = (height - frame.height) / 2
  return {
    width,
    height,
    left: (frame.width - width) / 2 + position.x * panX,
    top: (frame.height - height) / 2 + position.y * panY,
    panX,
    panY,
  }
}

export function BackgroundCropDialog({
  file,
  isSaving,
  onClose,
  onSave,
}: {
  file: File
  isSaving: boolean
  onClose: () => void
  onSave: (file: File) => Promise<void>
}) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<Size | null>(null)
  const [frameSize, setFrameSize] = useState<Size | null>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isPreparing, setIsPreparing] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; position: Position } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSourceUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(([entry]) => {
      setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const layout = imageSize && frameSize && frameSize.width > 0
    ? getLayout(imageSize, frameSize, zoom, position)
    : null

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!layout || isSaving || isPreparing) return
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !layout) return
    setPosition({
      x: layout.panX > 0 ? clamp(drag.position.x + (event.clientX - drag.x) / layout.panX, -1, 1) : 0,
      y: layout.panY > 0 ? clamp(drag.position.y + (event.clientY - drag.y) / layout.panY, -1, 1) : 0,
    })
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  async function handleSave() {
    const image = imageRef.current
    if (!image || !layout || !frameSize || isSaving || isPreparing) return
    setIsPreparing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_WIDTH
      canvas.height = OUTPUT_HEIGHT
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Image editor is unavailable')
      const outputScale = OUTPUT_WIDTH / frameSize.width
      context.fillStyle = '#f5f8f7'
      context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
      context.drawImage(
        image,
        layout.left * outputScale,
        layout.top * outputScale,
        layout.width * outputScale,
        layout.height * outputScale,
      )
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Could not prepare the background image')
      await onSave(new File([blob], 'background.jpg', { type: 'image/jpeg' }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the background image')
    } finally {
      setIsPreparing(false)
    }
  }

  const busy = isPreparing || isSaving

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[min(94vw,760px)] max-w-none overflow-y-auto p-4 sm:max-w-none sm:p-6" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg">Adjust channel background</DialogTitle>
          <DialogDescription>Drag the image to choose what appears in your banner. Zoom in for a closer crop.</DialogDescription>
        </DialogHeader>

        <div
          ref={frameRef}
          role="img"
          aria-label="Background crop preview"
          className="relative aspect-[4/1] w-full touch-none overflow-hidden rounded-xl border border-border bg-muted select-none cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {sourceUrl && (
            <img
              ref={imageRef}
              src={sourceUrl}
              alt=""
              draggable={false}
              onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => toast.error('This image could not be opened. Try another JPG or PNG.')}
              className="pointer-events-none absolute max-w-none"
              style={layout ? { width: layout.width, height: layout.height, left: layout.left, top: layout.top } : { width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white"><Move size={13} aria-hidden="true" /> Drag to reposition</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Zoom <span className="text-xs font-normal text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <input type="range" min="1" max="3" step="0.05" value={zoom} disabled={busy} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-primary" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Horizontal position
            <input type="range" min="-100" max="100" value={Math.round(position.x * 100)} disabled={busy || !layout || layout.panX < 1} onChange={(event) => setPosition((current) => ({ ...current, x: Number(event.target.value) / 100 }))} className="w-full accent-primary" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
            Vertical position
            <input type="range" min="-100" max="100" value={Math.round(position.y * 100)} disabled={busy || !layout || layout.panY < 1} onChange={(event) => setPosition((current) => ({ ...current, y: Number(event.target.value) / 100 }))} className="w-full accent-primary" />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>The saved image is 1600 × 400 px. The edges may crop slightly on smaller screens.</span>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }) }}><RotateCcw className="size-4" /> Reset</Button>
        </div>
        <DialogFooter className="mt-1">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={busy || !layout} onClick={() => void handleSave()}>{busy ? 'Saving…' : 'Save background'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
