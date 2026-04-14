import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SortOption } from '../types'
import {
  checkVideoLiked,
  checkVideoSaved,
  createVideo,
  deleteVideo,
  fetchCreatorVideos,
  fetchFollowingVideos,
  fetchMyVideos,
  fetchRelatedVideos,
  fetchSavedVideos,
  fetchVideo,
  fetchVideos,
  likeVideo,
  recordVideoView,
  saveVideo,
  searchVideos,
  uploadVideoThumbnail,
  unlikeVideo,
  unsaveVideo,
} from '../lib/queries/videos'
import { useAuthStore } from '../store/authStore'

function logVideoQueryError(scope: string, error: unknown, context?: Record<string, unknown>) {
  if (!import.meta.env.DEV) return

  console.error(`[videos] ${scope} failed`, {
    error,
    ...context,
  })
}

export function useVideos({
  category,
  sort = 'newest',
}: {
  category?: string
  sort?: SortOption
} = {}) {
  return useQuery({
    queryKey: ['videos', { category, sort }],
    queryFn: async () => {
      try {
        return await fetchVideos({ category, sort })
      } catch (error) {
        logVideoQueryError('list', error, { category, sort })
        throw error
      }
    },
  })
}

export function useVideo(videoId: string) {
  return useQuery({
    queryKey: ['video', videoId],
    queryFn: () => fetchVideo(videoId),
    enabled: !!videoId,
  })
}

export function useRelatedVideos(videoId: string, category?: string | null) {
  return useQuery({
    queryKey: ['related-videos', videoId, category],
    queryFn: async () => {
      try {
        return await fetchRelatedVideos(videoId, category)
      } catch (error) {
        logVideoQueryError('related', error, { videoId, category })
        throw error
      }
    },
    enabled: !!videoId,
  })
}

export function useSearchVideos(query: string) {
  const term = query.trim()

  return useQuery({
    queryKey: ['video-search', term],
    queryFn: () => searchVideos(term),
    enabled: term.length >= 2,
  })
}

export function useCreatorVideos(userId: string) {
  return useQuery({
    queryKey: ['creator-videos', userId],
    queryFn: () => fetchCreatorVideos(userId),
    enabled: !!userId,
  })
}

export function useMyVideos() {
  const profile = useAuthStore((state) => state.profile)

  return useQuery({
    queryKey: ['my-videos', profile?.user_id],
    queryFn: () => fetchMyVideos(profile!.user_id),
    enabled: !!profile?.user_id,
  })
}

export function useSavedVideos() {
  const profile = useAuthStore((state) => state.profile)

  return useQuery({
    queryKey: ['saved-videos', profile?.user_id],
    queryFn: () => fetchSavedVideos(profile!.user_id),
    enabled: !!profile?.user_id,
  })
}

export function useFollowingVideos() {
  const profile = useAuthStore((state) => state.profile)

  return useQuery({
    queryKey: ['following-videos', profile?.user_id],
    queryFn: () => fetchFollowingVideos(profile!.user_id),
    enabled: !!profile?.user_id,
  })
}

export function useVideoLike(videoId: string) {
  const qc = useQueryClient()
  const profile = useAuthStore((state) => state.profile)
  const userId = profile?.user_id

  const likedQuery = useQuery({
    queryKey: ['video-liked', userId, videoId],
    queryFn: () => checkVideoLiked(userId!, videoId),
    enabled: !!userId && !!videoId,
  })

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!userId) return

      if (likedQuery.data) {
        await unlikeVideo(userId, videoId)
      } else {
        await likeVideo(userId, videoId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['video-liked', userId, videoId] })
      qc.invalidateQueries({ queryKey: ['video', videoId] })
      qc.invalidateQueries({ queryKey: ['videos'] })
      qc.invalidateQueries({ queryKey: ['related-videos'] })
      qc.invalidateQueries({ queryKey: ['creator-videos'] })
      qc.invalidateQueries({ queryKey: ['my-videos'] })
    },
  })

  return {
    isLiked: likedQuery.data ?? false,
    isLoading: likedQuery.isLoading,
    toggleLike,
    isPending: toggleLike.isPending,
  }
}

export function useVideoSave(videoId: string) {
  const qc = useQueryClient()
  const profile = useAuthStore((state) => state.profile)
  const userId = profile?.user_id

  const savedQuery = useQuery({
    queryKey: ['video-saved', userId, videoId],
    queryFn: () => checkVideoSaved(userId!, videoId),
    enabled: !!userId && !!videoId,
  })

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!userId) return

      if (savedQuery.data) {
        await unsaveVideo(userId, videoId)
      } else {
        await saveVideo(userId, videoId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['video-saved', userId, videoId] })
      qc.invalidateQueries({ queryKey: ['saved-videos'] })
      qc.invalidateQueries({ queryKey: ['video', videoId] })
    },
  })

  return {
    isSaved: savedQuery.data ?? false,
    isLoading: savedQuery.isLoading,
    toggleSave,
    isPending: toggleSave.isPending,
  }
}

export function useRecordView() {
  const qc = useQueryClient()
  const profile = useAuthStore((state) => state.profile)

  return useMutation({
    mutationFn: async (videoId: string) => {
      if (!profile?.user_id) return
      await recordVideoView(profile.user_id, videoId)
    },
    onSuccess: (_data, videoId) => {
      qc.invalidateQueries({ queryKey: ['video', videoId] })
      qc.invalidateQueries({ queryKey: ['videos'] })
      qc.invalidateQueries({ queryKey: ['related-videos'] })
    },
  })
}

export function useDeleteVideo() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-videos'] })
      qc.invalidateQueries({ queryKey: ['videos'] })
      qc.invalidateQueries({ queryKey: ['creator-videos'] })
      qc.invalidateQueries({ queryKey: ['saved-videos'] })
      qc.invalidateQueries({ queryKey: ['following-videos'] })
    },
  })
}

export function useCreateVideo() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: createVideo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-videos'] })
      qc.invalidateQueries({ queryKey: ['videos'] })
      qc.invalidateQueries({ queryKey: ['creator-videos'] })
    },
  })
}

export function useUploadVideoThumbnail() {
  return useMutation({
    mutationFn: ({ userId, file }: { userId: string; file: File }) =>
      uploadVideoThumbnail(userId, file),
  })
}
