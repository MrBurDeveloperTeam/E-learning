import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import type { Profile } from '@/types'
import {
  followUser,
  unfollowUser,
  checkIsFollowing,
  fetchFollowers,
  fetchFollowing,
} from '@/lib/queries/follows'
import { fetchProfile } from '@/lib/queries/profiles'

export function useIsFollowing(followingId: string) {
  const { profile } = useAuthStore()

  return useQuery({
    queryKey: ['is-following', profile?.user_id, followingId],
    queryFn: async () => {
      try {
        return await checkIsFollowing(profile!.user_id, followingId)
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'PGRST116'
        ) {
          return false
        }

        throw error
      }
    },
    enabled:
      !!profile?.user_id &&
      !!followingId &&
      profile.user_id !== followingId,
  })
}

export function useFollowToggle(followingId: string) {
  const { profile } = useAuthStore()
  const setProfile = useAuthStore((state) => state.setProfile)
  const queryClient = useQueryClient()
  const { data: isFollowing } = useIsFollowing(followingId)

  const mutation = useMutation({
    mutationFn: () =>
      isFollowing
        ? unfollowUser(profile!.user_id, followingId)
        : followUser(profile!.user_id, followingId),
    onMutate: async () => {
      const followerId = profile?.user_id
      const nextIsFollowing = !isFollowing

      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ['is-following', followerId, followingId],
        }),
        queryClient.cancelQueries({
          queryKey: ['profile', followingId],
        }),
        queryClient.cancelQueries({
          queryKey: ['profile', followerId],
        }),
      ])

      const previousIsFollowing = queryClient.getQueryData<boolean>([
        'is-following',
        followerId,
        followingId,
      ])
      const previousTargetProfile = queryClient.getQueryData<Profile>([
        'profile',
        followingId,
      ])
      const previousCurrentProfile = followerId
        ? queryClient.getQueryData<Profile>(['profile', followerId])
        : undefined

      queryClient.setQueryData(
        ['is-following', followerId, followingId],
        nextIsFollowing
      )

      if (previousTargetProfile) {
        queryClient.setQueryData<Profile>(['profile', followingId], {
          ...previousTargetProfile,
          follower_count: Math.max(
            0,
            previousTargetProfile.follower_count +
              (nextIsFollowing ? 1 : -1)
          ),
        })
      }

      if (followerId && previousCurrentProfile) {
        const nextCurrentProfile = {
          ...previousCurrentProfile,
          following_count: Math.max(
            0,
            previousCurrentProfile.following_count +
              (nextIsFollowing ? 1 : -1)
          ),
        }

        queryClient.setQueryData<Profile>(['profile', followerId], nextCurrentProfile)

        if (profile?.user_id === followerId) {
          setProfile(nextCurrentProfile)
        }
      }

      return {
        previousIsFollowing,
        previousTargetProfile,
        previousCurrentProfile,
        followerId,
      }
    },
    onError: (err, _variables, context) => {
      if (context) {
        queryClient.setQueryData(
          ['is-following', context.followerId, followingId],
          context.previousIsFollowing
        )

        if (context.previousTargetProfile) {
          queryClient.setQueryData(
            ['profile', followingId],
            context.previousTargetProfile
          )
        }

        if (context.followerId && context.previousCurrentProfile) {
          queryClient.setQueryData(
            ['profile', context.followerId],
            context.previousCurrentProfile
          )

          if (profile?.user_id === context.followerId) {
            setProfile(context.previousCurrentProfile)
          }
        }
      }

      const message =
        err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message || 'Something went wrong')
    },
    onSettled: async () => {
      queryClient.invalidateQueries({
        queryKey: ['is-following', profile?.user_id, followingId],
      })
      queryClient.invalidateQueries({
        queryKey: ['profile', followingId],
      })
      queryClient.invalidateQueries({
        queryKey: ['profile', profile?.user_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['public-profile', followingId],
      })
      queryClient.invalidateQueries({
        queryKey: ['public-profile', profile?.user_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['public-creator-profile', followingId],
      })
      queryClient.invalidateQueries({
        queryKey: ['public-creator-profile', profile?.user_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['followers', followingId],
      })
      queryClient.invalidateQueries({
        queryKey: ['following', profile?.user_id],
      })

      if (profile?.user_id) {
        try {
          const latestProfile = await queryClient.fetchQuery({
            queryKey: ['profile', profile.user_id],
            queryFn: () => fetchProfile(profile.user_id),
          })
          setProfile(latestProfile)
        } catch {
          // Ignore background sync errors and keep optimistic state.
        }
      }
    },
  })

  return {
    isFollowing: !!isFollowing,
    toggleFollow: mutation.mutate,
    isPending: mutation.isPending,
  }
}

export function useFollowers(userId: string) {
  return useQuery({
    queryKey: ['followers', userId],
    queryFn: () => fetchFollowers(userId),
    enabled: !!userId,
  })
}

export function useFollowing(userId: string) {
  return useQuery({
    queryKey: ['following', userId],
    queryFn: () => fetchFollowing(userId),
    enabled: !!userId,
  })
}
