import { useState } from 'react'
import { UserMinus, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { CommunityConfirmAction } from '@/features/community/components/CommunityConfirmAction'
import { useCommunityOwnerActions, useRemoveCommunityMember } from '@/features/community/hooks/useCommunity'

type Member = {
  id: string
  membership_role: string
  muted_until: string | null
  mute_reason: string | null
  profile: { full_name: string | null; name: string | null; avatar_url: string | null } | null
}

const memberName = (member: Member) => member.profile?.full_name || member.profile?.name || 'Community member'

export function CommunityMemberManager({ communityId, members }: { communityId: string; members: Member[] }) {
  const actions = useCommunityOwnerActions(communityId)
  const remove = useRemoveCommunityMember(communityId)
  const [muteMember, setMuteMember] = useState<Member | null>(null)
  const [duration, setDuration] = useState('24')
  const [reason, setReason] = useState('')

  const applyMute = async () => {
    if (!muteMember) return
    const until = new Date(Date.now() + Number(duration) * 60 * 60 * 1000).toISOString()
    await actions.mutateAsync({ action: 'mute', memberId: muteMember.id, until, reason })
    toast.success(`Member muted for ${duration === '1' ? '1 hour' : duration === '24' ? '24 hours' : '7 days'}.`)
    setMuteMember(null)
    setReason('')
  }

  return <section>
    <h3 className="text-sm font-semibold">Active members ({members.length})</h3>
    <div className="mt-3 space-y-2">
      {members.map(member => {
        const muted = Boolean(member.muted_until && new Date(member.muted_until) > new Date())
        const name = memberName(member)
        return <div key={member.id} className="flex items-center gap-3 rounded-xl border p-3">
          <UserAvatar name={name} avatarUrl={member.profile?.avatar_url} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs capitalize text-muted-foreground">{member.membership_role}{muted ? ` · Muted until ${new Date(member.muted_until!).toLocaleString()}` : ''}</p>
            {muted && member.mute_reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {member.mute_reason}</p>}
          </div>
          {member.membership_role === 'member' && <>
            {muted ? <CommunityConfirmAction trigger={<Button size="icon-sm" variant="ghost" aria-label="Unmute member"><Volume2 /></Button>} title={`Unmute ${name}?`} description="This member can immediately post comments and send messages again." label="Unmute member" onConfirm={() => actions.mutateAsync({ action: 'mute', memberId: member.id, until: null, reason: null }).then(() => toast.success('Member unmuted.'))} /> : <Button size="icon-sm" variant="ghost" aria-label="Mute member" onClick={() => setMuteMember(member)}><VolumeX /></Button>}
            <CommunityConfirmAction trigger={<Button size="icon-sm" variant="ghost" aria-label="Remove member"><UserMinus /></Button>} title={`Remove ${name}?`} description="The member will lose access to private content and Community group chat." label="Remove member" onConfirm={() => remove.mutateAsync(member.id).then(() => toast.success('Member removed.'))} />
          </>}
        </div>
      })}
    </div>
    <Dialog open={Boolean(muteMember)} onOpenChange={open => { if (!open) { setMuteMember(null); setReason('') } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Mute {muteMember ? memberName(muteMember) : 'member'}</DialogTitle><DialogDescription>Choose a duration and record a reason. The member stays in the Community but cannot publish during this period.</DialogDescription></DialogHeader>
        <div className="grid gap-2"><Label>Duration</Label><Select value={duration} onValueChange={value => setDuration(value ?? '24')}><SelectTrigger aria-label="Mute duration"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 hour</SelectItem><SelectItem value="24">24 hours</SelectItem><SelectItem value="168">7 days</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="community-mute-reason">Reason</Label><Textarea id="community-mute-reason" value={reason} maxLength={1000} className="resize-none" placeholder="Explain why this member is being muted…" onChange={event => setReason(event.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMuteMember(null)}>Cancel</Button><Button variant="destructive" disabled={reason.trim().length < 5 || actions.isPending} onClick={() => void applyMute()}>Mute member</Button></div>
      </DialogContent>
    </Dialog>
  </section>
}
