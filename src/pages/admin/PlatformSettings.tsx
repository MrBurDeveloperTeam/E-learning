import { useEffect, useState } from 'react'
import { Coins, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminSectionCard, AdminStatusBadge } from '@/components/admin/AdminPrimitives'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useCreditSettings, useUpdateCreditSettings } from '@/hooks/useProducts'
import { isAdminProfile } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import type { SnabbbCreditType } from '@/types'

export function PlatformSettings() {
  const profile = useAuthStore((state) => state.profile)
  const settingsQuery = useCreditSettings()
  const { mutateAsync: updateSettings, isPending: isSaving } = useUpdateCreditSettings()

  const [creditType, setCreditType] = useState<SnabbbCreditType>('flat')
  const [creditValue, setCreditValue] = useState('0')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!settingsQuery.data) return
    setCreditType(settingsQuery.data.credit_type)
    setCreditValue(String(settingsQuery.data.credit_value))
    setIsActive(settingsQuery.data.is_active)
  }, [settingsQuery.data])

  if (!isAdminProfile(profile)) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  async function handleSave() {
    const numericValue = Number(creditValue)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      toast.error('Enter a valid, non-negative credit amount.')
      return
    }
    if (creditType === 'percentage' && numericValue > 100) {
      toast.error('Percentage credit cannot exceed 100%.')
      return
    }

    try {
      await updateSettings({ credit_type: creditType, credit_value: numericValue, is_active: isActive })
      toast.success('Snabbb Credit settings saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings.')
    }
  }

  const previewAmount =
    creditType === 'flat'
      ? `${Number(creditValue || 0).toFixed(2)} credit per successful purchase`
      : `${Number(creditValue || 0).toFixed(2)}% of the order amount, awarded per successful purchase`

  return (
    <AdminLayout
      title="Platform settings"
      subtitle="Configure how doctors earn Snabbb Credit from products featured on their E-Learning videos."
      heroAside={
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
            Reward status
          </p>
          <AdminStatusBadge
            label={isActive ? 'Rewards active' : 'Rewards paused'}
            tone={isActive ? 'success' : 'warning'}
          />
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <AdminSectionCard
          title="E-Learning product purchase credit"
          description="Doctors earn this Snabbb Credit only after an order placed through their featured product link is successfully paid. Cancelled, refunded, or failed orders never qualify."
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Credit type</Label>
                <Select value={creditType} onValueChange={(value) => setCreditType(value as SnabbbCreditType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Credit type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat amount per purchase</SelectItem>
                    <SelectItem value="percentage">Percentage of order amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="credit-value">
                  {creditType === 'flat' ? 'Credit amount' : 'Credit percentage'}
                </Label>
                <div className="relative">
                  <Input
                    id="credit-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={creditValue}
                    onChange={(e) => setCreditValue(e.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {creditType === 'flat' ? 'MYR' : '%'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Reward doctors for purchases</p>
                <p className="text-xs text-muted-foreground">
                  Turn off to pause Snabbb Credit awards platform-wide without removing featured products.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              Preview: a doctor earns <span className="font-medium text-foreground">{previewAmount}</span>.
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} disabled={isSaving || settingsQuery.isLoading}>
                {isSaving ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard title="How this works" description="Suggested flow for the product purchase feature.">
          <ol className="space-y-4 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              A doctor attaches Snabbb partner products to a video from the upload/edit screen.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                2
              </span>
              Viewers click the featured product button and complete checkout on the product page.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                3
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Once the order is marked paid, this rule determines the
                Snabbb Credit awarded to the doctor.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                4
              </span>
              <span className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" /> Cancelled, refunded, or failed orders are recorded but never
                credited.
              </span>
            </li>
          </ol>
        </AdminSectionCard>
      </div>
    </AdminLayout>
  )
}
