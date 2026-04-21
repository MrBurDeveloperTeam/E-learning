import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  CheckCircle2,
  Eye,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  AdminFilterTabs,
  AdminSearchField,
  AdminSectionCard,
  AdminStatCard,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives'
import { PageLayout } from '@/components/layout/PageLayout'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { formatViewCount, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import type { Profile } from '@/types'

type UserManagementTab = 'pending' | 'creators' | 'members'

type CreatorProfile = Profile & {
  videos?: { count: number }[] | null
}

export function UserManagement() {
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<UserManagementTab>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [detailUser, setDetailUser] = useState<Profile | null>(null)
  const [rejectUserId, setRejectUserId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [revokeUserId, setRevokeUserId] = useState<string | null>(null)

  const userManagementQuery = useQuery({
    queryKey: ['admin-user-management'],
    queryFn: async () => {
      async function fetchPendingVerification() {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_creator', false)
          .eq('is_verified', false)
          .eq('account_type', 'individual')
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data ?? []) as Profile[]
      }

      async function fetchAllCreators() {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, videos(count)')
          .eq('is_creator', true)
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data ?? []) as CreatorProfile[]
      }

      async function fetchAllMembers() {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('role', 'admin')
          .eq('is_creator', false)
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data ?? []) as Profile[]
      }

      const [pendingUsers, creators, members] = await Promise.all([
        fetchPendingVerification(),
        fetchAllCreators(),
        fetchAllMembers(),
      ])

      return { pendingUsers, creators, members }
    },
    enabled: isAdminProfile(profile),
  })

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: true, is_creator: true, role: 'creator' })
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Creator approved')
      queryClient.invalidateQueries({ queryKey: ['admin-user-management'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      setDetailUser(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string
      reason: string
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_creator: false, is_verified: false })
        .eq('user_id', userId)

      if (error) throw error
      return reason
    },
    onSuccess: () => {
      toast.success('Creator application rejected')
      setRejectUserId(null)
      setRejectReason('')
      setDetailUser(null)
      queryClient.invalidateQueries({ queryKey: ['admin-user-management'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_creator: false, is_verified: false, role: 'member' })
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Creator access revoked')
      setRevokeUserId(null)
      queryClient.invalidateQueries({ queryKey: ['admin-user-management'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    },
  })

  if (!isAdminProfile(profile)) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  const data = userManagementQuery.data
  const pendingCount = data?.pendingUsers.length ?? 0
  const creatorCount = data?.creators.length ?? 0
  const memberCount = data?.members.length ?? 0
  const filteredPendingUsers = (data?.pendingUsers ?? []).filter((user) => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    return (
      (user.full_name ?? '').toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.specialty ?? '').toLowerCase().includes(query) ||
      (user.institution ?? '').toLowerCase().includes(query)
    )
  })

  return (
    <AdminLayout
      title="User management"
      subtitle="Review creator verification requests, inspect approved creators, and manage member accounts from a single professional workspace."
      sidebarBadges={{
        pendingUsers: pendingCount,
      }}
      heroAside={
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
            Access status
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge
              label={`${pendingCount} pending`}
              tone={pendingCount > 0 ? 'warning' : 'success'}
              dot={true}
            />
            <AdminStatusBadge label={`${creatorCount} creators`} tone="info" />
            <AdminStatusBadge label={`${memberCount} members`} tone="default" />
          </div>
        </div>
      }
    >
      {userManagementQuery.isLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-[26px]" />
            ))}
          </div>
          <Skeleton className="h-20 rounded-[24px]" />
          <Skeleton className="h-[420px] rounded-[28px]" />
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <AdminStatCard
              label="Pending verification"
              value={pendingCount.toLocaleString()}
              icon={ShieldCheck}
              accent={pendingCount > 0 ? 'warning' : 'default'}
              hint="Applications now managed directly in this user workspace"
            />
            <AdminStatCard
              label="Total creators"
              value={creatorCount.toLocaleString()}
              icon={CheckCircle2}
              accent="success"
              hint="Profiles currently holding creator access"
            />
            <AdminStatCard
              label="Total members"
              value={memberCount.toLocaleString()}
              icon={Users}
              hint="Non-admin member accounts on the platform"
            />
          </div>

          <AdminSectionCard
            title="Account views"
            description="Creator application review is now merged into this page under the pending verification tab."
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <AdminFilterTabs
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'pending', label: 'Pending verification', count: pendingCount },
                  { value: 'creators', label: 'Creators', count: creatorCount },
                  { value: 'members', label: 'Members', count: memberCount },
                ]}
              />
              {tab === 'pending' && (
                <div className="w-full lg:max-w-sm">
                  <AdminSearchField
                    type="text"
                    placeholder="Search name, email, specialty, or institution"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
              )}
            </div>
          </AdminSectionCard>

          {tab === 'pending' && (
            <>
              {filteredPendingUsers.length === 0 ? (
                <AdminSectionCard
                  title="Pending verification queue"
                  description={
                    searchQuery
                      ? 'No pending users match the current search.'
                      : 'No creator applications are currently waiting for review.'
                  }
                >
                  <EmptyState
                    title={searchQuery ? 'No matching applicants' : 'No pending verifications'}
                    description={
                      searchQuery
                        ? 'Try adjusting the search term.'
                        : 'All creator applications have been reviewed.'
                    }
                  />
                </AdminSectionCard>
              ) : (
                <div className="space-y-4">
                  {filteredPendingUsers.map((user) => (
                    <AdminSectionCard key={user.user_id}>
                      <div className="flex flex-col gap-5">
                        <button
                          type="button"
                          onClick={() => setDetailUser(user)}
                          className="w-full rounded-[24px] text-left transition-colors hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <div className="flex flex-col gap-4 p-1 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-start gap-4">
                              <UserAvatar
                                name={user.full_name ?? user.email}
                                avatarUrl={user.avatar_url}
                                size={48}
                                className="bg-primary/10 text-primary"
                              />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-base font-semibold text-foreground">
                                    {user.full_name ?? 'Unnamed user'}
                                  </p>
                                  <AdminStatusBadge
                                    label="Pending verification"
                                    tone="warning"
                                    dot={true}
                                  />
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {user.email}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                                  {user.specialty && (
                                    <AdminStatusBadge label={user.specialty} tone="info" />
                                  )}
                                  {user.institution && (
                                    <span className="text-sm text-muted-foreground">
                                      {user.institution}
                                    </span>
                                  )}
                                  {user.position && (
                                    <span className="text-sm text-muted-foreground/75">
                                      {user.position}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-3 rounded-[22px] border border-border/70 bg-background/75 p-4 text-sm sm:grid-cols-2 lg:min-w-[280px]">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                                  Applied
                                </p>
                                <p className="mt-1 font-medium text-foreground">
                                  {timeAgo(user.created_at)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                                  Source
                                </p>
                                <p className="mt-1 font-medium text-foreground">
                                  {user.company_name || 'Direct individual profile'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {user.bio && (
                            <div className="mt-4 rounded-[22px] border border-border/70 bg-background/70 p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                                Professional bio
                              </p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {user.bio}
                              </p>
                            </div>
                          )}
                        </button>

                        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={() => setDetailUser(user)}
                            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Eye className="h-4 w-4" />
                              Review details
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectUserId(user.user_id)
                              setRejectReason('')
                            }}
                            className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <UserX className="h-4 w-4" />
                              Reject
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => approveMutation.mutate(user.user_id)}
                            disabled={approveMutation.isPending}
                            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <UserCheck className="h-4 w-4" />
                              Approve as creator
                            </span>
                          </button>
                        </div>
                      </div>
                    </AdminSectionCard>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'creators' && (
            <AdminTableShell
              title="Approved creators"
              description="Verified creator accounts with current channel and follower stats."
            >
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/35">
                    {['Creator', 'Specialty', 'Videos', 'Followers', 'Joined', 'Actions'].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data?.creators.map((creator) => (
                    <tr
                      key={creator.user_id}
                      className="border-b border-border/70 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={creator.full_name ?? creator.email}
                            avatarUrl={creator.avatar_url}
                            size={42}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {creator.full_name ?? creator.email}
                              </p>
                              <AdminStatusBadge label="Verified" tone="success" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {creator.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {creator.specialty ? (
                          <AdminStatusBadge label={creator.specialty} tone="info" />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">
                        {creator.video_count ?? creator.videos?.[0]?.count ?? 0}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">
                        {formatViewCount(creator.follower_count)}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {timeAgo(creator.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/channel/$userId"
                            params={{ userId: creator.user_id }}
                            className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                          >
                            View channel
                          </Link>
                          <button
                            type="button"
                            onClick={() => setRevokeUserId(creator.user_id)}
                            className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
          )}

          {tab === 'members' && (
            <AdminTableShell
              title="Member accounts"
              description="Standard non-admin accounts that do not currently hold creator access."
            >
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/35">
                    {['Member', 'Specialty', 'Followers', 'Joined', 'Status'].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data?.members.map((member) => (
                    <tr
                      key={member.user_id}
                      className="border-b border-border/70 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={member.full_name ?? member.email}
                            avatarUrl={member.avatar_url}
                            size={42}
                          />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {member.full_name ?? member.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {member.specialty ?? '-'}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">
                        {formatViewCount(member.follower_count)}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {timeAgo(member.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <AdminStatusBadge label="Member" tone="default" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
          )}
        </>
      )}

      <Dialog
        open={!!detailUser}
        onOpenChange={(open) => !open && setDetailUser(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-2xl rounded-[28px] border-border/80 bg-card p-0 overflow-hidden"
        >
          {detailUser && (
            <>
              <DialogHeader className="border-b border-border/80 bg-muted/35 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-lg text-foreground">
                      Review application
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-muted-foreground">
                      Confirm the applicant details before granting creator access.
                    </DialogDescription>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailUser(null)}
                    className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </DialogHeader>

              <div className="space-y-5 px-6 py-6">
                <div className="flex items-center gap-4">
                  <UserAvatar
                    name={detailUser.full_name ?? detailUser.email}
                    avatarUrl={detailUser.avatar_url}
                    size={60}
                    className="bg-primary/10 text-primary"
                  />
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {detailUser.full_name ?? 'Unnamed applicant'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {detailUser.email}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Specialty', detailUser.specialty || 'Not specified'],
                    ['Position', detailUser.position || 'Not specified'],
                    ['Institution', detailUser.institution || 'Not specified'],
                    ['Company / Clinic', detailUser.company_name || 'Not specified'],
                    ['Phone', detailUser.phone || 'Not provided'],
                    ['Applied', timeAgo(detailUser.created_at)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[22px] border border-border/70 bg-background/75 p-4"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                        {label}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {detailUser.bio && (
                  <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                      Professional bio
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {detailUser.bio}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-border/80 bg-muted/35 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRejectUserId(detailUser.user_id)
                    setRejectReason('')
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <UserX className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => approveMutation.mutate(detailUser.user_id)}
                  disabled={approveMutation.isPending}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Approve as creator
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectUserId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectUserId(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-lg rounded-[28px] border-border/80 bg-card p-0 overflow-hidden"
        >
          <DialogHeader className="border-b border-border/80 bg-muted/35 px-6 py-5">
            <DialogTitle className="text-lg text-foreground">
              Reject application?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              This removes the applicant from the pending queue. They can apply again later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 py-5">
            <label
              htmlFor="reject-reason"
              className="text-sm font-medium text-foreground"
            >
              Rejection reason
            </label>
            <div className="rounded-[22px] border border-border/80 bg-background/75 px-4 py-3">
              <div className="flex items-start gap-3">
                <Search className="mt-0.5 h-4 w-4 text-muted-foreground/60" />
                <textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Document why this application is being rejected..."
                  className="min-h-28 w-full resize-none border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              This note is for the admin action record and does not change the backend flow.
            </p>
          </div>

          <DialogFooter className="gap-3 border-t border-border/80 bg-muted/35 px-6 py-4">
            <button
              type="button"
              onClick={() => {
                setRejectUserId(null)
                setRejectReason('')
              }}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                rejectUserId
                  ? rejectMutation.mutate({
                      userId: rejectUserId,
                      reason: rejectReason || 'Rejected by admin',
                    })
                  : undefined
              }
              disabled={rejectMutation.isPending}
              className="rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              Reject application
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revokeUserId}
        onOpenChange={(open) => !open && setRevokeUserId(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-lg rounded-[28px] border-border/80 bg-card p-0 overflow-hidden"
        >
          <DialogHeader className="border-b border-border/80 bg-muted/35 px-6 py-5">
            <DialogTitle className="text-lg text-foreground">
              Revoke creator access?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              This user will lose creator and verification status and return to a member account.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <div className="flex items-start gap-3 rounded-[22px] border border-destructive/10 bg-destructive/5 p-4">
              <UserRoundX className="h-5 w-5 flex-shrink-0 text-destructive" />
              <p className="text-sm leading-6 text-muted-foreground">
                This keeps the existing account intact but removes creator privileges.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-3 border-t border-border/80 bg-muted/35 px-6 py-4">
            <button
              type="button"
              onClick={() => setRevokeUserId(null)}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                revokeUserId ? revokeMutation.mutate(revokeUserId) : undefined
              }
              disabled={revokeMutation.isPending}
              className="rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              Revoke access
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
