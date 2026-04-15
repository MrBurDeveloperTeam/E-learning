import { Link, useNavigate } from '@tanstack/react-router'
import type { KeyboardEvent } from 'react'
import type { VideoWithCreator } from '@/types'
import { cn, formatViewCount, getDisplayName, timeAgo } from '@/lib/utils'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { VideoThumbnail } from '@/components/shared/VideoThumbnail'

interface VideoCardProps {
  video: VideoWithCreator
  size?: 'default' | 'small' | 'horizontal'
  showCreator?: boolean
  showCategory?: boolean
}

export function VideoCard({
  video,
  size = 'default',
  showCreator = true,
  showCategory = false,
}: VideoCardProps) {
  const navigate = useNavigate()
  const isHorizontal = size === 'horizontal'
  const isSmall = size === 'small'
  const creator = video.profiles
  const creatorName = getDisplayName(creator, 'Unknown creator')
  const shouldShowAvatar = showCreator && !isSmall && !isHorizontal

  function openVideo() {
    navigate({
      to: '/watch/$videoId',
      params: { videoId: video.id },
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openVideo()
    }
  }

  if (isHorizontal) {
    return (
      <div
        className="group flex cursor-pointer gap-3 animate-fade-in"
        role="link"
        tabIndex={0}
        onClick={openVideo}
        onKeyDown={handleKeyDown}
      >
        <div className="w-[168px] flex-shrink-0">
          <VideoThumbnail
            src={video.thumbnail_url}
            title={video.title}
            durationSeconds={video.duration_seconds}
            status={video.status}
            className="aspect-video"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 line-clamp-2 text-sm font-medium leading-snug text-[#1E3333] transition-colors group-hover:text-[#2D6E6A]">
            {video.title}
          </h3>
          {showCreator && (
            <Link
              to="/channel/$userId"
              params={{ userId: video.creator_id }}
              onClick={(event) => event.stopPropagation()}
              className="mb-0.5 flex items-center text-xs text-[#6B8E8E] transition-colors hover:text-[#2D6E6A]"
            >
              <span className="truncate">{creatorName}</span>
              {creator?.is_verified && <VerifiedBadge />}
            </Link>
          )}
          <p className="text-xs text-[#9BB5B5]">
            {formatViewCount(video.view_count)} views · {timeAgo(video.created_at)}
          </p>
          {showCategory && (
            <span className="badge-specialty mt-1 inline-block">
              {video.category}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="group cursor-pointer animate-fade-in"
      role="link"
      tabIndex={0}
      onClick={openVideo}
      onKeyDown={handleKeyDown}
    >
      <VideoThumbnail
        src={video.thumbnail_url}
        title={video.title}
        durationSeconds={video.duration_seconds}
        status={video.status}
        className="aspect-video"
      />

      <div className="mt-2.5 flex gap-2.5">
        {shouldShowAvatar && (
          <Link
            to="/channel/$userId"
            params={{ userId: video.creator_id }}
            onClick={(event) => event.stopPropagation()}
          >
            <UserAvatar
              name={creatorName}
              avatarUrl={creator?.avatar_url}
              size={36}
              className="flex-shrink-0 transition-opacity hover:opacity-80"
            />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'leading-snug text-[#1E3333] transition-colors group-hover:text-[#2D6E6A]',
              isSmall
                ? 'mb-0.5 line-clamp-1 text-sm font-medium'
                : 'mb-1 line-clamp-2 text-sm font-medium'
            )}
          >
            {video.title}
          </h3>

          {showCreator && (
            <Link
              to="/channel/$userId"
              params={{ userId: video.creator_id }}
              onClick={(event) => event.stopPropagation()}
              className="mb-0.5 flex items-center text-xs text-[#6B8E8E] transition-colors hover:text-[#2D6E6A]"
            >
              <span className="truncate">{creatorName}</span>
              {creator?.is_verified && <VerifiedBadge />}
            </Link>
          )}

          <p className={cn('text-[#9BB5B5]', isSmall ? 'text-[11px]' : 'text-xs')}>
            {formatViewCount(video.view_count)} views · {timeAgo(video.created_at)}
          </p>

          {showCategory && (
            <span className="badge-specialty mt-1 inline-block">
              {video.category}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
