import {
  FileText,
  Flag,
  GraduationCap,
  History,
  RotateCcw,
  Settings2,
  Trash2,
  UserX,
} from 'lucide-react'
import type { CommunitySettingsSection } from '@/features/community/api/communityApi'

export type CommunitySettingsView = Exclude<CommunitySettingsSection, 'bookmarks'> | 'verification' | 'reports' | 'blocked' | 'privacy' | 'topics' | 'appeals' | 'restrictions'

export const communitySettingsSections: Array<{ id: CommunitySettingsView; label: string; icon: typeof FileText }> = [
  { id: 'history', label: 'Watch history', icon: History },
  { id: 'deleted', label: 'Deleted posts', icon: Trash2 },
  // Topics settings are temporarily hidden. Re-add the Tags import when restoring this entry.
  // { id: 'topics', label: 'Topics', icon: Tags },
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
