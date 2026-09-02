import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bookmark, BellRing, FileText, Flag, GraduationCap, Heart, History, Repeat2, RotateCcw, Settings2, Tags, Trash2, UserMinus, UserRoundCheck, UsersRound, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useCommunitySettings, useRemoveCommunitySettingRelation, useRestoreOwnCommunityPost } from '@/features/community/hooks/useCommunity'
import type { CommunityManagedPost, CommunityPerson } from '@/features/community/types'
import type { CommunitySettingsSection } from '@/features/community/api/communityApi'
import { cn } from '@/lib/utils'
import { ProfessionalVerification } from '@/features/community/components/ProfessionalVerification'
import { CommunityReportStatus } from '@/features/community/components/CommunityReportStatus'
import { CommunityBlockedUsers } from '@/features/community/components/CommunityBlockedUsers'
import { CommunityPrivacySettings } from '@/features/community/components/CommunityPrivacySettings'
import { CommunityFriendRequests } from '@/features/community/components/CommunityFriendRequests'
import { CommunityAppealHistory, CommunityNotificationSettings, CommunityTopicSettings } from '@/features/community/components/CommunityReleaseSettings'
import { CommunityAppealDialog } from '@/features/community/components/CommunityAppealDialog'
import { CommunityRestrictionAppeals } from '@/features/community/components/CommunityRestrictionAppeals'

type SettingsView = CommunitySettingsSection | 'verification' | 'reports' | 'blocked' | 'privacy' | 'requests' | 'notifications' | 'topics' | 'appeals' | 'restrictions'
const sections: Array<{ id: SettingsView; label: string; icon: typeof FileText }> = [
  { id: 'history', label: 'Watch history', icon: History },
  { id: 'bookmarks', label: 'Saved', icon: Bookmark },
  { id: 'deleted', label: 'Deleted posts', icon: Trash2 },
  { id: 'requests', label: 'Friend requests', icon: UserRoundCheck },
  { id: 'topics', label: 'Topics', icon: Tags },
  { id: 'notifications', label: 'Notifications', icon: BellRing },
  { id: 'reports', label: 'My reports', icon: Flag },
  { id: 'appeals', label: 'Appeals', icon: RotateCcw },
  { id: 'restrictions', label: 'Restrictions', icon: Flag },
  { id: 'blocked', label: 'Blocked users', icon: UserX },
  { id: 'privacy', label: 'Privacy', icon: Settings2 },
  { id: 'verification', label: 'Verifications', icon: GraduationCap },
]

const postStatusHelp:Record<CommunityManagedPost['status'],string>={
  draft:'Only you can see this draft. Open it when you are ready to submit.',
  pending_review:'Submitted to the moderation team and not visible to other members yet.',
  published:'Visible to members who have permission to view its Community.',
  rejected:'Not published after review. You can edit it or request another review.',
  hidden:'Removed from feeds after moderation. You can review the decision and appeal.',
  deleted:'Moved to deleted items. You can restore it to the review queue.',
}

