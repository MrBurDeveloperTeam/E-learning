import { CommunityBackendUnavailableError } from '@/features/community/api/communityContract'

export type CommunityUserSafety = {
  restrictions: Array<{ id: string; restriction_type: string; reason: string; expires_at: string | null; revoked_at: string | null }>
  actions: Array<{ id: string; action_type: string; reason: string; created_at: string }>
  revisions: Array<{ id: string; previous_status: string; previous_body: string; replacement_body: string; created_at: string }>
}

export async function fetchCommunityUserSafety(_userId: string): Promise<CommunityUserSafety> {
  throw new CommunityBackendUnavailableError('Community user restrictions and safety history')
}

export async function applyCommunityRestriction(_input: { userId: string; type: 'comment_mute' | 'community_suspension' | 'permanent_ban'; durationHours: number | null; reason: string }): Promise<void> {
  throw new CommunityBackendUnavailableError('Community user restrictions')
}

export async function revokeCommunityRestriction(_id: string): Promise<void> {
  throw new CommunityBackendUnavailableError('Community user restrictions')
}

export async function warnCommunityUser(_input: { userId: string; reason: string }): Promise<void> {
  throw new CommunityBackendUnavailableError('Community user warnings')
}
