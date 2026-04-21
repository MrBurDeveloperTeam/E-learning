import {
  LayoutDashboard,
  ShieldEllipsis,
  Users,
  Youtube,
  SlidersHorizontal,
} from 'lucide-react'
import type { SidebarItem } from '@/components/layout/Sidebar'

export type AdminSidebarBadges = {
  pendingUsers?: number
}

export function getAdminSidebarItems(
  badges: AdminSidebarBadges = {}
): SidebarItem[] {
  const pendingUsers = badges.pendingUsers ?? 0

  return [
    {
      label: 'Dashboard',
      path: '/admin',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: 'User management',
      path: '/admin/users',
      badge: pendingUsers,
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: 'Content review',
      path: '/admin/content',
      icon: <ShieldEllipsis className="h-4 w-4" />,
    },
    {
      label: 'Fetch videos',
      path: '/admin/fetch-videos',
      icon: <Youtube className="h-4 w-4" />,
    },
    {
      label: 'Platform settings',
      path: '/admin/settings',
      disabled: true,
      icon: <SlidersHorizontal className="h-4 w-4" />,
    },
  ]
}
