import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Camera,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Lock,
  LogOut,
  MoonStar,
  Monitor,
  Pencil,
  Shield,
  Share2,
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
  useUploadBackground,
} from '../hooks/useProfile'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { PasswordField } from '../components/ui/PasswordField'
import { useTheme } from '../components/shared/ThemeProvider'
import { useProfileImage } from '../hooks/useProfileImage'
import type { CreatorApplication } from '../types'
import { fetchAccountProfile, saveAccountProfile } from '../lib/accountProfile'

type SettingsTab =
  | 'profile'
  | 'security'
  | 'notifications'
  | 'appearance'

interface ProfileFormValues {
  first_name: string
  last_name: string
  phone: string
  date_of_birth: string
  specialty: string
  street_address: string
  address_line_2: string
  city: string
  state_id: string
  postal_code: string
  country_id: string
  invoice_delivery: string
  electronic_invoice_format: string
  bio: string
}

function splitProfileName(fullName: string | null | undefined) {
  const [firstName = '', ...lastNameParts] = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return { first_name: firstName, last_name: lastNameParts.join(' ') }
}

const SPECIALTY_CATEGORIES = [
  { id: '76', name: 'General Dentistry' }, { id: '77', name: 'Endodontics' },
  { id: '78', name: 'Orthodontics' }, { id: '79', name: 'Prosthodontics' },
  { id: '80', name: 'Periodontics' }, { id: '81', name: 'Implant Dentistry' },
  { id: '82', name: 'Oral Surgery' }, { id: '83', name: 'Pediatric Dentistry' },
]

const MALAYSIAN_STATES = [
  { id: '483', name: 'Selangor' }, { id: '480', name: 'Kuala Lumpur' },
  { id: '481', name: 'Penang' }, { id: '482', name: 'Johor' },
  { id: '484', name: 'Perak' }, { id: '485', name: 'Sabah' },
  { id: '486', name: 'Sarawak' },
]

