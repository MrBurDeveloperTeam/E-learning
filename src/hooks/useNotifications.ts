import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/queries/notifications'

export function useNotifications() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!profile?.user_id) return

    const channel = supabase
      .channel(`notifications:${profile.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.user_id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['notifications', profile.user_id],
          })
          queryClient.invalidateQueries({
            queryKey: ['notifications-full', profile.user_id],
          })
          queryClient.invalidateQueries({
            queryKey: ['unread-count', profile.user_id],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.user_id, queryClient])

  return useQuery({
    queryKey: ['notifications', profile?.user_id],
    queryFn: () => fetchNotifications(profile!.user_id),
    enabled: !!profile?.user_id,
  })
}

export function useUnreadCount() {
  const { profile } = useAuthStore()

  return useQuery({
    queryKey: ['unread-count', profile?.user_id],
    queryFn: () => fetchUnreadCount(profile!.user_id),
    enabled: !!profile?.user_id,
    refetchInterval: 30_000,
  })
}

export function useMarkRead() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationRead,
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message || 'Something went wrong')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notifications', profile?.user_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['notifications-full', profile?.user_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['unread-count', profile?.user_id],
      })
    },
  })
}

export function useMarkAllRead() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => markAllNotificationsRead(profile!.user_id),
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message || 'Something went wrong')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notifications', profile?.user_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['notifications-full', profile?.user_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['unread-count', profile?.user_id],
      })
    },
  })
}
