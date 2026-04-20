import { Skeleton } from '@/components/ui/skeleton'

export function DentalVideoCardSkeleton() {
  return (
    <div>
      {/* Thumbnail placeholder */}
      <Skeleton className="aspect-video w-full rounded-xl" />

      {/* Meta placeholders */}
      <div className="mt-2.5 space-y-2">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-4/5 rounded-md" />
        <Skeleton className="h-3 w-1/3 rounded-md" />
      </div>
    </div>
  )
}
