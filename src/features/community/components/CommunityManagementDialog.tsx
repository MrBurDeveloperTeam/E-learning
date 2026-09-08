import { useEffect, useState } from 'react'
import { Check, Info, Loader2, Megaphone, Settings2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { CommunityMemberManager } from '@/features/community/components/CommunityMemberManager'
import { CommunityRuleManager } from '@/features/community/components/CommunityRuleManager'
import { CommunityConfirmAction } from '@/features/community/components/CommunityConfirmAction'
import { useArchiveCommunity, useCommunityManagement, useCommunityOwnerActions, useDecideCommunityJoinRequest } from '@/features/community/hooks/useCommunity'

export function CommunityManagementDialog({ communityId, userId }: { communityId: string; userId: string }) {
  const query = useCommunityManagement(communityId)
  const decide = useDecideCommunityJoinRequest(communityId, userId)
  const ownerActions = useCommunityOwnerActions(communityId)
  const archive = useArchiveCommunity()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => setDescription(query.data?.description ?? ''), [query.data?.description])
  useEffect(() => setAnnouncement(query.data?.announcement ?? ''), [query.data?.announcement])
  const name = (profile: { full_name: string | null; name: string | null } | null) => profile?.full_name || profile?.name || 'Community member'

  return <Dialog open={open} onOpenChange={value => { if (!archive.isPending) setOpen(value) }}>
    <DialogTrigger render={<Button variant="outline" />}><Settings2 />Community settings</DialogTrigger>
    <DialogContent className="h-[calc(100dvh-1rem)] max-h-[52rem] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:h-[calc(100dvh-2rem)] sm:max-w-2xl">
      <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6"><DialogTitle>Manage community</DialogTitle><DialogDescription>Publish announcements, maintain rules, review requests, and manage active members.</DialogDescription></DialogHeader>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
      {query.isLoading ? <div className="flex min-h-40 items-center justify-center"><LoadingSpinner /></div> : query.isError ? <p className="text-sm text-destructive">Community management could not be loaded.</p> : <div className="space-y-6">
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Info className="size-4" />About</h3>
          <Textarea value={description} maxLength={1000} className="mt-3 min-h-24 resize-none" placeholder="Describe the purpose of this community…" onChange={event => setDescription(event.target.value)} />
          <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{description.length}/1,000</span><Button size="sm" disabled={ownerActions.isPending} onClick={() => void ownerActions.mutateAsync({ action: 'about', description }).then(() => toast.success('About updated.')).catch(error => toast.error(error instanceof Error ? error.message : 'About could not be updated.'))}>Save about</Button></div>
        </section>
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4" />Announcement</h3>
          <Textarea value={announcement} maxLength={1000} className="mt-3 min-h-20 resize-none" placeholder="Share an update with community members…" onChange={event => setAnnouncement(event.target.value)} />
          <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{announcement.length}/1,000</span><Button size="sm" disabled={ownerActions.isPending} onClick={() => void ownerActions.mutateAsync({ action: 'announcement', announcement }).then(() => toast.success(announcement.trim() ? 'Announcement saved.' : 'Announcement cleared.')).catch(error => toast.error(error instanceof Error ? error.message : 'Announcement could not be saved.'))}>{announcement.trim() ? 'Save announcement' : 'Clear announcement'}</Button></div>
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
      </div>
      <div className="border-t bg-muted/20 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold">Delete community</p><p className="text-xs leading-5 text-muted-foreground">Preserve its history, but make the entire Community read-only.</p></div>
          <CommunityConfirmAction
            trigger={<Button type="button" variant="destructive" className="w-full sm:w-auto"><Trash2 />Delete community</Button>}
            title="Delete this community?"
            description="Members can still view existing posts and comments, but nobody will be able to post, comment, react, edit, delete, or manage this Community afterward. This cannot be undone."
            label="Delete community"
            danger
            onConfirm={async () => {
              try {
                await archive.mutateAsync(communityId)
                toast.success('Community deleted. Its history is now read-only.')
                setOpen(false)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Community could not be deleted.')
                throw error
              }
            }}
          />
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
