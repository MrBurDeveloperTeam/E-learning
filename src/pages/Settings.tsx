import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Bell,
  ChevronDown,
  Clock3,
  Lock,
  LogOut,
  Monitor,
  MoonStar,
  Pencil,
  Shield,
  Smartphone,
  SunMedium,
  UserRound,
} from 'lucide-react'
import { PageLayout } from '../components/layout/PageLayout'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Switch } from '../components/ui/switch'
import { cn, getInitials } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUpdateProfile, useUploadAvatar } from '../hooks/useProfile'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { PasswordField } from '../components/ui/PasswordField'

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

const SESSION_LIST = [
  { label: 'MacBook Pro - Chrome', location: 'Kuala Lumpur', lastActive: 'Active now', current: true, icon: Monitor },
  { label: 'iPhone 15 - Safari', location: 'Petaling Jaya', lastActive: '2 hours ago', current: false, icon: Smartphone },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-wider text-[#9BB5B5]">{children}</p>
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
    <div className="rounded-xl border border-dashed border-[#D4E8E7] bg-[#F7FAFA] p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF4F3] text-[#2D6E6A]">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-sm font-medium text-[#1E3333]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#6B8E8E]">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-lg border border-[#D4E8E7] bg-white px-4 py-2 text-sm font-medium text-[#2D6E6A] transition-colors hover:bg-[#EAF4F3]"
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
  if (score === 4) return { score, label: 'Strong', color: 'bg-[#059669]' }
  if (score === 3) return { score, label: 'Good', color: 'bg-[#88C1BD]' }
  if (score === 2) return { score, label: 'Fair', color: 'bg-[#D97706]' }
  if (score === 1) return { score, label: 'Weak', color: 'bg-[#DC2626]' }
  return { score: 0, label: 'Start typing a new password', color: 'bg-[#D4E8E7]' }
}

export function Settings() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const { signOut } = useAuth()
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(profile?.avatar_url ?? null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
  const [appearanceMode, setAppearanceMode] = useState<'soft' | 'high-contrast'>('soft')
  const [applied, setApplied] = useState(false)

  const passwordStrength = getPasswordStrength(newPassword)
  const avatarName = profile?.full_name ?? profile?.name ?? user?.email ?? 'DentalLearn User'
  const pendingCreatorReview =
    applied ||
    (profile?.account_type === 'individual' &&
      profile?.is_creator === false &&
      profile?.is_verified === false)

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
      window.location.href = '/login'
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign out')
    }
  }

  function handleNotificationToggle(key: string, value: boolean) {
    setNotificationSettings((current) => ({ ...current, [key]: value }))
  }

  async function handleApplyForCreator() {
    if (!profile) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_type: 'individual' })
        .eq('user_id', profile.user_id)

      if (error) throw error

      setApplied(true)
      toast.success(
        'Application submitted! We will review your application within 1–2 business days.'
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Something went wrong'
      )
    }
  }

  function renderProfilePanel() {
    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="px-6 py-6">
          <div className="flex items-center gap-5 border-b border-[#D6E0E0] pb-6">
            <div className="relative flex-shrink-0">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#2D6E6A] text-xl font-medium text-[#EAF4F3]">
                {avatarPreviewUrl ? <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" /> : getInitials(watchedFullName || avatarName)}
              </div>
              <label className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[#88C1BD] text-white transition-colors hover:bg-[#2D6E6A]">
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
              <p className="mb-0.5 text-sm font-medium text-[#1E3333]">Profile photo</p>
              <p className="mb-3 text-xs text-[#6B8E8E]">JPG or PNG, recommended 400x400px, max 2MB</p>
              <div className="flex gap-2">
                <label className="cursor-pointer rounded-lg border border-[#D4E8E7] bg-[#EAF4F3] px-3 py-1.5 text-xs font-medium text-[#2D6E6A] transition-colors hover:bg-[#D4E8E7]">
                  Upload new photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
                <button
                  type="button"
                  onClick={() => toast.error('Avatar removal is not available yet')}
                  className="rounded-lg px-3 py-1.5 text-xs text-[#9BB5B5] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-[#D6E0E0] py-6">
            <SectionLabel>Personal details</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="full_name" className="text-xs font-medium text-[#3D5C5C]">Full name<span className="ml-0.5 text-[#DC2626]">*</span></label>
                <input id="full_name" className="input-field" placeholder="Dr. Aina Rahman" {...register('full_name', { required: true })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-[#3D5C5C]">Email address</label>
                <div className="relative">
                  <input id="email" disabled value={profile?.email ?? user?.email ?? ''} className="input-field cursor-not-allowed bg-[#EDF2F2] pr-9 text-[#9BB5B5]" readOnly />
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9BB5B5]"><Lock size={12} /></div>
                </div>
                <p className="text-[11px] text-[#9BB5B5]">Cannot be changed</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-xs font-medium text-[#3D5C5C]">Phone number</label>
                <input id="phone" className="input-field" placeholder="+60 12-345 6789" {...register('phone')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="company_name" className="text-xs font-medium text-[#3D5C5C]">Company / clinic name</label>
                <input id="company_name" className="input-field" placeholder="Clinic or organisation" {...register('company_name')} />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label htmlFor="institution" className="text-xs font-medium text-[#3D5C5C]">Institution</label>
                <input id="institution" className="input-field" placeholder="Hospital, university, or training institution" {...register('institution')} />
              </div>
            </div>
          </div>

          <div className="border-b border-[#D6E0E0] py-6">
            <SectionLabel>Professional details</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="specialty" className="text-xs font-medium text-[#3D5C5C]">Specialty</label>
                <div className="relative">
                  <select id="specialty" className="input-field appearance-none pr-9" {...register('specialty')}>
                    <option value="">Select specialty</option>
                    {SPECIALTY_OPTIONS.map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9BB5B5]"><ChevronDown size={12} /></div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="position" className="text-xs font-medium text-[#3D5C5C]">Position / title</label>
                <input id="position" className="input-field" placeholder="Consultant, lecturer, clinic lead" {...register('position')} />
              </div>
              <div className="rounded-lg border border-[#D4E8E7] bg-[#F7FAFA] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-[#9BB5B5]">Account overview</p>
                <div className="mt-3 flex items-center gap-2 text-sm text-[#3D5C5C]">
                  <span className="capitalize">{profile?.role ?? 'member'}</span>
                  <span className="text-[#D4E8E7]">/</span>
                  <span className="rounded-full bg-[#2D6E6A] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#E8F5F4]">{formatPlanLabel(profile?.plan)}</span>
                </div>
              </div>
            </div>
          </div>

          {profile?.is_creator === false && profile?.is_verified === false && (
            <div className="py-6 border-b border-[#D6E0E0]">
              <p className="text-xs font-medium text-[#9BB5B5] uppercase tracking-wider mb-4">
                Creator access
              </p>

              {pendingCreatorReview ? (
                <div className="flex items-center gap-2 text-sm text-[#D97706]">
                  <Clock3 size={14} />
                  Pending admin review
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[#1E3333]">
                      Apply for creator access
                    </p>
                    <p className="text-xs text-[#6B8E8E] mt-1 max-w-sm">
                      Verified dental professionals can upload videos and build their audience on DentalLearn. Our team will review your application within 1–2 business days.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyForCreator}
                    className="btn-primary text-sm px-4 py-2 flex-shrink-0"
                  >
                    Apply now
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="border-b border-[#D6E0E0] py-6">
            <SectionLabel>Bio</SectionLabel>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bio" className="text-xs font-medium text-[#3D5C5C]">Professional bio</label>
              <textarea id="bio" maxLength={500} className="input-field h-28 resize-none" placeholder="Write a short professional bio visible to other members..." {...register('bio')} />
              <p className="text-right text-[11px] text-[#9BB5B5]">{watchedBio.length}/500</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-5">
            <div className="min-h-[20px]">
              {isDirty && <div className="flex items-center gap-1.5 text-xs text-[#D97706]"><span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />Unsaved changes</div>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleReset} className="rounded-lg px-4 py-2 text-sm text-[#6B8E8E] transition-colors hover:bg-[#EDF2F2]">Discard</button>
              <button type="submit" disabled={updateProfile.isPending} className="flex items-center gap-2 rounded-lg bg-[#88C1BD] px-5 py-2 text-sm font-medium text-[#1A4A47] transition-colors hover:bg-[#5A8784] hover:text-[#EAF4F3] disabled:cursor-not-allowed disabled:opacity-50">
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

        <div className="border-b border-[#D6E0E0] py-6">
          <p className="mb-4 text-sm font-medium text-[#1E3333]">Active sessions</p>
          {SESSION_LIST.map((sessionItem) => {
            const Icon = sessionItem.icon
            return (
              <div key={sessionItem.label} className="flex items-center justify-between border-b border-[#EDF2F2] py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="text-[#6B8E8E]"><Icon size={20} /></div>
                  <div>
                    <p className="text-sm text-[#1E3333]">{sessionItem.label}</p>
                    <p className="text-xs text-[#9BB5B5]">{sessionItem.location} - {sessionItem.current ? 'Current session' : sessionItem.lastActive}</p>
                  </div>
                </div>
                {sessionItem.current ? (
                  <span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-medium text-[#059669]">Current</span>
                ) : (
                  <button type="button" onClick={() => toast.error('Session revocation is not available yet')} className="text-xs text-[#DC2626] hover:underline">Revoke</button>
                )}
              </div>
            )
          })}
        </div>

        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#1E3333]">Two-factor authentication</p>
              <p className="mt-0.5 text-xs text-[#6B8E8E]">Add an extra layer of security to your account</p>
            </div>
            <button type="button" onClick={() => toast.error('Two-factor authentication is not available yet')} className="rounded-lg border border-[#D4E8E7] px-4 py-2 text-sm font-medium text-[#3D5C5C] transition-colors hover:border-[#88C1BD] hover:bg-[#EAF4F3] hover:text-[#2D6E6A]">
              Enable 2FA
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
            onClick={() => setAppearanceMode('soft')}
            className={cn('rounded-xl border p-5 text-left transition-colors', appearanceMode === 'soft' ? 'border-[#88C1BD] bg-[#EAF4F3]' : 'border-[#D4E8E7] hover:border-[#88C1BD]')}
          >
            <div className="mb-3 flex items-center gap-3 text-[#2D6E6A]"><SunMedium size={18} /><p className="text-sm font-medium text-[#1E3333]">Soft daylight</p></div>
            <p className="text-xs text-[#6B8E8E]">Keep the current bright palette with soft teal accents and clean contrast.</p>
          </button>
          <button
            type="button"
            onClick={() => setAppearanceMode('high-contrast')}
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
      <div className="min-h-screen bg-[#F7FAFA]">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-medium text-[#1E3333]">Settings</h1>
            <p className="mt-1 text-sm text-[#6B8E8E]">Manage your account, preferences, and billing</p>
          </div>
          <div className="mb-4 rounded-2xl border border-[#D4E8E7] bg-white p-2 md:hidden">
            <div className="flex min-w-max gap-1 overflow-x-auto">
              {mobileItems.map((item) => {
                const Icon = item.icon
                const active = activeTab === item.id
                return <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors', active ? 'bg-[#EAF4F3] font-medium text-[#2D6E6A]' : 'text-[#6B8E8E]')}><Icon size={16} /><span className="hidden sm:inline">{item.label}</span></button>
              })}
            </div>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-[220px_1fr]">
            <div className="sticky top-20 hidden self-start md:block">
              <div className="overflow-hidden rounded-2xl border border-[#D4E8E7] bg-white">
                <div className="border-b border-[#D4E8E7] p-5">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#2D6E6A] text-base font-medium text-[#EAF4F3]">
                    {avatarPreviewUrl ? <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" /> : getInitials(watchedFullName || avatarName)}
                  </div>
                  <p className="truncate text-sm font-medium text-[#1E3333]">{watchedFullName || profile?.full_name || 'DentalLearn User'}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-xs capitalize text-[#6B8E8E]">{profile?.role ?? 'member'}</span>
                    <span className="text-[#D4E8E7]">/</span>
                    <span className="rounded-full bg-[#2D6E6A] px-2 py-0.5 text-[10px] font-medium capitalize text-[#E8F5F4]">{formatPlanLabel(profile?.plan)}</span>
                  </div>
                </div>
                <nav className="p-2">
                  {navGroups.map((group) => (
                    <div key={group.label}>
                      <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5]">{group.label}</p>
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const active = activeTab === item.id
                        return <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150', active ? 'bg-[#EAF4F3] font-medium text-[#2D6E6A]' : 'text-[#6B8E8E] hover:bg-[#F7FAFA] hover:text-[#2D6E6A]')}><Icon size={16} />{item.label}</button>
                      })}
                    </div>
                  ))}
                  <div>
                    <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-[#9BB5B5]">Danger zone</p>
                    <button type="button" onClick={() => void handleSignOut()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-[#6B8E8E] transition-colors duration-150 hover:bg-[#FEE2E2] hover:text-[#DC2626]"><LogOut size={16} />Sign out</button>
                  </div>
                </nav>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#D4E8E7] bg-white">
              <div className="border-b border-[#D4E8E7] px-6 py-5">
                <h2 className="text-base font-medium text-[#1E3333]">{currentTabMeta.title}</h2>
                <p className="mt-0.5 text-xs text-[#6B8E8E]">{currentTabMeta.description}</p>
              </div>
              {renderPanelBody()}
            </div>
          </div>
        </div>
      </div>

    </PageLayout>
  )
}
