import { cn } from '@/lib/utils'

/**
 * Pulsing loading placeholder for a "Creators to follow" card.
 * Mirrors the real card's layout (avatar, name, specialty, follow button) and
 * its fixed 52px height / 210px min width, so nothing shifts when data arrives.
 * Pulse is disabled for users who prefer reduced motion.
 */
export function CreatorSuggestionSkeleton({
  className,
  delayMs = 0,
}: {
  className?: string
  /** Stagger the pulse so cards ripple instead of blinking in unison. */
  delayMs?: number
}) {
  const bar = 'rounded-full bg-muted motion-reduce:animate-none animate-pulse'
  const style = delayMs ? { animationDelay: `${delayMs}ms` } : undefined

  return (
    <div
      aria-hidden="true"
      data-slot="creator-suggestion-skeleton"
      className={cn(
        'flex h-[52px] w-[210px] flex-shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2',
        className,
      )}
    >
      {/* Avatar */}
      <div className={cn(bar, 'h-8 w-8 shrink-0')} style={style} />
      {/* Name + specialty */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className={cn(bar, 'h-2.5 w-20')} style={style} />
        <div className={cn(bar, 'h-2 w-14 opacity-70')} style={style} />
      </div>
      {/* Follow button */}
      <div className={cn(bar, 'h-7 w-14 shrink-0 rounded-lg')} style={style} />
    </div>
  )
}
