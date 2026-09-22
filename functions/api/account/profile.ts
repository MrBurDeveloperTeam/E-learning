function odooCookie(request: Request): string | null {
  const cookies = request.headers.get('Cookie') || ''
  const values = Object.fromEntries(cookies.split(';').map(part => {
    const index = part.indexOf('=')
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()]
  }))
  const session = values.session_id || values.mrbur_sso
  return session ? `session_id=${session}` : null
}

async function proxy(context: { request: Request }, method: 'GET' | 'POST') {
  const cookie = odooCookie(context.request)
  if (!cookie) return Response.json({ ok: false, error: 'Missing Snabbb account session. Please sign in again.' }, { status: 401 })

  try {
    const upstream = await fetch('https://account.snabbb.com/api/account/profile', {
      method,
      headers: { Accept: 'application/json', Cookie: cookie },
      body: method === 'POST' ? await context.request.formData() : undefined,
      redirect: 'manual',
    })
    if (!upstream.ok || !upstream.headers.get('Content-Type')?.includes('application/json')) {
      return Response.json({ ok: false, error: 'Snabbb account session expired or profile service unavailable.' }, { status: upstream.status === 401 ? 401 : 502 })
    }
    return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ ok: false, error: 'Snabbb account profile service unavailable.' }, { status: 502 })
  }
}

export const onRequestGet = (context: { request: Request }) => proxy(context, 'GET')
export const onRequestPost = (context: { request: Request }) => proxy(context, 'POST')
