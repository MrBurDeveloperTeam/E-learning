export function SkeletonCard() {
  return (
    <div className="bg-white border border-teal-100 rounded-xl overflow-hidden">
      <div className="aspect-video bg-neutral-100 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-neutral-100 rounded animate-pulse w-1/3" />
        <div className="h-4 bg-neutral-100 rounded animate-pulse w-full" />
        <div className="h-3 bg-neutral-100 rounded animate-pulse w-2/3" />
        <div className="flex justify-between items-center pt-1">
          <div className="h-3 bg-neutral-100 rounded animate-pulse w-1/4" />
          <div className="h-4 bg-neutral-100 rounded animate-pulse w-1/5" />
        </div>
      </div>
    </div>
  )
}
