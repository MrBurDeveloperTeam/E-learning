import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProfile,
  fetchPublicProfile,
  fetchPublicCreatorProfile,
  searchPublicCreators,
  updateProfile,
  uploadAvatar,
} from '../lib/queries/profiles'

export function useProfile(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: enabled && !!userId,
  })
}

export function usePublicProfile(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['public-profile', userId],
    queryFn: () => fetchPublicProfile(userId!),
    enabled: enabled && !!userId,
  })
}

export function usePublicCreatorProfile(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['public-creator-profile', userId],
    queryFn: () => fetchPublicCreatorProfile(userId!),
    enabled: enabled && !!userId,
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
      qc.invalidateQueries({ queryKey: ['public-profile', variables.userId] })
      qc.invalidateQueries({ queryKey: ['public-creator-profile', variables.userId] })
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
      qc.invalidateQueries({ queryKey: ['public-profile', variables.userId] })
      qc.invalidateQueries({ queryKey: ['public-creator-profile', variables.userId] })
    },
  })
}

export function useSearchCreators(query: string) {
  const term = query.trim()

  return useQuery({
    queryKey: ['creator-search', term],
    queryFn: () => searchPublicCreators(term),
    enabled: term.length >= 2,
  })
}
