import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/layout/Navbar'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import { fetchNotifications } from '@/lib/queries/notifications'
import { cn, getDisplayName, getInitials, timeAgo } from '@/lib/utils'
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
    case 'community_comment_reply':
      return 'replied to your Community comment'
    case 'community_comment_like':
      return 'liked your Community comment'
    case 'community_mention':
      return 'mentioned you in Community'
    case 'community_report_resolved':
    case 'community_report_result':
      return 'reviewed your Community report'
    case 'community_post_like':
      return 'liked your Community post'
    case 'community_comment':
      return 'commented on your Community post'
    case 'community_reply':
      return 'replied to your Community comment'
    case 'community_friend_accepted':
      return 'accepted your friend request'
    case 'community_join_request':
      return 'requested to join your Community'
    case 'community_join_decision':
      return 'reviewed your Community join request'
    case 'community_message':
      return 'sent you a Community message'
    case 'community_post_review':
      return 'reviewed your Community post'
    case 'community_verification_result':
      return 'reviewed your professional verification application'
    case 'community_appeal_result':
      return 'reviewed your Community appeal'
    default:
      return 'sent you a notification'
  }
}

function NotificationCardSkeleton() {
  return (
    <div className="card p-4 flex items-start gap-4 border-border bg-card">
      <div className="mt-4 h-2 w-2 rounded-full bg-muted" />
      <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-7 w-10 animate-pulse rounded-md bg-muted" />
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
    queryFn: () => fetchNotifications(profile!.user_id, 200),
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
      markRead.mutate(notification)
    }

    if (notification.type === 'new_follower') {
      void navigate({
        to: '/profile/$userId',
        params: {
          userId: notification.profiles?.user_id ?? notification.actor_id,
        },
      })
      return
    }

    if (notification.video_id) {
      void navigate({
        to: '/watch/$videoId',
        params: { videoId: notification.video_id },
      })
    }
    if (notification.community_post_id) { void navigate({ to: '/community/post/$postId', params: { postId: notification.community_post_id } });return }
    if(notification.type==='community_appeal_decided'||notification.type==='community_report_resolved')void navigate({to:'/community',search:{tab:'settings',q:undefined,topic:undefined,sort:undefined}})
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
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
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
              const actorName = getDisplayName(notification.profiles, 'Someone')

              return (
                <div
                  key={`${notification.source ?? 'platform'}:${notification.id}`}
                  onClick={() => handleClick(notification)}
                  className={cn(
                    'card p-4 flex items-start gap-4 cursor-pointer',
                    'hover:border-primary transition-colors border-border bg-card',
                    !notification.is_read && 'border-primary bg-primary/10'
                  )}
                >
                  <div
                    className={cn(
                      'mt-4 h-2 w-2 rounded-full flex-shrink-0',
                      notification.is_read
                        ? 'bg-transparent'
                        : 'bg-primary'
                    )}
                  />

                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary flex-shrink-0">
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
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{actorName}</span>{' '}
                      {getActionText(notification.type)}
                    </p>
                    {notification.message && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                    )}
                    {notification.videos?.title && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notification.videos.title}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>

                  {notification.videos && (
                    <div className="h-7 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted">
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
