import { Link, useNavigate } from '@tanstack/react-router'
import { CornerUpLeft, Flag, Heart, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { CommentWithAuthor } from '@/types'
import { cn, getDisplayName, timeAgo } from '@/lib/utils'
import { useCommentLike, useDeleteComment, useReplies } from '@/hooks/useComments'
import { useAuthStore } from '@/store/authStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const profile = useAuthStore((state) => state.profile)
  const { isLiked, toggleLike, isPending } = useCommentLike(comment.id)
  const deleteCommentMutation = useDeleteComment()
  const [showReplies, setShowReplies] = useState(false)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const repliesQuery = useReplies(showReplies ? comment.id : '')
  const replyCount = comment.reply_count ?? 0
  const isOwnComment = profile?.user_id === comment.author_id
  const authorName = getDisplayName(comment.profiles, 'Unknown user')

  function handleLike() {
    if (!session) {
      navigate({ to: '/login' })
      return
    }
    toggleLike.mutate()
  }

  async function handleDelete() {
    if (!window.confirm('Delete this comment?')) return

    try {
      await deleteCommentMutation.mutateAsync({
        commentId: comment.id,
        videoId,
      })
      toast.success('Comment deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete comment')
    }
  }

  function handleReport() {
    if (!session) {
      navigate({ to: '/login' })
      return
    }

    toast.error('Comment reporting is not available yet')
  }

  return (
    <div className={cn('flex gap-3', isReply && 'ml-10 mt-3')}>
      <Link to="/channel/$userId" params={{ userId: comment.author_id }}>
        <UserAvatar
          name={authorName}
          avatarUrl={comment.profiles?.avatar_url}
          size={isReply ? 28 : 36}
          className={isReply ? 'bg-[#D4E8E7] text-[#2D6E6A]' : 'bg-[#D4E8E7] text-[#2D6E6A]'}
        />
      </Link>

      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to="/channel/$userId"
                params={{ userId: comment.author_id }}
                className="text-sm font-medium text-[#1E3333]"
              >
                {authorName}
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

            {!isReply && (
              <div className="mt-2 flex items-center">
                <button
                  type="button"
                  onClick={() => setShowReplyInput((current) => !current)}
                  className="text-xs text-[#9BB5B5] transition-colors hover:text-[#2D6E6A]"
                >
                  Reply
                </button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={isPending}
              onClick={handleLike}
              className="flex min-w-[2.5rem] items-center justify-end gap-1 text-xs text-[#9BB5B5] transition-colors hover:text-[#2D6E6A] disabled:opacity-50"
              aria-label={isLiked ? 'Unlike comment' : 'Like comment'}
            >
              <Heart
                className={cn('h-3 w-3', isLiked && 'fill-[#2D6E6A] text-[#2D6E6A]')}
              />
              {comment.like_count > 0 && comment.like_count}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#9BB5B5] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#88C1BD]"
                aria-label="Open comment actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 rounded-xl border border-[#D4E8E7] bg-white p-1 text-[#3D5C5C] shadow-lg"
              >
                {!isReply && (
                  <DropdownMenuItem
                    onClick={() => setShowReplyInput((current) => !current)}
                    className="cursor-pointer"
                  >
                    <CornerUpLeft className="h-4 w-4" />
                    Reply
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleReport} className="cursor-pointer">
                  <Flag className="h-4 w-4" />
                  Report
                </DropdownMenuItem>
                {isOwnComment && (
                  <>
                    <DropdownMenuSeparator className="bg-[#EAF4F3]" />
                    <DropdownMenuItem
                      onClick={() => void handleDelete()}
                      className="cursor-pointer"
                      variant="destructive"
                      disabled={deleteCommentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
