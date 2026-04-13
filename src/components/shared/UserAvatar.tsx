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
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full bg-[#2D6E6A] text-[#EAF4F3] font-medium',
        className
      )}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name ? `${name} avatar` : 'User avatar'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={cn('text-xs', textClassName)}>{getInitials(name)}</span>
      )}
    </div>
  )
}
