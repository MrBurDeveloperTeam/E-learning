import { fetchAccountProfile } from './accountProfile'
import { supabase } from './supabase'
import { queryClient } from './queryClient'
import { useAuthStore } from '../store/authStore'

// Community, chat and creator lists all read this shared profile field.
export async function syncAccountAvatar(userId: string, imageUrl?: string | null) {
  const accountUrl = imageUrl === undefined
    ? (await fetchAccountProfile()).imageUrl
    : imageUrl
  const avatarUrl = accountUrl || null
  const { data: current, error: readError } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw readError
  if (!current || current.avatar_url === avatarUrl) return

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) throw error

  const state = useAuthStore.getState()
  if (state.user?.id === userId && state.profile) {
    state.setProfile({ ...state.profile, avatar_url: avatarUrl })
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
    queryClient.invalidateQueries({ queryKey: ['public-profile', userId] }),
    queryClient.invalidateQueries({ queryKey: ['public-creator-profile', userId] }),
    queryClient.invalidateQueries({ queryKey: ['home-follow-suggestions'] }),
    queryClient.invalidateQueries({ queryKey: ['following'] }),
  ])
}
