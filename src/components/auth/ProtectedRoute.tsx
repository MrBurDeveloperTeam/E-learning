import { ReactNode } from 'react'
import { Navigate, useLocation } from '@tanstack/react-router'
import { useAuthStore } from '../../store/authStore'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { isAdminProfile, isCreatorProfile } from '../../lib/auth'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'member' | 'creator' | 'admin'
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requiredRole, requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50" aria-busy="true">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: location.pathname }} />
  }

  if (requireAdmin && !isAdminProfile(profile)) {
    return <Navigate to="/" />
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/" />
  }

  return <>{children}</>
}

interface CreatorRouteProps {
  children: React.ReactNode
}

export function CreatorRoute({ children }: CreatorRouteProps) {
  const { profile, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!profile) {
    return <Navigate to="/login" />
  }

  if (!isCreatorProfile(profile)) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h2 className="text-xl font-medium text-[#1E3333] mb-2">
          Creator access required
        </h2>
        <p className="text-sm text-[#6B8E8E] mb-6">
          Only verified dental professionals can access this page.
        </p>
        <a href="/settings"
           className="btn-primary px-6 py-2.5 text-sm inline-block">
          Apply for creator access
        </a>
      </div>
    )
  }

  return <>{children}</>
}
