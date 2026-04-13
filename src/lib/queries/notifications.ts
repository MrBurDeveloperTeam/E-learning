import { supabase } from '../supabase'
import type { NotificationWithActor } from '../../types'

export async function fetchNotifications(
  userId: string
): Promise<NotificationWithActor[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      profiles!notifications_actor_id_fkey (
        user_id, full_name, username, avatar_url
      ),
      videos (
        id, title, thumbnail_url
      )
    `)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as NotificationWithActor[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}
