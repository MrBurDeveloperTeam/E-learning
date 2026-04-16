import { supabase } from '../supabase'
import type { Profile, PublicCreatorProfile, PublicProfile } from '../../types'

const PROFILE_MEDIA_BUCKET = 'avatars'

const publicProfileSelect = `
  user_id,
  name,
  full_name,
  username,
  avatar_url,
  background_url,
  specialty,
  bio,
  institution,
  is_verified,
  is_creator,
  follower_count,
  following_count,
  video_count
`

function normalizePrivateProfile(profile: Profile | null): Profile | null {
  if (!profile) return null

  return {
    ...profile,
    video_count: profile.video_count ?? 0,
  }
}

function normalizePublicProfile<T extends PublicProfile>(
  profile: T | null
): T | null {
  if (!profile) return null

  return {
    ...profile,
    follower_count: profile.follower_count ?? 0,
    following_count: profile.following_count ?? 0,
    video_count: profile.video_count ?? 0,
  } as T
}

function normalizePublicCreatorProfile(
  profile: PublicCreatorProfile | null
): PublicCreatorProfile | null {
  return normalizePublicProfile(profile)
}

export async function fetchProfile(userId: string) {
  const [{ data: profile, error: profileError }, { count, error: countError }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', userId)
        .eq('status', 'published'),
    ])

  if (profileError) throw profileError
  if (countError) throw countError
  if (!profile) return null

  return normalizePrivateProfile({
    ...profile,
    video_count: count ?? profile.video_count ?? 0,
  } as Profile)
}

export async function fetchPublicCreatorProfile(userId: string) {
  const { data, error } = await supabase
    .from('creator_public_profiles')
    .select(publicProfileSelect)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  return normalizePublicCreatorProfile((data ?? null) as PublicCreatorProfile | null)
}

export async function fetchPublicProfile(userId: string) {
  const { data, error } = await supabase
    .from('public_profiles')
    .select(publicProfileSelect)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  return normalizePublicProfile((data ?? null) as PublicProfile | null)
}

export async function fetchPublicCreatorProfiles(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))]
  if (uniqueUserIds.length === 0) {
    return new Map<string, PublicCreatorProfile>()
  }

  const { data, error } = await supabase
    .from('creator_public_profiles')
    .select(publicProfileSelect)
    .in('user_id', uniqueUserIds)

  if (error) throw error

  return new Map(
    ((data ?? []) as PublicCreatorProfile[])
      .map((profile) => normalizePublicCreatorProfile(profile))
      .filter((profile): profile is PublicCreatorProfile => !!profile)
      .map((profile) => [profile.user_id, profile])
  )
}

export async function fetchTopPublicCreators(options?: {
  excludeUserId?: string
  limit?: number
}) {
  const limit = options?.limit ?? 6

  let query = supabase
    .from('creator_public_profiles')
    .select(publicProfileSelect)
    .order('follower_count', { ascending: false })
    .limit(limit)

  if (options?.excludeUserId) {
    query = query.neq('user_id', options.excludeUserId)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as PublicCreatorProfile[])
    .map((profile) => normalizePublicCreatorProfile(profile))
    .filter((profile): profile is PublicCreatorProfile => !!profile)
}

export async function updateProfile(
  userId: string,
  payload: Partial<Omit<Profile, 'user_id' | 'created_at'>>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return normalizePrivateProfile(data as Profile) as Profile
}

async function uploadProfileMedia(
  userId: string,
  file: File,
  kind: 'avatar' | 'background',
  column: 'avatar_url' | 'background_url'
) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${kind}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .getPublicUrl(path)
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

  const { data, error } = await supabase
    .from('profiles')
    .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return normalizePrivateProfile(data as Profile) as Profile
}

export async function uploadAvatar(userId: string, file: File) {
  return uploadProfileMedia(userId, file, 'avatar', 'avatar_url')
}

export async function uploadBackground(userId: string, file: File) {
  return uploadProfileMedia(userId, file, 'background', 'background_url')
}

export async function searchPublicCreators(query: string) {
  const term = query.trim()
  if (term.length < 2) return [] as PublicCreatorProfile[]

  const escaped = term.replace(/[%_,]/g, '')
  const { data, error } = await supabase
    .from('creator_public_profiles')
    .select(publicProfileSelect)
    .or(
      `full_name.ilike.%${escaped}%,username.ilike.%${escaped}%,name.ilike.%${escaped}%,specialty.ilike.%${escaped}%`
    )
    .order('follower_count', { ascending: false })
    .limit(12)

  if (error) throw error

  return ((data ?? []) as PublicCreatorProfile[])
    .map((profile) => normalizePublicCreatorProfile(profile))
    .filter((profile): profile is PublicCreatorProfile => !!profile)
}
