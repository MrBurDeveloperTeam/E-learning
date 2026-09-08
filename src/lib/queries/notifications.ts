import { supabase } from '../supabase'
import type { NotificationWithActor } from '../../types'

const communityNotificationTypeMap: Record<string, NotificationWithActor['type']> = {
  new_follower: 'new_follower',
  post_like: 'community_post_like',
  post_comment: 'community_comment',
  comment_reply: 'community_reply',
  comment_like: 'community_comment_like',
  mention: 'community_mention',
  community_update: 'community_announcement',
  community_join_request: 'community_join_request',
  community_join_approved: 'community_join_decision',
  community_join_rejected: 'community_join_decision',
  new_message: 'community_message',
  verification_approved: 'community_verification_result',
  verification_rejected: 'community_verification_result',
  moderation_action: 'community_post_review',
  report_resolved: 'community_report_resolved',
  appeal_decided: 'community_appeal_decided',
  friend_request: 'community_friend_request',
  friend_accepted: 'community_friend_accepted',
}

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

  const communityRows = communityResult.data ?? []
  const actorIds = [...new Set(communityRows.map(item => item.actor_id).filter((id): id is string => Boolean(id)))]
  const publicProfiles = actorIds.length
    ? await supabase.from('public_profiles').select('user_id,name,full_name,username,avatar_url').in('user_id', actorIds)
    : { data: [], error: null }
  if (publicProfiles.error) throw publicProfiles.error
  const actorProfiles = new Map((publicProfiles.data ?? []).map(profile => [profile.user_id, profile]))

  const platform = (platformResult.data ?? []).map((item) => ({ ...item, source: 'platform' as const }))
  const community = communityRows.map((item) => ({
    ...item,
    type: communityNotificationTypeMap[item.notification_type] ?? item.notification_type,
    profiles: actorProfiles.get(item.actor_id) ?? item.profiles ?? null,
    video_id: null,
    community_post_id: item.post_id ?? null,
    community_comment_id: item.comment_id ?? null,
    comment_id: null,
    videos: null,
    action_url: item.notification_type === 'friend_request' ? `/profile/${userId}?requests=1` : item.action_url,
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
