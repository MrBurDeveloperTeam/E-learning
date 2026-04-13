import { create } from 'zustand'

interface PlayerState {
  currentVideoId: string | null
  isPlaying: boolean
  volume: number
  isMuted: boolean
  setCurrentVideo: (videoId: string | null) => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  reset: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentVideoId: null,
  isPlaying: false,
  volume: 1,
  isMuted: false,
  setCurrentVideo: (videoId) =>
    set({ currentVideoId: videoId, isPlaying: false }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  reset: () =>
    set({
      currentVideoId: null,
      isPlaying: false,
      volume: 1,
      isMuted: false,
    }),
}))
