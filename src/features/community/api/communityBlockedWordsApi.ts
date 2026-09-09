import { supabase } from '@/lib/supabase'

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
  const { data, error } = await supabase.from('community_blocked_words').select('id,term,is_active,created_by,created_at,severity,match_mode').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CommunityBlockedWord[]
}

export async function addCommunityBlockedWord(input: { term: string; severity: CommunityBlockedWord['severity']; matchMode: CommunityBlockedWord['match_mode'] }, adminId: string): Promise<void> {
  const { error } = await supabase.from('community_blocked_words').insert({ term: input.term.trim(), severity: input.severity, match_mode: input.matchMode, created_by: adminId })
  if (error) {
    if (error.code === '23505') throw new Error('This word or phrase already exists.')
    throw error
  }
}

export async function updateCommunityBlockedWord(id: string, values: Partial<Pick<CommunityBlockedWord, 'severity' | 'match_mode'>>): Promise<void> {
  const { error } = await supabase.from('community_blocked_words').update(values).eq('id', id)
  if (error) throw error
}

export async function setCommunityBlockedWordActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('community_blocked_words').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function deleteCommunityBlockedWord(id: string): Promise<void> {
  const { error } = await supabase.from('community_blocked_words').delete().eq('id', id)
  if (error) throw error
}
