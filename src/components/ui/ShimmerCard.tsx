import { cn } from '@/lib/utils'

const FADE_MASK = 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.01) 100%)'

/**
 * Empty, dimmed card with a light band sweeping across it. The shared "still
 * loading" placeholder (used instead of spinners). `fade` fades the card
 * vertically from 100% at the top to 1% at the bottom.
 */
export function ShimmerCard({
  className,
  fade,
  ...rest
}: { className?: string; fade?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn('relative overflow-hidden rounded-2xl border border-border bg-muted/70 shadow-card', className)}
      style={fade ? { WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK } : undefined}
    >
      {/* Light band sweeping across the card so it clearly reads as "loading" */}
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent bg-[length:200%_100%] dark:via-white/10" />
    </div>
  )
}
