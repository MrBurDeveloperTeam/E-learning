import {
  LayoutDashboard,
  ShieldEllipsis,
  MessagesSquare,
  Users,
  Youtube,
  Megaphone,
  SlidersHorizontal,
} from 'lucide-react'
import type { SidebarItem } from '@/components/layout/Sidebar'

export type AdminSidebarBadges = {
  pendingUsers?: number
  dentalReviewCount?: number
}

export function getAdminSidebarItems(
  badges: AdminSidebarBadges = {}
): SidebarItem[] {
  const pendingUsers = badges.pendingUsers ?? 0
  const dentalReview = badges.dentalReviewCount ?? 0

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
      badge: dentalReview,
      icon: <ShieldEllipsis className="h-4 w-4" />,
    },
    {
      label: 'Community review',
      path: '/admin/community',
      icon: <MessagesSquare className="h-4 w-4" />,
    },
    {
      label: 'Fetch videos',
      path: '/admin/fetch-videos',
      icon: <Youtube className="h-4 w-4" />,
    },
    {
      label: 'Advertisements',
      path: '/admin/advertisements',
      icon: <Megaphone className="h-4 w-4" />,
    },
    {
      label: 'Platform settings',
      path: '/admin/settings',
      icon: <SlidersHorizontal className="h-4 w-4" />,
    },
  ]
}
