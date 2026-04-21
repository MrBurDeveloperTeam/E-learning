import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { PageLayout } from '@/components/layout/PageLayout'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  getAdminSidebarItems,
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
  const pendingUsersQuery = useQuery({
    queryKey: ['admin-sidebar-badges'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_creator', false)
        .eq('is_verified', false)
        .eq('account_type', 'individual')

      if (error) throw error
      return count ?? 0
    },
    staleTime: 30_000,
  })

  const resolvedSidebarBadges: AdminSidebarBadges = {
    pendingUsers:
      sidebarBadges?.pendingUsers ?? pendingUsersQuery.data ?? 0,
  }

  const sidebarItems = getAdminSidebarItems(resolvedSidebarBadges)

  function isItemActive(path: string) {
    if (path === '/admin') {
      return currentPath === path
    }

    return currentPath === path || currentPath.startsWith(path + '/')
  }

  return (
    <PageLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      sidebarVariant="admin"
      className={cn('min-w-0 p-4 md:p-6 lg:p-8', className)}
    >
      <div className="space-y-5 md:space-y-6">
        <div className="-mx-1 overflow-x-auto pb-1 md:hidden scrollbar-hide">
          <div className="flex min-w-max gap-2 px-1">
            {sidebarItems.map((item) => {
              const isActive = isItemActive(item.path)

              if (item.disabled) {
                return (
                  <div
                    key={item.path}
                    className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground/50"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                )
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                    isActive
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-border/70 bg-card/70 text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

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
