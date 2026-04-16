import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-8xl font-medium text-primary/10 mb-4 leading-none select-none">
          404
        </div>
        <h1 className="text-2xl font-medium text-foreground mb-3 font-outfit uppercase tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-[280px] mx-auto">
          The page you are looking for does not exist or has been moved. Head
          back to the home feed to discover dental videos.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            Go back
          </button>
          <Link to="/">
            <button className="btn-primary px-5 py-2.5 text-sm">
              Home feed
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
