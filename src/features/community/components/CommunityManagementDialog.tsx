import { useEffect, useState } from 'react'
import { Check, Loader2, Megaphone, Settings2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { CommunityMemberManager } from '@/features/community/components/CommunityMemberManager'
import { CommunityRuleManager } from '@/features/community/components/CommunityRuleManager'
import { useCommunityManagement, useCommunityOwnerActions, useDecideCommunityJoinRequest } from '@/features/community/hooks/useCommunity'

export function CommunityManagementDialog({ communityId, userId }: { communityId: string; userId: string }) {
  const query = useCommunityManagement(communityId)
  const decide = useDecideCommunityJoinRequest(communityId, userId)
  const ownerActions = useCommunityOwnerActions(communityId)
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => setAnnouncement(query.data?.announcement ?? ''), [query.data?.announcement])
  const name = (profile: { full_name: string | null; name: string | null } | null) => profile?.full_name || profile?.name || 'Community member'

  return <Dialog>
    <DialogTrigger render={<Button size="sm" variant="outline" />}><Settings2 />Manage</DialogTrigger>
    <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Manage community</DialogTitle><DialogDescription>Publish announcements, maintain rules, review requests, and manage active members.</DialogDescription></DialogHeader>
      {query.isLoading ? <LoadingSpinner /> : query.isError ? <p className="text-sm text-destructive">Community management could not be loaded.</p> : <div className="space-y-6">
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4" />Announcement</h3>
          <Textarea value={announcement} maxLength={1000} className="mt-3 min-h-20 resize-none" placeholder="Share an update with community members…" onChange={event => setAnnouncement(event.target.value)} />
          <Button className="mt-2" size="sm" disabled={ownerActions.isPending} onClick={() => void ownerActions.mutateAsync({ action: 'announcement', announcement }).then(() => toast.success('Announcement saved.'))}>Save announcement</Button>
        </section>
        <CommunityRuleManager communityId={communityId} rules={query.data?.rules ?? []} />
        <section>
          <h3 className="text-sm font-semibold">Pending requests ({query.data?.requests.length ?? 0})</h3>
          <div className="mt-3 space-y-2">{query.data?.requests.length ? query.data.requests.map(request => <div key={request.id} className="rounded-xl border p-3">
            <div className="flex items-center gap-3"><UserAvatar name={name(request.profile)} avatarUrl={request.profile?.avatar_url} size={34} /><p className="min-w-0 flex-1 truncate text-sm font-medium">{name(request.profile)}</p><Button size="icon-sm" variant="outline" aria-label="Reject request" disabled={decide.isPending} onClick={() => void decide.mutateAsync({ id: request.id, decision: 'rejected' }).then(() => toast.success('Request rejected.'))}><X /></Button><Button size="icon-sm" aria-label="Approve request" disabled={decide.isPending} onClick={() => void decide.mutateAsync({ id: request.id, decision: 'approved' }).then(() => toast.success('Member approved.'))}>{decide.isPending ? <Loader2 className="animate-spin" /> : <Check />}</Button></div>
            {request.message && <p className="mt-2 text-xs text-muted-foreground">{request.message}</p>}
          </div>) : <p className="text-sm text-muted-foreground">No pending requests.</p>}</div>
        </section>
        <CommunityMemberManager communityId={communityId} members={query.data?.members ?? []} />
      </div>}
    </DialogContent>
  </Dialog>
}
