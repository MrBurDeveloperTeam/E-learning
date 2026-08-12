import { supabase } from '../supabase'
import { logElearningActivity } from '../logActivityToOdoo'
import type { PartnerProduct, SnabbbCreditSettings, VideoProduct, VideoProductPurchase } from '../../types'

// Mirrors useAppLink.ts's getApiBaseUrl(): a shared "SSO Gateways Active"
// worker sits in front of the /api/* namespace on the custom domain and
// only forwards a fixed set of known routes (see /api/wallet), returning a
// static placeholder for anything else — including this feature's two new
// endpoints. Setting VITE_API_BASE_URL to this Pages project's own
// *.pages.dev domain (not covered by that worker's route) sends requests
// straight to these Cloudflare Pages Functions instead. Falls back to a
// same-origin relative call if unset, which only works once that gateway
// also forwards these paths through.
const getApiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function getApiUrl(path: string) {
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}${path}` : path
}

/**
 * Searches the Snabbb partner product catalog (proxied through Odoo — see
 * functions/api/products/search.ts) for the "Add product" picker.
 */
export async function searchPartnerProducts(query: string): Promise<PartnerProduct[]> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  params.set('limit', '20')

  const response = await fetch(getApiUrl(`/api/products/search?${params.toString()}`))
  const result = (await response.json().catch(() => null)) as
    | { ok: boolean; products?: PartnerProduct[]; error?: string }
    | null

  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || 'Unable to load Snabbb partner products.')
  }

  return result.products ?? []
}

export async function fetchVideoProducts(videoId: string): Promise<VideoProduct[]> {
  const { data, error } = await supabase
    .from('video_products')
    .select('*')
    .eq('video_id', videoId)
    .order('position', { ascending: true })

  if (error) throw error
  return (data ?? []) as VideoProduct[]
}

export type FeaturedProductInput = Pick<
  VideoProduct,
  'product_ref' | 'product_name' | 'product_image_url' | 'product_price' | 'currency' | 'product_url' | 'cta_label'
>

/**
 * Syncs the set of featured products for a video to exactly match `products`:
 * removes attachments no longer selected, and upserts the current selection
 * (in order) so the featured product row for a video always reflects what the
 * doctor picked in the upload/edit form.
 */
export async function replaceVideoProducts(
  videoId: string,
  creatorId: string,
  products: FeaturedProductInput[]
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('video_products')
    .select('id, product_ref')
    .eq('video_id', videoId)

  if (fetchError) throw fetchError

  const keepRefs = new Set(products.map((product) => product.product_ref))
  const toRemove = (existing ?? []).filter((row) => !keepRefs.has(row.product_ref))

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('video_products')
      .delete()
      .in('id', toRemove.map((row) => row.id))

    if (deleteError) throw deleteError
  }

  if (products.length > 0) {
    const rows = products.map((product, index) => ({
      video_id: videoId,
      creator_id: creatorId,
      product_ref: product.product_ref,
      product_name: product.product_name,
      product_image_url: product.product_image_url,
      product_price: product.product_price,
      currency: product.currency,
      product_url: product.product_url,
      cta_label: product.cta_label || 'View Product',
      position: index,
      updated_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabase
      .from('video_products')
      .upsert(rows, { onConflict: 'video_id,product_ref' })

    if (upsertError) throw upsertError
  }

  logElearningActivity(
    'video_products_updated',
    `Featured ${products.length} product(s) on video ${videoId}`
  )
}

export async function fetchCreditSettings(): Promise<SnabbbCreditSettings> {
  const { data, error } = await supabase
    .from('snabbb_credit_settings')
    .select('*')
    .eq('id', true)
    .single()

  if (error) throw error
  return data as SnabbbCreditSettings
}

export async function updateCreditSettings(params: {
  credit_type: SnabbbCreditSettings['credit_type']
  credit_value: number
  is_active: boolean
  updated_by: string
}): Promise<void> {
  const { error } = await supabase
    .from('snabbb_credit_settings')
    .update({
      credit_type: params.credit_type,
      credit_value: params.credit_value,
      is_active: params.is_active,
      updated_by: params.updated_by,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)

  if (error) throw error
}

export async function fetchMyProductPurchases(doctorId: string): Promise<VideoProductPurchase[]> {
  const { data, error } = await supabase
    .from('video_product_purchases')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as VideoProductPurchase[]
}
