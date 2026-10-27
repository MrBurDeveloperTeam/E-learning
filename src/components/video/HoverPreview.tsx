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

// YouTube switches small embeds to a compact layout with big centre buttons
// (prev/pause/next) regardless of `controls=0`. So the iframe is rendered at a
// full desktop size and scaled down to fit the card.
const YT_W = 640
const YT_H = 360
// Slight over-scale so the card edge crops YouTube's title bar.
const YT_CROP = 1.08

/** Muted, control-less YouTube embed. Fades in once loaded. */
export function YouTubeHoverPreview({ videoId, title }: { videoId: string; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [playing, setPlaying] = useState(false)

  // Reveal the iframe only once YouTube reports the video is actually playing,
  // so the thumbnail stays visible while the player loads / buffers.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      let data: { event?: string; info?: unknown } | null = null
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (!data) return
      const info = data.info as { playerState?: number } | number | undefined
      const state = typeof info === 'number' ? info : info?.playerState
      if (state === 1) setPlaying(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    // const update = () => setScale((box.clientWidth / YT_W) * YT_CROP)
    // update()
    // const observer = new ResizeObserver(update)
    // observer.observe(box)
    // return () => observer.disconnect()
  }, [])

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
    enablejsapi: '1',
    origin: window.location.origin,
  })

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {scale !== null && (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`}
          title={`Preview of ${title}`}
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          aria-hidden="true"
          onLoad={() =>
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
              '*'
            )
          }
          style={{
            width: YT_W,
            height: YT_H,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
          className={cn(
            'absolute max-w-none border-0 transition-opacity duration-300',
            playing ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </div>
  )
}
