import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, CheckCircle2, Circle, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Switch } from '@/components/ui/switch'
import { fetchCommunityAppeals, fetchCommunityNotificationPreferences, fetchFollowedCommunityTopics, saveCommunityNotificationPreferences, setCommunityTopicFollow, withdrawCommunityAppeal } from '@/features/community/api/communityReleaseApi'
import type { CommunityPostTopic } from '@/features/community/types'

const topics: CommunityPostTopic[] = ['general_dentistry','implantology','orthodontics','endodontics','periodontology','oral_surgery','prosthodontics','pediatric_dentistry','digital_dentistry','practice_management']

export function CommunityNotificationSettings({userId}:{userId:string}) {
  const client=useQueryClient(),query=useQuery({queryKey:['community-notification-preferences',userId],queryFn:()=>fetchCommunityNotificationPreferences(userId)})
  const save=useMutation({mutationFn:(values:NonNullable<typeof query.data>)=>saveCommunityNotificationPreferences(userId,values),onSuccess:()=>{client.invalidateQueries({queryKey:['community-notification-preferences',userId]});toast.success('Notification preferences saved.')}})
  if(query.isLoading)return <LoadingSpinner/>;if(!query.data)return null
  const labels={likes:'Likes',replies:'Replies',mentions:'Mentions',follows:'New followers',friend_requests:'Friend requests',community_updates:'Community updates',moderation_updates:'Reports and moderation',direct_messages:'Direct messages'} as const
  return <div className="mt-5 space-y-3">{Object.entries(labels).map(([key,label])=><div key={key} className="flex items-center gap-4 rounded-2xl border bg-card p-4"><BellRing className="size-4 text-primary"/><p className="min-w-0 flex-1 font-medium">{label}</p><Switch checked={query.data[key as keyof typeof query.data]} disabled={save.isPending} onCheckedChange={checked=>void save.mutateAsync({...query.data,[key]:checked})}/></div>)}</div>
}

export function CommunityTopicSettings({userId}:{userId:string}) {
  const client=useQueryClient(),query=useQuery({queryKey:['community-topic-follows',userId],queryFn:()=>fetchFollowedCommunityTopics(userId)})
  const change=useMutation({mutationFn:({topic,active}:{topic:CommunityPostTopic;active:boolean})=>setCommunityTopicFollow(userId,topic,active),onSuccess:()=>client.invalidateQueries({queryKey:['community-topic-follows',userId]})})
  if(query.isLoading)return <LoadingSpinner/>;const followed=new Set(query.data??[])
  return <div className="mt-5 grid gap-3 sm:grid-cols-2">{topics.map(topic=>{const active=followed.has(topic);return <button type="button" key={topic} aria-pressed={active} disabled={change.isPending} onClick={()=>void change.mutateAsync({topic,active:!active})} className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60">{active?<CheckCircle2 className="size-5 text-primary"/>:<Circle className="size-5 text-muted-foreground"/>}<span className="font-medium capitalize">{topic.replaceAll('_',' ')}</span></button>})}</div>
}

export function CommunityAppealHistory({userId}:{userId:string}) {
  const client=useQueryClient(),query=useQuery({queryKey:['community-appeals',userId],queryFn:()=>fetchCommunityAppeals(userId)})
  const withdraw=useMutation({mutationFn:withdrawCommunityAppeal,onSuccess:()=>{client.invalidateQueries({queryKey:['community-appeals',userId]});toast.success('Appeal withdrawn.')}})
  if(query.isLoading)return <LoadingSpinner/>;if(!query.data?.length)return <div className="mt-5"><EmptyState title="No appeals" description="If moderated content needs another review, your appeal and its decision will appear here."/></div>
  return <div className="mt-5 space-y-3">{query.data.map(appeal=><article key={appeal.id} className="rounded-2xl border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><Badge variant={appeal.status==='approved'?'default':'outline'}>{appeal.status}</Badge><p className="mt-3 text-sm leading-6">{appeal.reason}</p><p className="mt-2 text-xs text-muted-foreground">Submitted {new Date(appeal.created_at).toLocaleDateString()}</p>{appeal.decision_note&&<p className="mt-3 rounded-xl bg-muted p-3 text-sm">Admin response: {appeal.decision_note}</p>}</div>{appeal.status==='pending'&&<Button size="sm" variant="outline" disabled={withdraw.isPending} onClick={()=>void withdraw.mutateAsync(appeal.id)}><RotateCcw/>Withdraw</Button>}</div></article>)}</div>
}
