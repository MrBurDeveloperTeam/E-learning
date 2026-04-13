import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/layout/Navbar'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { cn, getInitials, timeAgo } from '@/lib/utils'
import {
  useMarkAllRead,
  useMarkRead,
  useUnreadCount,
} from '@/hooks/useNotifications'
import type { NotificationWithActor } from '@/types'

type NotificationFilter = 'all' | 'unread'

function getActionText(type: NotificationWithActor['type']) {
  switch (type) {
    case 'new_follower':
      return 'started following you'
    case 'new_like':
      return 'liked your video'
    case 'new_comment':
      return 'commented on your video'
    case 'new_reply':
      return 'replied to your comment'
    case 'new_video':
      return 'uploaded a new video'
    default:
      return 'sent you a notification'
  }
}

function NotificationCardSkeleton() {
  return (
    <div className="card p-4 flex items-start gap-4">
      <div className="mt-4 h-2 w-2 rounded-full bg-[#D4E8E7]" />
      <div className="h-10 w-10 animate-pulse rounded-full bg-[#EDF2F2]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[#EDF2F2]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#EDF2F2]" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-[#EDF2F2]" />
      </div>
      <div className="h-7 w-10 animate-pulse rounded-md bg-[#EDF2F2]" />
    </div>
  )
}

export function Notifications() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const markAllRead = useMarkAllRead()
  const markRead = useMarkRead()
  const { data: unreadCount = 0 } = useUnreadCount()
  const notificationsQuery = useQuery({
    queryKey: ['notifications-full', profile?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles!notifications_actor_id_fkey (
            user_id, full_name, username, avatar_url
          ),
          videos (
            id, title, thumbnail_url
          )
        `)
        .eq('recipient_id', profile!.user_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as NotificationWithActor[]
    },
    enabled: !!profile?.user_id,
  })

  const notifications =
    filter === 'unread'
      ? (notificationsQuery.data ?? []).filter(
          (notification) => !notification.is_read
        )
      : (notificationsQuery.data ?? [])

  function handleClick(notification: NotificationWithActor) {
    if (!notification.is_read) {
      markRead.mutate(notification.id)
    }

    if (notification.type === 'new_follower') {
      void navigate({
        to: '/channel/$userId',
        params: { userId: notification.profiles.user_id },
      })
      return
    }

    if (notification.video_id) {
      void navigate({
        to: '/watch/$videoId',
        params: { videoId: notification.video_id },
      })
    }
  }

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <PageHeader
          title="Notifications"
          actions={
            unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="btn-ghost text-sm"
              >
                Mark all as read
              </button>
            ) : undefined
          }
        />

        <div className="flex gap-1 mb-5">
          {([
            ['all', 'All'],
            ['unread', 'Unread'],
          ] as const).map(([value, label]) => {
            const isActive = filter === value

            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  'px-4 py-1.5 text-sm transition-colors rounded-full',
                  isActive
                    ? 'bg-[#EAF4F3] text-[#2D6E6A]'
                    : 'text-[#6B8E8E] hover:bg-[#EDF2F2]'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          {notificationsQuery.isLoading &&
            Array.from({ length: 4 }).map((_, index) => (
              <NotificationCardSkeleton key={index} />
            ))}

          {!notificationsQuery.isLoading && notifications.length === 0 && (
            <EmptyState
              title="No notifications"
              description="When people follow you, like or comment on your videos, you'll see it here"
            />
          )}

          {!notificationsQuery.isLoading &&
            notifications.map((notification) => {
              const actorName =
                notification.profiles?.full_name ??
                notification.profiles?.username ??
                'Someone'

              return (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={cn(
                    'card p-4 flex items-start gap-4 cursor-pointer',
                    'hover:border-[#88C1BD] transition-colors',
                    !notification.is_read && 'border-[#88C1BD] bg-[#EAF4F3]'
                  )}
                >
                  <div
                    className={cn(
                      'mt-4 h-2 w-2 rounded-full flex-shrink-0',
                      notification.is_read
                        ? 'bg-transparent'
                        : 'bg-[#88C1BD]'
                    )}
                  />

                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#2D6E6A] text-sm font-medium text-[#EAF4F3] flex-shrink-0">
                    {notification.profiles?.avatar_url ? (
                      <img
                        src={notification.profiles.avatar_url}
                        alt={actorName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(actorName)
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1E3333]">
                      <span className="font-medium">{actorName}</span>{' '}
                      {getActionText(notification.type)}
                    </p>
                    {notification.videos?.title && (
                      <p className="text-xs text-[#6B8E8E] mt-0.5">
                        {notification.videos.title}
                      </p>
                    )}
                    <p className="text-xs text-[#9BB5B5] mt-1">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>

                  {notification.videos && (
                    <div className="h-7 w-10 flex-shrink-0 overflow-hidden rounded-md bg-[#EDF2F2]">
                      {notification.videos.thumbnail_url ? (
                        <img
                          src={notification.videos.thumbnail_url}
                          alt={notification.videos.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    </>
  )
}
