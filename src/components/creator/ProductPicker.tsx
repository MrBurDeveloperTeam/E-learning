import { useEffect, useState } from 'react'
import { Package, Plus, Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePartnerProductSearch } from '@/hooks/useProducts'
import { cn } from '@/lib/utils'
import type { PartnerProduct } from '@/types'

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

interface ProductPickerProps {
  selected: PartnerProduct[]
  onChange: (products: PartnerProduct[]) => void
  disabled?: boolean
}

/**
 * "Add product" button + dialog for attaching Snabbb partner products to an
 * E-Learning video. Selection lives in the parent (Upload.tsx) so it can be
 * persisted alongside the rest of the video form.
 */
export function ProductPicker({ selected, onChange, disabled }: ProductPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const productsQuery = usePartnerProductSearch(debouncedQuery)
  const selectedRefs = new Set(selected.map((product) => product.product_ref))

  function toggleProduct(product: PartnerProduct) {
    if (selectedRefs.has(product.product_ref)) {
      onChange(selected.filter((item) => item.product_ref !== product.product_ref))
    } else {
      onChange([...selected, product])
    }
  }

  function removeProduct(productRef: string) {
    onChange(selected.filter((item) => item.product_ref !== productRef))
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <ul className="space-y-2">
          {selected.map((product) => (
            <li
              key={product.product_ref}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-2 pr-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(product.price, product.currency)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeProduct(product.product_ref)}
                disabled={disabled}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${product.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button type="button" variant="outline" disabled={disabled} className="w-full justify-center gap-2">
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Snabbb partner products</DialogTitle>
            <DialogDescription>
              Featured products appear as clickable buttons while viewers watch this video. You earn
              Snabbb Credit when someone buys through your link.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search Snabbb partner products"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {productsQuery.isLoading && (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading products…</p>
            )}

            {productsQuery.isError && (
              <p className="py-6 text-center text-sm text-destructive">
                Couldn't load Snabbb partner products. Try again.
              </p>
            )}

            {productsQuery.data?.length === 0 && !productsQuery.isLoading && (
              <p className="py-6 text-center text-sm text-muted-foreground">No products found.</p>
            )}

            {productsQuery.data?.map((product) => {
              const isSelected = selectedRefs.has(product.product_ref)
              return (
                <button
                  key={product.product_ref}
                  type="button"
                  onClick={() => toggleProduct(product)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(product.price, product.currency)}</p>
                  </div>
                  {isSelected ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                      Added
                    </span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>

          <DialogFooter showCloseButton>
            <Button type="button" onClick={() => setOpen(false)}>
              Done{selected.length > 0 ? ` (${selected.length} selected)` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
