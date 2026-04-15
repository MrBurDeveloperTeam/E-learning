import { Link } from '@tanstack/react-router'
import type { PublicCreatorProfile } from '@/types'
import { formatViewCount, getDisplayName } from '@/lib/utils'
import { FollowButton } from './FollowButton'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'

export function CreatorCard({ profile }: { profile: PublicCreatorProfile }) {
  const creatorName = getDisplayName(profile, 'Unknown creator')

  return (
    <div className="card-hover p-4">
      <div className="flex items-center gap-4">
        <Link to="/channel/$userId" params={{ userId: profile.user_id }}>
          <UserAvatar
            name={creatorName}
            avatarUrl={profile.avatar_url}
            size={56}
            textClassName="text-sm"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to="/channel/$userId"
            params={{ userId: profile.user_id }}
            className="flex items-center text-sm font-medium text-[#1E3333]"
          >
            <span className="truncate">{creatorName}</span>
            {profile.is_verified && <VerifiedBadge />}
          </Link>
          <p className="text-xs text-[#6B8E8E]">{profile.specialty ?? 'Dental professional'}</p>
          <p className="text-xs text-[#9BB5B5]">
            {formatViewCount(profile.follower_count)} followers · {profile.video_count} videos
          </p>
        </div>

        <FollowButton userId={profile.user_id} size="sm" />
      </div>
    </div>
  )
}
