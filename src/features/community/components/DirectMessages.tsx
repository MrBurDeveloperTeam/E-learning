import { useEffect, useState } from 'react'
import { Loader2, MessageCircleMore, Pencil, Search, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useCommunityMessageActions, useCommunityPeopleSearch, useDirectConversations, useDirectMessages, useOpenDirectConversation, useSendDirectMessage } from '@/features/community/hooks/useCommunity'
import { cn } from '@/lib/utils'
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DirectMessage } from '@/features/community/types'

export function DirectMessages({ userId }: { userId: string }) {
  const conversations = useDirectConversations(userId)
  const [selectedId, setSelectedId] = useState<string>()
  const [body, setBody] = useState('')
  const [friendId,setFriendId]=useState('')
  const [peopleSearch,setPeopleSearch]=useState('')
  const [editingMessage,setEditingMessage]=useState<DirectMessage|null>(null),[editBody,setEditBody]=useState('')
  const [sendError,setSendError]=useState('')
  const [failedNonce,setFailedNonce]=useState<string|null>(null)
  const [online,setOnline]=useState(()=>navigator.onLine)
  const people=useCommunityPeopleSearch(userId,peopleSearch)
  const openConversation=useOpenDirectConversation(userId)

  useEffect(() => {
    if (!selectedId && conversations.data?.[0]) setSelectedId(conversations.data[0].id)
  }, [conversations.data, selectedId])

  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])

  const selected = conversations.data?.find((conversation) => conversation.id === selectedId)
  const messages = useDirectMessages(selectedId)
  const send = useSendDirectMessage(userId, selectedId)
  const messageActions=useCommunityMessageActions(selectedId)

  async function startConversation(){if(!friendId)return;try{const id=await openConversation.mutateAsync(friendId);setSelectedId(id);setFriendId('')}catch(error){toast.error(error instanceof Error?error.message:'Conversation could not be started.')}}

  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    if (!body.trim() || !selectedId) return
    const clientNonce=failedNonce??crypto.randomUUID()
    setSendError('')
    try {
      await send.mutateAsync({body,clientNonce})
      setBody('')
      setFailedNonce(null)
    } catch (error) {
      setFailedNonce(clientNonce)
      setSendError(!navigator.onLine?'You appear to be offline. Reconnect, then retry this message.':error instanceof Error?error.message:'Message could not be confirmed. Retry uses the same message ID to prevent duplicates.')
    }
  }

  if (conversations.isLoading) return <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  if (!conversations.data?.length) {
    return <div className="mt-4 rounded-2xl border border-border bg-card p-5"><EmptyState icon={<MessageCircleMore />} title="No conversations yet" description="Search for any Community member to start a private conversation." /><div className="mx-auto max-w-md space-y-2"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={peopleSearch} onChange={event=>setPeopleSearch(event.target.value)} placeholder="Search members…" className="pl-9"/></div><div className="flex gap-2"><Select value={friendId} onValueChange={value=>setFriendId(value??'')}><SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="Choose a member…" /></SelectTrigger><SelectContent>{people.data?.map(person=><SelectItem key={person.user_id} value={person.user_id}>{person.full_name||person.name||person.username||'Community member'}</SelectItem>)}</SelectContent></Select><Button disabled={!friendId||openConversation.isPending} onClick={()=>void startConversation()}>Start chat</Button></div></div></div>
  }

  return (
    <div className="mt-4 grid min-h-[520px] overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="border-b border-border md:border-b-0 md:border-r">
        <p className="px-4 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Conversations</p><div className="space-y-1 px-2 pb-2"><Input value={peopleSearch} onChange={event=>setPeopleSearch(event.target.value)} placeholder="Find a member…" className="h-9 text-xs"/><div className="flex gap-1"><Select value={friendId} onValueChange={value=>setFriendId(value??'')}><SelectTrigger className="min-w-0 flex-1 text-xs" aria-label="Choose a member"><SelectValue placeholder="New chat…" /></SelectTrigger><SelectContent>{people.data?.map(person=><SelectItem key={person.user_id} value={person.user_id}>{person.full_name||person.name||person.username||'Community member'}</SelectItem>)}</SelectContent></Select><Button size="sm" disabled={!friendId||openConversation.isPending} onClick={()=>void startConversation()}>Start</Button></div></div>
        <div className="flex gap-2 overflow-x-auto p-2 md:block md:space-y-1 md:overflow-visible">
          {conversations.data.map((conversation) => {
            const name = conversation.other_user.full_name || conversation.other_user.name || 'Friend'
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={cn(
                  'flex min-w-52 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors md:min-w-0 md:w-full',
                  selectedId === conversation.id ? 'bg-primary/12' : 'hover:bg-muted',
                )}
              >
                <UserAvatar name={name} avatarUrl={conversation.other_user.avatar_url} size={36} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground">Direct message</p></div>{conversation.unread_count>0&&<span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{conversation.unread_count}</span>}
              </button>
            )
          })}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <UserAvatar name={selected?.other_user.full_name || selected?.other_user.name} avatarUrl={selected?.other_user.avatar_url} size={34} />
          <div><p className="text-sm font-semibold">{selected?.other_user.full_name || selected?.other_user.name}</p><p className="text-xs text-muted-foreground">Private conversation</p></div>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {messages.isLoading ? <div className="flex h-full items-center justify-center"><LoadingSpinner /></div> : messages.data?.map((message) => (
            <div key={message.id} className={cn('flex', message.sender_id === userId ? 'justify-end' : 'justify-start')}>
              <div className={cn('group max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-6', message.sender_id === userId ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary text-secondary-foreground')}>
                {message.body}{message.edited_at&&<span className="ml-2 text-[10px] opacity-70">edited</span>}{message.sender_id===userId&&<span className="ml-2 inline-flex gap-1"><button type="button" aria-label="Edit message" onClick={()=>{setEditingMessage(message);setEditBody(message.body)}}><Pencil className="size-3"/></button><button type="button" aria-label="Delete message" onClick={()=>void messageActions.mutateAsync({id:message.id,action:'delete'})}><Trash2 className="size-3"/></button></span>}
              </div>
            </div>
          ))}
        </div>
        {!online&&<div className="border-t border-warning/30 bg-warning/10 px-4 py-2 text-xs text-foreground" role="status">You are offline. Messages stay in the composer until you reconnect.</div>}
        {sendError&&<div className="flex items-center gap-3 border-t border-destructive/25 bg-destructive/5 px-4 py-2 text-xs text-destructive" role="alert"><span className="min-w-0 flex-1">{sendError}</span><Button type="button" size="sm" variant="outline" disabled={send.isPending||!online} onClick={()=>void submit()}>Retry</Button></div>}
        <form noValidate onSubmit={submit} className="flex gap-2 border-t border-border p-3">
          <label htmlFor="direct-message" className="sr-only">Message</label>
          <input id="direct-message" value={body} maxLength={5000} onChange={(event) => {setBody(event.target.value);setFailedNonce(null);setSendError('')}} placeholder="Write a private message…" className="input-field min-w-0 flex-1" />
          <Button type="submit" size="icon-lg" disabled={!body.trim() || send.isPending || !online} aria-label="Send message">
            {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </section>
      <Dialog open={Boolean(editingMessage)} onOpenChange={open=>{if(!open)setEditingMessage(null)}}><DialogContent><DialogHeader><DialogTitle>Edit message</DialogTitle></DialogHeader><Textarea value={editBody} maxLength={5000} className="min-h-28 resize-none" onChange={event=>setEditBody(event.target.value)}/><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditingMessage(null)}>Cancel</Button><Button disabled={!editBody.trim()||messageActions.isPending} onClick={()=>editingMessage&&void messageActions.mutateAsync({id:editingMessage.id,action:'edit',body:editBody}).then(()=>setEditingMessage(null))}>Save changes</Button></div></DialogContent></Dialog>
    </div>
  )
}
