import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ODOO_SSO_API_KEY?: string
  SSO_API_KEY?: string
  ODOO_BASE?: string
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return new Response('Invalid user', { status: 400 })
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const odooApiKey = env.ODOO_SSO_API_KEY || env.SSO_API_KEY
  const missing = [
    !supabaseUrl && 'SUPABASE_URL',
    !env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    !odooApiKey && 'ODOO_SSO_API_KEY',
  ].filter(Boolean)
  if (missing.length) {
    return Response.json({ error: 'Avatar service unavailable', missing }, { status: 503 })
  }

  const admin = createClient(supabaseUrl!, env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile, error } = await admin.from('profiles').select('email').eq('user_id', userId).maybeSingle()
  if (error || !profile) return new Response('Avatar unavailable', { status: 404 })
  let email = profile.email as string | null
  if (!email) {
    const { data } = await admin.auth.admin.getUserById(userId)
    email = data.user?.email || null
  }
  if (!email) return new Response('Avatar unavailable', { status: 404 })

  const upstream = await fetch(`${String(env.ODOO_BASE || 'https://mrbur.odoo.com').replace(/\/$/, '')}/api/v1/account/public_avatars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SSO-API-KEY': odooApiKey! },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { emails: [email] }, id: 1 }),
  })
  const result = await upstream.json().catch(() => null) as { result?: Record<string, string> } | null
  const encoded = result?.result?.[email.trim().toLowerCase()]
  if (!upstream.ok || !encoded) return new Response('Avatar unavailable', { status: 404 })

  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0))
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49
  return new Response(bytes, {
    headers: {
      'Content-Type': isPng ? 'image/png' : isGif ? 'image/gif' : 'image/jpeg',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
