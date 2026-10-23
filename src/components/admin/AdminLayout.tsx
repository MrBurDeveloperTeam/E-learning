import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { cn } from '@/lib/utils'
import {
  useAdminSidebarItems,
  type AdminSidebarBadges,
} from './adminNavigation'

interface AdminLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  actions?: ReactNode
  heroAside?: ReactNode
  sidebarBadges?: AdminSidebarBadges
  className?: string
}

export function AdminLayout({
  title,
  subtitle,
  children,
  actions,
  heroAside,
  sidebarBadges,
  className,
}: AdminLayoutProps) {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const sidebarItems = useAdminSidebarItems(sidebarBadges)

  return (
    <PageLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      sidebarVariant="admin"
      className={cn(
        'min-w-0 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6 lg:p-8 lg:pb-8',
        className
      )}
    >
      <div className="space-y-5 md:space-y-6">
        {currentPath !== '/admin' && (
          <Link
            to="/admin"
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Admin actions
          </Link>
        )}

        <section className="admin-hero-panel rounded-[30px] p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <span className="h-2 w-2 rounded-full bg-current" />
                Admin control center
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                {subtitle}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[280px] xl:items-end">
              {actions && (
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  {actions}
                </div>
              )}
              {heroAside && (
                <div className="w-full rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_18px_40px_rgba(30,51,51,0.08)] backdrop-blur dark:border-white/10 dark:bg-card/80 xl:max-w-sm">
                  {heroAside}
                </div>
              )}
            </div>
          </div>
        </section>

        {children}
      </div>
    </PageLayout>
  )
}
