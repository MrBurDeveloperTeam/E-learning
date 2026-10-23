import {
  LayoutDashboard,
  ShieldEllipsis,
  Captions,
  MessagesSquare,
  Users,
  Youtube,
  Megaphone,
  SlidersHorizontal,
  Package,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { SidebarItem } from '@/components/layout/Sidebar'
import { supabase } from '@/lib/supabase'

export type AdminSidebarBadges = {
  pendingUsers?: number
  dentalReviewCount?: number
}

export function useAdminSidebarItems(sidebarBadges?: AdminSidebarBadges): SidebarItem[] {
  const pendingUsersQuery = useQuery({
    queryKey: ['admin-sidebar-badges'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('creator_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (error) throw error
      return count ?? 0
    },
    staleTime: 30_000,
  })

  const dentalReviewQuery = useQuery({
    queryKey: ['admin-dental-review-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('dental_videos')
        .select('*', { count: 'exact', head: true })
        .eq('needs_review', true)

      if (error) throw error
      return count ?? 0
    },
    staleTime: 30_000,
  })

  return getAdminSidebarItems({
    pendingUsers: sidebarBadges?.pendingUsers ?? pendingUsersQuery.data ?? 0,
    dentalReviewCount: sidebarBadges?.dentalReviewCount ?? dentalReviewQuery.data ?? 0,
  })
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
      label: 'AI subtitles',
      path: '/admin/subtitles',
      icon: <Captions className="h-4 w-4" />,
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
      label: 'Featured products',
      path: '/admin/video-products',
      icon: <Package className="h-4 w-4" />,
    },
    {
      label: 'Platform settings',
      path: '/admin/settings',
      icon: <SlidersHorizontal className="h-4 w-4" />,
    },
  ]
}
