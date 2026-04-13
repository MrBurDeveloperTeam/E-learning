interface RetryCardProps {
  onRetry: () => void
  message?: string
}

export function RetryCard({
  onRetry,
  message = 'Failed to load. Please try again.',
}: RetryCardProps) {
  return (
    <div className="card p-6 text-center">
      <p className="mb-3 text-sm text-[#DC2626]">
        {message}
      </p>
      <button onClick={onRetry} className="btn-outline px-4 py-2 text-sm">
        Try again
      </button>
    </div>
  )
}
