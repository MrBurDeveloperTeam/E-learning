import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { toast } from 'sonner'
import { Logo } from '../components/brand/Logo'

export default function Login() {
  const { signInWithEmail, user, profile } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, string>
  const redirectTo = search?.redirect ?? '/explore'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition focus:border-tiffany-600 focus:outline-none focus:ring-2 focus:ring-tiffany-600/20'
  const labelClass =
    'mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400'

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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <main className="w-full max-w-xl rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 lg:p-10">
        <div className="mb-8 text-left">
          <Logo className="mb-5" imageClassName="h-7" />
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Welcome Back</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input
              id="email"
              type="email"
              className={inputClass}
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className={labelClass}>Password</label>
              <button type="button" onClick={() => toast.info('Password reset is not implemented yet.')} className="text-[10px] font-bold text-tiffany-600 hover:underline">
                Forgot Password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              className={inputClass}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center">
            <input type="checkbox" className="h-4 w-4 accent-tiffany-600" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span className="ml-2 text-[11px] text-slate-500">Remember me</span>
          </label>

          <button type="submit" disabled={loading} className="mt-2 w-full rounded-xl bg-slate-900 py-3 text-base font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
            {loading ? <LoadingSpinner size="sm" /> : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/register" className="font-bold text-[hsl(180_14%_49%)] hover:underline">Don&apos;t have an account? Sign up</Link>
        </p>
      </main>
    </div>
  )
}
