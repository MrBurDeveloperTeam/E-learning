import { useEffect, useState } from 'react'
import { Loader2, MessageCircleMore, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useDirectMessages, useOpenCommunityConversation, useSendDirectMessage } from '@/features/community/hooks/useCommunity'
import { cn } from '@/lib/utils'

export function CommunityGroupChatDialog({communityId,userId,name}:{communityId:string;userId:string;name:string}){
  const [open,setOpen]=useState(false)
  const [conversationId,setConversationId]=useState<string>()
  const [body,setBody]=useState('')
  const [failedNonce,setFailedNonce]=useState<string|null>(null)
  const [sendError,setSendError]=useState('')
  const [online,setOnline]=useState(()=>navigator.onLine)
  const openConversation=useOpenCommunityConversation()
  const messages=useDirectMessages(conversationId)
  const send=useSendDirectMessage(userId,conversationId)

  useEffect(()=>{if(open&&!conversationId)void openConversation.mutateAsync(communityId).then(setConversationId).catch(error=>toast.error(error instanceof Error?error.message:'Group chat could not be opened.'))},[communityId,conversationId,open,openConversation])
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])

  async function submit(event?:React.FormEvent){
    event?.preventDefault()
    if(!body.trim()||!conversationId)return
    const clientNonce=failedNonce??crypto.randomUUID()
    setSendError('')
    try{await send.mutateAsync({body,clientNonce});setBody('');setFailedNonce(null)}
    catch(error){setFailedNonce(clientNonce);setSendError(!navigator.onLine?'You appear to be offline. Reconnect, then retry this message.':error instanceof Error?error.message:'Message could not be confirmed. Retry will not create a duplicate.')}
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button size="sm" variant="secondary"/>}><MessageCircleMore/>Group chat</DialogTrigger>
    <DialogContent className="flex h-[70vh] flex-col sm:max-w-2xl">
      <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>Only active community members can read and send these messages.</DialogDescription></DialogHeader>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border p-4">{openConversation.isPending||messages.isLoading?<LoadingSpinner/>:messages.data?.length?messages.data.map(message=><div key={message.id} className={cn('flex',message.sender_id===userId?'justify-end':'justify-start')}><div className={cn('max-w-[80%] rounded-2xl px-4 py-2 text-sm',message.sender_id===userId?'bg-primary text-primary-foreground':'bg-secondary')}>{message.body}</div></div>):<p className="text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</p>}</div>
      {!online&&<p className="rounded-lg bg-warning/10 px-3 py-2 text-xs" role="status">You are offline. Your message remains in the composer.</p>}
      {sendError&&<div className="flex items-center gap-3 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert"><span className="min-w-0 flex-1">{sendError}</span><Button type="button" size="sm" variant="outline" disabled={send.isPending||!online} onClick={()=>void submit()}>Retry</Button></div>}
      <form noValidate onSubmit={submit} className="flex gap-2"><label htmlFor={`community-chat-${communityId}`} className="sr-only">Message the community</label><input id={`community-chat-${communityId}`} className="input-field min-w-0 flex-1" value={body} maxLength={5000} onChange={event=>{setBody(event.target.value);setFailedNonce(null);setSendError('')}} placeholder="Message the community…"/><Button type="submit" size="icon-lg" aria-label="Send message" disabled={!body.trim()||send.isPending||!online}>{send.isPending?<Loader2 className="animate-spin"/>:<Send/>}</Button></form>
    </DialogContent>
  </Dialog>
}
