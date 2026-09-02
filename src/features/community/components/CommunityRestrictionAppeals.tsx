import { useQuery } from '@tanstack/react-query'
import { MessageSquareWarning, ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { CommunityAppealDialog } from '@/features/community/components/CommunityAppealDialog'
import { CommunityBackendUnavailableError } from '@/features/community/api/communityContract'

type RestrictionResult = {
  actions: Array<{ id: string; action_type: string; reason: string; created_at: string }>
  comments: Array<{ id: string; body: string; status: string; moderation_note: string | null; created_at: string }>
}

export function CommunityRestrictionAppeals({ userId }: { userId: string }) {
  const query = useQuery<RestrictionResult>({
    queryKey: ['community-own-restrictions', userId],
    queryFn: async () => {
      throw new CommunityBackendUnavailableError('Community restriction appeals')
    },
  })

  if (query.isLoading) return <LoadingSpinner />
  if (query.isError) return <div className="mt-5"><EmptyState icon={<ShieldAlert />} title="Restriction appeals are not available yet" description="This feature needs the Community production access package before it can safely read moderation records." /></div>
  if (!query.data || (!query.data.actions.length && !query.data.comments.length)) return <div className="mt-5"><EmptyState icon={<ShieldAlert />} title="No restrictions or moderated comments" description="Account restrictions and comments removed by Community safety rules will appear here." /></div>

  return <div className="mt-5 space-y-6">
    {query.data.comments.length > 0 && <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareWarning className="size-4" />Moderated comments</h3>
      <div className="mt-3 space-y-3">{query.data.comments.map(comment => <article key={comment.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1"><p className="line-clamp-3 text-sm leading-6">{comment.body}</p><p className="mt-2 text-xs capitalize text-muted-foreground">{comment.status} · {new Date(comment.created_at).toLocaleString()}</p>{comment.moderation_note && <p className="mt-2 rounded-lg bg-muted p-2 text-xs text-muted-foreground">Reason: {comment.moderation_note}</p>}</div>
        <CommunityAppealDialog userId={userId} commentId={comment.id} targetLabel={comment.body.slice(0, 80)} />
      </article>)}</div>
    </section>}
    {query.data.actions.length > 0 && <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="size-4" />Account restrictions</h3>
      <div className="mt-3 space-y-3">{query.data.actions.map(action => <article key={action.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><p className="font-medium capitalize">{action.action_type.replaceAll('_', ' ')}</p><p className="mt-1 text-sm text-muted-foreground">{action.reason}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(action.created_at).toLocaleString()}</p></div><CommunityAppealDialog userId={userId} moderationActionId={action.id} targetLabel={action.action_type.replaceAll('_', ' ')} /></article>)}</div>
    </section>}
  </div>
}
