import { createOdooUser } from '../_shared/auth'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

export const onRequestPost = async ({ request, env }: any) => {
  const origin = request.headers.get('Origin') || '*'
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
  try {
    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const name = String(body?.name || '').trim()
    if (!email || !password || !name) return json({ error: 'Name, email, and password are required.' }, 400, cors)
    const result = await createOdooUser(env, { email, password, name, phone: body.phone || undefined, account_type: body.account_type || 'individual', position: body.position || undefined, company_name: body.company_name || undefined, dob: body.dob || undefined, country: body.country || undefined })
    return json({ result }, 201, cors)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to create the Snabbb account.' }, 400, cors)
  }
}

export const onRequestOptions = ({ request }: any) => {
  const origin = request.headers.get('Origin') || '*'
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
}
