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
    <aside className={cn('w-[220px] min-h-full bg-white border-r border-teal-100 flex-shrink-0', className)}>
      <nav className="py-4">
        {items.map((item) => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/')

          if (item.disabled) {
            return (
              <div
                key={item.path + item.label}
                className="px-4 py-2.5 text-[13px] text-[#9BB5B5] flex items-center gap-2 cursor-not-allowed opacity-70"
              >
                {item.icon && (
                  <span className="flex-shrink-0 text-[#9BB5B5]">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto text-[10px] bg-[#FEE2E2] text-[#DC2626] px-1.5 py-0.5 rounded-full font-medium">
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
                      ? 'text-[#D97706]'
                      : 'text-teal-800'
                    : 'text-neutral-400 group-hover:text-teal-800'
                )}>
                  {item.icon}
                </span>
              )}
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto text-[10px] bg-[#FEE2E2] text-[#DC2626] px-1.5 py-0.5 rounded-full font-medium">
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
