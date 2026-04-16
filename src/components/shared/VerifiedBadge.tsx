export function VerifiedBadge({
  className = '',
}: {
  className?: string
}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      className={`inline-block ml-0.5 flex-shrink-0 ${className}`.trim()}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="hsl(var(--primary))" />
      <path
        d="M6 12l4 4 8-8"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
