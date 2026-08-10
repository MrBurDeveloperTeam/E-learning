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
 * Appends attribution params to a Snabbb product URL so the purchase can be
 * traced back to this video/creator when Odoo reports the order as paid
 * (see functions/api/products/purchase-webhook.ts).
 */
function buildAttributedUrl(productUrl: string, videoId: string, creatorId: string) {
  try {
    const url = new URL(productUrl)
    url.searchParams.set('utm_source', 'elearning')
    url.searchParams.set('utm_medium', 'video')
    url.searchParams.set('ref_video', videoId)
    url.searchParams.set('ref_creator', creatorId)
    return url.toString()
  } catch {
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
