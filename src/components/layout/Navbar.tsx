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

const navLinks: { label: string; path: string; search?: Record<string, unknown> }[] = [
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
      <nav className="sticky top-0 z-50 h-14 w-full border-b border-border bg-background">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6">
          <Link to={user ? '/explore' : '/'}>
            <Logo />
          </Link>

          {user && (
            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const active = isActive(link.path)
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    {...(link.search ? { search: link.search } : {})}
                    className={cn(
                      'relative px-4 py-1.5 text-sm transition-colors duration-150',
                      active
                        ? 'text-[#1E3333] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#88C1BD]'
                        : 'text-[#6B8E8E] hover:text-[#2D6E6A]'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-3">
            {!user ? (
              <>
                <Link to="/login" search={{ redirect: undefined }} className="hidden md:block">
                  <button type="button" className="btn-ghost text-sm">Log in</button>
                </Link>
                <Link to="/register" className="hidden md:block">
                  <button type="button" className="btn-primary px-4 py-2 text-sm">Get started</button>
                </Link>
                <button
                  type="button"
                  className="rounded-lg p-2 text-[#6B8E8E] transition-colors hover:bg-[#EAF4F3] md:hidden"
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
                {canAccessCreatorTools && (
                  <Link to="/upload" className="hidden items-center gap-1.5 rounded-lg bg-[#88C1BD] px-4 py-1.5 text-sm font-medium text-[#1A4A47] transition-colors duration-150 hover:bg-[#5A8784] hover:text-[#EAF4F3] md:flex">
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

                <button
                  type="button"
                  className="rounded-lg p-2 text-[#6B8E8E] transition-colors hover:bg-[#EAF4F3] md:hidden"
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

                <div className="relative hidden md:block" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#2D6E6A] text-[13px] font-medium text-[#EAF4F3] transition-opacity hover:opacity-90"
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
                        className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
                        onClick={() => setMenuOpen(false)}
                      >
                        My channel
                      </Link>
                      {canAccessCreatorTools && (
                        <Link
                          to="/studio"
                          className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
                          onClick={() => setMenuOpen(false)}
                        >
                          Creator studio
                        </Link>
                      )}
                      <Link
                        to="/settings"
                        className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <Link
                        to="/billing"
                        className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Billing
                      </Link>
                      {canAccessAdmin && (
                        <Link
                          to="/admin"
                          className="block rounded-md px-3 py-1.5 text-[13px] text-[#3D5C5C] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
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
                        className="block w-full rounded-md px-3 py-1.5 text-left text-[13px] text-[#DC2626] transition-colors hover:bg-[#FEE2E2]"
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

      <div
        className={cn(
          'fixed left-0 right-0 top-14 z-[55] overflow-hidden border-t border-border bg-background transition-all duration-200 md:hidden',
          mobileMenuOpen
            ? 'max-h-[calc(100vh-3.5rem)] overflow-y-auto opacity-100'
            : 'max-h-0 opacity-0'
        )}
      >
        <div className="space-y-1 px-4 py-3">
          {user ? (
            <>
              <Link
                to="/explore"
                onClick={closeMobileMenu}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive('/explore') ? 'bg-[#EAF4F3] font-medium text-[#2D6E6A]' : 'text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]'
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
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive('/feed') ? 'bg-[#EAF4F3] font-medium text-[#2D6E6A]' : 'text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]'
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
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive('/search') ? 'bg-[#EAF4F3] font-medium text-[#2D6E6A]' : 'text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]'
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
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive('/saved') ? 'bg-[#EAF4F3] font-medium text-[#2D6E6A]' : 'text-[#6B8E8E] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]'
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2Z" />
                  <path d="m16 3-4 4-4-4" />
                </svg>
                Saved videos
              </Link>

              <div className="my-2 h-px bg-border" />

              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2D6E6A] text-xs font-medium text-[#EAF4F3]">
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
                  <p className="text-xs capitalize text-[#9BB5B5]">
                    {profile?.role ?? 'member'}
                  </p>
                </div>
              </div>

              <Link
                to="/channel/$userId"
                params={{ userId: profile?.user_id ?? user?.id ?? '' }}
                onClick={closeMobileMenu}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6B8E8E] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
              >
                My channel
              </Link>

              {canAccessCreatorTools && (
                <>
                  <Link
                    to="/studio"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6B8E8E] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
                  >
                    Creator studio
                  </Link>
                  <Link
                    to="/upload"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6B8E8E] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
                  >
                    Upload
                  </Link>
                </>
              )}

              <Link
                to="/settings"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6B8E8E] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
              >
                Settings
              </Link>
              <Link
                to="/billing"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6B8E8E] transition-colors hover:bg-[#EAF4F3] hover:text-[#2D6E6A]"
              >
                Billing
              </Link>

              <div className="my-2 h-px bg-border" />

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#DC2626] transition-colors hover:bg-[#FEE2E2]"
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

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[54] bg-black/20 md:hidden"
          onClick={closeMobileMenu}
          style={{ top: '3.5rem' }}
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-background px-2 py-2 md:hidden safe-area-pb">
        <Link to="/explore" onClick={closeMobileMenu}>
          <div
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors',
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
              'flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors',
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

        {canAccessCreatorTools ? (
          <Link to="/upload" onClick={closeMobileMenu}>
            <div className="-mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#88C1BD] text-white shadow-md">
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
                'flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors',
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
              'flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors',
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
              'flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors',
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
