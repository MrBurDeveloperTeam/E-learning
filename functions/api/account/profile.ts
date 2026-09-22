import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ODOO_SSO_API_KEY?: string
  SSO_API_KEY?: string
  ODOO_BASE?: string
}

function cors(request: Request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = origin === 'https://e-learning.snabbb.com' || origin.endsWith('.e-learning-ddw.pages.dev')
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://e-learning.snabbb.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'private, no-store',
    Vary: 'Origin',
  }
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors(request) })
}

async function authenticatedEmail(request: Request, env: Env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  if (!token || !supabaseUrl || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  const admin = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data.user?.email || null
}

async function callOdoo(request: Request, env: Env, email: string, values?: Record<string, unknown>, profilePicture?: string) {
  const apiKey = env.ODOO_SSO_API_KEY || env.SSO_API_KEY
  if (!apiKey) return json(request, { ok: false, error: 'Account service unavailable' }, 503)
  const upstream = await fetch(`${String(env.ODOO_BASE || 'https://mrbur.odoo.com').replace(/\/$/, '')}/api/v1/account/profile_by_email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SSO-API-KEY': apiKey },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { email, values, profile_picture: profilePicture }, id: 1 }),
  })
  const payload = await upstream.json().catch(() => null) as { result?: unknown; error?: { data?: { message?: string }; message?: string } } | null
  if (!upstream.ok || payload?.error) {
    return json(request, { ok: false, error: payload?.error?.data?.message || payload?.error?.message || 'Account service unavailable' }, 502)
  }
  return json(request, payload?.result ?? { ok: false, error: 'Invalid account response' })
}

async function handle(request: Request, env: Env) {
  const email = await authenticatedEmail(request, env)
  if (!email) return json(request, { ok: false, error: 'Unauthorized' }, 401)
  if (request.method === 'GET') return callOdoo(request, env, email)

  const form = await request.formData()
  const categories = form.getAll('category_id').map(String).filter(Boolean)
  const values: Record<string, unknown> = {}
  for (const key of ['name', 'phone', 'x_date_of_birth', 'street', 'street2', 'city', 'zipcode', 'state_id', 'country_id', 'invoice_sending_method', 'invoice_edi_format']) {
    const value = form.get(key)
    if (typeof value === 'string') values[key] = value
  }
  if (categories.length) values.category_id = categories

  const photo = form.get('profile_picture')
  let encodedPhoto: string | undefined
  if (photo instanceof File && photo.size) {
    const bytes = new Uint8Array(await photo.arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    encodedPhoto = btoa(binary)
  }
  return callOdoo(request, env, email, values, encodedPhoto)
}

export const onRequestOptions = ({ request }: { request: Request }) => new Response(null, { status: 204, headers: cors(request) })
export const onRequestGet = ({ request, env }: { request: Request; env: Env }) => handle(request, env)
export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => handle(request, env)
