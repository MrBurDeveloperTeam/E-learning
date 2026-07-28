const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

export const onRequestPost = async ({ request, env }: any) => {
  const origin = request.headers.get('Origin') || '*'
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
  let userId: string | null = null
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Supabase server credentials are not configured.' }, 500, cors)
    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const name = String(body?.name || '').trim()
    const accountType = body?.account_type === 'company' ? 'company' : 'individual'
    if (!email || !password || !name) return json({ error: 'Name, email, and password are required.' }, 400, cors)

    const userMetadata = { name, account_type: accountType, phone: body?.phone || null, position: body?.position || null, company_name: accountType === 'company' ? body?.company_name || null : null, dob: body?.dob || null, country: body?.country || null, agreed_to_terms: Boolean(body?.agreed_to_terms) }
    const authResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata }) })
    const authData: any = await authResponse.json().catch(() => null)
    if (!authResponse.ok) return json({ error: authData?.msg || authData?.message || authData?.error || 'Unable to create the Supabase account.' }, authResponse.status, cors)
    userId = authData?.user?.id || authData?.id
    if (!userId) throw new Error('Supabase did not return a user id.')

    const profileResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?on_conflict=user_id`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: userId, email, name, full_name: name, account_type: accountType, phone: userMetadata.phone, position: userMetadata.position, company_name: userMetadata.company_name, role: 'member' }) })
    const profileData = await profileResponse.json().catch(() => null)
    if (!profileResponse.ok) throw new Error(profileData?.message || profileData?.hint || 'Unable to save the E-learning profile.')
    return json({ user: authData.user || authData, profile: Array.isArray(profileData) ? profileData[0] : profileData }, 201, cors)
  } catch (error) {
    if (userId && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }).catch(() => undefined)
    return json({ error: error instanceof Error ? error.message : 'Unable to save the account.' }, 500, cors)
  }
}

export const onRequestOptions = ({ request }: any) => {
  const origin = request.headers.get('Origin') || '*'
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
}