const ELECTRONIC_FORMATS = [
  ['', 'None'], ['facturx', 'France (FacturX)'], ['ubl_bis3', 'EU Standard (Peppol Bis 3.0)'],
  ['zugferd', 'Germany (ZUGFeRD)'], ['xrechnung', 'Germany (XRechnung)'],
  ['nlcius', 'Netherlands (NLCIUS)'], ['ubl_a_nz', 'Australia (BIS Billing 3.0 A-NZ)'],
  ['ubl_sg', 'Singapore (BIS Billing 3.0 SG)'], ['pint_jp', 'Japan (Peppol PINT JP)'],
  ['pint_my', 'Malaysia (Peppol PINT MY)'],
] as const

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
  const { profileImageUrl } = useProfileImage(Boolean(user))
  const queryClient = useQueryClient()
  const { signOut } = useAuth()
  const updateProfile = useUpdateProfile()
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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const accountProfileQuery = useQuery({
    queryKey: ['snabbb-account-profile', user?.id],
    queryFn: fetchAccountProfile,
    enabled: !!user,
  })
  const accountProfile = accountProfileQuery.data
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
  const { theme, resolvedTheme, setTheme } = useTheme()

  const passwordStrength = getPasswordStrength(newPassword)
  const avatarName = profile?.full_name ?? profile?.name ?? user?.email ?? 'DentalLearn User'
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

  const fallbackName = splitProfileName(profile?.full_name ?? profile?.name)

  const { register, handleSubmit, reset, watch, formState: { isDirty, isSubmitting } } = useForm<ProfileFormValues>({
    defaultValues: {
      first_name: fallbackName.first_name,
      last_name: fallbackName.last_name,
      phone: profile?.phone ?? '',
      date_of_birth: '',
      specialty: '',
      street_address: '',
      address_line_2: '',
      city: '',
      state_id: '',
      postal_code: '',
      country_id: '',
      invoice_delivery: 'email',
      electronic_invoice_format: '',
      bio: profile?.bio ?? '',
    },
  })

  const watchedFullName = `${watch('first_name') ?? ''} ${watch('last_name') ?? ''}`.trim()

  useEffect(() => {
    if (!accountProfile) return
    reset({
      first_name: accountProfile.firstName,
      last_name: accountProfile.lastName,
      phone: accountProfile.phone,
      date_of_birth: accountProfile.dateOfBirth,
      specialty: accountProfile.categoryIds[0] ?? '',
      street_address: accountProfile.street,
      address_line_2: accountProfile.street2,
      city: accountProfile.city,
      state_id: accountProfile.stateId,
      postal_code: accountProfile.postalCode,
      country_id: accountProfile.countryId,
      invoice_delivery: accountProfile.receiveInvoices,
      electronic_invoice_format: accountProfile.electronicFormat,
      bio: profile?.bio ?? '',
    })
    setAvatarPreviewUrl(accountProfile.imageUrl || profileImageUrl || null)
    setBackgroundPreviewUrl(profile?.background_url ?? null)
  }, [accountProfile, profile?.background_url, profile?.bio, profileImageUrl, reset])



  async function onSubmit(values: ProfileFormValues) {
    if (!profile || !accountProfile) return
    const fullName = `${values.first_name.trim()} ${values.last_name.trim()}`.trim()
    try {
      const updatedAccount = await saveAccountProfile({
        ...accountProfile,
        firstName: values.first_name,
        lastName: values.last_name,
        email: accountProfile.email || profile.email || user?.email || '',
        phone: values.phone,
        dateOfBirth: values.date_of_birth,
        street: values.street_address,
        street2: values.address_line_2,
        city: values.city,
        stateId: values.state_id,
        postalCode: values.postal_code,
        countryId: values.country_id,
        categoryIds: values.specialty ? [values.specialty] : [],
        receiveInvoices: values.invoice_delivery,
        electronicFormat: values.electronic_invoice_format,
      })
      queryClient.setQueryData(['snabbb-account-profile', user?.id], updatedAccount)

      // Keep only the e-learning display summary mirrored in Supabase; Odoo remains the source of truth.
      try {
        await updateProfile.mutateAsync({
          userId: profile.user_id,
          payload: {
            full_name: fullName,
            name: fullName,
            phone: values.phone || null,
            specialty: SPECIALTY_CATEGORIES.find((item) => item.id === values.specialty)?.name ?? null,
          },
        })
      } catch (syncError) {
        console.warn('Account profile saved, but the e-learning display cache did not refresh', syncError)
      }
      reset(values)
      toast.success('Profile updated successfully')
    } catch {
      toast.error('Failed to save changes')
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !accountProfile) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be below 2MB')
      e.target.value = ''
      return
    }
    try {
      setIsUploadingAvatar(true)
      const updatedAccount = await saveAccountProfile(accountProfile, file)
      queryClient.setQueryData(['snabbb-account-profile', user?.id], updatedAccount)
      setAvatarPreviewUrl(updatedAccount.imageUrl)
      toast.success('Profile photo updated')
    } catch {
      toast.error('Failed to upload profile photo')
    } finally {
      setIsUploadingAvatar(false)
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
    if (!accountProfile) return
    reset({
      first_name: accountProfile.firstName,
      last_name: accountProfile.lastName,
      phone: accountProfile.phone,
      date_of_birth: accountProfile.dateOfBirth,
      specialty: accountProfile.categoryIds[0] ?? '',
      street_address: accountProfile.street,
      address_line_2: accountProfile.street2,
      city: accountProfile.city,
      state_id: accountProfile.stateId,
      postal_code: accountProfile.postalCode,
      country_id: accountProfile.countryId,
      invoice_delivery: accountProfile.receiveInvoices,
      electronic_invoice_format: accountProfile.electronicFormat,
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
        'Creator request submitted! An administrator will review it within 1–2 business days.'
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
        <SectionLabel>Creator access</SectionLabel>

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
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-700">
              Your application is in the review queue. We will update your access after review.
            </p>
          </div>
        ) : creatorApplicationStatus === 'rejected' ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-destructive/15 bg-destructive/5 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Creator request was rejected
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {creatorApplication?.rejection_reason ||
                  'Your last creator application was rejected. You can update your profile and request creator access again.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyForCreator}
              disabled={isApplyingForCreator}
              className="btn-primary text-sm px-4 py-2 md:flex-shrink-0"
            >
              {isApplyingForCreator ? 'Sending request...' : 'Request creator access again'}
            </button>
          </div>
        ) : creatorApplicationStatus === 'revoked' ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Creator access was revoked
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Your account is back on member access. You can request creator access again when ready.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyForCreator}
              disabled={isApplyingForCreator}
              className="btn-primary text-sm px-4 py-2 md:flex-shrink-0"
            >
              {isApplyingForCreator ? 'Sending request...' : 'Request creator access again'}
            </button>
          </div>
        ) : canApplyForCreator ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Become a creator
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Apply for creator access. An administrator will review your request within 1-2 business days before you can upload videos.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyForCreator}
              disabled={isApplyingForCreator}
              className="btn-primary text-white text-sm px-4 py-2 md:flex-shrink-0"
            >
              {isApplyingForCreator ? 'Sending request...' : 'Request to become a creator'}
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

    // return (
    //   <button
    //     type="button"
    //     onClick={handleApplyForCreator}
    //     disabled={creatorApplicationStatus === 'pending' || isApplyingForCreator}
    //     className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
    //   >
    //     {buttonLabel}
    //   </button>
    // )
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
                {isUploadingAvatar ? <LoadingSpinner size="sm" /> : <Pencil size={10} color='white' />}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
              {isUploadingAvatar && (
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
            <SectionLabel>Personal information</SectionLabel>
            {accountProfileQuery.isLoading && <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"><LoadingSpinner size="sm" />Loading your Snabbb account details...</div>}
            {accountProfileQuery.isError && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">We could not load your Snabbb account details. Please sign in again and refresh this page.</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5"><label htmlFor="first_name" className="text-xs font-medium text-foreground/70">First Name</label><input id="first_name" className="input-field" {...register('first_name', { required: true })} /></div>
              <div className="flex flex-col gap-1.5"><label htmlFor="last_name" className="text-xs font-medium text-foreground/70">Last Name</label><input id="last_name" className="input-field" {...register('last_name', { required: true })} /></div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-foreground/70">Email Address</label>
                <input id="email" disabled value={accountProfile?.email ?? profile?.email ?? user?.email ?? ''} className="input-field cursor-not-allowed bg-muted/50 text-muted-foreground" readOnly />
                <p className="text-[11px] text-muted-foreground/60">Email cannot be changed</p>
              </div>
              <div className="flex flex-col gap-1.5"><label htmlFor="phone" className="text-xs font-medium text-foreground/70">Phone Number</label><input id="phone" className="input-field" {...register('phone')} /></div>
              <div className="flex flex-col gap-1.5"><label htmlFor="date_of_birth" className="text-xs font-medium text-foreground/70">Date of Birth</label><input id="date_of_birth" type="date" className="input-field" {...register('date_of_birth')} /></div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label htmlFor="specialty" className="text-xs font-medium text-foreground/70">Your Specialty</label>
                <div className="relative"><select id="specialty" className="input-field appearance-none bg-transparent pr-9" {...register('specialty')}><option value="">+ Add specialty...</option>{SPECIALTY_CATEGORIES.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>
              </div>
            </div>
          </div>

          <div className="border-b border-border py-6">
            <SectionLabel>Address</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5 md:col-span-2"><label htmlFor="street_address" className="text-xs font-medium text-foreground/70">Street Address</label><input id="street_address" className="input-field" {...register('street_address')} /></div>
              <div className="md:col-span-2"><input aria-label="Address line 2" className="input-field" {...register('address_line_2')} /></div>
              <div className="flex flex-col gap-1.5"><label htmlFor="city" className="text-xs font-medium text-foreground/70">City</label><input id="city" className="input-field" {...register('city')} /></div>
              <div className="flex flex-col gap-1.5"><label htmlFor="state_id" className="text-xs font-medium text-foreground/70">State / Province</label><div className="relative"><select id="state_id" className="input-field appearance-none bg-transparent pr-9" {...register('state_id')}><option value="">Select state</option>{MALAYSIAN_STATES.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></div></div>
              <div className="flex flex-col gap-1.5"><label htmlFor="postal_code" className="text-xs font-medium text-foreground/70">Zip / Postal Code</label><input id="postal_code" className="input-field" {...register('postal_code')} /></div>
              <div className="flex flex-col gap-1.5"><label htmlFor="country_id" className="text-xs font-medium text-foreground/70">Country</label><input id="country_id" type="hidden" {...register('country_id')} /><input className="input-field cursor-not-allowed bg-muted/50 text-muted-foreground" value={accountProfile?.countryName ?? ''} disabled readOnly /></div>
            </div>
          </div>

          <div className="border-b border-border py-6">
            <SectionLabel>Billing preferences</SectionLabel>
            <p className="mb-5 text-xs text-muted-foreground">Choose how you would like to receive invoices.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5"><label htmlFor="invoice_delivery" className="text-xs font-medium text-foreground/70">Receive Invoices</label><select id="invoice_delivery" className="input-field bg-transparent" {...register('invoice_delivery')}><option value="email">by Email</option><option value="snailmail">by Post</option></select></div>
              <div className="flex flex-col gap-1.5"><label htmlFor="electronic_invoice_format" className="text-xs font-medium text-foreground/70">Electronic Format</label><select id="electronic_invoice_format" className="input-field bg-transparent" {...register('electronic_invoice_format')}>{ELECTRONIC_FORMATS.map(([value, label]) => <option key={value || 'none'} value={value}>{label}</option>)}</select></div>
            </div>
          </div>

          <div className="border-b border-border py-6">
            <SectionLabel>Referral program</SectionLabel>
            <p className="mb-5 text-xs text-muted-foreground">Share your Contact ID with friends. When they sign up using your code, you both earn Snabbb credits.</p>
            <label className="text-xs font-medium text-foreground/70">Your Contact ID</label>
            <div className="mt-2 flex gap-3">
              <div className="flex min-h-12 flex-1 items-center rounded-xl border-2 border-primary/70 px-4 font-mono text-lg font-semibold tracking-[0.18em]">{accountProfile?.contactId ?? 'Loading...'}</div>
              <button type="button" aria-label="Copy Contact ID" className="rounded-xl border border-border px-4 text-muted-foreground hover:bg-muted" onClick={() => accountProfile?.contactId && void navigator.clipboard.writeText(accountProfile.contactId).then(() => toast.success('Contact ID copied'))}><Copy size={18} /></button>
              <button type="button" aria-label="Share Contact ID" className="rounded-xl border border-border px-4 text-muted-foreground hover:bg-muted" onClick={() => accountProfile?.contactId && (navigator.share ? void navigator.share({ text: `Join Snabbb with my referral code ${accountProfile.contactId}` }) : void navigator.clipboard.writeText(accountProfile.contactId).then(() => toast.success('Contact ID copied')))}><Share2 size={18} /></button>
            </div>
            {accountProfile?.contactId && <p className="mt-3 text-xs text-muted-foreground">Ask friends to enter <span className="font-semibold text-foreground/70">{accountProfile.contactId}</span> in the referral field when signing up.</p>}
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

          {/* Bio is intentionally retained for a future profile version, but hidden to match the current account settings design. */}
          {false && (
            <div className="border-b border-border py-6">
              <SectionLabel>Bio</SectionLabel>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="bio" className="text-xs font-medium text-foreground/70">Professional bio</label>
                <textarea id="bio" maxLength={500} className="input-field h-28 resize-none" placeholder="Write a short professional bio visible to other members..." {...register('bio')} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[20px]">
              {isDirty && <div className="flex items-center gap-1.5 text-xs text-amber-500"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Unsaved changes</div>}
            </div>
            <div className="-mb-3 flex w-full justify-end gap-2 sm:mb-0 sm:w-auto">
              <button type="button" onClick={handleReset} className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">Discard</button>
              <button type="submit" disabled={!accountProfile || accountProfileQuery.isLoading || isSubmitting} className="flex text-white items-center gap-2 btn-primary px-5 py-2 text-sm disabled:opacity-60">
                {isSubmitting ? <LoadingSpinner size="sm" /> : null}
                {isSubmitting ? 'Saving...' : 'Save changes'}
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
        <div className="mb-5 rounded-xl border border-[#D4E8E7] bg-white/80 p-4 text-xs text-[#6B8E8E] dark:border-border dark:bg-card/80 dark:text-muted-foreground">
          Current Snabbb theme: <span className="font-medium text-[#1E3333] dark:text-foreground">{theme}</span> · Resolved as <span className="font-medium text-[#1E3333] dark:text-foreground">{resolvedTheme}</span>.
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn(
              'rounded-xl border p-5 text-left transition-colors dark:bg-card dark:text-foreground',
              theme === 'light'
                ? 'border-[#88C1BD] bg-[#EAF4F3] dark:border-primary dark:bg-primary/10'
                : 'border-[#D4E8E7] hover:border-[#88C1BD] dark:border-border dark:hover:border-primary'
            )}
          >
            <div className="mb-3 flex items-center gap-3 text-[#2D6E6A] dark:text-primary"><SunMedium size={18} /><p className="text-sm font-medium text-[#1E3333] dark:text-foreground">Light</p></div>
            <p className="text-xs text-[#6B8E8E] dark:text-muted-foreground">Use the bright Snabbb learning interface with soft teal accents.</p>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={cn(
              'rounded-xl border p-5 text-left transition-colors dark:bg-card dark:text-foreground',
              theme === 'dark'
                ? 'border-[#88C1BD] bg-[#EAF4F3] dark:border-primary dark:bg-primary/10'
                : 'border-[#D4E8E7] hover:border-[#88C1BD] dark:border-border dark:hover:border-primary'
            )}
          >
            <div className="mb-3 flex items-center gap-3 text-[#2D6E6A] dark:text-primary"><MoonStar size={18} /><p className="text-sm font-medium text-[#1E3333] dark:text-foreground">Dark</p></div>
            <p className="text-xs text-[#6B8E8E] dark:text-muted-foreground">Use the darker Snabbb mode for lower-light viewing.</p>
          </button>
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={cn(
              'rounded-xl border p-5 text-left transition-colors dark:bg-card dark:text-foreground',
              theme === 'system'
                ? 'border-[#88C1BD] bg-[#EAF4F3] dark:border-primary dark:bg-primary/10'
                : 'border-[#D4E8E7] hover:border-[#88C1BD] dark:border-border dark:hover:border-primary'
            )}
          >
            <div className="mb-3 flex items-center gap-3 text-[#2D6E6A] dark:text-primary"><Monitor size={18} /><p className="text-sm font-medium text-[#1E3333] dark:text-foreground">System</p></div>
            <p className="text-xs text-[#6B8E8E] dark:text-muted-foreground">Follow the user’s device preference while staying synced with Snabbb.</p>
          </button>
        </div>
        <div className="mt-6">
          <PlaceholderPanel
            icon={MoonStar}
            title="Snabbb appearance sync is active"
            description="Theme changes are shared through the Snabbb theme cookie and synced with Odoo when the user is authenticated."
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
        <div className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-8">
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
                    <span className="rounded-full text-white bg-primary px-2 py-0.5 text-[10px] font-medium capitalize text-primary-foreground">{formatPlanLabel(profile?.plan)}</span>
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