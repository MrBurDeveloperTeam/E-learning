import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyVerificationApplications, fetchVerificationQueue, reviewVerificationApplication, submitVerificationApplication } from '@/features/community/api/communityVerificationApi'

export const useMyVerification = (userId: string) => useQuery({ queryKey: ['community-verification', userId], queryFn: () => fetchMyVerificationApplications(userId) })
export const useVerificationQueue = () => useQuery({ queryKey: ['admin-community-verification'], queryFn: fetchVerificationQueue })
export function useSubmitVerification(userId: string) { const q = useQueryClient(); return useMutation({ mutationFn: submitVerificationApplication, onSuccess: () => q.invalidateQueries({ queryKey: ['community-verification', userId] }) }) }
export function useReviewVerification() { const q = useQueryClient(); return useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) => reviewVerificationApplication(id, decision), onSuccess: () => q.invalidateQueries({ queryKey: ['admin-community-verification'] }) }) }
