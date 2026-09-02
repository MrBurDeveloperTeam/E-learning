import { Info, Megaphone, Settings2, ShieldCheck, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useCommunityMembers } from '@/features/community/hooks/useCommunity'
import type { CommunitySummary } from '@/features/community/types'

export function CommunitySpaceSettingsDialog({ community }: { community: CommunitySummary }) {
  const members = useCommunityMembers(community.id)
  const displayName = (member: { full_name: string | null; name: string | null }) => member.full_name || member.name || 'Community member'

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}><Settings2 />Community settings</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{community.name}</DialogTitle>
          <DialogDescription>Community information, announcements, rules, and members.</DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-6">
          <section className="rounded-2xl border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Info className="size-4 text-primary" />About</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{community.description || 'A dental community for professional discussion and shared learning.'}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2.5 py-1 capitalize">{community.visibility}</span>
              <span className="rounded-full bg-muted px-2.5 py-1">{community.member_count} {community.member_count === 1 ? 'member' : 'members'}</span>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4 text-primary" />Announcement</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{community.announcement || 'No announcement has been published yet.'}</p>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="size-4 text-primary" />Members</h3>
            <div className="mt-3 space-y-2">
              {members.isLoading ? <LoadingSpinner /> : members.isError ? (
                <p className="text-sm text-destructive">Members could not be loaded.</p>
              ) : members.data?.length ? members.data.map((member) => (
                <div key={member.user_id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                  <UserAvatar name={displayName(member)} avatarUrl={member.avatar_url} size={36} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(member)}</span>
                  {member.user_id === community.owner_id && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300"><ShieldCheck className="size-3" />Owner</span>}
                </div>
              )) : <p className="text-sm text-muted-foreground">No active members yet.</p>}
            </div>
          </section>

          {community.viewer_membership_role === 'owner' && (
            <div className="flex items-center gap-2 border-t pt-5 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />You are the owner of this community.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
