import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { isAdminProfile, isCreatorProfile } from '../lib/auth'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setSession: (session: Session | null) => void
  setIsLoading: (loading: boolean) => void
  signOut: () => void
  isCreator: () => boolean
  isAdmin: () => boolean
  isVerified: () => boolean
}

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setSession: (session) => set({ session }),
    setIsLoading: (isLoading) => set({ isLoading }),
    signOut: () =>
      set({ user: null, profile: null, session: null, isLoading: false }),
    isCreator: () => isCreatorProfile(get().profile),
    isAdmin: () => isAdminProfile(get().profile),
    isVerified: () => get().profile?.is_verified === true,
  })
)
