import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
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
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),[tabindex]:not([tabindex="-1"])'))
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

  const openDestination = () => {
    if (!advertisement.click_url) return
    if (advertisement.open_in_new_tab) {
      const openedWindow = window.open(advertisement.click_url, '_blank', 'noopener,noreferrer')
      if (openedWindow) openedWindow.opener = null
      return
    }
    window.location.assign(advertisement.click_url)
  }

  const handleOverlayKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === dialogRef.current && advertisement.click_url) {
      event.preventDefault()
      openDestination()
    }
  }

  return (
    <div className={`fixed inset-0 z-[1001] flex items-center justify-center overflow-hidden bg-background/70 p-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/55 sm:p-6 ${advertisement.click_url ? 'cursor-pointer' : ''}`} role="dialog" aria-modal="true" aria-labelledby="advertisement-title" onClick={openDestination}>
      <div ref={dialogRef} tabIndex={0} className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card text-foreground shadow-[0_24px_70px_rgba(45,110,106,0.16)] outline-none focus-visible:ring-2 focus-visible:ring-ring" onKeyDown={handleOverlayKeyDown} aria-label={advertisement.click_url ? `Open ${advertisement.advertiser_name} advertisement` : undefined}>
        <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Advertisement</p>
            <h2 id="advertisement-title" className="truncate text-sm font-medium text-foreground">{advertisement.advertiser_name}</h2>
          </div>
          <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Sponsored</div>
        </div>

        <div className="relative min-h-0 flex-1 bg-muted/35">
          {advertisement.media_type === 'video' ? (
            <video className="pointer-events-none max-h-[72dvh] min-h-52 w-full bg-black object-contain" src={advertisement.media_url} aria-label={advertisement.alt_text} autoPlay muted playsInline controls={false} disablePictureInPicture controlsList="nodownload noplaybackrate noremoteplayback" onEnded={onComplete} onError={onComplete} />
          ) : (
            <img className="pointer-events-none max-h-[72dvh] min-h-52 w-full bg-muted/35 object-contain" src={advertisement.media_url} alt={advertisement.alt_text} />
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{advertisement.campaign_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">The learning video will continue after this advertisement.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {advertisement.cta_label && advertisement.click_url && <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-primary px-2.5 text-sm font-medium text-primary-foreground">{advertisement.cta_label}<ExternalLink className="h-4 w-4" /></span>}
            <Button data-ad-skip variant="outline" className="relative z-10 min-w-28 rounded-xl" disabled={!canSkip} onClick={(event) => { event.stopPropagation(); onComplete() }}>
              {canSkip ? 'Skip Ads' : `Skip in ${secondsRemaining}s`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
