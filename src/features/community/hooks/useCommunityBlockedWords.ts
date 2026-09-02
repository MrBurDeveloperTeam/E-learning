import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addCommunityBlockedWord, deleteCommunityBlockedWord, fetchCommunityBlockedWords, setCommunityBlockedWordActive, updateCommunityBlockedWord, type CommunityBlockedWord } from '@/features/community/api/communityBlockedWordsApi'

export function useCommunityBlockedWords() {
  return useQuery({ queryKey: ['admin-community-blocked-words'], queryFn: fetchCommunityBlockedWords })
}

export function useAddCommunityBlockedWord(adminId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: { term: string; severity: CommunityBlockedWord['severity']; matchMode: CommunityBlockedWord['match_mode'] }) => addCommunityBlockedWord(input, adminId), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-community-blocked-words'] }) })
}

export function useUpdateCommunityBlockedWord() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, values }: { id: string; values: Partial<Pick<CommunityBlockedWord, 'severity' | 'match_mode'>> }) => updateCommunityBlockedWord(id, values), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-community-blocked-words'] }) })
}

export function useToggleCommunityBlockedWord() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setCommunityBlockedWordActive(id, isActive), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-community-blocked-words'] }) })
}

export function useDeleteCommunityBlockedWord() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteCommunityBlockedWord, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-community-blocked-words'] }) })
}
