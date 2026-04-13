import { supabase } from '../supabase'
import type { Profile } from '../../types'

type FollowProfile = Pick<
  Profile,
  | 'user_id'
  | 'full_name'
  | 'username'
  | 'avatar_url'
  | 'specialty'
  | 'is_verified'
  | 'is_creator'
  | 'follower_count'
  | 'video_count'
>

function normalizeProfile<T extends { profiles: FollowProfile[] | FollowProfile | null }>(
  row: T
): Omit<T, 'profiles'> & { profiles: FollowProfile | null } {
  return {
    ...row,
    profiles: Array.isArray(row.profiles)
      ? row.profiles[0] ?? null
      : row.profiles,
  }
}

export async function followUser(
  followerId: string,
  followingId: string
): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId })
  if (error) throw error
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
    .single()
  return !!data
}

export async function fetchFollowers(userId: string): Promise<
  Array<{
    follower_id: string
    created_at: string
    profiles: FollowProfile | null
  }>
> {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower_id,
      created_at,
      profiles!follows_follower_id_fkey (
        user_id, full_name, username,
        avatar_url, specialty,
        is_verified, is_creator,
        follower_count, video_count
      )
    `)
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Array<{
    follower_id: string
    created_at: string
    profiles: FollowProfile[] | FollowProfile | null
  }>).map(normalizeProfile)
}

export async function fetchFollowing(userId: string): Promise<
  Array<{
    following_id: string
    created_at: string
    profiles: FollowProfile | null
  }>
> {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      following_id,
      created_at,
      profiles!follows_following_id_fkey (
        user_id, full_name, username,
        avatar_url, specialty,
        is_verified, is_creator,
        follower_count, video_count
      )
    `)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Array<{
    following_id: string
    created_at: string
    profiles: FollowProfile[] | FollowProfile | null
  }>).map(normalizeProfile)
}
