import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Camera,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Lock,
  LogOut,
  MoonStar,
  Pencil,
  Shield,
  SunMedium,
  UserRound,
} from 'lucide-react'
import { PageLayout } from '../components/layout/PageLayout'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Switch } from '../components/ui/switch'
import { submitCreatorApplication } from '../lib/creatorApplications'
import { cn, getInitials } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import {
  useUpdateProfile,
  useUploadAvatar,
  useUploadBackground,
} from '../hooks/useProfile'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { PasswordField } from '../components/ui/PasswordField'
import { useTheme } from '../components/shared/ThemeProvider'
import type { CreatorApplication } from '../types'

type SettingsTab =
  | 'profile'
  | 'security'
  | 'notifications'
  | 'appearance'

interface ProfileFormValues {
  full_name: string
  phone: string
  position: string
  company_name: string
  specialty: string
  institution: string
  bio: string
}

const SPECIALTY_OPTIONS = [
  'General Dentistry',
  'Restorative',
  'Implantology',
  'Orthodontics',
  'Endodontics',
  'Periodontology',
  'Oral Surgery',
  'Paediatric Dentistry',
  'Prosthodontics',
  'Practice Management',
]

const TAB_META: Record<SettingsTab, { title: string; description: string }> = {
  profile: { title: 'Profile information', description: 'Update your personal details and professional information' },
  security: { title: 'Security', description: 'Manage your password and account security' },
  notifications: { title: 'Notifications', description: 'Choose what you want to be notified about' },
  appearance: { title: 'Appearance', description: 'Preview upcoming visual and accessibility preferences' },
}

const NOTIFICATION_GROUPS = [
  {
    label: 'Learning activity',
    items: [
      { key: 'certificateReady', label: 'CE certificate ready', description: 'When your certificate is generated after course completion' },
      { key: 'lessonReminder', label: 'Lesson reminder', description: 'Remind me to continue an in-progress course after 3 days' },
      { key: 'newSpecialtyCourse', label: 'New course in my specialty', description: 'When a new course matching your specialty is published' },
    ],
  },
  {
    label: 'Community',
    items: [
      { key: 'caseReply', label: 'Reply to my case', description: 'When someone replies to a case you posted' },
      { key: 'kolEndorsement', label: 'KOL endorsed reply', description: 'When a KOL endorses a reply on your case' },
      { key: 'instructorReply', label: 'New reply from instructor', description: 'When an instructor answers a question on your course' },
    ],
  },
  {
    label: 'Platform updates',
    items: [
      { key: 'kolLive', label: 'KOL going live', description: 'When a KOL you follow starts a live session' },
      { key: 'weeklySummary', label: 'Weekly CE summary', description: 'A weekly digest of your CE progress' },
      { key: 'productAnnouncements', label: 'Product announcements', description: 'New features and platform updates' },
    ],
  },
] as const

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">{children}</p>
}

