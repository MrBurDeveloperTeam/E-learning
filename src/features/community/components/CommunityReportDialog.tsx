import { useState } from 'react'
import { Flag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateCommunityReport } from '@/features/community/hooks/useCommunityReports'
import type { CommunityReportReason } from '@/features/community/api/communityReportApi'

const reasons: Array<{ value: CommunityReportReason; label: string }> = [
  { value: 'patient_privacy', label: 'Patient privacy concern' },
  { value: 'misinformation', label: 'Clinical misinformation' },
  { value: 'harassment', label: 'Harassment or abusive content' },
  { value: 'spam', label: 'Spam or promotion' },
  { value: 'copyright', label: 'Copyright concern' },
  { value: 'other', label: 'Other' },
]

export function CommunityReportDialog({ userId, postId, communityId, commentId, targetName }: { userId: string; postId?: string; communityId?: string; commentId?: string; targetName: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<CommunityReportReason>('patient_privacy')
  const [details, setDetails] = useState('')
  const mutation = useCreateCommunityReport()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      await mutation.mutateAsync({ reporterId: userId, postId, communityId, commentId, reason, details })
      toast.success('Report sent to the admin team.')
      setOpen(false); setDetails(''); setReason('patient_privacy')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Report could not be sent.') }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Report ${targetName}`} />}><Flag /></DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <form noValidate onSubmit={submit}>
        <DialogHeader><DialogTitle>Report {targetName}</DialogTitle><DialogDescription>Your report is private and will be reviewed by a platform administrator.</DialogDescription></DialogHeader>
        <div className="my-5 space-y-4">
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Reason</legend><div className="grid gap-2 sm:grid-cols-2">{reasons.map((item) => <label key={item.value} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="community-report-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} className="mt-0.5 accent-primary" /><span>{item.label}</span></label>)}</div></fieldset>
          <div className="space-y-2"><Label htmlFor="community-report-details">Additional details</Label><Textarea id="community-report-details" value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} placeholder="Explain what the admin should review…" className="min-h-28 resize-none" /><p className="text-right text-xs text-muted-foreground">{details.length}/1000</p></div>
        </div>
        <DialogFooter><DialogClose render={<Button type="button" variant="outline" disabled={mutation.isPending} />}>Cancel</DialogClose><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Sending…' : 'Send report'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
