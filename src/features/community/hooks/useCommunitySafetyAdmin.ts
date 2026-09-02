import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applyCommunityRestriction, fetchCommunityUserSafety, revokeCommunityRestriction, warnCommunityUser } from '@/features/community/api/communitySafetyAdminApi'

export function useCommunityUserSafety(userId?: string) {
  return useQuery({ queryKey: ['admin-community-user-safety', userId], queryFn: () => fetchCommunityUserSafety(userId!), enabled: Boolean(userId) })
}

export function useApplyCommunityRestriction(userId?: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: applyCommunityRestriction, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-community-user-safety', userId] }) })
}

export function useRevokeCommunityRestriction(userId?: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: revokeCommunityRestriction, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-community-user-safety', userId] }) })
}

export function useWarnCommunityUser(userId?: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: warnCommunityUser, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-community-user-safety', userId] }) })
}
