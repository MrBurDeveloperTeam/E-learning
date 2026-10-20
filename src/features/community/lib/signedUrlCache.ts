import { supabase } from '@/lib/supabase'

/**
 * Cached signing of private community media.
 *
 * Signing the same file again returns a *different* URL (new token), so the browser
 * could never reuse an image it had already downloaded: every feed load re-fetched
 * every image. Here a signed URL is reused until it is close to expiring, so the
 * same file keeps the same URL and the browser's HTTP cache (and conditional
 * requests) can serve it. This is the same idea as the Unified Shop's
 * `?unique=<last-edit>` product images, whose URLs never change for a given image.
 *
 * Kept per signed-in user in sessionStorage (cleared when the tab closes) so one
 * person's media links are never reused for another account on the same browser.
 */

const SIGN_FOR_SECONDS = 7 * 24 * 3600 // lifetime of URLs we create
const REUSE_UNTIL_SECONDS = 24 * 3600 // re-sign once less than this remains
const STORAGE_KEY = 'community-signed-urls-v1'
const MAX_ENTRIES = 600

type Entry = { url: string; exp: number }

let loadedFor: string | null = null
let cache = new Map<string, Entry>()

const nowSeconds = () => Math.floor(Date.now() / 1000)

function loadCache(userId: string) {
  if (loadedFor === userId) return
  loadedFor = userId
  cache = new Map()
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}:${userId}`)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, Entry>
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.url === 'string' && entry.exp > nowSeconds() + REUSE_UNTIL_SECONDS) {
        cache.set(key, entry)
      }
    }
  } catch {
    // Storage unavailable or corrupt: just start empty.
  }
}

function persistCache(userId: string) {
  try {
    const entries = [...cache.entries()].sort((a, b) => b[1].exp - a[1].exp).slice(0, MAX_ENTRIES)
    sessionStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Quota or unavailable: the in-memory cache still works for this page view.
  }
}

/**
 * Drop-in replacement for
 * `supabase.storage.from(bucket).createSignedUrls(paths, 3600)`:
 * same `{ data, error }` result shape, but reuses unexpired URLs.
 */
export async function signCommunityMediaUrls(bucket: string, paths: string[]) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id ?? 'anonymous'
  loadCache(userId)

  const threshold = nowSeconds() + REUSE_UNTIL_SECONDS
  const missing = [...new Set(paths)].filter((path) => {
    const entry = cache.get(`${bucket}:${path}`)
    return !entry || entry.exp <= threshold
  })

  if (missing.length > 0) {
    const signed = await supabase.storage.from(bucket).createSignedUrls(missing, SIGN_FOR_SECONDS)
    if (signed.error) return { data: null, error: signed.error }

    const exp = nowSeconds() + SIGN_FOR_SECONDS
    for (const item of signed.data ?? []) {
      if (item.path && item.signedUrl) cache.set(`${bucket}:${item.path}`, { url: item.signedUrl, exp })
    }
    persistCache(userId)
  }

  const data = paths.flatMap((path) => {
    const entry = cache.get(`${bucket}:${path}`)
    return entry ? [{ path, signedUrl: entry.url, error: null }] : []
  })

  return { data, error: null as null }
}
