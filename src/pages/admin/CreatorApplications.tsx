import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Check,
  Clock3,
  Eye,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import type { SidebarItem } from '@/components/layout/Sidebar'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
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
import { cn, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import type { Profile } from '@/types'

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected'

interface ApplicationUser extends Profile {
  _status: 'pending' | 'approved' | 'rejected'
}

function AdminGuard() {
  return (
    <div className="text-center py-16">
      <p className="text-[#DC2626] text-sm">Admin access required</p>
    </div>
  )
}

function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const config = {
    pending: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      dot: 'bg-amber-500',
      label: 'Pending review',
    },
    approved: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      label: 'Approved',
    },
    rejected: {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      dot: 'bg-destructive',
      label: 'Rejected',
    },
  }[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
        config.bg,
        config.text
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}

function StatsCard({
  label,
  value,
  icon: Icon,
  accent = 'default',
}: {
  label: string
  value: number
  icon: typeof Clock3
  accent?: 'default' | 'warning' | 'success' | 'danger'
}) {
  const iconColorMap = {
    default: 'bg-primary/10 text-primary',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    danger: 'bg-destructive/10 text-destructive',
  }

  return (
    <div className="card p-5 flex items-center gap-4 border-border bg-card">
      <div
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
          iconColorMap[accent]
        )}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export function CreatorApplications() {
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [rejectUserId, setRejectUserId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [detailUser, setDetailUser] = useState<ApplicationUser | null>(null)

  // Fetch all application data
  const applicationsQuery = useQuery({
    queryKey: ['admin-creator-applications'],
    queryFn: async () => {
      // Pending applications: account_type = 'individual', is_creator = false, is_verified = false
      const { data: pending, error: pendingErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_creator', false)
        .eq('is_verified', false)
        .eq('account_type', 'individual')
        .order('created_at', { ascending: false })

      if (pendingErr) throw pendingErr

      // Approved creators
      const { data: approved, error: approvedErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_creator', true)
        .eq('is_verified', true)
        .order('updated_at', { ascending: false })

      if (approvedErr) throw approvedErr

      // Rejected: is_verified = false, is_creator = false, account_type is null (reset after rejection)
      // For now we only show pending and approved since we don't track rejection status separately
      const pendingUsers: ApplicationUser[] = (pending ?? []).map((u) => ({
        ...u,
        _status: 'pending' as const,
      }))

      const approvedUsers: ApplicationUser[] = (approved ?? []).map((u) => ({
        ...u,
        _status: 'approved' as const,
      }))

      return {
        pending: pendingUsers,
        approved: approvedUsers,
        all: [...pendingUsers, ...approvedUsers],
      }
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
      toast.success('Creator application approved!')
      queryClient.invalidateQueries({ queryKey: ['admin-creator-applications'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-management'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      setDetailUser(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to approve')
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
      // Reset account_type to null to remove from pending queue
      const { error } = await supabase
        .from('profiles')
        .update({
          is_creator: false,
          is_verified: false,
          account_type: null,
        })
        .eq('user_id', userId)

      if (error) throw error
      return reason
    },
    onSuccess: () => {
      toast.success('Application rejected')
      setRejectUserId(null)
      setRejectReason('')
      setDetailUser(null)
      queryClient.invalidateQueries({ queryKey: ['admin-creator-applications'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-management'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reject')
    },
  })

  if (!isAdminProfile(profile)) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  const data = applicationsQuery.data
  const pendingCount = data?.pending.length ?? 0
  const approvedCount = data?.approved.length ?? 0

  // Sidebar
  const adminSidebarItems: SidebarItem[] = [
    { label: 'Dashboard', path: '/admin' },
    {
      label: 'Creator applications',
      path: '/admin/applications',
      badge: pendingCount,
    },
    { label: 'Content review', path: '/admin/content' },
    { label: 'User management', path: '/admin/users' },
    { label: 'Platform settings', path: '/admin/settings', disabled: true },
  ]

  // Filter + search
  const filteredUsers = (() => {
    let list: ApplicationUser[] = []
    if (filterStatus === 'all') list = data?.all ?? []
    else if (filterStatus === 'pending') list = data?.pending ?? []
    else if (filterStatus === 'approved') list = data?.approved ?? []

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (u) =>
          (u.full_name ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.specialty ?? '').toLowerCase().includes(q) ||
          (u.institution ?? '').toLowerCase().includes(q),
      )
    }

    return list
  })()

  return (
    <PageLayout
      showSidebar={true}
      sidebarItems={adminSidebarItems}
      sidebarVariant="admin"
    >
      <PageHeader
        title="Creator applications"
        subtitle="Review and manage creator access requests from dental professionals"
      />

      {applicationsQuery.isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-14 rounded-xl mb-5" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl mb-3" />
          ))}
        </>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-6">
            <StatsCard
              label="Pending review"
              value={pendingCount}
              icon={Clock3}
              accent={pendingCount > 0 ? 'warning' : 'default'}
            />
            <StatsCard
              label="Approved creators"
              value={approvedCount}
              icon={UserCheck}
              accent="success"
            />
            <StatsCard
              label="Total applications"
              value={(data?.all.length ?? 0)}
              icon={ShieldCheck}
            />
          </div>

          {/* Filter bar */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
            <div className="flex gap-1.5">
              {(
                [
                  ['pending', 'Pending', pendingCount],
                  ['approved', 'Approved', approvedCount],
                  ['all', 'All', data?.all.length ?? 0],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilterStatus(value as FilterStatus)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all',
                    filterStatus === value
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-colors',
                      filterStatus === value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground/60'
                    )}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
              />
              <input
                type="text"
                placeholder="Search by name, email, specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-full pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Application list */}
          {filteredUsers.length === 0 ? (
            <EmptyState
              title={
                filterStatus === 'pending'
                  ? 'No pending applications'
                  : filterStatus === 'approved'
                    ? 'No approved creators yet'
                    : 'No applications found'
              }
              description={
                searchQuery
                  ? 'Try adjusting your search query'
                  : filterStatus === 'pending'
                    ? 'All creator applications have been reviewed. Check back later for new submissions.'
                    : 'No applications match the current filter.'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="card overflow-hidden hover:shadow-md transition-shadow border-border bg-card"
                >
                  <div className="p-5">
                    {/* Top row: avatar + info + status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <UserAvatar
                          name={user.full_name ?? user.email}
                          avatarUrl={user.avatar_url}
                          size={48}
                          className="bg-primary/10 text-primary flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground text-[15px]">
                              {user.full_name ?? 'Unnamed applicant'}
                            </p>
                            <StatusBadge status={user._status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {user.email}
                          </p>

                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            {user.specialty && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary font-medium border border-primary/20">
                                {user.specialty}
                              </span>
                            )}
                            {user.institution && (
                              <span className="text-xs text-muted-foreground">
                                {user.institution}
                              </span>
                            )}
                            {user.position && (
                              <span className="text-xs text-muted-foreground/60">
                                · {user.position}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground/60">
                          {user._status === 'pending' ? 'Applied' : 'Updated'}{' '}
                          {timeAgo(
                            user._status === 'pending'
                              ? user.created_at
                              : user.updated_at,
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Bio preview */}
                    {user.bio && (
                      <div className="mt-3 ml-16">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {user.bio}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action row */}
                  {user._status === 'pending' && (
                    <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-muted/30">
                      <button
                        type="button"
                        onClick={() => setDetailUser(user)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:bg-primary/10 hover:text-primary transition-colors bg-card shadow-sm"
                      >
                        <Eye size={13} />
                        Review details
                      </button>
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setRejectUserId(user.user_id)
                          setRejectReason('')
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors bg-card shadow-sm"
                      >
                        <UserX size={13} />
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => approveMutation.mutate(user.user_id)}
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <UserCheck size={13} />
                        Approve
                      </button>
                    </div>
                  )}

                  {user._status === 'approved' && (
                    <div className="flex items-center gap-2 px-5 py-3 border-t border-[#EDF2F2] bg-[#FAFCFC]">
                      <Link
                        to="/channel/$userId"
                        params={{ userId: user.user_id }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#6B8E8E] border border-[#D4E8E7] rounded-lg hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
                      >
                        <Eye size={13} />
                        View channel
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Detail Review Dialog ──────────────────────────────── */}
      <Dialog
        open={!!detailUser}
        onOpenChange={(open) => !open && setDetailUser(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-lg rounded-2xl bg-card border-border p-0 overflow-hidden"
        >
          {detailUser && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg text-foreground">
                    Review application
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={() => setDetailUser(null)}
                    className="text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <DialogDescription className="text-muted-foreground text-sm mt-1">
                  Review this dental professional's application for creator
                  access
                </DialogDescription>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5">
                {/* Applicant info */}
                <div className="flex items-center gap-4">
                  <UserAvatar
                    name={detailUser.full_name ?? detailUser.email}
                    avatarUrl={detailUser.avatar_url}
                    size={56}
                    className="bg-primary/10 text-primary"
                  />
                  <div>
                    <p className="text-base font-medium text-foreground">
                      {detailUser.full_name ?? 'Unnamed'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {detailUser.email}
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                      Specialty
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {detailUser.specialty || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                      Position
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {detailUser.position || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                      Institution
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {detailUser.institution || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                      Company / Clinic
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {detailUser.company_name || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                      Phone
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {detailUser.phone || 'Not provided'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                      Applied
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {timeAgo(detailUser.created_at)}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                {detailUser.bio && (
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
                      Professional bio
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {detailUser.bio}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {detailUser._status === 'pending' && (
                <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center gap-3 justify-end rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectUserId(detailUser.user_id)
                      setRejectReason('')
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors bg-card shadow-sm"
                  >
                    <UserX size={14} />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      approveMutation.mutate(detailUser.user_id)
                    }
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md"
                  >
                    <Check size={14} />
                    Approve as creator
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reject Confirmation Dialog ────────────────────────── */}
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
          className="max-w-md rounded-2xl bg-card border-border p-0 overflow-hidden"
        >
          <DialogHeader className="border-b border-border bg-muted/30 px-6 pt-6 pb-4">
            <DialogTitle className="text-lg text-foreground">
              Reject application?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              This will remove the user from the pending queue. They can
              re-apply in the future.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 px-6 py-5">
            <label
              htmlFor="reject-reason"
              className="block text-xs font-medium text-foreground"
            >
              Rejection reason (optional)
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Incomplete professional details..."
              className="input-field min-h-28 w-full resize-none"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              This note is for the admin action record and helps explain why the
              application was rejected.
            </p>
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0 gap-3 rounded-b-2xl border-t border-border bg-muted/30 px-6 py-4">
            <button
              type="button"
              onClick={() => {
                setRejectUserId(null)
                setRejectReason('')
              }}
              className="btn-outline text-sm"
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
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 shadow-sm"
            >
              Reject application
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
