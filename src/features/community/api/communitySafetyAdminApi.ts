import { supabase } from '@/lib/supabase'

export type CommunityUserSafety = {
  restrictions: Array<{ id: string; restriction_type: string; reason: string; expires_at: string | null; revoked_at: string | null }>
  actions: Array<{ id: string; action_type: string; reason: string; created_at: string }>
  revisions: Array<{ id: string; previous_status: string; previous_body: string; replacement_body: string; created_at: string }>
}

export async function fetchCommunityUserSafety(userId: string): Promise<CommunityUserSafety> {
  const [restrictions, actions, revisions] = await Promise.all([
    supabase.from('community_user_restrictions').select('id,restriction_type,reason,expires_at,revoked_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('community_safety_actions').select('id,action_type,reason,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('community_comment_revisions').select('id,previous_status,previous_body,replacement_body,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  const error = restrictions.error ?? actions.error ?? revisions.error
  if (error) throw error
  return { restrictions: restrictions.data ?? [], actions: actions.data ?? [], revisions: revisions.data ?? [] }
}

export async function applyCommunityRestriction(input: { userId: string; type: 'comment_mute' | 'community_suspension' | 'permanent_ban'; durationHours: number | null; reason: string }): Promise<void> {
  const { error } = await supabase.rpc('community_apply_user_restriction', { input_user_id: input.userId, input_type: input.type, input_duration_hours: input.durationHours, input_reason: input.reason })
  if (error) throw error
}

export async function revokeCommunityRestriction(id: string): Promise<void> {
  const { error } = await supabase.rpc('community_revoke_user_restriction', { input_restriction_id: id })
  if (error) throw error
}

export async function warnCommunityUser(input: { userId: string; reason: string }): Promise<void> {
  const { error } = await supabase.rpc('community_warn_user', { input_user_id: input.userId, input_reason: input.reason })
  if (error) throw error
}
