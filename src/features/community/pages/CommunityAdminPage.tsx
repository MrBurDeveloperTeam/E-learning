import { lazy, Suspense, useMemo, useState } from 'react'
import { Check, Clock3, Flag, GraduationCap, History, MessageSquareText, Paperclip, Pin, Search, UsersRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminFilterTabs, AdminStatCard, AdminStatusBadge, AdminTableShell } from '@/components/admin/AdminPrimitives'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { useCommunityAuditActions, useCommunityPostPin, useCommunityReviewComments, useCommunityReviewGroups, useCommunityReviewPosts, useReviewCommunityComment, useReviewCommunityGroup, useReviewCommunityPost } from '@/features/community/hooks/useCommunityAdmin'
import { useAuthStore } from '@/store/authStore'
import { useCommunityReports, useResolveCommunityReport } from '@/features/community/hooks/useCommunityReports'
import { useReviewVerification, useVerificationQueue } from '@/features/community/hooks/useCommunityVerification'
import { getVerificationEvidenceUrl } from '@/features/community/api/communityVerificationApi'
import { CommunityUserSafetyDialog } from '@/features/community/components/CommunityUserSafetyDialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CommunityReportReason } from '@/features/community/api/communityReportApi'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const CommunityBlockedWordsAdmin = lazy(() => import('@/features/community/components/CommunityBlockedWordsAdmin').then(module => ({ default: module.CommunityBlockedWordsAdmin })))
const CommunityAppealsAdmin = lazy(() => import('@/features/community/components/CommunityAppealsAdmin').then(module => ({ default: module.CommunityAppealsAdmin })))
const CommunityOperationsAdmin = lazy(() => import('@/features/community/components/CommunityOperationsAdmin').then(module => ({ default: module.CommunityOperationsAdmin })))

type ReviewTab = 'posts' | 'comments' | 'communities' | 'reports' | 'verification' | 'audit'
type StatusFilter = 'pending' | 'all'
type ReportSort = 'newest' | 'volume' | 'risk'

function tone(status: string) {
  if (status === 'published' || status === 'active') return 'success' as const
  if (status === 'pending_review') return 'warning' as const
  if (status === 'rejected' || status === 'hidden') return 'danger' as const
  return 'default' as const
}

