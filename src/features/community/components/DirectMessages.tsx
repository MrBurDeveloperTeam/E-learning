import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, MessageCircleMore, MoreHorizontal, Paperclip, Pencil, Reply, Send, SmilePlus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useCommunityMessageActions, useCommunityMessageReaction, useCommunityPeopleSearch, useCommunitySettings, useDeleteDirectConversation, useDirectMessages, useOpenDirectConversation, useSendDirectMessage } from '@/features/community/hooks/useCommunity'
import { cn } from '@/lib/utils'
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { CommunityPerson, DirectConversation, DirectMessage } from '@/features/community/types'

function getMessageError(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Message could not be confirmed. Retry uses the same message ID to prevent duplicates.'
}

export function DirectMessages({ userId, conversations, conversationsLoading = false }: { userId: string; conversations?: DirectConversation[]; conversationsLoading?: boolean }) {
  const [selectedId, setSelectedId] = useState<string>()
  const [draftRecipient,setDraftRecipient]=useState<CommunityPerson|null>(null)
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [peopleSearch,setPeopleSearch]=useState('')
  const [editingMessage,setEditingMessage]=useState<DirectMessage|null>(null),[editBody,setEditBody]=useState('')
  const [withdrawingMessage,setWithdrawingMessage]=useState<DirectMessage|null>(null)
  const [deletingConversation,setDeletingConversation]=useState(false)
  const [replyingTo,setReplyingTo]=useState<DirectMessage|null>(null)
  const [reactingMessageId,setReactingMessageId]=useState<string|null>(null)
  const [sendError,setSendError]=useState('')
  const [failedNonce,setFailedNonce]=useState<string|null>(null)
  const [online,setOnline]=useState(()=>navigator.onLine)
  const messagesEndRef=useRef<HTMLDivElement|null>(null)
  const people=useCommunityPeopleSearch(userId,peopleSearch)
  const following=useCommunitySettings(userId,'following')
  const openConversation=useOpenDirectConversation(userId)

  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])

  const selected = conversations?.find((conversation) => conversation.id === selectedId)
  const activeRecipient=selected?.other_user??draftRecipient
  const messages = useDirectMessages(selectedId, userId)
  const send = useSendDirectMessage(userId, selectedId)
  const messageActions=useCommunityMessageActions(selectedId)
  const reactionAction=useCommunityMessageReaction(selectedId)
  const deleteConversation=useDeleteDirectConversation(userId)
  const displayedMessages = useMemo(() => {
    const rows = messages.data ?? []
    if (!failedNonce || !send.isError || rows.some(message => message.id === failedNonce) || !selectedId) return rows
    const failedBody = send.variables?.body?.trim()
    if (!failedBody) return rows
    return [...rows, { id: failedNonce, conversation_id: selectedId, sender_id: userId, body: failedBody, created_at: new Date().toISOString(), edited_at: null, status: 'sent' as const, reply_to_message_id: send.variables?.replyToMessageId ?? null, reply_to: null, reactions: [], attachments: [], delivery_status: 'failed' as const }]
  }, [failedNonce, messages.data, selectedId, send.isError, send.variables, userId])

  useEffect(() => {
    if (!selectedId || messages.isLoading) return
    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [displayedMessages.length, messages.isLoading, selectedId])

  useEffect(() => {
    if (selected && draftRecipient?.user_id === selected.other_user.user_id) {
      setDraftRecipient(null)
    }
  }, [draftRecipient?.user_id, selected])

  const suggestions=useMemo(()=>{
    const conversationRows=conversations??[]
    const remaining=Math.max(0,15-conversationRows.length)
    if(!remaining)return [] as CommunityPerson[]
    const existing=new Set(conversationRows.map(conversation=>conversation.other_user.user_id))
    return ([...((following.data??[]) as CommunityPerson[])]).filter(person=>!existing.has(person.user_id)).sort(()=>Math.random()-.5).slice(0,remaining)
  },[conversations,following.data])

  function startConversation(person:CommunityPerson){
    const existing=conversations?.find(conversation=>conversation.other_user.user_id===person.user_id)
    setSelectedId(existing?.id)
    setDraftRecipient(existing?null:person)
    setPeopleSearch('')
    setSendError('')
    setFailedNonce(null)
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    if ((!body.trim() && files.length === 0) || (!selectedId&&!draftRecipient)) return
    const clientNonce=failedNonce??crypto.randomUUID()
    setSendError('')
    try {
      let conversationId=selectedId
      if(!conversationId&&draftRecipient){
        conversationId=await openConversation.mutateAsync(draftRecipient.user_id)
        setSelectedId(conversationId)
      }
      await send.mutateAsync({body,clientNonce,conversationId,replyToMessageId:replyingTo?.id,files})
      setBody('')
      setFiles([])
      setReplyingTo(null)
      setFailedNonce(null)
    } catch (error) {
      setFailedNonce(clientNonce)
      setSendError(!navigator.onLine?'You appear to be offline. Reconnect, then retry this message.':getMessageError(error))
    }
  }

  async function removeMessage(action: 'withdraw' | 'hide') {
    if (!withdrawingMessage) return
    try {
      await messageActions.mutateAsync({ id: withdrawingMessage.id, action })
      setWithdrawingMessage(null)
      toast.success(action === 'withdraw' ? 'Message withdrawn for everyone.' : 'Message deleted for you.')
    } catch (error) {
      toast.error(getMessageError(error))
    }
  }

  async function confirmDeleteConversation() {
    if (!selectedId) return
    try {
      await deleteConversation.mutateAsync(selectedId)
      setSelectedId(undefined)
      setDeletingConversation(false)
      setBody('')
      setFiles([])
      setReplyingTo(null)
      setSendError('')
      setFailedNonce(null)
      toast.success('Conversation deleted for you.')
    } catch (error) {
      toast.error(getMessageError(error))
    }
  }

  if (conversationsLoading) return <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  return (
    <div className="mt-4 grid h-[calc(100%-1rem)] min-h-0 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border md:border-b-0 md:border-r">
            <p className="px-4 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Conversations</p><div className="space-y-1 px-2 pb-2"><Input value={peopleSearch} onChange={event=>setPeopleSearch(event.target.value)} placeholder="Find a member…" className="h-9 text-xs"/>{peopleSearch.trim()&&<div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card">{people.data?.map(person=><button type="button" key={person.user_id} onClick={()=>startConversation(person)} className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-muted"><UserAvatar name={person.full_name||person.name||'Community member'} avatarUrl={person.avatar_url} size={30}/><span className="truncate text-xs font-medium">{person.full_name||person.name||person.username||'Community member'}</span></button>)}</div>}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
          {(conversations??[]).map((conversation) => {
            const name = conversation.other_user.full_name || conversation.other_user.name || 'Friend'
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {setSelectedId(conversation.id);setDraftRecipient(null);setSendError('')}}
                className={cn(
                  'flex min-w-52 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors md:min-w-0 md:w-full',
                  selectedId === conversation.id ? 'bg-primary/12' : 'hover:bg-muted',
                )}
              >
                <UserAvatar name={name} avatarUrl={conversation.other_user.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    {conversation.unread_count > 0 && <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground" aria-label={`${conversation.unread_count} unread messages`}>{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Direct message</p>
                </div>
              </button>
            )
          })}
          {suggestions.map(person=>{
            const name=person.full_name||person.name||'Community member'
            return <button type="button" key={`suggested-${person.user_id}`} onClick={()=>startConversation(person)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted',draftRecipient?.user_id===person.user_id&&'bg-primary/12')}><UserAvatar name={name} avatarUrl={person.avatar_url} size={36}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground">Following · Start a chat</p></div></button>
          })}
        </div>
      </aside>

      {activeRecipient ? <section className="flex min-h-0 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <UserAvatar name={activeRecipient.full_name || activeRecipient.name} avatarUrl={activeRecipient.avatar_url} size={34} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{activeRecipient.full_name || activeRecipient.name}</p><p className="text-xs text-muted-foreground">{selected?'Private conversation':'New conversation'}</p></div>
          {selected&&<DropdownMenu><DropdownMenuTrigger className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Conversation settings"><MoreHorizontal className="size-5"/></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={()=>setDeletingConversation(true)}><Trash2/>Delete conversation</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
          {!selected?<EmptyState icon={<MessageCircleMore/>} title="Start a conversation" description="Send your first message to begin this conversation."/>:messages.isLoading ? <div className="flex h-full items-center justify-center"><LoadingSpinner /></div> : displayedMessages.map((message) => (
            <div id={`message-${message.id}`} key={message.id} className={cn('flex', message.sender_id === userId ? 'justify-end' : 'justify-start')}>
              <div className="max-w-[82%]">
                {message.status!=='deleted'&&reactingMessageId===message.id&&<div className="mb-1 flex gap-1 rounded-full border border-border bg-card p-1 shadow-sm">{['👍','❤️','😂','😮','😢','🎉'].map(emoji=><button key={emoji} type="button" className="rounded-full px-1.5 py-0.5 hover:bg-muted" onClick={()=>{const existing=message.reactions.find(reaction=>reaction.emoji===emoji);void reactionAction.mutateAsync({id:message.id,emoji,reacted:Boolean(existing?.viewer_reacted)}).catch(error=>toast.error(getMessageError(error)));setReactingMessageId(null)}}>{emoji}</button>)}</div>}
                <div className={cn('group rounded-2xl px-4 py-2.5 text-sm leading-6', message.status==='deleted'?'border border-border bg-transparent italic text-muted-foreground':message.sender_id === userId ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary text-secondary-foreground')}>
                  {message.reply_to&&<button type="button" className="mb-2 block w-full rounded-lg border-l-2 border-current bg-black/5 px-2 py-1 text-left text-xs opacity-75" onClick={()=>document.getElementById(`message-${message.reply_to?.id}`)?.scrollIntoView({behavior:'smooth',block:'center'})}>{message.reply_to.status==='deleted'?'This message was withdrawn.':message.reply_to.body.slice(0,120)}</button>}
                  {message.status!=='deleted'&&message.attachments.length>0&&<div className="mb-2 grid gap-2">{message.attachments.map(attachment=>attachment.mime_type.startsWith('image/')?<a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer"><img src={attachment.url} alt={attachment.file_name} className="max-h-64 w-full rounded-xl object-contain"/></a>:attachment.mime_type.startsWith('video/')?<video key={attachment.id} src={attachment.url} controls preload="metadata" className="max-h-72 w-full rounded-xl"/>:<a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" download={attachment.file_name} className="flex items-center gap-2 rounded-lg border border-current/20 px-3 py-2"><FileText className="size-4 shrink-0"/><span className="min-w-0 truncate">{attachment.file_name}</span></a>)}</div>}
                  {message.status==='deleted'?'This message was withdrawn.':message.body}{message.status!=='deleted'&&message.edited_at&&<span className="ml-2 text-[10px] opacity-70">edited</span>}{message.status!=='deleted'&&<span className="ml-2 inline-flex gap-1"><button type="button" aria-label="React to message" onClick={()=>setReactingMessageId(current=>current===message.id?null:message.id)}><SmilePlus className="size-3"/></button><button type="button" aria-label="Reply to message" onClick={()=>{setReplyingTo(message);setReactingMessageId(null)}}><Reply className="size-3"/></button>{message.sender_id===userId&&<button type="button" aria-label="Edit message" onClick={()=>{setEditingMessage(message);setEditBody(message.body)}}><Pencil className="size-3"/></button>}<button type="button" aria-label="Delete message" disabled={messageActions.isPending} onClick={()=>setWithdrawingMessage(message)}><Trash2 className="size-3"/></button></span>}
                </div>
                {message.status!=='deleted'&&message.reactions.length>0&&<div className={cn('mt-1 flex flex-wrap gap-1',message.sender_id===userId&&'justify-end')}>{message.reactions.map(reaction=><button key={reaction.emoji} type="button" className={cn('rounded-full border px-2 py-0.5 text-xs',reaction.viewer_reacted?'border-primary bg-primary/10':'border-border bg-card')} onClick={()=>void reactionAction.mutateAsync({id:message.id,emoji:reaction.emoji,reacted:reaction.viewer_reacted}).catch(error=>toast.error(getMessageError(error)))}>{reaction.emoji} {reaction.count}</button>)}</div>}
                {message.sender_id===userId&&message.status!=='deleted'&&<p className={cn('mt-1 text-right text-[10px]',message.delivery_status==='failed'?'text-destructive':'text-muted-foreground')} aria-live="polite">{message.delivery_status==='sending'?'Sending…':message.delivery_status==='failed'?'Failed to send':message.delivery_status==='read'?'Read':'Unread'}</p>}
              </div>
            </div>
          ))}
          {selected&&<div ref={messagesEndRef} aria-hidden="true"/>}
        </div>
        {!online&&<div className="border-t border-warning/30 bg-warning/10 px-4 py-2 text-xs text-foreground" role="status">You are offline. Messages stay in the composer until you reconnect.</div>}
        {sendError&&<div className="flex items-center gap-3 border-t border-destructive/25 bg-destructive/5 px-4 py-2 text-xs text-destructive" role="alert"><span className="min-w-0 flex-1">{sendError}</span><Button type="button" size="sm" variant="outline" disabled={send.isPending||!online} onClick={()=>void submit()}>Retry</Button></div>}
        <form noValidate onSubmit={submit} className="border-t border-border p-3">
          {replyingTo&&<div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted px-3 py-2 text-xs"><Reply className="size-4 shrink-0"/><div className="min-w-0 flex-1"><p className="font-medium">Replying to a message</p><p className="truncate text-muted-foreground">{replyingTo.body}</p></div><button type="button" aria-label="Cancel reply" onClick={()=>setReplyingTo(null)}><X className="size-4"/></button></div>}
          {files.length>0&&<div className="mb-2 flex flex-wrap gap-2">{files.map((file,index)=><span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-muted px-2 py-1 text-xs"><span className="truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={()=>setFiles(current=>current.filter((_,itemIndex)=>itemIndex!==index))}><X className="size-3"/></button></span>)}</div>}
          <div className="flex gap-2"><label htmlFor="direct-message" className="sr-only">Message</label>
            <input id="direct-message" value={body} maxLength={5000} onChange={(event) => {setBody(event.target.value);setFailedNonce(null);setSendError('')}} placeholder="Write a private message…" className="input-field min-w-0 flex-1" />
            <input id="direct-message-attachments" type="file" multiple className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={event=>{const selected=[...(event.target.files??[])].slice(0,3);if(selected.some(file=>file.size>10*1024*1024)){toast.error('Each attachment must be 10 MB or smaller.');event.target.value='';return}setFiles(selected);setFailedNonce(null);event.target.value=''}}/>
            <Button type="button" size="icon-lg" variant="outline" disabled={send.isPending||!online} aria-label="Attach files" render={<label htmlFor="direct-message-attachments"/>}><Paperclip/></Button>
            <Button type="submit" size="icon-lg" disabled={(!body.trim()&&files.length===0) || send.isPending || !online} aria-label="Send message">
              {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>
        </form>
      </section>:<section className="flex min-h-0 items-center justify-center overflow-hidden"><EmptyState icon={<MessageCircleMore/>} title="Choose someone to chat with" description="Select a conversation or find a member from the list to start chatting."/></section>}
      <Dialog open={Boolean(editingMessage)} onOpenChange={open=>{if(!open)setEditingMessage(null)}}><DialogContent><DialogHeader><DialogTitle>Edit message</DialogTitle></DialogHeader><Textarea value={editBody} maxLength={5000} className="min-h-28 resize-none" onChange={event=>setEditBody(event.target.value)}/><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditingMessage(null)}>Cancel</Button><Button disabled={!editBody.trim()||messageActions.isPending} onClick={()=>editingMessage&&void messageActions.mutateAsync({id:editingMessage.id,action:'edit',body:editBody}).then(()=>setEditingMessage(null))}>Save changes</Button></div></DialogContent></Dialog>
      <Dialog open={Boolean(withdrawingMessage)} onOpenChange={open=>{if(!open&&!messageActions.isPending)setWithdrawingMessage(null)}}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete message?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Choose whether to remove this message only from your view or withdraw it for everyone.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={messageActions.isPending} onClick={()=>setWithdrawingMessage(null)}>Cancel</Button>
            <Button type="button" variant="outline" disabled={messageActions.isPending} onClick={()=>void removeMessage('hide')}>Delete for me</Button>
            {withdrawingMessage?.sender_id===userId&&<Button type="button" variant="destructive" disabled={messageActions.isPending} onClick={()=>void removeMessage('withdraw')}>{messageActions.isPending?<><Loader2 className="animate-spin"/>Updating…</>:'Withdraw for everyone'}</Button>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deletingConversation} onOpenChange={open=>{if(!open&&!deleteConversation.isPending)setDeletingConversation(false)}}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete conversation?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This removes the conversation from your view only. It will not delete the other person's copy. New messages can make the conversation appear again.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={deleteConversation.isPending} onClick={()=>setDeletingConversation(false)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleteConversation.isPending} onClick={()=>void confirmDeleteConversation()}>{deleteConversation.isPending?<><Loader2 className="animate-spin"/>Deleting…</>:'Delete conversation'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