function PlaceholderPanel({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof MoonStar
  title: string
  description: string
  actionLabel: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-sm font-medium text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function formatPlanLabel(plan: string | null | undefined) {
  if (!plan) return 'Free'
  return plan.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 8) score = 1
  if (/[A-Z]/.test(password)) score = 2
  if (/\d/.test(password)) score = 3
  if (/[^A-Za-z0-9]/.test(password)) score = 4
  if (score === 4) return { score, label: 'Strong', color: 'bg-emerald-500' }
  if (score === 3) return { score, label: 'Good', color: 'bg-primary' }
  if (score === 2) return { score, label: 'Fair', color: 'bg-amber-500' }
  if (score === 1) return { score, label: 'Weak', color: 'bg-destructive' }
  return { score: 0, label: 'Start typing a new password', color: 'bg-muted' }
}

export function Settings() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const { signOut } = useAuth()
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const uploadBackground = useUploadBackground()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(profile?.avatar_url ?? null)
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState(
    profile?.background_url ?? null
  )
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isApplyingForCreator, setIsApplyingForCreator] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState<Record<string, boolean>>({
    certificateReady: true,
    lessonReminder: true,
    newSpecialtyCourse: false,
    caseReply: true,
    kolEndorsement: true,
    instructorReply: true,
    kolLive: false,
    weeklySummary: true,
    productAnnouncements: false,
  })
  const { resolvedTheme, setTheme } = useTheme()

  const passwordStrength = getPasswordStrength(newPassword)
  const avatarName = profile?.full_name ?? profile?.name ?? user?.email ?? 'DentalLearn User'
  const appearanceMode: 'soft' | 'high-contrast' =
    resolvedTheme === 'dark' ? 'high-contrast' : 'soft'
  const creatorApplicationQuery = useQuery({
    queryKey: ['creator-application', profile?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_applications')
        .select('*')
        .eq('user_id', profile!.user_id)
        .maybeSingle()

      if (error) throw error
      return (data ?? null) as CreatorApplication | null
    },
    enabled: !!profile?.user_id,
  })
  const creatorApplication = creatorApplicationQuery.data
  const creatorApplicationStatus = creatorApplication?.status ?? null
  const isVerificationApproved =
    profile?.is_verified === true || creatorApplicationStatus === 'approved'
  const pendingCreatorReview = creatorApplicationStatus === 'pending'
  const canApplyForCreator =
    creatorApplicationStatus === null ||
    creatorApplicationStatus === 'rejected' ||
    creatorApplicationStatus === 'revoked'

  const { register, handleSubmit, reset, watch, formState: { isDirty } } = useForm<ProfileFormValues>({
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      position: profile?.position ?? '',
      company_name: profile?.company_name ?? '',
      specialty: profile?.specialty ?? '',
      institution: profile?.institution ?? '',
      bio: profile?.bio ?? '',
    },
  })

  const watchedFullName = watch('full_name')
  const watchedBio = watch('bio') ?? ''

  useEffect(() => {
    reset({
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      position: profile?.position ?? '',
      company_name: profile?.company_name ?? '',
      specialty: profile?.specialty ?? '',
      institution: profile?.institution ?? '',
      bio: profile?.bio ?? '',
    })
    setAvatarPreviewUrl(profile?.avatar_url ?? null)
    setBackgroundPreviewUrl(profile?.background_url ?? null)
  }, [profile, reset])



  async function onSubmit(values: ProfileFormValues) {
    if (!profile) return
    try {
      await updateProfile.mutateAsync({
        userId: profile.user_id,
        payload: {
          full_name: values.full_name,
          phone: values.phone || null,
          position: values.position || null,
          company_name: values.company_name || null,
          specialty: values.specialty || null,
          institution: values.institution || null,
          bio: values.bio || null,
        },
      })
      reset(values)
      toast.success('Profile updated successfully')
    } catch {
      toast.error('Failed to save changes')
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    try {
      const updatedProfile = await uploadAvatar.mutateAsync({ userId: profile.user_id, file })
      setAvatarPreviewUrl(updatedProfile.avatar_url)
      toast.success('Avatar updated')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      e.target.value = ''
    }
  }

  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    try {
      const updatedProfile = await uploadBackground.mutateAsync({
        userId: profile.user_id,
        file,
      })
      setBackgroundPreviewUrl(updatedProfile.background_url)
      toast.success('Channel background updated')
    } catch {
      toast.error('Failed to upload channel background')
    } finally {
      e.target.value = ''
    }
  }

  function handleReset() {
    reset({
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      position: profile?.position ?? '',
      company_name: profile?.company_name ?? '',
      specialty: profile?.specialty ?? '',
      institution: profile?.institution ?? '',
      bio: profile?.bio ?? '',
    })
  }

  async function handleSignOut() {
    try {
      await signOut()
      // Note: signOut now automatically redirects to Snabbb main app
    } catch (error) {
      console.error('Sign out failed:', error)
      // Fallback: redirect to login if signOut fails
      window.location.href = '/login'
    }
  }

  function handleNotificationToggle(key: string, value: boolean) {
    setNotificationSettings((current) => ({ ...current, [key]: value }))
  }

  async function handleApplyForCreator() {
    if (!profile || isApplyingForCreator) return

    try {
      setIsApplyingForCreator(true)
      const data = await submitCreatorApplication(
        profile.user_id,
        creatorApplication ?? null
      )

      console.log('[verification-request][settings] creator_applications upsert succeeded', data)
      queryClient.setQueryData(
        ['creator-application', profile.user_id],
        data as CreatorApplication
      )
      queryClient.invalidateQueries({
        queryKey: ['creator-application', profile.user_id],
      })
      toast.success(
        'Application submitted! We will review your application within 1–2 business days.'
      )
    } catch (error) {
      console.error('[verification-request][settings] creator_applications upsert failed', error)
      toast.error(
        error instanceof Error ? error.message : 'Something went wrong'
      )
    } finally {
      setIsApplyingForCreator(false)
    }
  }

  function renderVerificationSection() {
    if (profile?.is_creator !== false || profile?.is_verified !== false) {
      return null
    }

    return (
      <div className="border-b border-border py-6">
        <SectionLabel>Verification</SectionLabel>

        {creatorApplicationQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">
            Loading creator application status...
          </p>
        ) : pendingCreatorReview ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <Clock3 size={14} />
              Pending admin review
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Your application is in the review queue. We will update your access after review.
            </p>
          </div>
        ) : creatorApplicationStatus === 'rejected' ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-destructive/15 bg-destructive/5 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Verification was rejected
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {creatorApplication?.rejection_reason ||
                  'Your last creator application was rejected. You can update your profile and request verification again.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyForCreator}
              disabled={isApplyingForCreator}
              className="btn-primary text-sm px-4 py-2 md:flex-shrink-0"
            >
              {isApplyingForCreator ? 'Requesting...' : 'Request verification again'}
            </button>
          </div>
        ) : creatorApplicationStatus === 'revoked' ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Verification was revoked
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Your account is back on member access. You can request verification again when ready.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyForCreator}
              disabled={isApplyingForCreator}
              className="btn-primary text-sm px-4 py-2 md:flex-shrink-0"
            >
              {isApplyingForCreator ? 'Requesting...' : 'Request verification again'}
            </button>
          </div>
        ) : canApplyForCreator ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Request verification
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Request a review for your professional profile. Our team will verify your application within 1-2 business days.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyForCreator}
              disabled={isApplyingForCreator}
              className="btn-primary text-sm px-4 py-2 md:flex-shrink-0"
            >
              {isApplyingForCreator ? 'Requesting...' : 'Request verification'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Creator application status is being updated. Refresh this page if the latest state does not appear yet.
          </p>
        )}
      </div>
    )
  }

  function renderProfileHeaderAction() {
    if (
      activeTab !== 'profile' ||
      creatorApplicationQuery.isLoading
    ) {
      return null
    }

    if (isVerificationApproved) {
      return (
        <div className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={16} />
          Verified
        </div>
      )
    }

    if (profile?.is_creator !== false || profile?.is_verified !== false) {
      return null
    }

    const buttonLabel =
      creatorApplicationStatus === 'pending'
        ? 'Verification pending'
        : isApplyingForCreator
          ? 'Requesting...'
        : creatorApplicationStatus === 'rejected' || creatorApplicationStatus === 'revoked'
          ? 'Request verification again'
          : 'Request verification'

    return (
      <button
        type="button"
        onClick={handleApplyForCreator}
        disabled={creatorApplicationStatus === 'pending' || isApplyingForCreator}
        className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
      >
        {buttonLabel}
      </button>
    )
  }

  function renderProfilePanel() {
    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="px-6 py-6">
          <div className="flex items-center gap-5 border-b border-border pb-6">
            <div className="relative flex-shrink-0">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-xl font-medium text-primary">
                {avatarPreviewUrl ? <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" /> : getInitials(watchedFullName || avatarName)}
              </div>
              <label className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:opacity-90">
                {uploadAvatar.isPending ? <LoadingSpinner size="sm" /> : <Pencil size={10} />}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
              {uploadAvatar.isPending && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>

            <div>
              <p className="mb-0.5 text-sm font-medium text-foreground">Profile photo</p>
              <p className="mb-3 text-xs text-muted-foreground">JPG or PNG, recommended 400x400px, max 2MB</p>
              <div className="flex gap-2">
                <label className="cursor-pointer rounded-lg border border-border bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
                  Upload new photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
                <button
                  type="button"
                  onClick={() => toast.error('Avatar removal is not available yet')}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          {renderVerificationSection()}

          <div className="border-b border-border py-6">
            <SectionLabel>Channel background</SectionLabel>
            <div className="overflow-hidden rounded-2xl border border-border bg-muted/30">
              <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary/40 via-primary/60 to-primary/80">
                {backgroundPreviewUrl ? (
                  <img
                    src={backgroundPreviewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}

                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />

                <div className="absolute bottom-4 left-4 flex items-end gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-primary/20 text-lg font-medium text-primary shadow-sm">
                    {avatarPreviewUrl ? (
                      <img
                        src={avatarPreviewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(watchedFullName || avatarName)
                    )}
                  </div>
                  <div className="pb-1 text-white">
                    <p className="text-sm font-medium">
                      {watchedFullName || profile?.full_name || 'Your channel'}
                    </p>
                    <p className="text-xs text-white/80">
                      Visible on your creator channel header
                    </p>
                  </div>
                </div>

                {uploadBackground.isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 px-4 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                <p>JPG or PNG, recommended 1600x400px or wider, max 4MB</p>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-muted">
                  {uploadBackground.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Camera size={14} />
                  )}
                  {backgroundPreviewUrl ? 'Change background' : 'Upload background'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBackgroundUpload}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="border-b border-border py-6">
            <SectionLabel>Personal details</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="full_name" className="text-xs font-medium text-foreground/70">Full name<span className="ml-0.5 text-destructive">*</span></label>
                <input id="full_name" className="input-field" placeholder="Dr. Aina Rahman" {...register('full_name', { required: true })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-foreground/70">Email address</label>
                <div className="relative">
                  <input id="email" disabled value={profile?.email ?? user?.email ?? ''} className="input-field cursor-not-allowed bg-muted/50 pr-9 text-muted-foreground" readOnly />
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Lock size={12} /></div>
                </div>
                <p className="text-[11px] text-muted-foreground/60">Cannot be changed</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-xs font-medium text-foreground/70">Phone number</label>
                <input id="phone" className="input-field" placeholder="+60 12-345 6789" {...register('phone')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="company_name" className="text-xs font-medium text-foreground/70">Company / clinic name</label>
                <input id="company_name" className="input-field" placeholder="Clinic or organisation" {...register('company_name')} />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label htmlFor="institution" className="text-xs font-medium text-foreground/70">Institution</label>
                <input id="institution" className="input-field" placeholder="Hospital, university, or training institution" {...register('institution')} />
              </div>
            </div>
          </div>

          <div className="border-b border-border py-6">
            <SectionLabel>Professional details</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="specialty" className="text-xs font-medium text-foreground/70">Specialty</label>
                <div className="relative">
                  <select id="specialty" className="input-field appearance-none pr-9 bg-transparent" {...register('specialty')}>
                    <option value="">Select specialty</option>
                    {SPECIALTY_OPTIONS.map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><ChevronDown size={12} /></div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="position" className="text-xs font-medium text-foreground/70">Position / title</label>
                <input id="position" className="input-field" placeholder="Consultant, lecturer, clinic lead" {...register('position')} />
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Account overview</p>
                <div className="mt-3 flex items-center gap-2 text-sm text-foreground/80">
                  <span className="capitalize">{profile?.role ?? 'member'}</span>
                  <span className="text-border">/</span>
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">{formatPlanLabel(profile?.plan)}</span>
                </div>
              </div>
            </div>
          </div>

          {false && (
            <div className="py-6 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-4">
                Verification
              </p>

              {creatorApplicationQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">
                  Loading creator application status...
                </p>
              ) : pendingCreatorReview ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-amber-500">
                    <Clock3 size={14} />
                    Pending admin review
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your application is in the review queue. We will update your access after review.
                  </p>
                </div>
              ) : creatorApplicationStatus === 'rejected' ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Verification was rejected
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      {creatorApplication?.rejection_reason ||
                        'Your last creator application was rejected. You can update your profile and apply again.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyForCreator}
                    className="btn-primary text-sm px-4 py-2 flex-shrink-0"
                  >
                    Request verification again
                  </button>
                </div>
              ) : creatorApplicationStatus === 'revoked' ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Verification was revoked
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Your account is back on member access. You can submit a new application when ready.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyForCreator}
                    className="btn-primary text-sm px-4 py-2 flex-shrink-0"
                  >
                    Request verification again
                  </button>
                </div>
              ) : canApplyForCreator ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Request verification
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Verified dental professionals can upload videos and build their audience on DentalLearn. Our team will review your application within 1–2 business days.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyForCreator}
                    className="btn-primary text-sm px-4 py-2 flex-shrink-0"
                  >
                    Request verification
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Creator application status is being updated. Refresh this page if the latest state does not appear yet.
                </p>
              )}
            </div>
          )}

          <div className="border-b border-border py-6">
            <SectionLabel>Bio</SectionLabel>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bio" className="text-xs font-medium text-foreground/70">Professional bio</label>
              <textarea id="bio" maxLength={500} className="input-field h-28 resize-none" placeholder="Write a short professional bio visible to other members..." {...register('bio')} />
              <p className="text-right text-[11px] text-muted-foreground/60">{watchedBio.length}/500</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-5">
            <div className="min-h-[20px]">
              {isDirty && <div className="flex items-center gap-1.5 text-xs text-amber-500"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Unsaved changes</div>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleReset} className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">Discard</button>
              <button type="submit" disabled={updateProfile.isPending} className="flex items-center gap-2 btn-primary px-5 py-2 text-sm">
                {updateProfile.isPending ? <LoadingSpinner size="sm" /> : null}
                Save changes
              </button>
            </div>
          </div>
        </div>
      </form>
    )
  }

  function renderSecurityPanel() {
    return (
      <div className="px-6 py-6">
        <div className="border-b border-[#D6E0E0] pb-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#1E3333]">Password</p>
              <p className="mt-0.5 text-xs text-[#6B8E8E]">Last changed: Never</p>
            </div>
          </div>
          <div className="max-w-[400px] space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#3D5C5C]">Current password</label>
              <PasswordField value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-field" placeholder="Enter current password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#3D5C5C]">New password</label>
              <PasswordField value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" placeholder="Enter new password" />
              {newPassword && (
                <div className="mt-2">
                  <div className="mb-1 flex gap-1">
                    {[1, 2, 3, 4].map((level) => <div key={level} className={cn('h-1 flex-1 rounded-full', passwordStrength.score >= level ? passwordStrength.color : 'bg-[#D4E8E7]')} />)}
                  </div>
                  <p className="text-[11px] text-[#6B8E8E]">{passwordStrength.label}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#3D5C5C]">Confirm new password</label>
              <PasswordField value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" placeholder="Confirm new password" />
            </div>
            <button type="button" onClick={() => toast.error('Password updates are not available yet')} className="mt-2 rounded-lg bg-[#88C1BD] px-5 py-2 text-sm font-medium text-[#1A4A47] transition-colors hover:bg-[#5A8784] hover:text-[#EAF4F3]">
              Update password
            </button>
          </div>
        </div>

      </div>
    )
  }

  function renderNotificationsPanel() {
    return (
      <div className="px-6 py-6">
        {NOTIFICATION_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className={cn(groupIndex > 0 && 'border-t border-[#D6E0E0] pt-5')}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#9BB5B5]">{group.label}</p>
            {group.items.map((item) => (
              <div key={item.key} className="flex items-start justify-between border-b border-[#EDF2F2] py-4 last:border-0">
                <div className="flex-1 pr-8">
                  <p className="text-sm font-medium text-[#1E3333]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[#6B8E8E]">{item.description}</p>
                </div>
                <Switch checked={notificationSettings[item.key]} onCheckedChange={(checked) => handleNotificationToggle(item.key, checked)} className="data-[state=checked]:bg-[#88C1BD]" />
              </div>
            ))}
          </div>
        ))}
        <div className="flex justify-end pt-5">
          <button type="button" onClick={() => toast.success('Notification preferences saved')} className="rounded-lg bg-[#88C1BD] px-5 py-2 text-sm font-medium text-[#1A4A47] transition-colors hover:bg-[#5A8784] hover:text-[#EAF4F3]">
            Save preferences
          </button>
        </div>
      </div>
    )
  }

  function renderAppearancePanel() {
    return (
      <div className="px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn('rounded-xl border p-5 text-left transition-colors', appearanceMode === 'soft' ? 'border-[#88C1BD] bg-[#EAF4F3]' : 'border-[#D4E8E7] hover:border-[#88C1BD]')}
          >
            <div className="mb-3 flex items-center gap-3 text-[#2D6E6A]"><SunMedium size={18} /><p className="text-sm font-medium text-[#1E3333]">Soft daylight</p></div>
            <p className="text-xs text-[#6B8E8E]">Keep the current bright palette with soft teal accents and clean contrast.</p>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={cn('rounded-xl border p-5 text-left transition-colors', appearanceMode === 'high-contrast' ? 'border-[#88C1BD] bg-[#EAF4F3]' : 'border-[#D4E8E7] hover:border-[#88C1BD]')}
          >
            <div className="mb-3 flex items-center gap-3 text-[#2D6E6A]"><MoonStar size={18} /><p className="text-sm font-medium text-[#1E3333]">High contrast preview</p></div>
            <p className="text-xs text-[#6B8E8E]">Preview a stronger contrast direction for future readability controls and theme options.</p>
          </button>
        </div>
        <div className="mt-6">
          <PlaceholderPanel
            icon={MoonStar}
            title="Appearance preferences are being prepared"
            description="This section is ready for theme, density, and accessibility controls once those preferences are connected to the product shell."
            actionLabel="Keep current appearance"
            onAction={() => toast.success('Current appearance retained')}
          />
        </div>
      </div>
    )
  }

  function renderPanelBody() {
    if (activeTab === 'profile') return renderProfilePanel()
    if (activeTab === 'security') return renderSecurityPanel()
    if (activeTab === 'notifications') return renderNotificationsPanel()
    if (activeTab === 'appearance') return renderAppearancePanel()
    return null
  }

  const navGroups = [
    { label: 'Account', items: [{ id: 'profile' as SettingsTab, label: 'Profile', icon: UserRound }, { id: 'security' as SettingsTab, label: 'Security', icon: Shield }] },
    { label: 'Preferences', items: [{ id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell }, { id: 'appearance' as SettingsTab, label: 'Appearance', icon: SunMedium }] },
  ]
  const mobileItems = navGroups.flatMap((group) => group.items)
  const currentTabMeta = TAB_META[activeTab]

  return (
    <PageLayout className="p-0" scrollMain={false}>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-medium text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your account, preferences, and billing</p>
          </div>
          <div className="mb-4 rounded-2xl border border-border bg-card p-2 md:hidden">
            <div className="flex min-w-max gap-1 overflow-x-auto">
              {mobileItems.map((item) => {
                const Icon = item.icon
                const active = activeTab === item.id
                return <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors', active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground')}><Icon size={16} /><span className="hidden sm:inline">{item.label}</span></button>
              })}
            </div>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-[220px_1fr]">
            <div className="sticky top-20 hidden self-start md:block">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-5">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-base font-medium text-primary">
                    {avatarPreviewUrl ? <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" /> : getInitials(watchedFullName || avatarName)}
                  </div>
                  <p className="truncate text-sm font-medium text-foreground">{watchedFullName || profile?.full_name || 'DentalLearn User'}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-xs capitalize text-muted-foreground">{profile?.role ?? 'member'}</span>
                    <span className="text-border">/</span>
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium capitalize text-primary-foreground">{formatPlanLabel(profile?.plan)}</span>
                  </div>
                </div>
                <nav className="p-2">
                  {navGroups.map((group) => (
                    <div key={group.label}>
                      <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">{group.label}</p>
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const active = activeTab === item.id
                        return <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150', active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-primary')}><Icon size={16} />{item.label}</button>
                      })}
                    </div>
                  ))}
                  <div>
                    <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Danger zone</p>
                    <button type="button" onClick={() => void handleSignOut()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"><LogOut size={16} />Sign out</button>
                  </div>
                </nav>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-6 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-medium text-foreground">{currentTabMeta.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{currentTabMeta.description}</p>
                  </div>
                  {renderProfileHeaderAction()}
                </div>
              </div>
              {renderPanelBody()}
            </div>
          </div>
        </div>
      </div>

    </PageLayout>
  )
}
