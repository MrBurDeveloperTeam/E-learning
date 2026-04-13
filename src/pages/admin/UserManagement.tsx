import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
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
import { formatViewCount, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { isAdminProfile } from '@/lib/auth'
import type { Profile } from '@/types'

type UserManagementTab = 'pending' | 'creators' | 'members'

type CreatorProfile = Profile & {
  videos?: { count: number }[] | null
}

function AdminGuard() {
  return (
    <div className="text-center py-16">
      <p className="text-[#DC2626] text-sm">Admin access required</p>
    </div>
  )
}

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-[#9BB5B5] mb-1">{label}</p>
      <p className="text-2xl font-medium text-[#1E3333]">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

export function UserManagement() {
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<UserManagementTab>('pending')
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
  const adminSidebarItems: SidebarItem[] = [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Content review', path: '/admin/content' },
    {
      label: 'User management',
      path: '/admin/users',
      badge: data?.pendingUsers.length ?? 0,
    },
    { label: 'Platform settings', path: '/admin/settings', disabled: true },
  ]

  return (
    <PageLayout
      showSidebar={true}
      sidebarItems={adminSidebarItems}
      sidebarVariant="admin"
    >
      <PageHeader
        title="User management"
        subtitle="Verify dental professionals for creator access"
      />

      {userManagementQuery.isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 rounded-xl mb-5" />
          <Skeleton className="h-96 rounded-xl" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-6">
            <StatsCard
              label="Pending verification"
              value={data?.pendingUsers.length ?? 0}
            />
            <StatsCard
              label="Total creators"
              value={data?.creators.length ?? 0}
            />
            <StatsCard
              label="Total members"
              value={data?.members.length ?? 0}
            />
          </div>

          <div className="flex gap-1 mb-5">
            {([
              ['pending', 'Pending verification'],
              ['creators', 'All creators'],
              ['members', 'All members'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={
                  tab === value
                    ? 'bg-[#EAF4F3] text-[#2D6E6A] rounded-full px-4 py-1.5 text-sm'
                    : 'text-[#6B8E8E] rounded-full px-4 py-1.5 text-sm hover:bg-[#EDF2F2]'
                }
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'pending' && (
            <>
              {data?.pendingUsers.length === 0 ? (
                <EmptyState
                  title="No pending verifications"
                  description="All creator applications have been reviewed"
                />
              ) : (
                <div>
                  {data?.pendingUsers.map((user) => (
                    <div key={user.user_id} className="card p-5 mb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <UserAvatar
                            name={user.full_name ?? user.email}
                            avatarUrl={user.avatar_url}
                            size={44}
                            className="bg-[#D4E8E7] text-[#2D6E6A]"
                          />
                          <div>
                            <p className="font-medium text-[#1E3333]">
                              {user.full_name ?? 'Unnamed user'}
                            </p>
                            <p className="text-xs text-[#6B8E8E]">
                              {user.email}
                            </p>
                            {user.specialty && (
                              <span className="badge-specialty mt-2 inline-flex">
                                {user.specialty}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-[#9BB5B5]">
                            Applied {timeAgo(user.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4 pt-4 border-t border-[#D6E0E0]">
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate(user.user_id)}
                          className="flex-1 py-2 text-sm font-medium bg-[#D1FAE5] text-[#059669] rounded-lg hover:bg-[#A7F3D0] transition-colors"
                        >
                          Approve as creator
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            rejectMutation.mutate({
                              userId: user.user_id,
                              reason: 'Rejected by admin',
                            })
                          }
                          className="px-4 py-2 text-sm text-[#DC2626] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'creators' && (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#D4E8E7]">
                    {[
                      'Creator',
                      'Specialty',
                      'Videos',
                      'Followers',
                      'Joined',
                      'Actions',
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#9BB5B5]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.creators.map((creator) => (
                    <tr
                      key={creator.user_id}
                      className="border-b border-[#EDF2F2] last:border-0"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={creator.full_name ?? creator.email}
                            avatarUrl={creator.avatar_url}
                            size={40}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[#1E3333]">
                                {creator.full_name ?? creator.email}
                              </p>
                              <span className="text-[10px] bg-[#D4E8E7] text-[#2D6E6A] px-2 py-0.5 rounded-full font-medium">
                                Verified
                              </span>
                            </div>
                            <p className="text-xs text-[#6B8E8E]">
                              {creator.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {creator.specialty ? (
                          <span className="badge-specialty">
                            {creator.specialty}
                          </span>
                        ) : (
                          <span className="text-sm text-[#9BB5B5]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-[#6B8E8E]">
                        {creator.video_count ??
                          creator.videos?.[0]?.count ??
                          0}
                      </td>
                      <td className="px-5 py-3 text-sm text-[#6B8E8E]">
                        {formatViewCount(creator.follower_count)}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#9BB5B5]">
                        {timeAgo(creator.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/channel/$userId"
                            params={{ userId: creator.user_id }}
                          >
                            <button className="btn-outline px-3 py-1.5 text-xs">
                              View channel
                            </button>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setRevokeUserId(creator.user_id)}
                            className="px-3 py-1.5 text-xs text-[#DC2626] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'members' && (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#D4E8E7]">
                    {[
                      'Member',
                      'Specialty',
                      'Followers',
                      'Joined',
                      'Status',
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#9BB5B5]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.members.map((member) => (
                    <tr
                      key={member.user_id}
                      className="border-b border-[#EDF2F2] last:border-0"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={member.full_name ?? member.email}
                            avatarUrl={member.avatar_url}
                            size={40}
                          />
                          <div>
                            <p className="text-sm font-medium text-[#1E3333]">
                              {member.full_name ?? member.email}
                            </p>
                            <p className="text-xs text-[#6B8E8E]">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[#6B8E8E]">
                        {member.specialty ?? '-'}
                      </td>
                      <td className="px-5 py-3 text-sm text-[#6B8E8E]">
                        {formatViewCount(member.follower_count)}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#9BB5B5]">
                        {timeAgo(member.created_at)}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#6B8E8E]">
                        Member
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialog open={!!revokeUserId} onOpenChange={(open) => !open && setRevokeUserId(null)}>
        <DialogContent showCloseButton={false} className="max-w-md rounded-2xl bg-white p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Revoke creator access?</DialogTitle>
            <DialogDescription>
              This user will lose creator and verification status and return to a member account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 bg-white">
            <button
              type="button"
              onClick={() => setRevokeUserId(null)}
              className="btn-outline text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                revokeUserId ? revokeMutation.mutate(revokeUserId) : undefined
              }
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C]"
            >
              Revoke access
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
