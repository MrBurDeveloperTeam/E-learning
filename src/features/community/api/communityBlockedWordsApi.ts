import { CommunityBackendUnavailableError } from '@/features/community/api/communityContract'

export interface CommunityBlockedWord {
  id: string
  term: string
  is_active: boolean
  created_by: string
  created_at: string
  severity: 'warn' | 'review' | 'block'
  match_mode: 'word' | 'phrase'
}

export async function fetchCommunityBlockedWords(): Promise<CommunityBlockedWord[]> {
  throw new CommunityBackendUnavailableError('Community banned-term administration')
}

export async function addCommunityBlockedWord(_input: { term: string; severity: CommunityBlockedWord['severity']; matchMode: CommunityBlockedWord['match_mode'] }, _adminId: string): Promise<void> {
  throw new CommunityBackendUnavailableError('Community banned-term administration')
}

export async function updateCommunityBlockedWord(_id: string, _values: Partial<Pick<CommunityBlockedWord, 'severity' | 'match_mode'>>): Promise<void> {
  throw new CommunityBackendUnavailableError('Community banned-term administration')
}

export async function setCommunityBlockedWordActive(_id: string, _isActive: boolean): Promise<void> {
  throw new CommunityBackendUnavailableError('Community banned-term administration')
}

export async function deleteCommunityBlockedWord(_id: string): Promise<void> {
  throw new CommunityBackendUnavailableError('Community banned-term administration')
}
