import { useState } from 'react'
import { useCommentCount, useComments } from '@/hooks/useComments'
import { useProfileImage } from '@/hooks/useProfileImage'
import { useAuthStore } from '@/store/authStore'
import { RetryCard } from '@/components/shared/RetryCard'
import { Skeleton } from '@/components/ui/skeleton'
import { CommentInput } from './CommentInput'
import { CommentItem } from './CommentItem'
import type { CommentSource } from '@/lib/queries/comments'

interface CommentSectionProps {
  videoId: string
  commentCount: number
  source?: CommentSource
  videoCreatorId?: string | null
}

export function CommentSection({
  videoId,
  commentCount,
  source = 'video',
  videoCreatorId = null,
}: CommentSectionProps) {
  const user = useAuthStore((state) => state.user)
  const { profileImageUrl } = useProfileImage(Boolean(user))
  const [sort, setSort] = useState<'top' | 'newest'>('top')
  const { data: comments = [], isLoading, isError, refetch } = useComments(videoId, source)
  const commentCountQuery = useCommentCount(videoId, source)
  const displayCommentCount = commentCountQuery.data ?? commentCount

  const byNewest = (
    a: (typeof comments)[number],
    b: (typeof comments)[number]
  ) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

  // "Top": pinned first, then most liked, then most replied-to, then newest.
  // "Newest first": strictly by date, ignoring likes and pins.
  const sortedComments = [...comments].sort((a, b) => {
    if (sort === 'newest') return byNewest(a, b)

    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    if (b.like_count !== a.like_count) return b.like_count - a.like_count
    const replyDiff = (b.reply_count ?? 0) - (a.reply_count ?? 0)
    if (replyDiff !== 0) return replyDiff
    return byNewest(a, b)
  })

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <h3 className="text-base font-medium text-[#1E3333]">
          {displayCommentCount} comments
        </h3>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as 'top' | 'newest')}
          className="cursor-pointer bg-transparent text-sm text-[#6B8E8E] outline-none"
        >
          <option value="top">Top comments</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      <CommentInput
        videoId={videoId}
        source={source}
        currentUserAvatarUrl={profileImageUrl}
      />

      <div className="divider my-5" />

      {isError && <RetryCard onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && sortedComments.length > 0 && (
        <div className="space-y-5">
          {sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              videoId={videoId}
              source={source}
              videoCreatorId={videoCreatorId}
              currentUserAvatarUrl={profileImageUrl}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && sortedComments.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-[#9BB5B5]">
            No comments yet. Be the first to comment.
          </p>
        </div>
      )}
    </div>
  )
}
