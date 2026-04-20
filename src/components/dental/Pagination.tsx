import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Optional ref or selector to scroll to on page change */
  scrollTargetId?: string
}

/**
 * Build an array of page numbers + ellipsis markers to display.
 * Shows at most 5 page pills around the current page.
 */
function getPageNumbers(
  current: number,
  total: number
): (number | 'ellipsis-start' | 'ellipsis-end')[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = []

  // Always show page 1
  pages.push(1)

  if (current > 3) {
    pages.push('ellipsis-start')
  }

  // Middle pages
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push('ellipsis-end')
  }

  // Always show last page
  if (total > 1) {
    pages.push(total)
  }

  return pages
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  scrollTargetId = 'dental-video-grid',
}: PaginationProps) {
  if (totalPages <= 1) return null

  function handlePageChange(page: number) {
    onPageChange(page)

    // Scroll to top of the video grid
    const target = document.getElementById(scrollTargetId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const pages = getPageNumbers(currentPage, totalPages)

  return (
    <nav
      className="flex items-center justify-center gap-1.5 pt-8 pb-4"
      aria-label="Pagination"
    >
      {/* Previous */}
      <button
        type="button"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={cn(
          'px-3 py-1.5 text-sm rounded-lg border transition-all duration-150',
          currentPage <= 1
            ? 'border-border text-muted-foreground/40 cursor-not-allowed'
            : 'border-border text-muted-foreground hover:border-primary hover:text-foreground cursor-pointer'
        )}
        aria-label="Go to previous page"
      >
        Previous
      </button>

      {/* Page pills */}
      {pages.map((page, index) => {
        if (page === 'ellipsis-start' || page === 'ellipsis-end') {
          return (
            <span
              key={page}
              className="px-1.5 text-sm text-muted-foreground select-none"
              aria-hidden="true"
            >
              …
            </span>
          )
        }

        const isActive = page === currentPage
        return (
          <button
            key={`page-${page}`}
            type="button"
            onClick={() => handlePageChange(page)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={`Go to page ${page}`}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer'
            )}
          >
            {page}
          </button>
        )
      })}

      {/* Next */}
      <button
        type="button"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={cn(
          'px-3 py-1.5 text-sm rounded-lg border transition-all duration-150',
          currentPage >= totalPages
            ? 'border-border text-muted-foreground/40 cursor-not-allowed'
            : 'border-border text-muted-foreground hover:border-primary hover:text-foreground cursor-pointer'
        )}
        aria-label="Go to next page"
      >
        Next
      </button>
    </nav>
  )
}
