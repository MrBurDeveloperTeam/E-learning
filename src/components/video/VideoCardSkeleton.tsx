import { Skeleton } from '@/components/ui/skeleton'

export function VideoCardSkeleton({
  size = 'default',
}: {
  size?: 'default' | 'horizontal'
}) {
  if (size === 'horizontal') {
    return (
      <div className="flex gap-3">
        <Skeleton className="h-[94px] w-[168px] rounded-xl" />
        <div className="flex flex-1 flex-col gap-2 py-1">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="mt-1 h-3 w-2/3 rounded-md" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="mt-2.5 flex gap-2.5">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
          <Skeleton className="h-3 w-2/3 rounded-md" />
        </div>
      </div>
    </div>
  )
}
