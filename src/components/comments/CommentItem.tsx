import { Link, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useState } from 'react'
import type { CommentWithAuthor } from '@/types'
import { cn, timeAgo } from '@/lib/utils'
import { useCommentLike, useReplies } from '@/hooks/useComments'
import { useAuthStore } from '@/store/authStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { CommentInput } from './CommentInput'

interface CommentItemProps {
  comment: CommentWithAuthor
  videoId: string
  isReply?: boolean
}

export function CommentItem({
  comment,
  videoId,
  isReply = false,
}: CommentItemProps) {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const { isLiked, toggleLike, isPending } = useCommentLike(comment.id)
  const [showReplies, setShowReplies] = useState(false)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const repliesQuery = useReplies(showReplies ? comment.id : '')
  const replyCount = comment.reply_count ?? 0

  function handleLike() {
    if (!session) {
      navigate({ to: '/login' })
      return
    }
    toggleLike.mutate()
  }

  return (
    <div className={cn('flex gap-3', isReply && 'ml-10 mt-3')}>
      <Link to="/channel/$userId" params={{ userId: comment.author_id }}>
        <UserAvatar
          name={comment.profiles?.full_name ?? comment.profiles?.username}
          avatarUrl={comment.profiles?.avatar_url}
          size={isReply ? 28 : 36}
          className={isReply ? 'bg-[#D4E8E7] text-[#2D6E6A]' : 'bg-[#D4E8E7] text-[#2D6E6A]'}
        />
      </Link>

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/channel/$userId"
            params={{ userId: comment.author_id }}
            className="text-sm font-medium text-[#1E3333]"
          >
            {comment.profiles?.full_name ?? 'Unknown user'}
          </Link>
          {comment.profiles?.is_verified && <VerifiedBadge />}
          <span className="text-xs text-[#9BB5B5]">{timeAgo(comment.created_at)}</span>
          {comment.is_pinned && (
            <span className="rounded-full bg-[#D4E8E7] px-2 py-0.5 text-[10px] text-[#2D6E6A]">
              Pinned
            </span>
          )}
        </div>

        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#3D5C5C]">
          {comment.body}
        </p>

        <div className="mt-2 flex items-center">
          <button
            type="button"
            disabled={isPending}
            onClick={handleLike}
            className="flex items-center gap-1 text-xs text-[#9BB5B5] transition-colors hover:text-[#2D6E6A]"
          >
            <Heart
              className={cn('h-3 w-3', isLiked && 'fill-[#2D6E6A] text-[#2D6E6A]')}
            />
            {comment.like_count > 0 && comment.like_count}
          </button>

          {!isReply && (
            <button
              type="button"
              onClick={() => setShowReplyInput((current) => !current)}
              className="ml-3 text-xs text-[#9BB5B5] transition-colors hover:text-[#2D6E6A]"
            >
              Reply
            </button>
          )}
        </div>

        {!isReply && replyCount > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowReplies((current) => !current)}
              className="text-xs font-medium text-[#2D6E6A]"
            >
              {showReplies
                ? 'Hide replies'
                : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
            </button>
          </div>
        )}

        {!isReply && showReplyInput && (
          <div className="mt-3">
            <CommentInput
              videoId={videoId}
              parentId={comment.id}
              placeholder="Write a reply..."
              autoFocus
              onCancel={() => setShowReplyInput(false)}
            />
          </div>
        )}

        {!isReply && showReplies && (
          <div className="mt-3 space-y-3">
            {repliesQuery.isLoading &&
              Array.from({ length: Math.max(1, replyCount) }).map((_, index) => (
                <div key={index} className="ml-10 flex gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32 rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                  </div>
                </div>
              ))}

            {repliesQuery.data?.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                videoId={videoId}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
