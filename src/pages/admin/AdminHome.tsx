import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useAdminSidebarItems } from '@/components/admin/adminNavigation'
import { PageLayout } from '@/components/layout/PageLayout'
import { AdminDashboard } from './AdminDashboard'

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return isMobile
}

function AdminMobileActions() {
  const items = useAdminSidebarItems()
  return (
    <PageLayout className="p-4 pb-24">
      <div className="mx-auto max-w-xl space-y-5">
        <header className="admin-hero-panel rounded-[30px] p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="h-2 w-2 rounded-full bg-current" />
            Admin control center
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">Admin</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose an area to manage.</p>
        </header>

        <nav aria-label="Admin actions" className="overflow-hidden rounded-[24px] border border-border bg-card">
          {items.map((item) => {
            const content = (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    {item.badge}
                  </span>
                )}
                {!item.disabled && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </>
            )

            if (item.disabled) {
              return <div key={item.path} className="flex min-h-14 items-center gap-3 border-b border-border/70 px-4 py-3 text-sm text-muted-foreground/60 last:border-b-0">{content}</div>
            }

            return (
              <Link
                key={item.path}
                to={item.path === '/admin' ? '/admin/dashboard' : item.path}
                className="flex min-h-14 items-center gap-3 border-b border-border/70 px-4 py-3 text-sm font-medium text-foreground transition-colors last:border-b-0 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {content}
              </Link>
            )
          })}
        </nav>
      </div>
    </PageLayout>
  )
}

export function AdminHome() {
  const isMobile = useMobileViewport()
  return isMobile ? <AdminMobileActions /> : <AdminDashboard />
}
