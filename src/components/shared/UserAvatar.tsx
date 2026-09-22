import { useEffect, useState } from 'react'
import { getInitials, cn } from '@/lib/utils'
import { getAccountAvatarUrl } from '@/lib/accountAvatar'

interface UserAvatarProps {
  name: string | null | undefined
  avatarUrl?: string | null
  userId?: string | null
  preferAvatarUrl?: boolean
  size?: number
  className?: string
  textClassName?: string
}

export function UserAvatar({
  name,
  avatarUrl,
  userId,
  preferAvatarUrl = false,
  size = 36,
  className,
  textClassName,
}: UserAvatarProps) {
  const accountUrl = getAccountAvatarUrl(userId)
  const [accountImageFailed, setAccountImageFailed] = useState(false)
  const [fallbackImageFailed, setFallbackImageFailed] = useState(false)

  useEffect(() => { setAccountImageFailed(false) }, [userId])
  useEffect(() => { setFallbackImageFailed(false) }, [avatarUrl])

  const preferredUrl = preferAvatarUrl ? avatarUrl : accountUrl
  const alternateUrl = preferAvatarUrl ? accountUrl : avatarUrl
  const preferredFailed = preferAvatarUrl ? fallbackImageFailed : accountImageFailed
  const alternateFailed = preferAvatarUrl ? accountImageFailed : fallbackImageFailed
  const imageUrl = preferredUrl && !preferredFailed
    ? preferredUrl
    : alternateUrl && !alternateFailed ? alternateUrl : null

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary font-medium border border-primary/20 shadow-sm',
        className
      )}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name ? `${name} avatar` : 'User avatar'}
          className="h-full w-full object-cover"
          onError={() => {
            if (imageUrl === accountUrl) setAccountImageFailed(true)
            else setFallbackImageFailed(true)
          }}
        />
      ) : (
        <span className={cn('text-xs', textClassName)}>{getInitials(name)}</span>
      )}
    </div>
  )
}
