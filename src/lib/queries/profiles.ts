import { supabase } from '../supabase'
import type { Profile } from '../../types'

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data as Profile
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
  return data as Profile
}

export async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

export async function searchCreators(query: string) {
  const term = query.trim()
  if (term.length < 2) return [] as Profile[]

  const escaped = term.replace(/[%_,]/g, '')
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_creator', true)
    .or(
      `full_name.ilike.%${escaped}%,username.ilike.%${escaped}%,specialty.ilike.%${escaped}%`
    )
    .order('follower_count', { ascending: false })
    .limit(12)

  if (error) throw error

  return (data ?? []) as Profile[]
}
