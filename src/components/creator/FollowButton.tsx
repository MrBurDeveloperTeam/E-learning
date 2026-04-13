import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useFollowToggle } from '@/hooks/useFollow'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

interface FollowButtonProps {
  userId: string
  size?: 'sm' | 'md'
  className?: string
}

export function FollowButton({
  userId,
  size = 'md',
  className,
}: FollowButtonProps) {
  const navigate = useNavigate()
  const profile = useAuthStore((state) => state.profile)
  const session = useAuthStore((state) => state.session)
  const [isHovered, setIsHovered] = useState(false)
  const { isFollowing, toggleFollow, isPending } = useFollowToggle(userId)

  if (profile?.user_id === userId) {
    return null
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={() => navigate({ to: '/login' })}
        className={cn(
          'btn-outline text-sm',
          size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2',
          className
        )}
      >
        Sign in to follow
      </button>
    )
  }

  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  if (isPending) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          isFollowing ? 'btn-outline' : 'btn-primary',
          'flex items-center gap-1.5',
          sizeClasses,
          className
        )}
      >
        <LoadingSpinner size="sm" />
      </button>
    )
  }

  if (!isFollowing) {
    return (
      <button
        type="button"
        onClick={() => toggleFollow()}
        className={cn(
          'btn-primary flex items-center gap-1.5',
          sizeClasses,
          className
        )}
      >
        <span>+</span>
        <span>Follow</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => toggleFollow()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'btn-outline flex items-center gap-1.5 hover:border-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#DC2626]',
        sizeClasses,
        className
      )}
    >
      <span>{isHovered ? 'Unfollow' : 'Following'}</span>
    </button>
  )
}
