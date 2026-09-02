import { CheckCircle2, Clock3, Flag, SearchCheck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { useMyCommunityReports } from '@/features/community/hooks/useCommunityReports'

export function CommunityReportStatus({ userId }: { userId: string }) {
  const query = useMyCommunityReports(userId)
  if (query.isLoading) return <div className="flex min-h-64 items-center justify-center"><LoadingSpinner /></div>
  if (query.isError) return <div className="mt-6"><RetryCard onRetry={() => void query.refetch()} /></div>
  if (!query.data?.length) return <div className="mt-6"><EmptyState icon={<Flag />} title="No reports submitted" description="Reports you send to the admin team will appear here." /></div>
  return <div className="mt-5 space-y-3">{query.data.map((report) => {
    const icon = report.status === 'resolved' ? <CheckCircle2 className="size-4" /> : report.status === 'dismissed' ? <XCircle className="size-4" /> : report.status === 'reviewing' ? <SearchCheck className="size-4" /> : <Clock3 className="size-4" />
    return <article key={report.id} className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2"><Badge variant={report.status === 'resolved' ? 'default' : report.status === 'dismissed' ? 'secondary' : 'outline'}>{icon}{report.status}</Badge><span className="text-xs text-muted-foreground">{report.comment_id ? 'Comment' : report.post_id ? 'Post' : 'Community'} · {report.reason.replaceAll('_', ' ')}</span></div>
      {report.details && <p className="mt-3 text-sm text-foreground/80">{report.details}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Submitted {new Date(report.created_at).toLocaleDateString()}</p>
      {report.status === 'resolved' && <p className="mt-2 text-xs text-muted-foreground">The admin team completed its review. Internal moderation details remain private.</p>}
    </article>
  })}</div>
}
