export function AdminGuard() {
  return (
    <div className="mx-auto max-w-lg rounded-[28px] border border-destructive/15 bg-card/90 p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z" />
          <path d="M9.5 12.5 11 14l3.5-3.5" />
        </svg>
      </div>
      <p className="text-base font-medium text-foreground">Admin access required</p>
      <p className="mt-2 text-sm text-muted-foreground">
        This area is restricted to platform administrators.
      </p>
    </div>
  )
}
