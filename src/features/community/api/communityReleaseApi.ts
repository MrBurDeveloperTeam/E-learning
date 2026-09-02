import { supabase } from '@/lib/supabase'
import type { CommunityPostTopic } from '@/features/community/types'
import { COMMUNITY_TABLES, CommunityBackendUnavailableError } from '@/features/community/api/communityContract'

export type CommunityNotificationPreferences = {
  likes: boolean; replies: boolean; mentions: boolean; follows: boolean
  friend_requests: boolean; community_updates: boolean; moderation_updates: boolean; direct_messages: boolean
}

const defaultNotificationPreferences: CommunityNotificationPreferences = {
  likes: true, replies: true, mentions: true, follows: true,
  friend_requests: true, community_updates: true, moderation_updates: true, direct_messages: true,
}

export async function fetchCommunityNotificationPreferences(userId: string) {
  const { data, error } = await supabase.from(COMMUNITY_TABLES.userSettings).select('notify_post_likes,notify_comments,notify_follows,notify_friend_requests,notify_community_activity,notify_messages').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ? { likes: data.notify_post_likes, replies: data.notify_comments, mentions: data.notify_comments, follows: data.notify_follows, friend_requests: data.notify_friend_requests, community_updates: data.notify_community_activity, moderation_updates: data.notify_community_activity, direct_messages: data.notify_messages } : defaultNotificationPreferences
}

export async function saveCommunityNotificationPreferences(userId: string, preferences: CommunityNotificationPreferences) {
  const { error } = await supabase.from(COMMUNITY_TABLES.userSettings).upsert({ user_id: userId, notify_post_likes: preferences.likes, notify_comments: preferences.replies || preferences.mentions, notify_follows: preferences.follows, notify_friend_requests: preferences.friend_requests, notify_community_activity: preferences.community_updates || preferences.moderation_updates, notify_messages: preferences.direct_messages })
  if (error) throw error
}

export async function fetchFollowedCommunityTopics(userId: string) {
  const { data, error } = await supabase.from(COMMUNITY_TABLES.userTopicPreferences).select('topic_id').eq('user_id', userId).eq('preference_source', 'explicit').eq('is_muted', false)
  if (error) throw error
  const ids = (data ?? []).map((row) => row.topic_id)
  if (!ids.length) return []
  const topics = await supabase.from(COMMUNITY_TABLES.topics).select('id,slug').in('id', ids)
  if (topics.error) throw topics.error
  return (topics.data ?? []).map((row) => row.slug.replaceAll('-', '_') as CommunityPostTopic)
}

export async function setCommunityTopicFollow(userId: string, topic: CommunityPostTopic, active: boolean) {
  const topicRow = await supabase.from(COMMUNITY_TABLES.topics).select('id').eq('slug', topic.replaceAll('_', '-')).maybeSingle()
  if (topicRow.error) throw topicRow.error
  if (!topicRow.data) throw new Error(`Community topic ${topic} has not been configured.`)
  const operation = active
    ? supabase.from(COMMUNITY_TABLES.userTopicPreferences).upsert({ user_id: userId, topic_id: topicRow.data.id, preference_source: 'explicit', preference_score: 1, is_muted: false })
    : supabase.from(COMMUNITY_TABLES.userTopicPreferences).delete().eq('user_id', userId).eq('topic_id', topicRow.data.id).eq('preference_source', 'explicit')
  const { error } = await operation
  if (error) throw error
}

export type CommunityAppeal = {
  id: string; post_id: string | null; comment_id: string | null; community_id:string|null;moderation_action_id:string|null;target_label:string|null;reason: string
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'; decision_note: string | null
  created_at: string; reviewed_at: string | null
}

export async function fetchCommunityAppeals(_userId: string): Promise<CommunityAppeal[]> {
  throw new CommunityBackendUnavailableError('Community appeals')
}

export async function createCommunityAppeal(_input: { userId: string; postId?: string; commentId?: string; communityId?:string;moderationActionId?:string;targetLabel?:string;reason: string }): Promise<void> {
  throw new CommunityBackendUnavailableError('Community appeals')
}

export async function withdrawCommunityAppeal(_id: string): Promise<void> {
  throw new CommunityBackendUnavailableError('Community appeals')
}

export async function recordCommunityOperationalEvent(_input: { userId: string; eventName: string; severity?: 'info'|'warning'|'error'; targetType?: string; targetId?: string; metadata?: Record<string, unknown> }) {
  // Operational telemetry is intentionally disabled until its Community-only
  // backend table and retention policy are approved.
}
