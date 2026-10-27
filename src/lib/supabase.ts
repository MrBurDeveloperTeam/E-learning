import { createClient } from '@supabase/supabase-js'

// Note: Database types are used at the application level via our own
// TypeScript interfaces (types/index.ts). The Supabase client is
// untyped to avoid version-specific generic incompatibilities.
const SUPABASE_FETCH_TIMEOUT_MS = 10000
// File uploads (e.g. advertisement videos) legitimately take far longer than a
// normal API call; the 10s limit was aborting them mid-upload ("(canceled)").
const SUPABASE_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000

async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const isStorageWrite = requestUrl.includes('/storage/v1/') && method !== 'GET' && method !== 'HEAD'
  const timeoutMs = isStorageWrite ? SUPABASE_UPLOAD_TIMEOUT_MS : SUPABASE_FETCH_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  const start = Date.now()

  // Merge the timeout signal with any signal the Supabase SDK passes (e.g.
  // the internal lock signal used by getSession / token refresh). Overwriting
  // init.signal was the root cause of getSession() hanging on page refresh.
  let mergedSignal: AbortSignal = controller.signal
  if (init?.signal) {
    if (typeof AbortSignal.any === 'function') {
      mergedSignal = AbortSignal.any([controller.signal, init.signal])
    } else {
      // Fallback: if the caller's signal aborts, abort our controller too.
      const callerSignal = init.signal
      if (callerSignal.aborted) {
        controller.abort(callerSignal.reason)
      } else {
        callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), {
          once: true,
        })
      }
    }
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: mergedSignal,
    })

    if (import.meta.env.DEV) {
      console.debug('[supabase] request completed', {
        url: requestUrl,
        status: response.status,
        ms: Date.now() - start,
      })
    }

    return response
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[supabase] request failed', {
        url: requestUrl,
        ms: Date.now() - start,
        online: navigator.onLine,
        error,
      })
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Supabase request timed out after ${timeoutMs}ms`)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    global: {
      fetch: supabaseFetch,
    },
  }
)
