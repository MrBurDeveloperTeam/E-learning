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
import { timeAgo } from '@/lib/utils'
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
      bg: 'bg-[#FEF3C7]',
      text: 'text-[#92400E]',
      dot: 'bg-[#D97706]',
      label: 'Pending review',
    },
    approved: {
      bg: 'bg-[#D1FAE5]',
      text: 'text-[#065F46]',
      dot: 'bg-[#059669]',
      label: 'Approved',
    },
    rejected: {
      bg: 'bg-[#FEE2E2]',
      text: 'text-[#991B1B]',
      dot: 'bg-[#DC2626]',
      label: 'Rejected',
    },
  }[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
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
    default: 'bg-[#EAF4F3] text-[#2D6E6A]',
    warning: 'bg-[#FEF3C7] text-[#D97706]',
    success: 'bg-[#D1FAE5] text-[#059669]',
    danger: 'bg-[#FEE2E2] text-[#DC2626]',
  }

  return (
    <div className="card p-5 flex items-center gap-4">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconColorMap[accent]}`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-[#1E3333]">
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-[#9BB5B5] mt-0.5">{label}</p>
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
                  className={
                    filterStatus === value
                      ? 'flex items-center gap-1.5 bg-[#EAF4F3] text-[#2D6E6A] rounded-full px-4 py-2 text-sm font-medium transition-all'
                      : 'flex items-center gap-1.5 text-[#6B8E8E] rounded-full px-4 py-2 text-sm hover:bg-[#EDF2F2] transition-all'
                  }
                >
                  {label}
                  <span
                    className={
                      filterStatus === value
                        ? 'bg-[#2D6E6A] text-[#EAF4F3] text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center'
                        : 'bg-[#EDF2F2] text-[#9BB5B5] text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center'
                    }
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BB5B5]"
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
                  className="card overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-5">
                    {/* Top row: avatar + info + status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <UserAvatar
                          name={user.full_name ?? user.email}
                          avatarUrl={user.avatar_url}
                          size={48}
                          className="bg-[#D4E8E7] text-[#2D6E6A] flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-[#1E3333] text-[15px]">
                              {user.full_name ?? 'Unnamed applicant'}
                            </p>
                            <StatusBadge status={user._status} />
                          </div>
                          <p className="text-xs text-[#6B8E8E] mt-0.5">
                            {user.email}
                          </p>

                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            {user.specialty && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#EAF4F3] px-2 py-1 text-xs text-[#2D6E6A] font-medium">
                                {user.specialty}
                              </span>
                            )}
                            {user.institution && (
                              <span className="text-xs text-[#6B8E8E]">
                                {user.institution}
                              </span>
                            )}
                            {user.position && (
                              <span className="text-xs text-[#9BB5B5]">
                                · {user.position}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-[#9BB5B5]">
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
                        <p className="text-sm text-[#6B8E8E] line-clamp-2">
                          {user.bio}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action row */}
                  {user._status === 'pending' && (
                    <div className="flex items-center gap-2 px-5 py-3 border-t border-[#EDF2F2] bg-[#FAFCFC]">
                      <button
                        type="button"
                        onClick={() => setDetailUser(user)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#6B8E8E] border border-[#D4E8E7] rounded-lg hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
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
                        className="flex items-center gap-1.5 px-4 py-2 text-xs text-[#DC2626] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors"
                      >
                        <UserX size={13} />
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => approveMutation.mutate(user.user_id)}
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#D1FAE5] text-[#059669] rounded-lg hover:bg-[#A7F3D0] transition-colors disabled:opacity-50"
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
          className="max-w-lg rounded-2xl bg-white p-0"
        >
          {detailUser && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#EDF2F2]">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg">
                    Review application
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={() => setDetailUser(null)}
                    className="text-[#9BB5B5] hover:text-[#3D5C5C] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <DialogDescription className="text-[#6B8E8E] text-sm mt-1">
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
                    className="bg-[#D4E8E7] text-[#2D6E6A]"
                  />
                  <div>
                    <p className="text-base font-medium text-[#1E3333]">
                      {detailUser.full_name ?? 'Unnamed'}
                    </p>
                    <p className="text-sm text-[#6B8E8E]">
                      {detailUser.email}
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[#EDF2F2] bg-[#FAFCFC] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5] mb-1">
                      Specialty
                    </p>
                    <p className="text-sm text-[#1E3333]">
                      {detailUser.specialty || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EDF2F2] bg-[#FAFCFC] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5] mb-1">
                      Position
                    </p>
                    <p className="text-sm text-[#1E3333]">
                      {detailUser.position || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EDF2F2] bg-[#FAFCFC] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5] mb-1">
                      Institution
                    </p>
                    <p className="text-sm text-[#1E3333]">
                      {detailUser.institution || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EDF2F2] bg-[#FAFCFC] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5] mb-1">
                      Company / Clinic
                    </p>
                    <p className="text-sm text-[#1E3333]">
                      {detailUser.company_name || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EDF2F2] bg-[#FAFCFC] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5] mb-1">
                      Phone
                    </p>
                    <p className="text-sm text-[#1E3333]">
                      {detailUser.phone || 'Not provided'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EDF2F2] bg-[#FAFCFC] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5] mb-1">
                      Applied
                    </p>
                    <p className="text-sm text-[#1E3333]">
                      {timeAgo(detailUser.created_at)}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                {detailUser.bio && (
                  <div className="rounded-xl border border-[#EDF2F2] bg-[#FAFCFC] p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5] mb-2">
                      Professional bio
                    </p>
                    <p className="text-sm text-[#3D5C5C] leading-relaxed">
                      {detailUser.bio}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {detailUser._status === 'pending' && (
                <div className="px-6 py-4 border-t border-[#EDF2F2] bg-[#FAFCFC] flex items-center gap-3 justify-end rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectUserId(detailUser.user_id)
                      setRejectReason('')
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-[#DC2626] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors"
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
                    className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-[#2D6E6A] text-white rounded-lg hover:bg-[#1A4A47] transition-colors disabled:opacity-50"
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
          className="max-w-md rounded-2xl bg-white p-0"
        >
          <DialogHeader className="border-b border-[#EDF2F2] px-6 pt-6 pb-4">
            <DialogTitle className="text-lg text-[#1E3333]">
              Reject application?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[#6B8E8E]">
              This will remove the user from the pending queue. They can
              re-apply in the future.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 px-6 py-5">
            <label
              htmlFor="reject-reason"
              className="block text-xs font-medium text-[#3D5C5C]"
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
            <p className="text-xs leading-5 text-[#6B8E8E]">
              This note is for the admin action record and helps explain why the
              application was rejected.
            </p>
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0 gap-3 rounded-b-2xl border-t border-[#EDF2F2] bg-[#FAFCFC] px-6 py-4">
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
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-50"
            >
              Reject application
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
