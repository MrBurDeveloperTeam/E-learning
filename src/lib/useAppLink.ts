import { useMutation } from '@tanstack/react-query'

interface AppLinkParams {
  app: string
  email: string
  name: string
}

interface AppLinkResponse {
  jsonrpc?: string
  id?: number
  result?: {
    url?: string
    supabase_user_id?: string
    [key: string]: unknown
  }
}

const getApiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function getApiUrl(path: string) {
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}${path}` : path
}

/**
 * Mints an SSO handoff for another Snabbb app (e.g. the rewards app) so
 * cross-app links land the user in an authenticated state instead of
 * bouncing to that app's own login/home page.
 *
 * Mirrors the /v1/sso/userid pattern used by the Appointment and Dental
 * Calculator apps, adapted to this project's fetch + /api-prefixed
 * worker-route convention (see useAuth.ts's fetchSsoExchange).
 */
export function useAppLink() {
  return useMutation({
    mutationFn: async ({ app, email, name }: AppLinkParams): Promise<AppLinkResponse> => {
      const response = await fetch(getApiUrl('/api/v1/sso/userid'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            app_code: app,
            email,
            name,
            company_id: 2,
            portal: true,
          },
          id: 1,
        }),
      })

      if (!response.ok) {
        throw new Error(`SSO link request failed (${response.status})`)
      }

      return response.json()
    },
  })
}
