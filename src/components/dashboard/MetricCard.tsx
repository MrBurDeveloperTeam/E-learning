interface MetricCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
}

export function MetricCard({ label, value, delta, deltaLabel }: MetricCardProps) {
  return (
    <div className="bg-neutral-50 rounded-xl p-4">
      <p className="text-xs text-neutral-400 mb-1">{label}</p>
      <p className="text-2xl font-medium text-neutral-900">{value}</p>
      {delta !== undefined && (
        <p className="text-xs mt-1">
          <span style={{ color: delta >= 0 ? '#059669' : '#DC2626' }}>
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
          {deltaLabel && (
            <span className="text-neutral-400 ml-1">{deltaLabel}</span>
          )}
        </p>
      )}
    </div>
  )
}
