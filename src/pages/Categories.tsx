import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { CATEGORY_SLUGS, VIDEO_CATEGORIES } from '@/types'

export function Categories() {
  useEffect(() => {
    document.title = 'Categories - DentalLearn'
    return () => {
      document.title = 'DentalLearn - Dental Video Community'
    }
  }, [])

  return (
    <>
      <Navbar />

      <div className="border-b border-border bg-primary/5">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
          <p className="mb-1 text-xs text-muted-foreground/60">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link> / Categories
          </p>
          <h1 className="text-2xl font-medium text-foreground">Categories</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Browse the video library by specialty, then open a category page to
            see all published videos in that area.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-6 pb-20 md:px-6 md:py-8 md:pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {VIDEO_CATEGORIES.map((category) => {
            const slug = CATEGORY_SLUGS[category]

            return (
              <Link
                key={category}
                to="/category/$slug"
                params={{ slug }}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-foreground transition-colors group-hover:text-primary">
                      {category}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Browse all published videos in {category.toLowerCase()}.
                    </p>
                  </div>
                  <span className="text-primary transition-transform group-hover:translate-x-0.5">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
