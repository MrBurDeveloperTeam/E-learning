import { useRef, useEffect, useCallback } from 'react'
import MuxPlayer from '@mux/mux-player-react'
import { useAuthStore } from '../../store/authStore'

interface VideoPlayerProps {
  playbackId: string
  lessonId: string
  courseId: string
  onComplete?: () => void
}

export function VideoPlayer({ playbackId, lessonId, courseId: _courseId, onComplete }: VideoPlayerProps) {
  const playerRef = useRef<any>(null)
  const segmentStartRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const user = useAuthStore((s) => s.user)

  const sendSegment = useCallback(
    (start: number, end: number) => {
      if (!user?.id || end <= start) return
      // segment tracking logic removed for social platform
    },
    [user?.id, lessonId]
  )

  const startHeartbeat = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const el = playerRef.current as HTMLMediaElement | null
      if (el && !el.paused) {
        const current = el.currentTime ?? 0
        sendSegment(segmentStartRef.current, current)
        segmentStartRef.current = current
      }
    }, 15_000)
  }, [sendSegment])

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Idle tab detection
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        const el = playerRef.current as HTMLMediaElement | null
        el?.pause?.()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => stopHeartbeat()
  }, [stopHeartbeat])

  return (
    <div className="w-full rounded-xl overflow-hidden bg-black border border-teal-100">
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        streamType="on-demand"
        style={{ width: '100%', aspectRatio: '16/9' }}
        className="w-full"
        onPlay={() => {
          const el = playerRef.current as HTMLMediaElement | null
          segmentStartRef.current = el?.currentTime ?? 0
          startHeartbeat()
        }}
        onPause={() => {
          const el = playerRef.current as HTMLMediaElement | null
          if (el) sendSegment(segmentStartRef.current, el.currentTime)
          stopHeartbeat()
        }}
        onEnded={() => {
          const el = playerRef.current as HTMLMediaElement | null
          if (el) sendSegment(segmentStartRef.current, el.currentTime)
          stopHeartbeat()
          onComplete?.()
        }}
      />
    </div>
  )
}
