import { useState } from 'react'
import { useComments } from '@/hooks/useComments'
import { RetryCard } from '@/components/shared/RetryCard'
import { Skeleton } from '@/components/ui/skeleton'
import { CommentInput } from './CommentInput'
import { CommentItem } from './CommentItem'

interface CommentSectionProps {
  videoId: string
  commentCount: number
}

export function CommentSection({
  videoId,
  commentCount,
}: CommentSectionProps) {
  const [sort, setSort] = useState<'top' | 'newest'>('top')
  const { data: comments = [], isLoading, isError, refetch } = useComments(videoId)

  const sortedComments =
    sort === 'newest'
      ? [...comments].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      : comments

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <h3 className="text-base font-medium text-[#1E3333]">
          {commentCount} comments
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

      <CommentInput videoId={videoId} />

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
            <CommentItem key={comment.id} comment={comment} videoId={videoId} />
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
