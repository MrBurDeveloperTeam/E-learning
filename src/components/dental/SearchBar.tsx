import { useState, useEffect, useRef, useCallback } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search dental videos…',
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external value changes (e.g. URL param resets)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const debouncedOnChange = useCallback(
    (next: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        onChange(next)
      }, 400)
    },
    [onChange]
  )

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setLocalValue(next)
    debouncedOnChange(next)
  }

  function handleClear() {
    setLocalValue('')
    if (timerRef.current) clearTimeout(timerRef.current)
    onClear()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      handleClear()
    }
  }

  return (
    <div className="relative w-full max-w-md">
      {/* Search icon */}
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>

      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search dental videos"
        className="input-field pl-9 pr-9"
      />

      {/* Clear button — visible only when there is input */}
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
