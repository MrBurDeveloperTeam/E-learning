/**
 * Snabbb partner product search — used by the "Add product" picker in the
 * video upload/edit flow so doctors can attach one or more Snabbb partner
 * products to an E-Learning video.
 *
 * Products are not stored in this app's Supabase project — they live in
 * Odoo, the same partner catalog the Snabbb shop and other Snabbb apps
 * (Appointment, Dental Calculator, etc.) already read from. This function
 * is a thin, read-only proxy so the frontend never needs Odoo credentials.
 *
 * NOTE ON THE ODOO CONTRACT: the exact catalog route/field names below
 * (`${ODOO_BASE}/api/v1/products/search`) are the best-guess counterpart to
 * the existing `/api/wallet` and `/api/v1/users` routes used elsewhere in
 * this repo (see functions/api/wallet.ts, _shared/auth.ts createOdooUser).
 * Confirm the real route + payload shape with whoever owns the Odoo/Snabbb
 * catalog module and adjust `mapOdooProduct` below — the parsing is written
 * defensively (multiple possible field names) so that only needs a small
 * tweak, not a rewrite.
 */

interface Env {
  ODOO_BASE?: string
  ODOO_SSO_API_KEY?: string
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
    },
  })
}

interface RawOdooProduct {
  [key: string]: unknown
}

function firstDefined<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const value of values) {
    if (value !== null && value !== undefined) return value
  }
  return undefined
}

function mapOdooProduct(raw: RawOdooProduct) {
  const ref = firstDefined(
    raw.product_ref,
    raw.default_code,
    raw.id,
    raw.product_id,
    raw.template_id
  )
  const name = firstDefined(raw.name, raw.product_name, raw.display_name)
  const price = firstDefined(raw.price, raw.list_price, raw.sale_price)
  const imageUrl = firstDefined(raw.image_url, raw.image_1920_url, raw.image, raw.thumbnail_url)
  const productUrl = firstDefined(raw.product_url, raw.url, raw.website_url, raw.shop_url)
  const currency = firstDefined(raw.currency, raw.currency_code) ?? 'MYR'
  const inStock = firstDefined(raw.in_stock, raw.available)

  if (ref === undefined || name === undefined || productUrl === undefined) return null

  const numericPrice = Number(price)

  return {
    product_ref: String(ref),
    name: String(name),
    image_url: imageUrl ? String(imageUrl) : null,
    price: Number.isFinite(numericPrice) ? numericPrice : 0,
    currency: String(currency),
    product_url: String(productUrl),
    in_stock: typeof inStock === 'boolean' ? inStock : undefined,
  }
}

export const onRequestOptions = async (context: { request: Request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) })
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context

  try {
    const url = new URL(request.url)
    const query = (url.searchParams.get('q') || '').trim()
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50)

    const odooBase = String(env.ODOO_BASE || 'https://mrbur.odoo.com').replace(/\/$/, '')

    const upstreamUrl = new URL(`${odooBase}/api/v1/products/search`)
    if (query) upstreamUrl.searchParams.set('q', query)
    upstreamUrl.searchParams.set('limit', String(limit))
    // Snabbb partner products only — exclude other Odoo catalog listings if the endpoint
    // supports scoping. Safe no-op if the upstream ignores unknown params.
    upstreamUrl.searchParams.set('partner_products', 'true')

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(env.ODOO_SSO_API_KEY ? { 'X-SSO-API-KEY': env.ODOO_SSO_API_KEY } : {}),
      },
    })

    const upstreamData: any = await upstreamResponse.json().catch(() => null)

    if (!upstreamResponse.ok || upstreamData?.error) {
      console.error('Odoo product search failed:', upstreamResponse.status, upstreamData)
      return jsonResponse(
        request,
        { ok: false, error: 'Unable to load Snabbb partner products right now.' },
        upstreamResponse.status && upstreamResponse.status >= 400 ? upstreamResponse.status : 502
      )
    }

    const rawProducts: RawOdooProduct[] =
      upstreamData?.result?.products ??
      upstreamData?.result?.items ??
      upstreamData?.products ??
      upstreamData?.result ??
      upstreamData?.items ??
      []

    const products = (Array.isArray(rawProducts) ? rawProducts : [])
      .map(mapOdooProduct)
      .filter((product): product is NonNullable<typeof product> => product !== null)

    return jsonResponse(request, { ok: true, products })
  } catch (error: any) {
    console.error('Product search error:', error)
    return jsonResponse(
      request,
      { ok: false, error: error?.message || 'Product search is unavailable.' },
      500
    )
  }
}
