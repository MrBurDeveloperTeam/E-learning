export type SubtitleCue = { start: number; end: number; text: string }
export type SubtitleJob = {
  id: string; filename: string; model: string; precision: string
  status: 'uploading' | 'downloading' | 'running' | 'cancelling' | 'done' | 'cancelled' | 'error'
  source_type?: 'file' | 'youtube'; source_url?: string; youtube_id?: string; stage?: 'download' | 'transcribe'
  progress: number; cue_count: number; message: string; media_key: string
}
export type SubtitleResult = { cues: SubtitleCue[]; metadata: Record<string, unknown> }
export type SubtitleOptions = { model: string; precision: string; prompt: string; offline: boolean }
export const subtitleApiUrl = (import.meta.env.VITE_SUBTITLE_API_URL || 'http://127.0.0.1:8765').replace(/\/$/, '')

export async function subtitleRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(subtitleApiUrl + path, {
      ...init, signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `Subtitle engine returned ${response.status}.`)
    }
    return await response.json() as T
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new Error('Cannot reach the local subtitle engine. Start it on this computer and allow local network access if your browser asks.')
    }
    throw error
  } finally { window.clearTimeout(timeout) }
}

export function uploadSubtitleVideo(file: File, options: SubtitleOptions, token: string, progress: (value: number) => void) {
  const request = new XMLHttpRequest()
  const promise = new Promise<{ id: string }>((resolve, reject) => {
    request.open('POST', subtitleApiUrl + '/jobs')
    request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.setRequestHeader('X-Filename', encodeURIComponent(file.name))
    request.setRequestHeader('X-Subtitle-Options', encodeURIComponent(JSON.stringify(options)))
    request.upload.onprogress = event => { if (event.lengthComputable) progress(event.loaded / event.total * 100) }
    request.onload = () => {
      let data: { id: string; error?: string }
      try { data = JSON.parse(request.responseText) } catch { reject(new Error('Invalid response from the subtitle engine.')); return }
      if (request.status >= 200 && request.status < 300) resolve(data)
      else reject(new Error(data.error || 'The video could not be uploaded.'))
    }
    request.onerror = () => reject(new Error('Cannot reach the local subtitle engine. Start it and allow local network access.'))
    request.onabort = () => reject(new Error('Upload cancelled.'))
    request.send(file)
  })
  return { promise, abort: () => request.abort() }
}

export function validateSubtitleCues(cues: SubtitleCue[]): string | null {
  let previous = 0
  for (const cue of cues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < previous || cue.end <= cue.start || !cue.text.trim()) {
      return 'Each subtitle needs text and a valid start/end time. Subtitles cannot overlap.'
    }
    previous = cue.end
  }
  return null
}

export function subtitleTime(value: number) {
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export async function downloadSubtitles(job: SubtitleJob, extension: string, token: string) {
  const response = await fetch(`${subtitleApiUrl}/jobs/${job.id}/export/${extension}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('Could not export subtitles. Reconnect the engine and retry.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = `${job.source_type === 'youtube' ? job.filename : job.filename.replace(/\.[^.]+$/, '')}.en.${extension}`
  link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function youtubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.includes('://') ? value.trim() : 'https://' + value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase()
    const path = url.pathname.replace(/\/$/, '')
    let id = ''
    if (['youtu.be', 'www.youtu.be'].includes(host)) id = path.slice(1)
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      if (path === '/watch') { const values = url.searchParams.getAll('v'); id = values.length === 1 ? values[0] : '' }
      else if (/^\/(shorts|embed|live)\/[^/]+$/.test(path)) id = path.split('/').pop() || ''
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch { return null }
}

export function createYouTubeSubtitleJob(url: string, options: SubtitleOptions, token: string) {
  return subtitleRequest<{ id: string }>('/jobs/youtube', token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...options, url }),
  })
}