export function CommunityAdminPage() {
  const adminId = useAuthStore((state) => state.user?.id) ?? ''
  const [tab, setTab] = useState<ReviewTab>('posts')
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [search, setSearch] = useState('')
  const [selectedReports, setSelectedReports] = useState(() => new Set<string>())
  const [reportReason, setReportReason] = useState<'all' | CommunityReportReason>('all')
  const [reportSort, setReportSort] = useState<ReportSort>('newest')
  const [dangerAction,setDangerAction]=useState<{title:string;description:string;label:string;run:()=>Promise<void>}|null>(null)
  const postsQuery = useCommunityReviewPosts()
  const groupsQuery = useCommunityReviewGroups()
  const commentsQuery = useCommunityReviewComments()
  const postMutation = useReviewCommunityPost(adminId)
  const postPinMutation=useCommunityPostPin()
  const groupMutation = useReviewCommunityGroup()
  const commentMutation = useReviewCommunityComment(adminId)
  const reportsQuery = useCommunityReports()
  const reportMutation = useResolveCommunityReport()
  const verificationQuery = useVerificationQueue()
  const auditQuery=useCommunityAuditActions()
  const verificationMutation = useReviewVerification()
  const query = tab === 'posts' ? postsQuery : tab === 'comments' ? commentsQuery : tab === 'communities' ? groupsQuery : tab === 'reports' ? reportsQuery : tab==='verification'?verificationQuery:auditQuery
  const source = tab === 'posts' ? postsQuery.data ?? [] : tab === 'comments' ? commentsQuery.data ?? [] : tab === 'communities' ? groupsQuery.data ?? [] : tab === 'reports' ? reportsQuery.data ?? [] : tab==='verification'?verificationQuery.data ?? []:auditQuery.data??[]
  const rows = useMemo(() => {
    const filtered = filter === 'all' || tab==='audit' ? source : source.filter((row) => {const status=(row as {status:string}).status;return tab === 'reports' ? status === 'open' || status === 'reviewing' : tab === 'comments' ? status === 'hidden' : status === 'pending_review'})
    const needle = search.trim().toLowerCase()
    let result = needle ? filtered.filter((row) => JSON.stringify(row).toLowerCase().includes(needle)) : filtered
    if (tab === 'reports') {
      if (reportReason !== 'all') result = result.filter((row) => reportReason in (row as NonNullable<typeof reportsQuery.data>[number]).reasons)
      if (reportSort !== 'newest') result = [...result].sort((left, right) => {
        const a = left as NonNullable<typeof reportsQuery.data>[number]
        const b = right as NonNullable<typeof reportsQuery.data>[number]
        if (reportSort === 'volume') return b.report_count - a.report_count
        const risk = (row: typeof a) => row.report_count * 2 + (row.reasons.patient_privacy ?? 0) * 3 + (row.reasons.harassment ?? 0) * 2 + (row.reasons.misinformation ?? 0) * 2
        return risk(b) - risk(a)
      })
    }
    return result
  }, [filter, reportReason, reportSort, search, source, tab])
  const visibleOpenReportIds = tab === 'reports' ? rows.flatMap((raw) => {
    const row = raw as NonNullable<typeof reportsQuery.data>[number]
    return row.status === 'open' || row.status === 'reviewing' ? [row.id] : []
  }) : []
  const pendingPosts = (postsQuery.data ?? []).filter((row) => row.status === 'pending_review').length
  const pendingComments = (commentsQuery.data ?? []).filter((row) => row.status === 'hidden').length
  const pendingGroups = (groupsQuery.data ?? []).filter((row) => row.status === 'pending_review').length
  const openReports = (reportsQuery.data ?? []).filter((row) => row.status === 'open' || row.status === 'reviewing').length
  const pendingVerification = (verificationQuery.data ?? []).filter((row) => row.status === 'pending_review').length

  const reviewPost = async (id: string, decision: 'publish' | 'reject' | 'restore') => {
    try { await postMutation.mutateAsync({ id, decision }); toast.success(decision === 'publish' ? 'Post published' : decision === 'restore' ? 'Post restored to review queue' : 'Post rejected') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Review failed') }
  }
  const reviewGroup = async (id: string, decision: 'approve' | 'reject') => {
    try { await groupMutation.mutateAsync({ id, decision }); toast.success(decision === 'approve' ? 'Community approved' : 'Community rejected') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Review failed') }
  }
  const reviewComment = async (id: string, decision: 'publish' | 'reject' | 'hide' | 'restore') => {
    try { await commentMutation.mutateAsync({ id, decision }); toast.success(decision === 'publish' ? 'Comment published' : decision === 'reject' ? 'Comment rejected' : decision === 'restore' ? 'Comment restored' : 'Comment hidden') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Comment review failed') }
  }
  const resolveReport = async (id: string, action: 'dismiss' | 'resolve' | 'hide') => {
    try { await reportMutation.mutateAsync({ id, action }); toast.success(action === 'hide' ? 'Content hidden and report resolved' : action === 'dismiss' ? 'Report dismissed' : 'Report resolved') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Report could not be processed') }
  }
  const resolveSelectedReports = async (action: 'dismiss' | 'hide') => {
    try {
      for (const id of selectedReports) await reportMutation.mutateAsync({ id, action })
      toast.success(`${selectedReports.size} report groups processed.`); setSelectedReports(new Set())
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Batch moderation failed') }
  }
  const reviewVerification = async (id: string, decision: 'approve' | 'reject') => { try { await verificationMutation.mutateAsync({ id, decision }); toast.success(decision === 'approve' ? 'Professional verification approved' : 'Verification application rejected') } catch (error) { toast.error(error instanceof Error ? error.message : 'Verification review failed') } }
  const openEvidence = async (path?: string) => { if (!path) return; try { window.open(await getVerificationEvidenceUrl(path), '_blank', 'noopener,noreferrer') } catch (error) { toast.error(error instanceof Error ? error.message : 'Evidence could not be opened') } }

  return <AdminLayout title="Community review" subtitle="Review member posts and new communities before they become visible in the clinical network.">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminStatCard label="Pending posts" value={pendingPosts} icon={MessageSquareText} accent="warning" />
      <AdminStatCard label="Auto-hidden comments" value={pendingComments} icon={MessageSquareText} accent="warning" />
      <AdminStatCard label="Pending communities" value={pendingGroups} icon={UsersRound} accent="warning" />
      <AdminStatCard label="Open reports" value={openReports} icon={Flag} accent={openReports > 0 ? 'danger' : 'default'} />
    </div>
    <Suspense fallback={<div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div>}><CommunityAppealsAdmin /></Suspense>
    <Suspense fallback={<div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div>}><CommunityOperationsAdmin /></Suspense>
    <AdminTableShell title="Moderation queue" description="Newest submissions appear first." action={<AdminFilterTabs value={tab} onChange={(value) => { setTab(value); setFilter(value==='audit'?'all':'pending') }} options={[{ value: 'posts', label: 'Posts', count: pendingPosts }, { value: 'comments', label: 'Comments', count: pendingComments }, { value: 'communities', label: 'Communities', count: pendingGroups }, { value: 'reports', label: 'Reports', count: openReports }, { value: 'verification', label: 'Verification', count: pendingVerification },{value:'audit',label:'Audit log'}]} />}>
      {tab === 'posts' && (postsQuery.data ?? []).some((post) => post.status === 'deleted') && <div className="border-b border-border bg-muted/30 p-5"><h3 className="text-sm font-semibold">Recently deleted posts</h3><div className="mt-3 space-y-2">{(postsQuery.data ?? []).filter((post) => post.status === 'deleted').map((post) => <div key={post.id} className="flex items-center gap-3 rounded-xl border bg-card p-3"><p className="min-w-0 flex-1 truncate text-sm">{post.author_name}: {post.title || post.body}</p><Button size="sm" disabled={postMutation.isPending} onClick={() => void reviewPost(post.id, 'restore')}><Check className="size-4" />Restore</Button></div>)}</div></div>}
      {tab === 'comments' && <Suspense fallback={<div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div>}><CommunityBlockedWordsAdmin adminId={adminId} /></Suspense>}
      {tab === 'comments' && (commentsQuery.data ?? []).some((comment) => comment.status === 'deleted') && <div className="border-b border-border bg-muted/30 p-5"><h3 className="text-sm font-semibold">Recently deleted comments</h3><div className="mt-3 space-y-2">{(commentsQuery.data ?? []).filter((comment) => comment.status === 'deleted').map((comment) => <div key={comment.id} className="flex items-center gap-3 rounded-xl border bg-card p-3"><p className="min-w-0 flex-1 truncate text-sm">{comment.author_name}: {comment.body}</p><Button size="sm" disabled={commentMutation.isPending} onClick={() => void reviewComment(comment.id, 'restore')}><Check className="size-4" />Restore</Button></div>)}</div></div>}
      <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tab}…`} className="pl-9 pr-9" />{search && <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}><X className="size-4" /></Button>}</div>
        {tab === 'reports' && <><Select value={reportReason} onValueChange={(value) => setReportReason(value as typeof reportReason)}><SelectTrigger className="w-full sm:w-44" aria-label="Filter reports by reason"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All reasons</SelectItem><SelectItem value="patient_privacy">Patient privacy</SelectItem><SelectItem value="misinformation">Misinformation</SelectItem><SelectItem value="harassment">Harassment</SelectItem><SelectItem value="spam">Spam</SelectItem><SelectItem value="copyright">Copyright</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><Select value={reportSort} onValueChange={(value) => setReportSort(value as ReportSort)}><SelectTrigger className="w-full sm:w-40" aria-label="Sort reports"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest</SelectItem><SelectItem value="volume">Most reports</SelectItem><SelectItem value="risk">Highest risk</SelectItem></SelectContent></Select>{visibleOpenReportIds.length > 0 && <Button size="sm" variant="outline" onClick={() => setSelectedReports(selectedReports.size === visibleOpenReportIds.length ? new Set() : new Set(visibleOpenReportIds))}>{selectedReports.size === visibleOpenReportIds.length ? 'Clear selection' : 'Select all'}</Button>}</>}
        {tab === 'reports' && selectedReports.size > 0 && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={reportMutation.isPending} onClick={() => void resolveSelectedReports('dismiss')}>Dismiss {selectedReports.size}</Button><Button size="sm" variant="destructive" disabled={reportMutation.isPending} onClick={() => setDangerAction({title:'Hide reported content?',description:`This will hide content for ${selectedReports.size} selected report groups and resolve those reports.`,label:`Hide ${selectedReports.size} items`,run:()=>resolveSelectedReports('hide')})}>Hide {selectedReports.size}</Button></div>}
      </div>
      {tab!=='audit'&&<div className="border-b border-border px-5 py-3"><AdminFilterTabs value={filter} onChange={setFilter} options={[{ value: 'pending', label: tab === 'reports' ? 'Open reports' : tab === 'comments' ? 'Auto-hidden' : 'Needs review' }, { value: 'all', label: 'All recent' }]} /></div>}
      {query.isLoading && <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>}
      {query.isError && <div className="p-6"><RetryCard onRetry={() => void query.refetch()} /></div>}
      {!query.isLoading && !query.isError && rows.length === 0 && <div className="p-6"><EmptyState icon={<Clock3 />} title="Review queue is clear" description="New submissions will appear here." /></div>}
      {!query.isLoading && !query.isError && rows.length > 0 && <div className="divide-y divide-border">
        {tab === 'posts' ? rows.map((raw) => { const row = raw as NonNullable<typeof postsQuery.data>[number]; return <article key={row.id} className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminStatusBadge label={row.status.replaceAll('_', ' ')} tone={tone(row.status)} dot />{row.is_pinned && <AdminStatusBadge label="Pinned" tone="success" />}<span className="text-xs text-muted-foreground">{row.post_type} · {row.topic.replaceAll('_', ' ')}</span></div><h3 className="mt-3 font-semibold text-foreground">{row.title || 'Untitled post'}</h3><p className="mt-1 text-sm text-muted-foreground">By {row.author_name} · {new Date(row.created_at).toLocaleDateString()}</p>{row.body && <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/80">{row.body}</p>}</div><div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" disabled={postPinMutation.isPending} onClick={() => void postPinMutation.mutateAsync({ id: row.id, enabled: !row.is_pinned }).then(() => toast.success(row.is_pinned ? 'Post unpinned.' : 'Post pinned.')).catch((error) => toast.error(error instanceof Error ? error.message : 'Pin could not be updated.'))}><Pin className="size-4" />{row.is_pinned ? 'Unpin' : 'Pin'}</Button>{row.status === 'pending_review' && <><Button size="sm" variant="outline" disabled={postMutation.isPending} onClick={() => void reviewPost(row.id, 'reject')}><X className="size-4" />Reject</Button><Button size="sm" disabled={postMutation.isPending} onClick={() => void reviewPost(row.id, 'publish')}><Check className="size-4" />Publish</Button></>}</div></div>
        </article> }) : tab === 'comments' ? rows.map((raw) => { const row = raw as NonNullable<typeof commentsQuery.data>[number]; return <article key={row.id} className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminStatusBadge label={row.status.replaceAll('_', ' ')} tone={row.status === 'visible' ? 'success' : row.status === 'pending_review' ? 'warning' : 'danger'} dot /><span className="text-xs text-muted-foreground">Comment</span></div><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-foreground/85">{row.body}</p><p className="mt-2 text-xs text-muted-foreground">By {row.author_name} · {new Date(row.created_at).toLocaleDateString()}</p></div><div className="flex shrink-0 flex-wrap gap-2"><CommunityUserSafetyDialog userId={row.author_id} userName={row.author_name} />{(row.status === 'pending_review' || row.status === 'hidden') && <Button size="sm" disabled={commentMutation.isPending} onClick={() => void reviewComment(row.id, 'publish')}><Check className="size-4" />Publish</Button>}{row.status === 'pending_review' && <Button size="sm" variant="outline" disabled={commentMutation.isPending} onClick={() => void reviewComment(row.id, 'reject')}><X className="size-4" />Reject</Button>}{row.status === 'visible' && <Button size="sm" variant="destructive" disabled={commentMutation.isPending} onClick={() => setDangerAction({title:'Hide this comment?',description:'Members will no longer see this comment. The author can appeal the decision.',label:'Hide comment',run:()=>reviewComment(row.id,'hide')})}><X className="size-4" />Hide</Button>}</div></div>
        </article> }) : tab === 'communities' ? rows.map((raw) => { const row = raw as NonNullable<typeof groupsQuery.data>[number]; return <article key={row.id} className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminStatusBadge label={row.status.replaceAll('_', ' ')} tone={tone(row.status)} dot /><span className="text-xs text-muted-foreground">{row.visibility} community</span></div><h3 className="mt-3 font-semibold text-foreground">{row.name}</h3><p className="mt-1 text-sm text-muted-foreground">Owned by {row.owner_name} · {new Date(row.created_at).toLocaleDateString()}</p>{row.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/80">{row.description}</p>}</div>{row.status === 'pending_review' && <div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" disabled={groupMutation.isPending} onClick={() => void reviewGroup(row.id, 'reject')}><X className="size-4" />Reject</Button><Button size="sm" disabled={groupMutation.isPending} onClick={() => void reviewGroup(row.id, 'approve')}><Check className="size-4" />Approve</Button></div>}</div>
        </article> }) : tab === 'verification' ? rows.map((raw) => { const row = raw as NonNullable<typeof verificationQuery.data>[number]; return <article key={row.id} className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminStatusBadge label={row.status.replaceAll('_', ' ')} tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'} dot /><span className="text-xs text-muted-foreground">{row.country}</span></div><h3 className="mt-3 flex items-center gap-2 font-semibold"><GraduationCap className="size-4 text-primary" />{row.applicant_name}</h3><p className="mt-1 text-sm text-muted-foreground">{row.professional_title} · {row.issuing_body}</p><p className="mt-2 text-sm">License: {row.license_number}</p>{row.evidence_notes && <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/80">{row.evidence_notes}</p>}</div><div className="flex shrink-0 flex-wrap gap-2">{row.evidence_path && <Button size="sm" variant="outline" onClick={() => void openEvidence(row.evidence_path)}><Paperclip className="size-4" />View evidence</Button>}{row.status === 'pending_review' && <><Button size="sm" variant="outline" disabled={verificationMutation.isPending} onClick={() => void reviewVerification(row.id, 'reject')}><X className="size-4" />Reject</Button><Button size="sm" disabled={verificationMutation.isPending} onClick={() => void reviewVerification(row.id, 'approve')}><Check className="size-4" />Approve</Button></>}</div></div>
        </article> }) : tab==='audit'?rows.map(raw=>{const row=raw as NonNullable<typeof auditQuery.data>[number];return <article key={row.id} className="flex gap-4 p-5 sm:p-6"><div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><History className="size-4"/></div><div className="min-w-0"><p className="font-medium">{row.action_type.replaceAll('_',' ')}</p><p className="mt-1 text-sm text-muted-foreground">{row.admin_name} → {row.target_name}</p>{row.reason&&<p className="mt-2 text-sm">{row.reason}</p>}<p className="mt-2 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p></div></article>}):rows.map((raw) => { const row = raw as NonNullable<typeof reportsQuery.data>[number]; return <article key={row.id} className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3">{(row.status === 'open' || row.status === 'reviewing') && <input type="checkbox" className="mt-1 size-4 accent-primary" aria-label={`Select report group for ${row.target_name}`} checked={selectedReports.has(row.id)} onChange={(event) => setSelectedReports((current) => { const next=new Set(current); event.target.checked ? next.add(row.id) : next.delete(row.id); return next })} />}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminStatusBadge label={row.status} tone={row.status === 'open' || row.status === 'reviewing' ? 'warning' : row.status === 'resolved' ? 'success' : 'default'} dot /><AdminStatusBadge label={`${row.report_count} report${row.report_count === 1 ? '' : 's'}`} tone={row.report_count >= 5 ? 'danger' : row.report_count >= 3 ? 'warning' : 'default'} />{row.resolution_action && <AdminStatusBadge label={row.resolution_action === 'content_hidden' ? 'Content hidden' : 'No action taken'} tone={row.resolution_action === 'content_hidden' ? 'danger' : 'default'} />}<span className="text-xs text-muted-foreground">{row.comment_id ? 'Comment report' : row.post_id ? 'Post report' : 'Community report'}</span></div><h3 className="mt-3 font-semibold text-foreground">{row.target_name}</h3><p className="mt-1 text-sm text-muted-foreground">Reasons: {Object.entries(row.reasons).map(([reason,count]) => `${reason.replaceAll('_',' ')} (${count})`).join(', ')}</p><p className="mt-1 text-xs text-muted-foreground">Reported by {row.reporter_names.join(', ')} · {new Date(row.created_at).toLocaleDateString()}</p>{row.details && <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/80">{row.details}</p>}</div></div>{(row.status === 'open' || row.status === 'reviewing') && <div className="flex shrink-0 flex-wrap gap-2">{row.target_user_id && <CommunityUserSafetyDialog userId={row.target_user_id} userName="Reported content owner" />}<Button size="sm" variant="outline" disabled={reportMutation.isPending} onClick={() => void resolveReport(row.id, 'dismiss')}>Dismiss</Button><Button size="sm" variant="outline" disabled={reportMutation.isPending} onClick={() => void resolveReport(row.id, 'resolve')}><Check className="size-4" />Resolve</Button><Button size="sm" variant="destructive" disabled={reportMutation.isPending} onClick={() => void resolveReport(row.id, 'hide')}><X className="size-4" />Hide content</Button></div>}</div>
        </article> })}
      </div>}
    </AdminTableShell>
    <Dialog open={Boolean(dangerAction)} onOpenChange={open=>{if(!open&&!reportMutation.isPending&&!commentMutation.isPending)setDangerAction(null)}}><DialogContent><DialogHeader><DialogTitle>{dangerAction?.title}</DialogTitle><DialogDescription>{dangerAction?.description}</DialogDescription></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline"/>}>Cancel</DialogClose><Button variant="destructive" disabled={reportMutation.isPending||commentMutation.isPending} onClick={()=>dangerAction&&void dangerAction.run().then(()=>setDangerAction(null))}>{dangerAction?.label}</Button></DialogFooter></DialogContent></Dialog>
  </AdminLayout>
}
