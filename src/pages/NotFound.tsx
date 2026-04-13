import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7FAFA] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-8xl font-medium text-[#D4E8E7] mb-4 leading-none">
          404
        </div>
        <h1 className="text-2xl font-medium text-[#1E3333] mb-3">
          Page not found
        </h1>
        <p className="text-sm text-[#6B8E8E] mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved. Head
          back to the home feed to discover dental videos.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="btn-outline px-5 py-2.5 text-sm"
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
