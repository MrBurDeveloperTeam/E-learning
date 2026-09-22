export const onRequestGet = async ({ request }: { request: Request }) => {
  const cookies = request.headers.get('Cookie') || ''
  const values = Object.fromEntries(cookies.split(';').map(part => {
    const index = part.indexOf('=')
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()]
  }))
  const session = values.session_id || values.mrbur_sso
  if (!session) return new Response('Missing account session', { status: 401 })

  const cookie = `session_id=${session}`
  const profileResponse = await fetch('https://account.snabbb.com/api/account/profile', {
    headers: { Accept: 'application/json', Cookie: cookie },
    redirect: 'manual',
  })
  const profile = await profileResponse.json().catch(() => null) as { ok?: boolean; partner_id?: number; image_url?: string | null; partner?: { has_image?: boolean } } | null
  if (!profileResponse.ok || !profile?.ok || !profile.partner_id || (profile.partner?.has_image === false && !profile.image_url)) {
    return new Response('Account photo unavailable', { status: 404 })
  }

  const image = await fetch(`https://account.snabbb.com/web/image/res.partner/${profile.partner_id}/image_128`, {
    headers: { Accept: 'image/*', Cookie: cookie },
    redirect: 'manual',
  })
  const contentType = image.headers.get('Content-Type') || ''
  if (!image.ok || !contentType.startsWith('image/')) return new Response('Account photo unavailable', { status: 404 })
  return new Response(image.body, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}
