import type { ComponentType, InputHTMLAttributes, ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type AccentTone = 'default' | 'warning' | 'success' | 'danger'
type StatusTone = AccentTone | 'info'

const statAccentStyles: Record<AccentTone, string> = {
  default:
    'bg-[linear-gradient(135deg,rgba(136,193,189,0.18),rgba(136,193,189,0.04))] text-teal-800 dark:text-teal-100 ring-1 ring-teal-900/10 dark:ring-teal-100/10',
  warning:
    'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20',
  success:
    'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20',
  danger:
    'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
}

const badgeToneStyles: Record<StatusTone, string> = {
  default:
    'border-border bg-muted/70 text-muted-foreground',
  info: 'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  warning:
    'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  success:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  danger:
    'border-destructive/20 bg-destructive/10 text-destructive',
}

export function AdminSectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section
      className={cn(
        'admin-surface overflow-hidden rounded-[28px]',
        className
      )}
    >
      {(title || description || action) && (
        <div className="flex flex-col gap-3 border-b border-border/80 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn('px-5 py-5 sm:px-6', contentClassName)}>{children}</div>
    </section>
  )
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  accent = 'default',
  hint,
}: {
  label: string
  value: number | string
  icon: ComponentType<{ className?: string }>
  accent?: AccentTone
  hint?: string
}) {
  return (
    <div className="admin-surface rounded-[26px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl',
            statAccentStyles[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export function AdminStatusBadge({
  label,
  tone = 'default',
  dot = false,
  className,
}: {
  label: string
  tone?: StatusTone
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        badgeToneStyles[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  )
}

export function AdminFilterTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (nextValue: T) => void
  options: { value: T; label: string; count?: number }[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-2xl border border-border/80 bg-background/70 p-1.5',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all',
              active
                ? 'bg-card text-foreground shadow-[0_10px_30px_rgba(30,51,51,0.08)] ring-1 ring-border/70'
                : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  active
                    ? 'bg-primary/12 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function AdminSearchField({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 rounded-2xl border border-border/80 bg-background/70 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]',
        className
      )}
    >
      <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />
      <input
        {...props}
        className="w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  )
}

export function AdminToolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'admin-surface flex flex-col gap-3 rounded-[24px] p-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      {children}
    </div>
  )
}

export function AdminTableShell({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <AdminSectionCard
      title={title}
      description={description}
      action={action}
      className={className}
      contentClassName="p-0"
    >
      <div className="overflow-x-auto">{children}</div>
    </AdminSectionCard>
  )
}
