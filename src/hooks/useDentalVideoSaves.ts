import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  checkDentalVideoSaved,
  fetchSavedDentalVideos,
  saveDentalVideo,
  unsaveDentalVideo,
} from '@/lib/queries/dentalVideoSaves'

export function useDentalVideoSave(dentalVideoId: string) {
  const qc = useQueryClient()
  const userId = useAuthStore((state) => state.profile?.user_id)

  const savedQuery = useQuery({
    queryKey: ['dental-video-saved', userId, dentalVideoId],
    queryFn: () => checkDentalVideoSaved(userId!, dentalVideoId),
    enabled: !!userId && !!dentalVideoId,
  })

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!userId) return
      if (savedQuery.data) {
        await unsaveDentalVideo(userId, dentalVideoId)
      } else {
        await saveDentalVideo(userId, dentalVideoId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-video-saved', userId, dentalVideoId] })
      qc.invalidateQueries({ queryKey: ['saved-dental-videos'] })
    },
  })

  return {
    isSaved: savedQuery.data ?? false,
    isLoading: savedQuery.isLoading,
    toggleSave,
    isPending: toggleSave.isPending,
  }
}

export function useSavedDentalVideos() {
  const userId = useAuthStore((state) => state.profile?.user_id)

  return useQuery({
    queryKey: ['saved-dental-videos', userId],
    queryFn: () => fetchSavedDentalVideos(userId!),
    enabled: !!userId,
  })
}
