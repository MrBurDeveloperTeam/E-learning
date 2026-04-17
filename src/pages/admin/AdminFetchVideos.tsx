import { useState, useEffect } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import type { SidebarItem } from '@/components/layout/Sidebar'
import { Loader2, Youtube, Code, CheckCircle, XCircle } from 'lucide-react'

function AdminGuard() {
  return (
    <div className="text-center py-16">
      <p className="text-destructive text-sm font-medium">Admin access required</p>
    </div>
  )
}

export function AdminFetchVideos() {
  const profile = useAuthStore((state) => state.profile)
  const [isFetching, setIsFetching] = useState(false)
  const [result, setResult] = useState<{ fetched: number; inserted: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  useEffect(() => {
    const storedTimestamp = localStorage.getItem('last_fetched_youtube_videos')
    if (storedTimestamp) {
      setLastFetched(new Date(parseInt(storedTimestamp)).toLocaleString())
    }
  }, [])

  if (!isAdminProfile(profile)) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  // We reuse the same admin sidebar items here for consistency, 
  // though in a larger app we'd abstract this array.
  const adminSidebarItems: SidebarItem[] = [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Creator applications', path: '/admin/applications' },
    { label: 'Content review', path: '/admin/content' },
    { label: 'User management', path: '/admin/users' },
    { label: 'Fetch YouTube videos', path: '/admin/fetch-videos' },
    { label: 'Platform settings', path: '/admin/settings', disabled: true },
  ]

  const handleFetchVideos = async () => {
    setIsFetching(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/fetch-dental-videos', {
        method: 'POST',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to fetch videos from the Cloudflare Function API')
      }

      const data = await response.json()
      setResult(data)
      
      const timestamp = Date.now().toString()
      localStorage.setItem('last_fetched_youtube_videos', timestamp)
      setLastFetched(new Date(parseInt(timestamp)).toLocaleString())
      
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred')
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <PageLayout
      showSidebar={true}
      sidebarItems={adminSidebarItems}
      sidebarVariant="admin"
    >
      <PageHeader
        title="Fetch YouTube Videos"
        subtitle="Trigger the backend job to ingest new dental videos from YouTube"
      />

      <div className="max-w-3xl space-y-6">
        <div className="card p-6 border-border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 dark:bg-red-950/30 rounded-xl">
                  <Youtube className="w-6 h-6 text-red-600 dark:text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">YouTube Ingestion Job</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Searches dental-specific keywords and automatically upserts videos into the <code>dental_videos</code> table.
                  </p>
                </div>
              </div>
              
              {lastFetched && (
                <p className="text-xs text-muted-foreground">
                  Last fetched: <span className="font-medium text-foreground">{lastFetched}</span>
                </p>
              )}
            </div>
            
            <button 
              onClick={handleFetchVideos} 
              disabled={isFetching}
              className="btn-primary"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                'Fetch Dental Videos'
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="card p-5 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800 dark:text-red-400">Error fetching videos</h4>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="card border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border bg-green-50 dark:bg-green-950/20 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-green-800 dark:text-green-400">Job completed successfully</h4>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  Summary stats for the fetch operation.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="p-4 text-center">
                <p className="text-2xl font-semibold text-foreground">{result.fetched}</p>
                <p className="text-xs text-muted-foreground mt-1">Videos fetched from YouTube</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-semibold text-green-600 dark:text-green-500">{result.inserted}</p>
                <p className="text-xs text-muted-foreground mt-1">New videos inserted</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-semibold text-foreground">{result.skipped}</p>
                <p className="text-xs text-muted-foreground mt-1">Skipped (duplicates)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
