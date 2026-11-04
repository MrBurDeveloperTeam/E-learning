import { supabase } from '../supabase'
import { logElearningActivity } from '../logActivityToOdoo'
import { fetchPublicProfiles } from './profiles'
import type { PublicProfile } from '../../types'

export async function followUser(
  followerId: string,
  followingId: string
): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .upsert(
      { follower_id: followerId, following_id: followingId },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
    )
  if (error) throw error
  logElearningActivity('creator_followed', `Followed creator ${followingId}`)
}

export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
  logElearningActivity('creator_unfollowed', `Unfollowed creator ${followingId}`)
}

export async function checkIsFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function fetchFollowers(userId: string): Promise<
  Array<{
    follower_id: string
    created_at: string
    profiles: PublicProfile | null
  }>
> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as Array<{ follower_id: string; created_at: string }>
  const profiles = await fetchPublicProfiles(rows.map((row) => row.follower_id))
  return rows.map((row) => ({ ...row, profiles: profiles.get(row.follower_id) ?? null }))
}

export async function fetchFollowing(userId: string): Promise<
  Array<{
    following_id: string
    created_at: string
    profiles: PublicProfile | null
  }>
> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, created_at')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as Array<{ following_id: string; created_at: string }>
  const profiles = await fetchPublicProfiles(rows.map((row) => row.following_id))
  return rows.map((row) => ({ ...row, profiles: profiles.get(row.following_id) ?? null }))
}