export function CommunitySettings({ userId }: { userId: string }) {
  const [section, setSection] = useState<SettingsView>('history')
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; label: string } | null>(null)
  const dataSection: CommunitySettingsSection = section === 'verification' || section === 'reports' || section === 'blocked' || section === 'privacy' || section === 'requests' || section === 'notifications' || section === 'topics' || section === 'appeals' || section === 'restrictions' ? 'posts' : section
  const query = useCommunitySettings(userId, dataSection)
  const removeMutation = useRemoveCommunitySettingRelation(userId, dataSection)
  const restoreMutation=useRestoreOwnCommunityPost(userId)
  const isPeopleSection = section === 'following' || section === 'friends'
  const showsActivity = section !== 'verification' && section !== 'reports' && section !== 'blocked' && section !== 'privacy' && section !== 'requests' && section !== 'notifications' && section !== 'topics' && section !== 'appeals' && section !== 'restrictions'
  const items = query.data ?? []

  const remove = async () => {
    if (!pendingRemoval) return
    await removeMutation.mutateAsync(pendingRemoval.id)
    setPendingRemoval(null)
  }

  return (
    <div className="mt-7">
      <div className="flex gap-2 overflow-x-auto border-b border-border pb-3">
        {sections.map((item) => (
          <button key={item.id} type="button" onClick={() => setSection(item.id)} className={cn('flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors', section === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <item.icon className="size-4" /> {item.label}
          </button>
        ))}
      </div>

      {section === 'verification' && <ProfessionalVerification userId={userId} />}
      {section === 'reports' && <CommunityReportStatus userId={userId} />}
      {section === 'blocked' && <CommunityBlockedUsers userId={userId} />}
      {section === 'privacy' && <CommunityPrivacySettings userId={userId} />}
      {section === 'requests' && <CommunityFriendRequests userId={userId} />}
      {section === 'topics' && <CommunityTopicSettings userId={userId} />}
      {section === 'notifications' && <CommunityNotificationSettings userId={userId} />}
      {section === 'appeals' && <CommunityAppealHistory userId={userId} />}
      {section === 'restrictions' && <CommunityRestrictionAppeals userId={userId} />}

      {showsActivity && query.isLoading && <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>}
      {showsActivity && query.isError && <div className="mt-6"><RetryCard onRetry={() => void query.refetch()} /></div>}
      {showsActivity && !query.isLoading && !query.isError && items.length === 0 && (
        <div className="mt-6"><EmptyState icon={isPeopleSection ? <UsersRound /> : <Bookmark />} title={`No ${sections.find((item) => item.id === section)?.label.toLowerCase()} yet`} description="Your Community activity will appear here." /></div>
      )}

      {showsActivity && !query.isLoading && !query.isError && !isPeopleSection && (
        <div className="mt-5 space-y-3">
          {(items as CommunityManagedPost[]).map((post) => (
            <article key={post.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{post.post_type}</Badge>
                    <Badge variant="outline">{post.topic.replaceAll('_', ' ')}</Badge>
                    {section === 'posts' && <Badge variant={post.status === 'published' ? 'default' : 'outline'}>{post.status.replaceAll('_', ' ')}</Badge>}
                  </div>
                  <h3 className="font-semibold">{post.title || 'Untitled post'}</h3>
                  {post.body && <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.body}</p>}
                  <p className="mt-3 text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</p>
                  {section==='posts'&&<p className="mt-2 max-w-xl rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">{postStatusHelp[post.status]}</p>}
                </div>
                {section === 'deleted'?<Button size="sm" variant="outline" disabled={restoreMutation.isPending} onClick={()=>void restoreMutation.mutateAsync(post.id)}>Restore</Button>:section === 'posts' && (post.status==='hidden'||post.status==='rejected')?<CommunityAppealDialog userId={userId} postId={post.id}/>:section !== 'posts' && <Button size="sm" variant="outline" onClick={() => setPendingRemoval({ id: post.id, label: post.title || 'this post' })}>Remove</Button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {showsActivity && !query.isLoading && !query.isError && isPeopleSection && (
        <div className="mt-5 space-y-3">
          {(items as CommunityPerson[]).map((person) => {
            const displayName = person.full_name || person.name || 'Community member'
            return <div key={person.relation_id || person.user_id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <UserAvatar name={displayName} avatarUrl={person.avatar_url} size={44} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-semibold">{displayName}{person.is_verified && <GraduationCap className="size-4 text-primary" aria-label="Verified professional" />}</p>
                <p className="text-xs text-muted-foreground">{section === 'friends' ? 'Accepted friend' : 'Following'}</p>
              </div>
              <Button size="sm" variant="ghost" render={<Link to="/profile/$userId" params={{userId:person.user_id}}/>}>View profile</Button>
              <Button size="sm" variant="outline" onClick={() => setPendingRemoval({ id: person.relation_id!, label: displayName })}><UserMinus className="size-4" />{section === 'friends' ? 'Remove' : 'Unfollow'}</Button>
            </div>
          })}
        </div>
      )}

      <Dialog open={Boolean(pendingRemoval)} onOpenChange={(open) => { if (!open && !removeMutation.isPending) setPendingRemoval(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirm removal</DialogTitle><DialogDescription>Remove {pendingRemoval?.label} from {sections.find((item) => item.id === section)?.label.toLowerCase()}? This only changes your local Community data.</DialogDescription></DialogHeader>
          <DialogFooter><DialogClose render={<Button variant="outline" disabled={removeMutation.isPending} />}>Cancel</DialogClose><Button variant="destructive" disabled={removeMutation.isPending} onClick={() => void remove()}>{removeMutation.isPending ? 'Removing…' : 'Remove'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
