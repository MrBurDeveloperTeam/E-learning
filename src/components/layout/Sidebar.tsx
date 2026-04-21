import { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '../../lib/utils'

export interface SidebarItem {
  label: string
  path: string
  badge?: number
  icon?: ReactNode
  disabled?: boolean
}

interface SidebarProps {
  items: SidebarItem[]
  className?: string
  variant?: 'default' | 'admin'
}

export function Sidebar({
  items,
  className,
  variant = 'default',
}: SidebarProps) {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const itemClassName =
    variant === 'admin' ? 'sidebar-item-admin' : 'sidebar-item'
  const activeClassName =
    variant === 'admin'
      ? 'sidebar-item-admin-active'
      : 'sidebar-item-active'

  function isItemActive(path: string) {
    if (path === '/admin') {
      return currentPath === path
    }

    return currentPath === path || currentPath.startsWith(path + '/')
  }

  return (
    <aside
      className={cn(
        'hidden md:sticky md:top-14 md:flex md:h-[calc(100vh-3.5rem)] md:w-[248px] md:flex-shrink-0 md:self-start md:flex-col md:overflow-y-auto md:border-r md:border-border/80',
        variant === 'admin'
          ? 'md:bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(234,244,243,0.86))] dark:md:bg-[linear-gradient(180deg,rgba(15,23,23,0.96),rgba(10,20,20,0.9))]'
          : 'md:bg-card',
        className
      )}
    >
      {variant === 'admin' && (
        <div className="border-b border-border/70 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
            Workspace
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            Platform operations
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Review creators, moderate content, and monitor ingestion workflows.
          </p>
        </div>
      )}
      <nav className="py-4">
        {items.map((item) => {
          const isActive = isItemActive(item.path)

          if (item.disabled) {
            return (
              <div
                key={item.path + item.label}
                className="px-4 py-2.5 text-[13px] text-muted-foreground/50 flex items-center gap-2 cursor-not-allowed opacity-60"
              >
                {item.icon && (
                  <span className="flex-shrink-0 text-muted-foreground/40">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                    {item.badge}
                  </span>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.path + item.label}
              to={item.path}
              className={cn(isActive ? activeClassName : itemClassName, 'group')}
            >
              {item.icon && (
                <span className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive
                    ? variant === 'admin'
                      ? 'text-amber-500'
                      : 'text-primary'
                    : 'text-muted-foreground/60 group-hover:text-primary'
                )}>
                  {item.icon}
                </span>
              )}
              <span className="flex-1 font-medium">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium shadow-sm">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
