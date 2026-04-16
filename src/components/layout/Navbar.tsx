import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '../../store/authStore'
import { cn, getInitials } from '../../lib/utils'
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { isAdminProfile, isCreatorProfile } from '../../lib/auth'
import { useAuth } from '../../hooks/useAuth'
import { NotificationBell } from './NotificationBell'
import { Logo } from '../brand/Logo'
import { ThemeToggle } from './ThemeToggle'

const navLinks = [
  { label: 'Home', path: '/explore' },
  { label: 'Following', path: '/feed' },
  { label: 'Saved videos', path: '/saved' },
  { label: 'Categories', path: '/category' },
]

export function Navbar() {
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const router = useRouterState()
  const currentPath = router.location.pathname
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarLabel = profile?.full_name ?? profile?.name ?? user?.email?.split('@')[0] ?? null
  const canAccessCreatorTools = isCreatorProfile(profile)
  const canAccessAdmin = isAdminProfile(profile)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [currentPath])

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  async function handleSignOut() {
    setMenuOpen(false)
    setMobileMenuOpen(false)

    try {
      await signOut()
      // Use router navigation instead of window.location.href to avoid
      // a full page reload which re-triggers auth init with isLoading=true.
      void navigate({ to: '/login', replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign out')
    }
  }

  function isActive(path: string) {
    return path === '/' ? currentPath === '/' : currentPath.startsWith(path)
  }

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-background border-b border-border h-14">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center justify-between">
          {/* Left — Logo */}
          <Link to={user ? "/explore" : "/"}>
            <Logo />
          </Link>

          {/* Center — nav links (authenticated only, hidden on mobile) */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const active = isActive(link.path)
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      'px-4 py-1.5 text-sm transition-colors duration-150 relative',
                      active
                        ? 'text-[#1E3333] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#88C1BD] after:rounded-full'
                        : 'text-[#6B8E8E] hover:text-[#2D6E6A]'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          )}

          {/* Right */}
          <div className="flex items-center gap-2 md:gap-3">
            {!user ? (
              <>
                {/* Desktop auth buttons */}
                <Link to="/login" search={{ redirect: undefined }} className="hidden md:block">
                  <button type="button" className="btn-ghost text-sm">Log in</button>
                </Link>
                <Link to="/register" className="hidden md:block">
                  <button type="button" className="btn-primary text-sm px-4 py-2">Get started</button>
                </Link>
                {/* Mobile hamburger for unauthenticated */}
                <button
                  type="button"
                  className="p-2 rounded-lg text-[#6B8E8E] hover:bg-[#EAF4F3] transition-colors md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  )}
                </button>
              </>
            ) : (
              <>
                {/* Upload button — desktop */}
                {canAccessCreatorTools && (
                  <Link to="/upload" className="hidden md:flex items-center gap-1.5 bg-[#88C1BD] text-[#1A4A47] text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-[#5A8784] hover:text-[#EAF4F3] transition-colors duration-150">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload
                  </Link>
                )}

                <NotificationBell />
                <ThemeToggle />

                {/* Hamburger — mobile */}
                <button
                  type="button"
                  className="p-2 rounded-lg text-[#6B8E8E] hover:bg-[#EAF4F3] transition-colors md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  )}
                </button>

                {/* Avatar + dropdown — desktop */}
                <div className="relative hidden md:block" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[13px] font-medium bg-[#2D6E6A] text-[#EAF4F3] transition-opacity hover:opacity-90"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={avatarLabel ? `${avatarLabel} avatar` : 'Profile avatar'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(avatarLabel)
                    )}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-card p-1 shadow-lg animate-fade-in">
                      <Link
                        to="/channel/$userId"
                        params={{ userId: profile?.user_id ?? user?.id ?? '' }}
                        className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
                        onClick={() => setMenuOpen(false)}
                      >
                        My channel
                      </Link>
                      {canAccessCreatorTools && (
                        <Link
                          to="/studio"
                          className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          Creator studio
                        </Link>
                      )}
                      <Link
                        to="/settings"
                        className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
                        onClick={() => setMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <Link
                        to="/billing"
                        className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
                        onClick={() => setMenuOpen(false)}
                      >
                        Billing
                      </Link>
                      {canAccessAdmin && (
                        <Link
                          to="/admin"
                          className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          Admin
                        </Link>
                      )}
                      <div className="my-1 h-px bg-border" />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          void handleSignOut()
                        }}
                        className="block w-full rounded-md px-3 py-1.5 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Mobile slide-down menu ─── */}
      <div
        className={cn(
          'md:hidden border-t border-border bg-background fixed top-14 left-0 right-0 z-[55]',
          'transition-all duration-200 overflow-hidden',
          mobileMenuOpen
            ? 'max-h-[calc(100vh-3.5rem)] opacity-100 overflow-y-auto'
            : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 py-3 space-y-1">
          {user ? (
            <>
              {/* Nav links */}
              <Link
                to="/explore"
                onClick={closeMobileMenu}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  isActive('/explore') ? 'bg-[#EAF4F3] text-[#2D6E6A] font-medium' : 'text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]'
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Home
              </Link>

              <Link
                to="/feed"
                onClick={closeMobileMenu}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  isActive('/feed') ? 'bg-[#EAF4F3] text-[#2D6E6A] font-medium' : 'text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]'
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Following feed
              </Link>

              <Link
                to="/search"
                onClick={closeMobileMenu}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  isActive('/search') ? 'bg-[#EAF4F3] text-[#2D6E6A] font-medium' : 'text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]'
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Search
              </Link>

              <Link
                to="/saved"
                onClick={closeMobileMenu}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  isActive('/saved') ? 'bg-[#EAF4F3] text-[#2D6E6A] font-medium' : 'text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]'
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2Z" />
                  <path d="m16 3-4 4-4-4" />
                </svg>
                Saved videos
              </Link>

              {/* Divider */}
              <div className="my-2 h-px bg-border" />

              {/* User section */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-medium bg-[#2D6E6A] text-[#EAF4F3] flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(avatarLabel)
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1E3333]">
                    {profile?.full_name ?? 'DentalLearn User'}
                  </p>
                  <p className="text-xs text-[#9BB5B5] capitalize">
                    {profile?.role ?? 'member'}
                  </p>
                </div>
              </div>

              <Link
                to="/channel/$userId"
                params={{ userId: profile?.user_id ?? user?.id ?? '' }}
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
              >
                My channel
              </Link>

              {canAccessCreatorTools && (
                <>
                  <Link
                    to="/studio"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
                  >
                    Creator studio
                  </Link>
                  <Link
                    to="/upload"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
                  >
                    Upload
                  </Link>
                </>
              )}

              <Link
                to="/settings"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
              >
                Settings
              </Link>
              <Link
                to="/billing"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A] transition-colors"
              >
                Billing
              </Link>

              <div className="my-2 h-px bg-border" />

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="space-y-2 py-2">
              <Link to="/login" search={{ redirect: undefined }} onClick={closeMobileMenu} className="block">
                <button type="button" className="btn-outline w-full text-sm">
                  Log in
                </button>
              </Link>
              <Link to="/register" onClick={closeMobileMenu} className="block">
                <button type="button" className="btn-primary w-full text-sm">
                  Get started
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[54] bg-black/20 md:hidden"
          onClick={closeMobileMenu}
          style={{ top: '3.5rem' }}
        />
      )}

      {/* ─── Bottom mobile nav bar ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border flex items-center justify-around px-2 py-2 md:hidden safe-area-pb">
        <Link to="/explore" onClick={closeMobileMenu}>
          <div
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors',
              isActive('/explore') ? 'text-[#2D6E6A]' : 'text-[#9BB5B5]'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="text-[10px]">Home</span>
          </div>
        </Link>

        <Link to="/search" onClick={closeMobileMenu}>
          <div
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors',
              isActive('/search') ? 'text-[#2D6E6A]' : 'text-[#9BB5B5]'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="text-[10px]">Search</span>
          </div>
        </Link>

        {/* Center — Upload (creators) or Explore (non-creators) */}
        {canAccessCreatorTools ? (
          <Link to="/upload" onClick={closeMobileMenu}>
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#88C1BD] text-white -mt-3 shadow-md">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </Link>
        ) : (
          <Link to="/category" onClick={closeMobileMenu}>
            <div
              className={cn(
                'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors',
                isActive('/category') ? 'text-[#2D6E6A]' : 'text-[#9BB5B5]'
              )}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
              <span className="text-[10px]">Categories</span>
            </div>
          </Link>
        )}

        <Link to="/feed" onClick={closeMobileMenu}>
          <div
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors',
              isActive('/feed') ? 'text-[#2D6E6A]' : 'text-[#9BB5B5]'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-[10px]">Following</span>
          </div>
        </Link>

        <Link
          to={user ? '/profile/$userId' : '/login'}
          {...(user ? { params: { userId: profile?.user_id ?? user?.id ?? '' } } : {})}
          onClick={closeMobileMenu}
        >
          <div
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors',
              isActive('/profile') ? 'text-[#2D6E6A]' : 'text-[#9BB5B5]'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[10px]">Profile</span>
          </div>
        </Link>
      </nav>
    </>
  )
}
