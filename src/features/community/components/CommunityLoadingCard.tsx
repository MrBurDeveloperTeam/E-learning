import { cn } from '@/lib/utils'
import { ShimmerCard } from '@/components/ui/ShimmerCard'

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
    return <ShimmerCard className={cn('min-h-72', className)} role="status" aria-busy="true" aria-label={label} />
  }
  return (
    <div className={cn('space-y-4', className)} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <ShimmerCard key={index} className="min-h-72" fade={index === count - 1} />
      ))}
    </div>
  )
}
