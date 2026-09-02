import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCommunityAppeal } from '@/features/community/api/communityReleaseApi'

export function CommunityAppealDialog({userId,postId,commentId,communityId,moderationActionId,targetLabel}:{userId:string;postId?:string;commentId?:string;communityId?:string;moderationActionId?:string;targetLabel?:string}){
  const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[error,setError]=useState<string|null>(null),client=useQueryClient()
  const create=useMutation({mutationFn:()=>createCommunityAppeal({userId,postId,commentId,communityId,moderationActionId,targetLabel,reason})})
  async function submit(){if(reason.trim().length<20){setError('Explain why this decision should be reviewed in at least 20 characters.');return}setError(null);try{await create.mutateAsync();await client.invalidateQueries({queryKey:['community-appeals',userId]});setOpen(false);setReason('');toast.success('Appeal submitted for admin review.')}catch(cause){setError(cause instanceof Error?cause.message:'Appeal could not be submitted.')}}
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button size="sm" variant="outline"/>}>Appeal</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Request another review</DialogTitle><DialogDescription>Explain what the moderation team should reconsider. Only one pending appeal is allowed for this content.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="community-appeal-reason">Reason</Label><Textarea id="community-appeal-reason" value={reason} maxLength={2000} className="min-h-32 resize-none" aria-invalid={Boolean(error)} aria-describedby={error?'community-appeal-error':undefined} onChange={event=>setReason(event.target.value)}/>{error&&<p id="community-appeal-error" className="text-sm text-destructive">{error}</p>}<p className="text-right text-xs text-muted-foreground">{reason.length}/2,000</p></div><DialogFooter><DialogClose render={<Button variant="outline" disabled={create.isPending}/>}>Cancel</DialogClose><Button disabled={create.isPending} onClick={()=>void submit()}>{create.isPending?'Submitting…':'Submit appeal'}</Button></DialogFooter></DialogContent></Dialog>
}
