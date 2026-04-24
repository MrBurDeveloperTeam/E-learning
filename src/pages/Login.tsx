import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { toast } from 'sonner'
import { Logo } from '../components/brand/Logo'
import { PasswordField } from '../components/ui/PasswordField'

export default function Login() {
  const { signInWithEmail, user, profile } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, string>
  const redirectTo = search?.redirect ?? '/explore'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      // Redirect admin users to the admin dashboard
      if (profile?.account_type === 'admin') {
        navigate({ to: '/admin', replace: true })
      } else {
        navigate({ to: redirectTo, replace: true })
      }
    }
  }, [navigate, redirectTo, user, profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithEmail(email, password)
      navigate({ to: redirectTo })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      if (msg === 'Invalid login credentials') {
        toast.error('Invalid login credentials. Please check your email and password, or verify that you have confirmed your email address.')
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  if (user) return null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[380px] card p-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex justify-center">
            <Logo className="mb-2" />
          </div>
          <h1 className="text-xl font-medium text-foreground mt-4 mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your DentalLearn account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground/80">Email</label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground/80">Password</label>
            <PasswordField
              id="password"
              className="input-field"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end mb-4">
            <button type="button" className="text-xs text-primary hover:opacity-80 transition-colors">
              Forgot password?
            </button>
          </div>

          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? <LoadingSpinner size="sm" /> : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary hover:opacity-80 transition-colors font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
