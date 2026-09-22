import { useEffect, useState } from 'react'
import { getInitials, cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string | null | undefined
  avatarUrl?: string | null
  userId?: string | null
  size?: number
  className?: string
  textClassName?: string
}

export function UserAvatar({
  name,
  avatarUrl,
  userId,
  size = 36,
  className,
  textClassName,
}: UserAvatarProps) {
  const accountUrl = userId ? `/api/account/public-avatar?userId=${encodeURIComponent(userId)}` : null
  const [accountImageFailed, setAccountImageFailed] = useState(false)
  const [fallbackImageFailed, setFallbackImageFailed] = useState(false)

  useEffect(() => { setAccountImageFailed(false) }, [userId])
  useEffect(() => { setFallbackImageFailed(false) }, [avatarUrl])

  const imageUrl = accountUrl && !accountImageFailed
    ? accountUrl
    : avatarUrl && !fallbackImageFailed ? avatarUrl : null

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
