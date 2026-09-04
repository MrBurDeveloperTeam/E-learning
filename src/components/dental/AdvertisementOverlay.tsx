import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Volume2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VideoAdvertisement } from '@/lib/videoAdvertisements'

type AdvertisementOverlayProps = {
  advertisement: VideoAdvertisement
  onComplete: () => void
}

export function AdvertisementOverlay({ advertisement, onComplete }: AdvertisementOverlayProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(Math.max(0, advertisement.skip_after_seconds))
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const canSkip = secondsRemaining === 0

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    if (secondsRemaining <= 0) return
    const timer = window.setTimeout(() => setSecondsRemaining((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsRemaining])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canSkip) onComplete()
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canSkip, onComplete])

  const ctaProps = advertisement.open_in_new_tab
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-[#071313]/90 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-labelledby="advertisement-title">
      <div ref={dialogRef} tabIndex={-1} className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#0d1d1d] text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)] outline-none">
        <div className="flex min-h-12 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ed8d3]">Advertisement</p>
            <h2 id="advertisement-title" className="truncate text-sm font-medium text-white/90">{advertisement.advertiser_name}</h2>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75">Sponsored</div>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          {advertisement.media_type === 'video' ? (
            <video
              className="max-h-[72dvh] min-h-52 w-full bg-black object-contain"
              src={advertisement.media_url}
              aria-label={advertisement.alt_text}
              autoPlay
              muted
              playsInline
              controls
              onEnded={onComplete}
              onError={onComplete}
            />
          ) : (
            <img className="max-h-[72dvh] min-h-52 w-full bg-black object-contain" src={advertisement.media_url} alt={advertisement.alt_text} />
          )}
          {advertisement.media_type === 'video' && (
            <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm">
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> Starts muted
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 bg-[#102525] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{advertisement.campaign_name}</p>
            <p className="mt-0.5 text-xs text-white/55">The learning video will continue after this advertisement.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {advertisement.cta_label && advertisement.click_url && (
              <a href={advertisement.click_url} {...ctaProps} className={cn(buttonVariants(), 'rounded-xl bg-[#88C1BD] text-[#102525] hover:bg-[#a3d4d0]')}>
                {advertisement.cta_label}<ExternalLink className="h-4 w-4" />
              </a>
            )}
            <Button variant="outline" className="min-w-28 rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white" disabled={!canSkip} onClick={onComplete}>
              {canSkip ? 'Skip ad' : `Skip in ${secondsRemaining}s`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
