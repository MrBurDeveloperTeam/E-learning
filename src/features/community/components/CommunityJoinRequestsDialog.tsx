import { useState } from 'react'
import { Check, Loader2, UserRoundCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useCommunityManagement, useDecideCommunityJoinRequest } from '@/features/community/hooks/useCommunity'
import type { CommunitySummary } from '@/features/community/types'

type PendingAction = { id: string; decision: 'approved' | 'rejected' } | null

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'The join request could not be reviewed.'
}

export function CommunityJoinRequestsDialog({ community, userId }: { community: CommunitySummary; userId: string }) {
  const query = useCommunityManagement(community.id)
  const decide = useDecideCommunityJoinRequest(community.id, userId)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const requests = query.data?.requests ?? []
  const displayName = (profile: { full_name: string | null; name: string | null } | null) => profile?.full_name || profile?.name || 'Community member'

  async function review(id: string, decision: 'approved' | 'rejected') {
    setPendingAction({ id, decision })
    try {
      await decide.mutateAsync({ id, decision })
      toast.success(decision === 'approved' ? 'Member approved.' : 'Request rejected.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPendingAction(null)
    }
  }

  return <Dialog>
    <DialogTrigger render={<Button variant="outline" />}>
      <UserRoundCheck />
      Join requests
      {requests.length > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-5 text-destructive-foreground">{requests.length}</span>}
    </DialogTrigger>
    <DialogContent overlayClassName="z-[120]" className="z-[121] max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-xl">
      <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
        <DialogTitle>Join requests</DialogTitle>
        <DialogDescription>Approve or reject requests to join {community.name}.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[min(36rem,calc(100dvh-9rem))] overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        {query.isLoading ? <div className="flex min-h-40 items-center justify-center"><LoadingSpinner /></div> : query.isError ? <div className="space-y-3 text-center"><p className="text-sm text-destructive">Join requests could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div> : requests.length === 0 ? <div className="py-12 text-center"><UserRoundCheck className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No pending requests</p><p className="mt-1 text-sm text-muted-foreground">New private Community requests will appear here.</p></div> : <div className="space-y-3">
          {requests.map(request => {
            const working = pendingAction?.id === request.id
            return <article key={request.id} className="rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <UserAvatar name={displayName(request.profile)} avatarUrl={request.profile?.avatar_url} size={38} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{displayName(request.profile)}</p><p className="text-xs text-muted-foreground">Requested {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(request.created_at))}</p></div>
              </div>
              {request.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm leading-6">{request.message}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" disabled={decide.isPending} onClick={() => void review(request.id, 'rejected')}>{working && pendingAction?.decision === 'rejected' ? <Loader2 className="animate-spin" /> : <X />}Reject</Button>
                <Button disabled={decide.isPending} onClick={() => void review(request.id, 'approved')}>{working && pendingAction?.decision === 'approved' ? <Loader2 className="animate-spin" /> : <Check />}Approve</Button>
              </div>
            </article>
          })}
        </div>}
      </div>
    </DialogContent>
  </Dialog>
}
