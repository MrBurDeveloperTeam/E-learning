import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { toast } from 'sonner'
import { Logo } from '../components/brand/Logo'
import { PasswordField } from '../components/ui/PasswordField'

export default function Register() {
  const { signUp, user } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user && !success && !loading) {
      navigate({ to: '/explore', replace: true })
    }
  }, [loading, navigate, success, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await signUp(email, password, {
        full_name: fullName,
        role: 'member',
        account_type: 'individual',
      })
      setSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="card p-8 max-w-sm text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <svg width="24" height="24" fill="none" stroke="currentColor" className="text-emerald-500" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-foreground">Check your email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
          </p>
          <Link to="/login" search={{ redirect: undefined }}>
            <button type="button" className="btn-outline mt-6">Back to login</button>
          </Link>
        </div>
      </div>
    )
  }

  if (user && !success && !loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" aria-busy="true">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] card p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="flex justify-center">
            <Logo className="mb-2" />
          </div>
          <h1 className="text-xl font-medium text-foreground mt-4 mb-1">Create your account</h1>
          <p className="text-sm text-muted-foreground">Join the dental learning community as an individual member</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-sm font-medium text-foreground/80">Full name</label>
            <input id="fullName" className="input-field" placeholder="Dr. Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="text-sm font-medium text-foreground/80">Email</label>
            <input id="reg-email" type="email" className="input-field" placeholder="you@clinic.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="text-sm font-medium text-foreground/80">Password</label>
            <PasswordField id="reg-password" className="input-field" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-confirm-password" className="text-sm font-medium text-foreground/80">Confirm password</label>
            <PasswordField
              id="reg-confirm-password"
              className="input-field"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground/80">
            New DentalLearn accounts are created as <strong>individual</strong> accounts with the <strong>member</strong> role.
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <LoadingSpinner size="sm" /> : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Already have an account?{' '}
          <Link to="/login" search={{ redirect: undefined }} className="text-primary hover:opacity-80 transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
