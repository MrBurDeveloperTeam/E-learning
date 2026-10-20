import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  checkCommentLiked,
  createComment,
  deleteOwnComment,
  fetchCommentCount,
  fetchComments,
  fetchReplies,
  likeComment,
  unlikeComment,
  type CommentSource,
} from '../lib/queries/comments'
import { useAuthStore } from '../store/authStore'

export function useComments(videoId: string, source: CommentSource = 'video') {
  return useQuery({
    queryKey: ['comments', videoId],
    queryFn: () => fetchComments(videoId, source),
    enabled: !!videoId,
  })
}

export function useCommentCount(videoId: string, source: CommentSource = 'video') {
  return useQuery({
    queryKey: ['comment-count', videoId],
    queryFn: () => fetchCommentCount(videoId, source),
    enabled: !!videoId,
  })
}

export function useReplies(parentId: string, source: CommentSource = 'video') {
  return useQuery({
    queryKey: ['replies', parentId],
    queryFn: () => fetchReplies(parentId, source),
    enabled: !!parentId,
  })
}

export function useCreateComment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: createComment,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['comments', variables.video_id] })
      qc.invalidateQueries({ queryKey: ['comment-count', variables.video_id] })
      qc.invalidateQueries({ queryKey: ['video', variables.video_id] })
      if (variables.parent_id) {
        qc.invalidateQueries({ queryKey: ['replies', variables.parent_id] })
      }
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  const profile = useAuthStore((state) => state.profile)
  const userId = profile?.user_id

  return useMutation({
    mutationFn: async ({
      commentId,
      source = 'video',
    }: {
      commentId: string
      videoId: string
      source?: CommentSource
    }) => {
      if (!userId) {
        throw new Error('You must be signed in to delete a comment.')
      }

      await deleteOwnComment(userId, commentId, source)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['comments', variables.videoId] })
      qc.invalidateQueries({ queryKey: ['comment-count', variables.videoId] })
      qc.invalidateQueries({ queryKey: ['replies'] })
      qc.invalidateQueries({ queryKey: ['comment-liked'] })
      qc.invalidateQueries({ queryKey: ['video', variables.videoId] })
      qc.setQueryData(['video', variables.videoId], (current: any) => {
        if (!current) return current
        return {
          ...current,
          comment_count: Math.max((current.comment_count ?? 0) - 1, 0),
        }
      })
    },
  })
}

export function useCommentLike(commentId: string, source: CommentSource = 'video') {
  const qc = useQueryClient()
  const profile = useAuthStore((state) => state.profile)
  const userId = profile?.user_id

  const likedQuery = useQuery({
    queryKey: ['comment-liked', userId, commentId],
    queryFn: () => checkCommentLiked(userId!, commentId, source),
    enabled: !!userId && !!commentId,
  })

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!userId) return

      if (likedQuery.data) {
        await unlikeComment(userId, commentId, source)
      } else {
        await likeComment(userId, commentId, source)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comment-liked', userId, commentId] })
      qc.invalidateQueries({ queryKey: ['comments'] })
      qc.invalidateQueries({ queryKey: ['replies'] })
    },
  })

  return {
    isLiked: likedQuery.data ?? false,
    isLoading: likedQuery.isLoading,
    toggleLike,
    isPending: toggleLike.isPending,
  }
}
