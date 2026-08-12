import { Package, ShoppingBag } from 'lucide-react'
import { logElearningActivity } from '@/lib/logActivityToOdoo'
import { supabase } from '@/lib/supabase'
import type { VideoProduct } from '@/types'

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

/**
 * Builds the attributed product URL with UTM params — without SSO wrapping.
 * SSO is handled separately via a POST to /api/shop-redirect (see handleClick)
 * so the session token never appears in the URL or browser history.
 */
function buildTargetUrl(productUrl: string, videoId: string, creatorId: string): string {
  try {
    const url = new URL(productUrl)
    // Unwrap any existing return_url nesting from a previous wrapping
    const existingReturnUrl = url.searchParams.get('return_url')
    const target = existingReturnUrl ? new URL(existingReturnUrl) : url
    target.searchParams.set('utm_source', 'elearning')
    target.searchParams.set('utm_medium', 'video')
    target.searchParams.set('ref_video', videoId)
    target.searchParams.set('ref_creator', creatorId)
    return target.toString()
  } catch {
    const sep = productUrl.includes('?') ? '&' : '?'
    return `${productUrl}${sep}utm_source=elearning&utm_medium=video&ref_video=${encodeURIComponent(videoId)}&ref_creator=${encodeURIComponent(creatorId)}`
  }
}

interface FeaturedProductCardProps {
  product: VideoProduct
  videoId: string
  creatorId: string
}

export function FeaturedProductCard({ product, videoId, creatorId }: FeaturedProductCardProps) {
  /**
   * Click handler — performs cross-domain SSO before navigating to mrbur.shop.
   *
   * Why POST instead of a plain href redirect:
   *   E-learning users authenticate via Supabase, so there is no Odoo
   *   session_id cookie for the Cloudflare Worker to read.  Instead we POST
   *   the user's Supabase access token (from localStorage, never a cookie) to
   *   our own Pages Function which verifies it server-side, looks up the
   *   matching Odoo user, and returns a redirect URL that logs the user in.
   *
   * Why window.open('about:blank') before the async work:
   *   Browsers block window.open() calls that happen *after* an await because
   *   they're no longer considered to be inside a user gesture.  Opening a
   *   blank tab synchronously and navigating it later avoids popup blockers.
   */
  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()

    logElearningActivity(
      'featured_product_clicked',
      `Clicked "${product.product_name}" from video ${videoId}`
    )

    const targetUrl = buildTargetUrl(product.product_url, videoId, creatorId)

    // Open a blank tab NOW — this is synchronous inside the click handler so
    // the browser allows it.  We'll navigate it once we have the SSO URL.
    const newTab = window.open('about:blank', '_blank')

    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token

      if (accessToken) {
        const res = await fetch('/api/shop-redirect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ return_url: targetUrl }),
        })

        if (res.ok) {
          const json = await res.json()
          if (json?.redirect_url) {
            if (newTab) newTab.location.href = json.redirect_url
            else window.open(json.redirect_url, '_blank')
            return
          }
        }
      }
    } catch {
      // Network error or no session — fall through to direct navigation
    }

    // Fallback: navigate to the shop directly (unauthenticated)
    if (newTab) newTab.location.href = targetUrl
    else window.open(targetUrl, '_blank')
  }

  // Keep a fallback href for middle-clicks, right-click → "Open in new tab",
  // and accessibility tools that don't trigger onClick.
  const fallbackHref = buildTargetUrl(product.product_url, videoId, creatorId)

  return (
    <a
      href={fallbackHref}
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
