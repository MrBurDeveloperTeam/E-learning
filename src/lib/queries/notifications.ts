import { supabase } from '../supabase'
import type { NotificationWithActor } from '../../types'

export async function fetchNotifications(
  userId: string,
  limit = 30,
): Promise<NotificationWithActor[]> {
  const [platformResult, communityResult] = await Promise.all([
    supabase
      .from('notifications')
      .select(`
        *,
        profiles!notifications_actor_id_fkey (
          user_id, name, full_name, username, avatar_url
        ),
        videos (
          id, title, thumbnail_url
        )
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('community_notifications')
      .select(`
        *,
        profiles!community_notifications_actor_id_fkey (
          user_id, name, full_name, username, avatar_url
        )
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (platformResult.error) throw platformResult.error
  // Transitional fallback: older local databases do not have the isolated table
  // yet and still store Community events in the platform notification table.
  const communityMissing = communityResult.error?.code === '42P01' || communityResult.error?.code === 'PGRST205'
  if (communityResult.error && !communityMissing) throw communityResult.error

  const platform = (platformResult.data ?? []).map((item) => ({ ...item, source: 'platform' as const }))
  const community = (communityResult.data ?? []).map((item) => ({
    ...item,
    video_id: null,
    comment_id: null,
    videos: null,
    source: 'community' as const,
  }))

  return [...platform, ...community]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit) as NotificationWithActor[]
}

export async function markNotificationRead(notification: Pick<NotificationWithActor, 'id' | 'source'>): Promise<void> {
  const { error } = await supabase
    .from(notification.source === 'community' ? 'community_notifications' : 'notifications')
    .update(notification.source === 'community' ? { is_read: true, read_at: new Date().toISOString() } : { is_read: true })
    .eq('id', notification.id)
  if (error) throw error
}

export async function markAllNotificationsRead(
  userId: string
): Promise<void> {
  const [platformResult, communityResult] = await Promise.all([
    supabase.from('notifications').update({ is_read: true }).eq('recipient_id', userId).eq('is_read', false),
    supabase.from('community_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('recipient_id', userId).eq('is_read', false),
  ])
  if (platformResult.error) throw platformResult.error
  const communityMissing = communityResult.error?.code === '42P01' || communityResult.error?.code === 'PGRST205'
  if (communityResult.error && !communityMissing) throw communityResult.error
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const [platformResult, communityResult] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).eq('is_read', false),
    supabase.from('community_notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).eq('is_read', false),
  ])
  if (platformResult.error) throw platformResult.error
  const communityMissing = communityResult.error?.code === '42P01' || communityResult.error?.code === 'PGRST205'
  if (communityResult.error && !communityMissing) throw communityResult.error
  return (platformResult.count ?? 0) + (communityResult.count ?? 0)
}
