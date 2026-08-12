import { Package, ShoppingBag } from 'lucide-react'
import { logElearningActivity } from '@/lib/logActivityToOdoo'
import type { VideoProduct } from '@/types'

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

/**
 * Appends attribution params to a Snabbb product URL, then routes the click
 * through our own /api/sso/shop-redirect bridge.
 *
 * shop-redirect reads the user's existing Odoo session_id cookie (set on
 * .snabbb.com by the Snabbb platform at login) and passes it — signed with
 * APP_JWT_SECRET — to mrbur.shop/api/sso/elearning, which sets the same
 * session_id as a cookie on the .mrbur.shop domain.  Because both the
 * e-learning app and the shop share the same Odoo backend, the single
 * session_id is valid for both domains: the user lands on the shop already
 * logged in without a second authentication step.
 *
 * If there is no Odoo session (e.g. the user authenticated via Google OAuth
 * only), shop-redirect falls back to app.snabbb.com/api/sso/ambient-redirect,
 * which degrades gracefully to a plain redirect for unauthenticated visitors.
 *
 * Attribution params (utm_source, ref_video, ref_creator) are attached to the
 * real destination URL before wrapping so purchase-webhook.ts can read them
 * back once the order is paid.  Double-wrapping is avoided by unwrapping any
 * existing return_url first.
 */
function buildAttributedUrl(productUrl: string, videoId: string, creatorId: string) {
  try {
    const url = new URL(productUrl)

    const existingReturnUrl = url.searchParams.get('return_url')
    const target = existingReturnUrl ? new URL(existingReturnUrl) : url

    target.searchParams.set('utm_source', 'elearning')
    target.searchParams.set('utm_medium', 'video')
    target.searchParams.set('ref_video', videoId)
    target.searchParams.set('ref_creator', creatorId)

    // Route through our shop-redirect endpoint (same origin) so it can
    // read the HttpOnly session_id cookie and forward it securely to the shop.
    const wrapped = new URL('/api/sso/shop-redirect', window.location.origin)
    wrapped.searchParams.set('return_url', target.toString())
    return wrapped.toString()
  } catch {
    // productUrl wasn't a valid absolute URL — best-effort fallback with no
    // SSO wrapping, same as before.
    const separator = productUrl.includes('?') ? '&' : '?'
    return `${productUrl}${separator}utm_source=elearning&utm_medium=video&ref_video=${encodeURIComponent(
      videoId
    )}&ref_creator=${encodeURIComponent(creatorId)}`
  }
}

interface FeaturedProductCardProps {
  product: VideoProduct
  videoId: string
  creatorId: string
}

export function FeaturedProductCard({ product, videoId, creatorId }: FeaturedProductCardProps) {
  const href = buildAttributedUrl(product.product_url, videoId, creatorId)

  function handleClick() {
    logElearningActivity(
      'featured_product_clicked',
      `Clicked "${product.product_name}" from video ${videoId}`
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {product.product_image_url ? (
          <img
            src={product.product_image_url}
            alt={product.product_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{product.product_name}</p>
        <p className="text-sm text-primary">{formatPrice(product.product_price, product.currency)}</p>
      </div>

      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
        <ShoppingBag className="h-3.5 w-3.5" />
        {product.cta_label || 'View Product'}
      </span>
    </a>
  )
}

interface FeaturedProductsListProps {
  products: VideoProduct[]
  videoId: string
  creatorId: string
}

export function FeaturedProductsList({ products, videoId, creatorId }: FeaturedProductsListProps) {
  if (products.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="px-4 text-sm font-medium text-foreground lg:px-0">Featured products</p>
      <div className="space-y-2 px-4 lg:px-0">
        {products.map((product) => (
          <FeaturedProductCard
            key={product.id}
            product={product}
            videoId={videoId}
            creatorId={creatorId}
          />
        ))}
      </div>
    </div>
  )
}
