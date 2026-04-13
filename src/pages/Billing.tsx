import { useState } from 'react'
import {
  Check,
  CreditCard,
  Download,
  FileText,
  Landmark,
  MoonStar,
  ReceiptText,
  Wallet,
} from 'lucide-react'
import { PageLayout } from '../components/layout/PageLayout'
import { cn, formatMYR } from '../lib/utils'
import { useAuthStore } from '../store/authStore'
import { isAdminProfile } from '../lib/auth'
import { toast } from 'sonner'

type BillingTab = 'plan' | 'payment-history' | 'payout' | 'tax-information'

const TAB_META: Record<BillingTab, { title: string; description: string }> = {
  plan: { title: 'Plan & billing', description: 'Manage your subscription and payment details' },
  'payment-history': { title: 'Payment history', description: 'Review your previous invoices and billing activity' },
  payout: { title: 'Payout settings', description: 'Configure how you receive your creator earnings' },
  'tax-information': { title: 'Tax information', description: 'Review the information that will support creator payouts' },
}

function PlaceholderPanel({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof MoonStar
  title: string
  description: string
  actionLabel: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#D4E8E7] bg-[#F7FAFA] p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF4F3] text-[#2D6E6A]">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-sm font-medium text-[#1E3333]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#6B8E8E]">{description}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-lg border border-[#D4E8E7] bg-white px-4 py-2 text-sm font-medium text-[#2D6E6A] transition-colors hover:bg-[#EAF4F3]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

const AVAILABLE_PLANS = [
  { id: 'dental_basic', name: 'Dental Basic', price: 'MYR 29', badge: undefined, features: ['5 CE courses/month', 'CE certificate', 'Community access'] },
  { id: 'dental_pro', name: 'Dental Pro', price: 'MYR 79', badge: 'Most popular', features: ['Unlimited courses', 'CE certificate', 'Community', 'Priority Q&A', 'Offline downloads'] },
  { id: 'dental_clinic', name: 'Dental Clinic', price: 'MYR 199', badge: undefined, features: ['Up to 10 team seats', 'Admin dashboard', 'Custom reports', 'Dedicated support'] },
] as const

const BILLING_HISTORY = [
  { date: '12 Mar 2026', description: 'Dental Pro monthly subscription', amount: 'MYR 79.00', status: 'Paid' },
  { date: '12 Feb 2026', description: 'Dental Pro monthly subscription', amount: 'MYR 79.00', status: 'Paid' },
  { date: '12 Jan 2026', description: 'Dental Pro monthly subscription', amount: 'MYR 79.00', status: 'Paid' },
] as const

function formatPlanLabel(plan: string | null | undefined) {
  if (!plan) return 'Free'
  return plan.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function normalisePlan(plan: string | null | undefined) {
  if (plan === 'dental_basic' || plan === 'dental_pro' || plan === 'dental_clinic') return plan
  if (plan === 'pro') return 'dental_pro'
  if (plan === 'studio') return 'dental_clinic'
  return 'dental_basic'
}

export function Billing() {
  const profile = useAuthStore((s) => s.profile)
  const [activeTab, setActiveTab] = useState<BillingTab>('plan')
  const [payoutSchedule, setPayoutSchedule] = useState<'monthly' | 'weekly'>('monthly')
  const currentPlanId = normalisePlan(profile?.plan)
  const currentTabMeta = TAB_META[activeTab]

  const canAccessCreatorBilling = isAdminProfile(profile) || profile?.is_creator === true

  const navGroups = [
    { label: 'Billing', items: [{ id: 'plan' as BillingTab, label: 'Plan & billing', icon: CreditCard }, { id: 'payment-history' as BillingTab, label: 'Payment history', icon: ReceiptText }] },
    ...(canAccessCreatorBilling ? [{ label: 'Creator', items: [{ id: 'payout' as BillingTab, label: 'Payout settings', icon: Wallet }, { id: 'tax-information' as BillingTab, label: 'Tax information', icon: FileText }] }] : []),
  ]
  const mobileItems = navGroups.flatMap((group) => group.items)

  function renderPlanPanel() {
    const currentPlanName = AVAILABLE_PLANS.find((plan) => plan.id === currentPlanId)?.name ?? formatPlanLabel(profile?.plan)

    return (
      <div className="px-6 py-6">
        <div className="border-b border-[#D6E0E0] pb-6">
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#D4E8E7] bg-[#EAF4F3] p-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2"><p className="text-base font-medium text-[#1E3333]">{currentPlanName}</p><span className="badge-ce">Active plan</span></div>
              <p className="text-sm text-[#6B8E8E]">MYR 79/month - renews on 12 Apr 2026</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {['Unlimited courses', 'CE certificates', 'Priority Q&A'].map((feature) => <span key={feature} className="flex items-center gap-1 text-xs text-[#5A8784]"><Check size={10} className="text-[#88C1BD]" />{feature}</span>)}
              </div>
            </div>
            <button type="button" onClick={() => toast.error('Plan management is not available yet')} className="flex-shrink-0 rounded-lg border-2 border-[#88C1BD] px-4 py-2 text-sm font-medium text-[#2D6E6A] transition-colors hover:bg-[#88C1BD] hover:text-[#1A4A47]">
              Manage plan
            </button>
          </div>
        </div>

        <div className="border-b border-[#D6E0E0] py-6">
          <p className="mb-4 text-sm font-medium text-[#1E3333]">Available plans</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {AVAILABLE_PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlanId
              return (
                <div key={plan.id} className={cn('rounded-xl border p-4 transition-colors', isCurrent ? 'border-2 border-[#88C1BD] bg-[#EAF4F3]' : 'cursor-pointer border-[#D4E8E7] hover:border-[#88C1BD]')}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[#1E3333]">{plan.name}</p>
                    {plan.badge && <span className="rounded-full bg-[#2D6E6A] px-2 py-0.5 text-[10px] font-medium text-[#E8F5F4]">{plan.badge}</span>}
                  </div>
                  <div className="mt-2 flex items-end gap-1"><p className="text-xl font-medium text-[#1E3333]">{plan.price}</p><span className="text-sm text-[#9BB5B5]">/mo</span></div>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.map((feature) => <li key={feature} className="flex items-center gap-1.5 text-xs text-[#6B8E8E]"><Check size={10} className="text-[#88C1BD]" />{feature}</li>)}
                  </ul>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => toast.error('Plan switching is not available yet')}
                    className={cn('mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors', isCurrent ? 'cursor-not-allowed bg-white/80 text-[#9BB5B5]' : 'border border-[#D4E8E7] text-[#2D6E6A] hover:bg-[#EAF4F3]')}
                  >
                    {isCurrent ? 'Current plan' : 'Switch to this plan'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-b border-[#D6E0E0] py-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-[#1E3333]">Payment method</p>
            <button type="button" onClick={() => toast.error('Adding payment methods is not available yet')} className="text-xs text-[#88C1BD] transition-colors hover:text-[#2D6E6A]">+ Add new</button>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#D4E8E7] p-3">
            <div className="flex h-6 w-10 items-center justify-center rounded bg-[#EDF2F2] text-xs font-medium text-[#6B8E8E]">VISA</div>
            <div className="flex-1"><p className="text-sm text-[#1E3333]">**** **** **** 4242</p><p className="text-xs text-[#9BB5B5]">Expires 12/27</p></div>
            <span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-medium text-[#059669]">Default</span>
          </div>
        </div>

        <div className="pt-6">
          <p className="mb-3 text-sm font-medium text-[#1E3333]">Billing history</p>
          <div className="overflow-hidden rounded-xl border border-[#D4E8E7]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D4E8E7] bg-[#F7FAFA]">
                  {['Date', 'Description', 'Amount', 'Status', ''].map((header) => <th key={header || 'actions'} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[#9BB5B5]">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {BILLING_HISTORY.map((entry) => (
                  <tr key={`${entry.date}-${entry.amount}`} className="border-b border-[#EDF2F2] transition-colors last:border-0 hover:bg-[#F7FAFA]">
                    <td className="px-4 py-3 text-sm text-[#6B8E8E]">{entry.date}</td>
                    <td className="px-4 py-3 text-sm text-[#3D5C5C]">{entry.description}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#1E3333]">{entry.amount}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-medium text-[#059669]">{entry.status}</span></td>
                    <td className="px-4 py-3"><button type="button" onClick={() => toast.error('Invoice downloads are not available yet')} className="text-[#9BB5B5] transition-colors hover:text-[#88C1BD]"><Download size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderPaymentHistoryPanel() {
    return (
      <div className="px-6 py-6">
        <div className="overflow-hidden rounded-xl border border-[#D4E8E7]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D4E8E7] bg-[#F7FAFA]">
                {['Date', 'Description', 'Amount', 'Status', ''].map((header) => <th key={header || 'actions'} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[#9BB5B5]">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {BILLING_HISTORY.map((entry) => (
                <tr key={`${entry.date}-${entry.amount}`} className="border-b border-[#EDF2F2] transition-colors last:border-0 hover:bg-[#F7FAFA]">
                  <td className="px-4 py-3 text-sm text-[#6B8E8E]">{entry.date}</td>
                  <td className="px-4 py-3 text-sm text-[#3D5C5C]">{entry.description}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[#1E3333]">{entry.amount}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-medium text-[#059669]">{entry.status}</span></td>
                  <td className="px-4 py-3"><button type="button" onClick={() => toast.error('Invoice downloads are not available yet')} className="text-[#9BB5B5] transition-colors hover:text-[#88C1BD]"><Download size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderPayoutPanel() {
    return (
      <div className="px-6 py-6">
        <div className="mb-6 rounded-xl border border-[#D4E8E7] bg-[#EAF4F3] p-5">
          <div className="grid gap-4 md:grid-cols-3 md:divide-x md:divide-[#D4E8E7]">
            {[
              { label: 'Available balance', value: formatMYR(1840) },
              { label: 'Total earned', value: formatMYR(12450) },
              { label: 'Next payout date', value: '15 Apr 2026' },
            ].map((item, index) => <div key={item.label} className={cn(index === 0 ? 'md:pl-0' : 'md:pl-5')}><p className="mb-1 text-xs text-[#6B8E8E]">{item.label}</p><p className="text-xl font-medium text-[#1E3333]">{item.value}</p></div>)}
          </div>
        </div>
        <div className="border-b border-[#D6E0E0] pb-6">
          <p className="mb-4 text-sm font-medium text-[#1E3333]">Bank account</p>
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#D4E8E7] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EDF2F2] text-[#6B8E8E]"><Landmark size={18} /></div>
            <div className="flex-1"><p className="text-sm text-[#1E3333]">Maybank</p><p className="text-xs text-[#9BB5B5]">Account **** 4821</p></div>
            <button type="button" onClick={() => toast.error('Bank account removal is not available yet')} className="text-xs text-[#6B8E8E] transition-colors hover:text-[#DC2626]">Remove</button>
          </div>
        </div>
        <div className="py-6">
          <p className="mb-4 text-sm font-medium text-[#1E3333]">Payout schedule</p>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { id: 'monthly', title: 'Monthly', description: '15th of each month' },
              { id: 'weekly', title: 'Weekly', description: 'Every Monday' },
            ].map((option) => {
              const selected = payoutSchedule === option.id
              return (
                <button key={option.id} type="button" onClick={() => setPayoutSchedule(option.id as 'monthly' | 'weekly')} className={cn('rounded-xl p-4 text-left transition-colors', selected ? 'border-2 border-[#88C1BD] bg-[#EAF4F3]' : 'border border-[#D4E8E7] hover:border-[#AEDAD8]')}>
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border', selected ? 'border-[#88C1BD] bg-[#88C1BD]' : 'border-[#D4E8E7]')}>{selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                    <div><p className="text-sm font-medium text-[#1E3333]">{option.title}</p><p className="mt-0.5 text-xs text-[#6B8E8E]">{option.description}</p></div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function renderTaxPanel() {
    return (
      <div className="px-6 py-6">
        <PlaceholderPanel icon={FileText} title="Tax details are not connected yet" description="Tax forms, withholding details, and downloadable documents will appear here once creator payout workflows are integrated." actionLabel="" />
      </div>
    )
  }

  function renderPanelBody() {
    if (activeTab === 'plan') return renderPlanPanel()
    if (activeTab === 'payment-history') return renderPaymentHistoryPanel()
    if (activeTab === 'payout') return renderPayoutPanel()
    if (activeTab === 'tax-information') return renderTaxPanel()
    return null
  }

  return (
    <PageLayout className="p-0" scrollMain={false}>
      <div className="min-h-screen bg-[#F7FAFA]">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-medium text-[#1E3333]">Billing</h1>
            <p className="mt-1 text-sm text-[#6B8E8E]">Manage your subscription, payment methods, and billing history</p>
          </div>

          {/* Mobile tab bar */}
          <div className="mb-4 rounded-2xl border border-[#D4E8E7] bg-white p-2 md:hidden">
            <div className="flex min-w-max gap-1 overflow-x-auto">
              {mobileItems.map((item) => {
                const Icon = item.icon
                const active = activeTab === item.id
                return <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors', active ? 'bg-[#EAF4F3] font-medium text-[#2D6E6A]' : 'text-[#6B8E8E]')}><Icon size={16} /><span>{item.label}</span></button>
              })}
            </div>
          </div>

          <div className="grid items-start gap-6 md:grid-cols-[220px_1fr]">
            {/* Sidebar — desktop */}
            <div className="sticky top-20 hidden self-start md:block">
              <div className="overflow-hidden rounded-2xl border border-[#D4E8E7] bg-white">
                <div className="border-b border-[#D4E8E7] p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2D6E6A] text-[#EAF4F3]">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1E3333]">Billing</p>
                      <p className="text-xs text-[#6B8E8E] capitalize">{formatPlanLabel(profile?.plan)} plan</p>
                    </div>
                  </div>
                </div>
                <nav className="p-2">
                  {navGroups.map((group) => (
                    <div key={group.label}>
                      <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5]">{group.label}</p>
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const active = activeTab === item.id
                        return <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150', active ? 'bg-[#EAF4F3] font-medium text-[#2D6E6A]' : 'text-[#6B8E8E] hover:bg-[#F7FAFA] hover:text-[#2D6E6A]')}><Icon size={16} />{item.label}</button>
                      })}
                    </div>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main content */}
            <div className="overflow-hidden rounded-2xl border border-[#D4E8E7] bg-white">
              <div className="border-b border-[#D4E8E7] px-6 py-5">
                <h2 className="text-base font-medium text-[#1E3333]">{currentTabMeta.title}</h2>
                <p className="mt-0.5 text-xs text-[#6B8E8E]">{currentTabMeta.description}</p>
              </div>
              {renderPanelBody()}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
