import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, Clock3, Database, Gauge, MessagesSquare, Save, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { AdminStatCard } from '@/components/admin/AdminPrimitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { CommunityConfirmAction } from '@/features/community/components/CommunityConfirmAction'
import { CommunityBackendUnavailableError } from '@/features/community/api/communityContract'

type Rule = { action_type:string;max_events:number;window_seconds:number;retention_days:number;enabled:boolean;updated_at:string }
type Event = { id:number;event_name:string;severity:'info'|'warning'|'error';created_at:string }
type Summary = { rate_events_24h:number;high_volume_accounts:number;open_reports:number;messages_24h:number;warnings_24h:number;stored_rate_events:number;oldest_rate_event:string|null;last_maintenance:string|null;recent_events:Event[] }

function RuleEditor({rule}:{rule:Rule}){
  const client=useQueryClient()
  const [maxEvents,setMaxEvents]=useState(rule.max_events)
  const [windowSeconds,setWindowSeconds]=useState(rule.window_seconds)
  const [retentionDays,setRetentionDays]=useState(rule.retention_days)
  const [enabled,setEnabled]=useState(rule.enabled)
  useEffect(()=>{setMaxEvents(rule.max_events);setWindowSeconds(rule.window_seconds);setRetentionDays(rule.retention_days);setEnabled(rule.enabled)},[rule])
  const save=useMutation({mutationFn:async()=>{throw new CommunityBackendUnavailableError('Community rate-limit administration')},onSuccess:()=>{client.invalidateQueries({queryKey:['admin-community-operations']});toast.success(`${rule.action_type} limit saved.`)}})
  const valid=maxEvents>=1&&maxEvents<=10000&&windowSeconds>=10&&windowSeconds<=86400&&retentionDays>=1&&retentionDays<=365
  return <article className="rounded-xl border bg-background p-4">
    <div className="flex items-center justify-between gap-3"><div><h4 className="font-medium capitalize">{rule.action_type}</h4><p className="text-xs text-muted-foreground">Maximum actions allowed inside the rolling window.</p></div><label className="flex cursor-pointer items-center gap-2 text-xs font-medium"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)} className="size-4 accent-primary"/>Enabled</label></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="space-y-1.5"><Label htmlFor={`${rule.action_type}-max`}>Maximum actions</Label><Input id={`${rule.action_type}-max`} type="number" min={1} max={10000} value={maxEvents} onChange={event=>setMaxEvents(Number(event.target.value))}/></div><div className="space-y-1.5"><Label htmlFor={`${rule.action_type}-window`}>Window (seconds)</Label><Input id={`${rule.action_type}-window`} type="number" min={10} max={86400} value={windowSeconds} onChange={event=>setWindowSeconds(Number(event.target.value))}/></div><div className="space-y-1.5"><Label htmlFor={`${rule.action_type}-retention`}>Keep logs (days)</Label><Input id={`${rule.action_type}-retention`} type="number" min={1} max={365} value={retentionDays} onChange={event=>setRetentionDays(Number(event.target.value))}/></div></div>
    <div className="mt-3 flex justify-end"><Button size="sm" disabled={!valid||save.isPending} onClick={()=>void save.mutateAsync().catch(error=>toast.error(error instanceof Error?error.message:'Limit could not be saved.'))}><Save/>{save.isPending?'Saving…':'Save limit'}</Button></div>
  </article>
}

export function CommunityOperationsAdmin(){
  const client=useQueryClient()
  const query=useQuery<{summary:Summary;rules:Rule[]}>({queryKey:['admin-community-operations'],queryFn:async()=>{throw new CommunityBackendUnavailableError('Community operations administration')}})
  const maintenance=useMutation<{rate_events_deleted:number;operational_events_deleted:number}>({mutationFn:async()=>{throw new CommunityBackendUnavailableError('Community maintenance')},onSuccess:data=>{client.invalidateQueries({queryKey:['admin-community-operations']});toast.success(`Maintenance complete: ${data.rate_events_deleted} rate logs and ${data.operational_events_deleted} operational logs removed.`)}})
  if(query.isLoading)return <div className="flex min-h-32 items-center justify-center"><LoadingSpinner/></div>
  if(query.isError||!query.data)return <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm text-destructive">Operations data could not be loaded.</p><Button className="mt-3" size="sm" variant="outline" onClick={()=>void query.refetch()}>Retry</Button></div>
  const {summary,rules}=query.data
  return <section className="mt-5 space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AdminStatCard label="24h rate events" value={summary.rate_events_24h} icon={Gauge}/><AdminStatCard label="Near-limit accounts" value={summary.high_volume_accounts} icon={AlertTriangle} accent={summary.high_volume_accounts?'warning':'default'}/><AdminStatCard label="Open reports" value={summary.open_reports} icon={Activity} accent={summary.open_reports?'danger':'default'}/><AdminStatCard label="24h messages" value={summary.messages_24h} icon={MessagesSquare}/></div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-2xl border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold"><Clock3 className="size-4 text-primary"/>Rate-limit rules</h3><p className="mt-1 text-xs text-muted-foreground">Changes apply immediately to new Community writes.</p></div></div><div className="mt-4 grid gap-3">{rules.map(rule=><RuleEditor key={rule.action_type} rule={rule}/>)}</div></div>
      <aside className="space-y-4"><div className="rounded-2xl border bg-card p-5"><h3 className="flex items-center gap-2 font-semibold"><Database className="size-4 text-primary"/>Maintenance</h3><dl className="mt-4 space-y-3 text-xs"><div><dt className="text-muted-foreground">Stored rate events</dt><dd className="mt-1 font-medium tabular-nums">{summary.stored_rate_events}</dd></div><div><dt className="text-muted-foreground">Oldest rate event</dt><dd className="mt-1 font-medium">{summary.oldest_rate_event?new Date(summary.oldest_rate_event).toLocaleString():'No stored events'}</dd></div><div><dt className="text-muted-foreground">Last maintenance</dt><dd className="mt-1 font-medium">{summary.last_maintenance?new Date(summary.last_maintenance).toLocaleString():'Not run yet'}</dd></div><div><dt className="text-muted-foreground">Schedule</dt><dd className="mt-1 font-medium">Daily at 03:15 database time</dd></div></dl><CommunityConfirmAction trigger={<Button className="mt-4 w-full" size="sm" variant="outline"><Wrench/>Run maintenance</Button>} title="Run Community maintenance now?" description="Expired rate-limit and operational telemetry records will be permanently removed according to their retention rules." label="Run maintenance" onConfirm={()=>maintenance.mutateAsync()}/></div>
      {summary.warnings_24h>0&&<div className="rounded-2xl border border-warning/30 bg-warning/10 p-4"><p className="text-sm font-medium">{summary.warnings_24h} warning or error events in the last 24 hours</p></div>}</aside>
    </div>
    {summary.recent_events.some(event=>event.severity!=='info')&&<div className="rounded-2xl border bg-card p-4"><h3 className="text-sm font-semibold">Recent warnings and errors</h3><div className="mt-2 space-y-2">{summary.recent_events.filter(event=>event.severity!=='info').slice(0,10).map(event=><div key={event.id} className="flex justify-between gap-3 text-xs"><span>{event.event_name.replaceAll('_',' ')}</span><span className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div>)}</div></div>}
  </section>
}
