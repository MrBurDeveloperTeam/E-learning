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
    case 'new_video':
      return `${actorName} uploaded a new video`
    default:
      return `${actorName} sent you a notification`
  }
}

function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-[#EDF2F2] last:border-0">
      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#D4E8E7]" />
      <div className="h-8 w-8 animate-pulse rounded-full bg-[#EDF2F2]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-4/5 animate-pulse rounded bg-[#EDF2F2]" />
        <div className="h-2.5 w-2/5 animate-pulse rounded bg-[#EDF2F2]" />
      </div>
      <div className="h-8 w-12 animate-pulse rounded-md bg-[#EDF2F2]" />
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
    markRead.mutate(notification.id)

    if (notification.type === 'new_follower') {
      void navigate({
        to: '/profile/$userId',
        params: {
          userId: notification.profiles?.user_id ?? notification.actor_id,
        },
      })
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
        className="relative p-2 rounded-lg text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors duration-150"
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
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-[#D4E8E7] rounded-2xl shadow-lg z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D4E8E7]">
            <p className="text-sm font-medium text-[#1E3333]">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-xs text-[#88C1BD] hover:text-[#2D6E6A] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
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
                  stroke="#D4E8E7"
                  strokeWidth="1.5"
                  className="mx-auto"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <p className="text-sm text-[#9BB5B5] mt-3">
                  No notifications yet
                </p>
              </div>
            )}

            {!isLoading &&
              notifications.map((notification) => {
                const actorName = getDisplayName(notification.profiles, 'Someone')

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 cursor-pointer',
                      'border-b border-[#EDF2F2] last:border-0',
                      'transition-colors hover:bg-[#F7FAFA]',
                      !notification.is_read && 'bg-[#EAF4F3]'
                    )}
                  >
                    {!notification.is_read ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#88C1BD] flex-shrink-0 mt-1.5" />
                    ) : (
                      <div className="w-1.5 h-1.5 flex-shrink-0" />
                    )}

                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#D4E8E7] text-[11px] font-medium text-[#2D6E6A]">
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
                      <p className="text-sm text-[#3D5C5C]">
                        {getNotificationMessage(notification)}
                      </p>

                      {notification.videos?.title && (
                        <p className="text-xs text-[#9BB5B5] mt-0.5 truncate">
                          {notification.videos.title}
                        </p>
                      )}

                      <p className="text-xs text-[#9BB5B5] mt-0.5">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>

                    {notification.videos && (
                      <div className="w-12 h-8 rounded-md bg-[#EDF2F2] flex-shrink-0 overflow-hidden">
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

          <div className="px-4 py-2.5 border-t border-[#D4E8E7] text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs text-[#88C1BD] hover:text-[#2D6E6A] transition-colors"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
