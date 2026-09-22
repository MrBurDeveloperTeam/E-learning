import { useQuery } from '@tanstack/react-query'
import { fetchAccountProfile } from '@/lib/accountProfile'

export function useOwnAccountAvatar(userId?: string, enabled = true) {
  const accountProfile = useQuery({
    queryKey: ['snabbb-account-profile', userId],
    queryFn: fetchAccountProfile,
    enabled: Boolean(userId && enabled),
    staleTime: 60_000,
  })

  return accountProfile.data?.imageUrl ?? null
}
