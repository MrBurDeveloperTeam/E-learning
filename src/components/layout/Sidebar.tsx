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

  return (
    <aside className={cn('w-[220px] min-h-full bg-card border-r border-border flex-shrink-0', className)}>
      <nav className="py-4">
        {items.map((item) => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/')

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
