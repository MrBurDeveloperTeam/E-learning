export function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="aspect-video bg-muted animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
        <div className="h-4 bg-muted rounded animate-pulse w-full" />
        <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
        <div className="flex justify-between items-center pt-1">
          <div className="h-3 bg-muted rounded animate-pulse w-1/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/5" />
        </div>
      </div>
    </div>
  )
}
