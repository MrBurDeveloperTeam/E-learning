import { useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircleMore, Pencil, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useCommunityMessageActions, useCommunityPeopleSearch, useCommunitySettings, useDirectConversations, useDirectMessages, useOpenDirectConversation, useSendDirectMessage } from '@/features/community/hooks/useCommunity'
import { cn } from '@/lib/utils'
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { CommunityPerson, DirectMessage } from '@/features/community/types'

export function DirectMessages({ userId }: { userId: string }) {
  const conversations = useDirectConversations(userId)
  const [selectedId, setSelectedId] = useState<string>()
  const [draftRecipient,setDraftRecipient]=useState<CommunityPerson|null>(null)
  const [body, setBody] = useState('')
  const [peopleSearch,setPeopleSearch]=useState('')
  const [editingMessage,setEditingMessage]=useState<DirectMessage|null>(null),[editBody,setEditBody]=useState('')
  const [sendError,setSendError]=useState('')
  const [failedNonce,setFailedNonce]=useState<string|null>(null)
  const [online,setOnline]=useState(()=>navigator.onLine)
  const people=useCommunityPeopleSearch(userId,peopleSearch)
  const following=useCommunitySettings(userId,'following')
  const openConversation=useOpenDirectConversation(userId)

  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])

  const selected = conversations.data?.find((conversation) => conversation.id === selectedId)
  const activeRecipient=selected?.other_user??draftRecipient
  const messages = useDirectMessages(selectedId)
  const send = useSendDirectMessage(userId, selectedId)
  const messageActions=useCommunityMessageActions(selectedId)
  const suggestions=useMemo(()=>{
    const conversationRows=conversations.data??[]
    const remaining=Math.max(0,15-conversationRows.length)
    if(!remaining)return [] as CommunityPerson[]
    const existing=new Set(conversationRows.map(conversation=>conversation.other_user.user_id))
    return ([...((following.data??[]) as CommunityPerson[])]).filter(person=>!existing.has(person.user_id)).sort(()=>Math.random()-.5).slice(0,remaining)
  },[conversations.data,following.data])

  function startConversation(person:CommunityPerson){
    const existing=conversations.data?.find(conversation=>conversation.other_user.user_id===person.user_id)
    setSelectedId(existing?.id)
    setDraftRecipient(existing?null:person)
    setPeopleSearch('')
    setSendError('')
    setFailedNonce(null)
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    if (!body.trim() || (!selectedId&&!draftRecipient)) return
    const clientNonce=failedNonce??crypto.randomUUID()
    setSendError('')
    try {
      let conversationId=selectedId
      if(!conversationId&&draftRecipient){
        conversationId=await openConversation.mutateAsync(draftRecipient.user_id)
        setSelectedId(conversationId)
        setDraftRecipient(null)
      }
      await send.mutateAsync({body,clientNonce,conversationId})
      setBody('')
      setFailedNonce(null)
    } catch (error) {
      setFailedNonce(clientNonce)
      setSendError(!navigator.onLine?'You appear to be offline. Reconnect, then retry this message.':error instanceof Error?error.message:'Message could not be confirmed. Retry uses the same message ID to prevent duplicates.')
    }
  }

  if (conversations.isLoading) return <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  return (
    <div className="mt-4 grid h-[calc(100%-1rem)] min-h-0 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border md:border-b-0 md:border-r">
            <p className="px-4 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Conversations</p><div className="space-y-1 px-2 pb-2"><Input value={peopleSearch} onChange={event=>setPeopleSearch(event.target.value)} placeholder="Find a member…" className="h-9 text-xs"/>{peopleSearch.trim()&&<div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card">{people.data?.map(person=><button type="button" key={person.user_id} onClick={()=>startConversation(person)} className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-muted"><UserAvatar name={person.full_name||person.name||'Community member'} avatarUrl={person.avatar_url} size={30}/><span className="truncate text-xs font-medium">{person.full_name||person.name||person.username||'Community member'}</span></button>)}</div>}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
          {(conversations.data??[]).map((conversation) => {
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
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground">Direct message</p></div>{conversation.unread_count>0&&<span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{conversation.unread_count}</span>}
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
          <div><p className="text-sm font-semibold">{activeRecipient.full_name || activeRecipient.name}</p><p className="text-xs text-muted-foreground">{selected?'Private conversation':'New conversation'}</p></div>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
          {!selected?<EmptyState icon={<MessageCircleMore/>} title="Start a conversation" description="Send your first message to begin this conversation."/>:messages.isLoading ? <div className="flex h-full items-center justify-center"><LoadingSpinner /></div> : messages.data?.map((message) => (
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
      </section>:<section className="flex min-h-0 items-center justify-center overflow-hidden"><EmptyState icon={<MessageCircleMore/>} title="Choose someone to chat with" description="Select a conversation or find a member from the list to start chatting."/></section>}
      <Dialog open={Boolean(editingMessage)} onOpenChange={open=>{if(!open)setEditingMessage(null)}}><DialogContent><DialogHeader><DialogTitle>Edit message</DialogTitle></DialogHeader><Textarea value={editBody} maxLength={5000} className="min-h-28 resize-none" onChange={event=>setEditBody(event.target.value)}/><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditingMessage(null)}>Cancel</Button><Button disabled={!editBody.trim()||messageActions.isPending} onClick={()=>editingMessage&&void messageActions.mutateAsync({id:editingMessage.id,action:'edit',body:editBody}).then(()=>setEditingMessage(null))}>Save changes</Button></div></DialogContent></Dialog>
    </div>
  )
}
