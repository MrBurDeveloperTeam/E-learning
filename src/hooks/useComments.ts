import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  checkCommentLiked,
  createComment,
  deleteComment,
  fetchComments,
  fetchReplies,
  likeComment,
  unlikeComment,
} from '../lib/queries/comments'
import { useAuthStore } from '../store/authStore'

export function useComments(videoId: string) {
  return useQuery({
    queryKey: ['comments', videoId],
    queryFn: () => fetchComments(videoId),
    enabled: !!videoId,
  })
}

export function useReplies(parentId: string) {
  return useQuery({
    queryKey: ['replies', parentId],
    queryFn: () => fetchReplies(parentId),
    enabled: !!parentId,
  })
}

export function useCreateComment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: createComment,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['comments', variables.video_id] })
      if (variables.parent_id) {
        qc.invalidateQueries({ queryKey: ['replies', variables.parent_id] })
      }
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments'] })
      qc.invalidateQueries({ queryKey: ['replies'] })
    },
  })
}

export function useCommentLike(commentId: string) {
  const qc = useQueryClient()
  const profile = useAuthStore((state) => state.profile)
  const userId = profile?.user_id

  const likedQuery = useQuery({
    queryKey: ['comment-liked', userId, commentId],
    queryFn: () => checkCommentLiked(userId!, commentId),
    enabled: !!userId && !!commentId,
  })

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!userId) return

      if (likedQuery.data) {
        await unlikeComment(userId, commentId)
      } else {
        await likeComment(userId, commentId)
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
