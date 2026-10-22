import {
  BellRing,
  Bookmark,
  FilePenLine,
  FileText,
  Flag,
  GraduationCap,
  History,
  RotateCcw,
  Settings2,
  Tags,
  Trash2,
  UserX,
} from 'lucide-react'
import type { CommunitySettingsSection } from '@/features/community/api/communityApi'

export type CommunitySettingsView = CommunitySettingsSection | 'drafts' | 'verification' | 'reports' | 'blocked' | 'privacy' | 'notifications' | 'topics' | 'appeals' | 'restrictions'

export const communitySettingsSections: Array<{ id: CommunitySettingsView; label: string; icon: typeof FileText }> = [
  { id: 'history', label: 'Watch history', icon: History },
  { id: 'bookmarks', label: 'Saved', icon: Bookmark },
  { id: 'drafts', label: 'Drafts', icon: FilePenLine },
  { id: 'deleted', label: 'Deleted posts', icon: Trash2 },
  { id: 'topics', label: 'Topics', icon: Tags },
  { id: 'notifications', label: 'Notifications', icon: BellRing },
  { id: 'reports', label: 'My reports', icon: Flag },
  { id: 'appeals', label: 'Appeals', icon: RotateCcw },
  { id: 'restrictions', label: 'Restrictions', icon: Flag },
  { id: 'blocked', label: 'Blocked users', icon: UserX },
  { id: 'privacy', label: 'Privacy', icon: Settings2 },
  { id: 'verification', label: 'Verifications', icon: GraduationCap },
]

export function isCommunitySettingsView(value: unknown): value is CommunitySettingsView {
  return communitySettingsSections.some((section) => section.id === value)
}
