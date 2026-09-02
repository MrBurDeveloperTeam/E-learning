import { useState } from 'react'
import { Ban, History, MessageSquareOff, PauseCircle, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useApplyCommunityRestriction, useCommunityUserSafety, useRevokeCommunityRestriction, useWarnCommunityUser } from '@/features/community/hooks/useCommunitySafetyAdmin'

export function CommunityUserSafetyDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('Repeated Community guideline violations.')
  const query = useCommunityUserSafety(open ? userId : undefined)
  const applyMutation = useApplyCommunityRestriction(userId)
  const revokeMutation = useRevokeCommunityRestriction(userId)
  const warnMutation = useWarnCommunityUser(userId)

  const apply = async (type: 'comment_mute' | 'community_suspension' | 'permanent_ban', durationHours: number | null) => {
    try { await applyMutation.mutateAsync({ userId, type, durationHours, reason }); toast.success('User restriction applied.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Restriction could not be applied.') }
  }

  const warn = async () => {
    try { await warnMutation.mutateAsync({ userId, reason }); toast.success('Warning recorded in the user safety history.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Warning could not be recorded.') }
  }

  const revoke = async (id: string) => {
    try { await revokeMutation.mutateAsync(id); toast.success('Restriction revoked.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Restriction could not be revoked.') }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button size="sm" variant="outline" />}><History className="size-4" />Safety history</DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{userName}: Community safety</DialogTitle><DialogDescription>Review violations, comment edits, and reversible restrictions before taking action.</DialogDescription></DialogHeader>
      <div className="space-y-5 py-4">
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} className="min-h-20 resize-none" aria-label="Restriction reason" />
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!reason.trim() || warnMutation.isPending} onClick={() => void warn()}><TriangleAlert className="size-4" />Warn</Button><Button variant="outline" disabled={!reason.trim() || applyMutation.isPending} onClick={() => void apply('comment_mute', 24)}><MessageSquareOff className="size-4" />Mute 24h</Button><Button variant="outline" disabled={!reason.trim() || applyMutation.isPending} onClick={() => void apply('community_suspension', 168)}><PauseCircle className="size-4" />Suspend 7 days</Button><Button variant="destructive" disabled={!reason.trim() || applyMutation.isPending} onClick={() => void apply('permanent_ban', null)}><Ban className="size-4" />Permanent ban</Button></div>
        {query.isLoading && <div className="flex min-h-32 items-center justify-center"><LoadingSpinner /></div>}
        {query.data && <>
          <section><h3 className="text-sm font-semibold">Restrictions</h3><div className="mt-2 space-y-2">{query.data.restrictions.length === 0 ? <p className="text-sm text-muted-foreground">No restrictions.</p> : query.data.restrictions.map((item) => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border p-3"><div className="min-w-0 flex-1"><Badge variant={item.revoked_at ? 'secondary' : 'destructive'}>{item.revoked_at ? 'revoked' : item.restriction_type.replaceAll('_', ' ')}</Badge><p className="mt-2 text-sm">{item.reason}</p><p className="mt-1 text-xs text-muted-foreground">{item.expires_at ? `Until ${new Date(item.expires_at).toLocaleString()}` : 'No expiry'}</p></div>{!item.revoked_at && <Button size="sm" variant="outline" disabled={revokeMutation.isPending} onClick={() => void revokeMutation.mutateAsync(item.id)}>Revoke</Button>}</div>)}</div></section>
          <section><h3 className="text-sm font-semibold">Moderation actions</h3><div className="mt-2 space-y-2">{query.data.actions.map((item) => <div key={item.id} className="rounded-xl bg-muted/50 p-3"><p className="text-sm font-medium">{item.action_type.replaceAll('_', ' ')}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()} · {item.reason}</p></div>)}</div></section>
          <section><h3 className="text-sm font-semibold">Comment edit history</h3><div className="mt-2 space-y-2">{query.data.revisions.length === 0 ? <p className="text-sm text-muted-foreground">No recorded edits.</p> : query.data.revisions.map((item) => <div key={item.id} className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()} · previous status {item.previous_status}</p><p className="mt-2 text-sm line-through opacity-60">{item.previous_body}</p><p className="mt-1 text-sm">{item.replacement_body}</p></div>)}</div></section>
        </>}
      </div>
      <DialogFooter><DialogClose render={<Button variant="outline" />}>Close</DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>
}
