import { createClient } from '@supabase/supabase-js'

// Note: Database types are used at the application level via our own
// TypeScript interfaces (types/index.ts). The Supabase client is
// untyped to avoid version-specific generic incompatibilities.
const SUPABASE_FETCH_TIMEOUT_MS = 10000

async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS)
  const start = Date.now()
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

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
      throw new Error(`Supabase request timed out after ${SUPABASE_FETCH_TIMEOUT_MS}ms`)
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
    auth: {
      // Disable the Web Locks API. gotrue-js uses navigator.locks to
      // serialise session access across tabs, but the lock can deadlock
      // when async onAuthStateChange listeners or the custom fetch wrapper
      // make further Supabase requests while the lock is held. A no-op lock
      // avoids the deadlock entirely; cross-tab sync still works via
      // localStorage "storage" events.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lock: (_name: string, _acquireTimeout: number, fn: (token: string) => Promise<any>) =>
        fn(''),
    },
  }
)
