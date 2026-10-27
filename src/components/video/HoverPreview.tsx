import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Muted, looping preview of a Mux video (HLS). Fades in once frames play. */
export function MuxHoverPreview({ playbackId }: { playbackId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const src = `https://stream.mux.com/${playbackId}.m3u8`
    let hls: import('hls.js').default | null = null
    let cancelled = false

    video.muted = true

    // Show the first captions/subtitles track the stream offers (if any).
    const showCaptions = () => {
      for (const track of Array.from(video.textTracks)) {
        if (track.kind === 'subtitles' || track.kind === 'captions') {
          track.mode = 'showing'
          return
        }
      }
    }
    video.textTracks.addEventListener('addtrack', showCaptions)

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS: native HLS
      video.src = src
      void video.play().catch(() => {})
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return
        hls = new Hls({ capLevelToPlayerSize: true, startLevel: 0, maxBufferLength: 10 })
        hls.subtitleDisplay = true
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, data) => {
          if (data.subtitleTracks.length > 0 && hls) hls.subtitleTrack = 0
        })
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => {})
        })
      })
    }

    return () => {
      cancelled = true
      video.textTracks.removeEventListener('addtrack', showCaptions)
      hls?.destroy()
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [playbackId])

  return (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      preload="none"
      onPlaying={() => setPlaying(true)}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 [&::cue]:text-[13px]',
        playing ? 'opacity-100' : 'opacity-0'
      )}
    />
  )
}

/**
 * Muted, control-less YouTube embed. Fades in once loaded. Scaled up so the
 * title bar / chrome YouTube draws at the edges is cropped by the card.
 * (No `loop`/`playlist` param: it makes YouTube show prev/next + pause buttons.)
 */
export function YouTubeHoverPreview({ videoId, title }: { videoId: string; title: string }) {
  const [loaded, setLoaded] = useState(false)
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    playsinline: '1',
    cc_load_policy: '1',
    modestbranding: '1',
    rel: '0',
    disablekb: '1',
    iv_load_policy: '3',
    fs: '0',
  })

  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`}
      title={`Preview of ${title}`}
      allow="autoplay; encrypted-media"
      tabIndex={-1}
      aria-hidden="true"
      onLoad={() => setLoaded(true)}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full scale-[1.4] border-0 transition-opacity duration-300',
        loaded ? 'opacity-100' : 'opacity-0'
      )}
    />
  )
}
