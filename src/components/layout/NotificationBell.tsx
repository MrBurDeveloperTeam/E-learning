import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { NotificationWithActor } from '@/types'
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/useNotifications'
import { cn, getDisplayName, getInitials, timeAgo } from '@/lib/utils'

function getNotificationMessage(notification: NotificationWithActor) {
  const actorName = getDisplayName(notification.profiles, 'Someone')

  switch (notification.type) {
    case 'new_follower':
      return `${actorName} started following you`
    case 'new_like':
      return `${actorName} liked your video`
    case 'new_comment':
      return `${actorName} commented on your video`
    case 'new_reply':
      return `${actorName} replied to your comment`
    case 'community_comment_reply':
      return `${actorName} replied to your Community comment`
    case 'community_comment_like':
      return `${actorName} liked your Community comment`
    case 'community_mention':
      return `${actorName} mentioned you in Community`
    case 'community_report_resolved':
      return notification.title ?? 'Your Community report was reviewed'
    case 'community_appeal_decided':
      return notification.title ?? 'Your Community appeal was reviewed'
    case 'community_post_like':
      return `${actorName} liked your Community post`
    case 'community_comment':
      return `${actorName} commented on your Community post`
    case 'community_reply':
      return `${actorName} replied to your Community comment`
    case 'community_friend_request':
      return `${actorName} sent you a friend request`
    case 'community_friend_accepted':
      return `${actorName} accepted your friend request`
    case 'community_join_request':
      return `${actorName} requested to join your Community`
    case 'community_join_decision':
      return notification.title ?? 'Your Community join request was reviewed'
    case 'community_announcement':
      return notification.title ?? 'A Community you joined has an update'
    case 'community_message':
    case 'community_direct_message':
      return `${actorName} sent you a message`
    case 'community_post_review':
      return notification.title ?? 'Your Community content was reviewed'
    case 'new_video':
      return `${actorName} uploaded a new video`
    default:
      return `${actorName} sent you a notification`
  }
}

function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0">
      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/40" />
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-2/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-8 w-12 animate-pulse rounded-md bg-muted" />
    </div>
  )
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { data: notifications = [], isLoading } = useNotifications()
  const { data: unreadCount = 0 } = useUnreadCount()
  const markAllRead = useMarkAllRead()
  const markRead = useMarkRead()

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  function handleNotificationClick(notification: NotificationWithActor) {
    markRead.mutate(notification)

    if (notification.action_url?.startsWith('/')) {
      void navigate({ to: notification.action_url })
    } else if (notification.type === 'new_follower') {
      void navigate({
        to: '/profile/$userId',
        params: {
          userId: notification.profiles?.user_id ?? notification.actor_id,
        },
      })
    } else if (notification.community_post_id) {
      void navigate({ to: '/community/post/$postId', params: { postId: notification.community_post_id } })
    } else if (notification.type === 'community_appeal_decided' || notification.type === 'community_report_resolved') {
      void navigate({ to: '/community', search: { tab: 'settings', q: undefined, topic: undefined, sort: undefined } })
    } else if (notification.video_id) {
      void navigate({
        to: '/watch/$videoId',
        params: { videoId: notification.video_id },
      })
    }

    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors duration-150 hover:bg-muted dark:hover:bg-muted/50"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <svg
          width="20"
          height="20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <div className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[#DC2626] rounded-full flex items-center justify-center px-1">
            <span className="text-[10px] font-medium text-white leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-4 right-4 top-16 z-[120] animate-fade-in overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[360px]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-xs text-primary transition-colors hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto md:max-h-[400px]">
            {isLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <NotificationRowSkeleton key={index} />
              ))}

            {!isLoading && notifications.length === 0 && (
              <div className="py-10 text-center">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mx-auto text-muted-foreground"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <p className="mt-3 text-sm text-muted-foreground">
                  No notifications yet
                </p>
              </div>
            )}

            {!isLoading &&
              notifications.map((notification) => {
                const actorName = getDisplayName(notification.profiles, 'Someone')

                return (
                  <div
                  key={`${notification.source ?? 'platform'}:${notification.id}`}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 cursor-pointer',
                      'border-b border-border last:border-0',
                      'transition-colors hover:bg-muted/70',
                      !notification.is_read && 'bg-primary/10'
                    )}
                  >
                    {!notification.is_read ? (
                      <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    ) : (
                      <div className="w-1.5 h-1.5 flex-shrink-0" />
                    )}

                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary text-[11px] font-medium text-secondary-foreground">
                      {notification.profiles?.avatar_url ? (
                        <img
                          src={notification.profiles.avatar_url}
                          alt={actorName ? `${actorName} avatar` : 'Avatar'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(actorName)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {getNotificationMessage(notification)}
                      </p>

                      {notification.videos?.title && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {notification.videos.title}
                        </p>
                      )}

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>

                    {notification.videos && (
                      <div className="h-8 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
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

          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs text-primary transition-colors hover:text-foreground"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
