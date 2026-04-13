import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProfile,
  searchCreators,
  updateProfile,
  uploadAvatar,
} from '../lib/queries/profiles'

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string
      payload: Parameters<typeof updateProfile>[1]
    }) => updateProfile(userId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['profile', variables.userId] })
    },
  })
}

export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, file }: { userId: string; file: File }) =>
      uploadAvatar(userId, file),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['profile', variables.userId] })
    },
  })
}

export function useSearchCreators(query: string) {
  const term = query.trim()

  return useQuery({
    queryKey: ['creator-search', term],
    queryFn: () => searchCreators(term),
    enabled: term.length >= 2,
  })
}
