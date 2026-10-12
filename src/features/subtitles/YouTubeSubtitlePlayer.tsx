import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type Player = { destroy(): void; getCurrentTime(): number; seekTo(seconds: number, allowSeekAhead: boolean): void }
type Api = { Player: new (element: HTMLElement, options: { videoId: string; playerVars: Record<string, string | number>; events: { onReady(): void; onError(): void } }) => Player }
type ApiWindow = { YT?: Api; onYouTubeIframeAPIReady?: () => void }
export type YouTubeSubtitleHandle = { seek(seconds: number): void }
let loading: Promise<Api> | null = null

function loadApi(): Promise<Api> {
  const apiWindow = window as unknown as ApiWindow
  if (apiWindow.YT?.Player) return Promise.resolve(apiWindow.YT)
  if (loading) return loading
  loading = new Promise<Api>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('YouTube player timed out.')), 20000)
    const previous = apiWindow.onYouTubeIframeAPIReady
    apiWindow.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (apiWindow.YT?.Player) resolve(apiWindow.YT)
      else reject(new Error('YouTube player is unavailable.'))
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => { window.clearTimeout(timer); reject(new Error('YouTube player could not load.')) }
      document.head.appendChild(script)
    }
  }).catch(error => { loading = null; throw error })
  return loading
}

export const YouTubeSubtitlePlayer = forwardRef<YouTubeSubtitleHandle, { videoId: string; onTime(seconds: number): void; onError(): void }>(function YouTubeSubtitlePlayer({ videoId, onTime, onError }, ref) {
  const container = useRef<HTMLDivElement>(null)
  const player = useRef<Player | null>(null)
  const callbacks = useRef({ onTime, onError })
  callbacks.current = { onTime, onError }
  useImperativeHandle(ref, () => ({ seek: seconds => player.current?.seekTo(seconds, true) }), [])
  useEffect(() => {
    let disposed = false
    let timer: number | undefined
    const mount = document.createElement('div')
    container.current?.appendChild(mount)
    void loadApi().then(api => {
      if (disposed) return
      player.current = new api.Player(mount, {
        videoId,
        playerVars: { playsinline: 1, controls: 1, rel: 0, fs: 0, origin: window.location.origin },
        events: {
          onReady: () => { if (!disposed) timer = window.setInterval(() => { const time = player.current?.getCurrentTime(); if (typeof time === 'number') callbacks.current.onTime(time) }, 200) },
          onError: () => callbacks.current.onError(),
        },
      })
    }).catch(() => { if (!disposed) callbacks.current.onError() })
    return () => { disposed = true; window.clearInterval(timer); player.current?.destroy(); player.current = null; mount.remove() }
  }, [videoId])
  return <div ref={container} className="aspect-video w-full [&_iframe]:h-full [&_iframe]:w-full" />
})
