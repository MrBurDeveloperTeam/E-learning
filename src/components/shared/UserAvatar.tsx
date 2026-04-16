import { useEffect, useState } from 'react'
import { getInitials, cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string | null | undefined
  avatarUrl?: string | null
  size?: number
  className?: string
  textClassName?: string
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 36,
  className,
  textClassName,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [avatarUrl])

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary font-medium border border-primary/20 shadow-sm',
        className
      )}
      style={{ width: size, height: size }}
    >
      {avatarUrl && !imageFailed ? (
        <img
          src={avatarUrl}
          alt={name ? `${name} avatar` : 'User avatar'}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={cn('text-xs', textClassName)}>{getInitials(name)}</span>
      )}
    </div>
  )
}
