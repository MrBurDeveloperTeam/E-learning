import { cn } from '@/lib/utils'

const FADE_MASK = 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.01) 100%)'

function Card({ className, fade, ...rest }: { className?: string; fade?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn('relative min-h-72 overflow-hidden rounded-2xl border border-border bg-muted/70 shadow-card', className)}
      style={fade ? { WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK } : undefined}
    >
      {/* Light band sweeping across the card so it clearly reads as "loading" */}
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent bg-[length:200%_100%] dark:via-white/10" />
    </div>
  )
}

/**
 * Empty, dimmed card(s) with a light band sweeping across, shown in place of a
 * spinner while Community content loads. With `count` > 1 the cards are stacked
 * and the last one fades out vertically (100% -> 1%) to suggest more below.
 */
export function CommunityLoadingCard({
  className,
  label = 'Loading',
  count = 1,
}: {
  className?: string
  label?: string
  count?: number
}) {
  if (count <= 1) {
    return <Card className={className} role="status" aria-busy="true" aria-label={label} />
  }
  return (
    <div className={cn('space-y-4', className)} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} fade={index === count - 1} />
      ))}
    </div>
  )
}
