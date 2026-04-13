import type { Profile } from '../types'

type AuthProfile = Pick<Profile, 'account_type' | 'role' | 'is_creator' | 'is_verified'> | null | undefined

export function isAdminProfile(profile: AuthProfile) {
  return profile?.account_type === 'admin'
}

export function isCreatorProfile(profile: AuthProfile) {
  return profile?.is_creator === true && profile?.is_verified === true
}
