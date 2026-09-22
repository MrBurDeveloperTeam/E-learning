import { fetchAccountProfile } from './accountProfile'
import { supabase } from './supabase'
import { queryClient } from './queryClient'
import { useAuthStore } from '../store/authStore'

// Community, chat and creator lists all read this shared profile field.
export async function syncAccountAvatar(userId: string, imageUrl?: string | null) {
  const accountUrl = imageUrl === undefined
    ? (await fetchAccountProfile()).imageUrl
    : imageUrl
  let avatarUrl: string | null = null
  if (accountUrl) {
    const imageResponse = await fetch('/api/account/avatar', { credentials: 'include', cache: 'no-store' })
    if (!imageResponse.ok) throw new Error('Could not load central account photo')
    const image = await imageResponse.blob()
    if (!image.type.startsWith('image/')) throw new Error('Central account returned an invalid photo')
    const extension = image.type === 'image/png' ? 'png' : image.type === 'image/gif' ? 'gif' : 'jpg'
    const path = `${userId}/account-avatar.${extension}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, image, { contentType: image.type, upsert: true })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    avatarUrl = `${data.publicUrl}?v=${Date.now()}`
  }
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
