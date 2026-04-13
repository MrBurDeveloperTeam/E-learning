import { ReactNode } from 'react'
import { useAuthStore } from '../../store/authStore'

interface RoleGuardProps {
  children: ReactNode
  role: 'member' | 'creator' | 'admin'
  fallback?: ReactNode
}

export function RoleGuard({ children, role, fallback = null }: RoleGuardProps) {
  const profile = useAuthStore((s) => s.profile)

  if (profile?.role !== role) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
