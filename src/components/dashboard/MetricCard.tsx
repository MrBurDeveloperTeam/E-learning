interface MetricCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
}

export function MetricCard({ label, value, delta, deltaLabel }: MetricCardProps) {
  return (
    <div className="bg-muted/40 border border-border/10 rounded-xl p-4">
      <p className="text-xs text-muted-foreground/60 mb-1">{label}</p>
      <p className="text-2xl font-medium text-foreground">{value}</p>
      {delta !== undefined && (
        <p className="text-xs mt-1">
          <span className={delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
          {deltaLabel && (
            <span className="text-muted-foreground/60 ml-1">{deltaLabel}</span>
          )}
        </p>
      )}
    </div>
  )
}
