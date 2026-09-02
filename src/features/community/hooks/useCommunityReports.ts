import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCommunityReport, fetchCommunityReports, fetchMyCommunityReports, resolveCommunityReport } from '@/features/community/api/communityReportApi'

export function useCreateCommunityReport() {
  return useMutation({ mutationFn: createCommunityReport })
}

export function useCommunityReports() {
  return useQuery({ queryKey: ['admin-community-reports'], queryFn: fetchCommunityReports })
}

export function useResolveCommunityReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'dismiss' | 'resolve' | 'hide' }) => resolveCommunityReport(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-reports'] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      queryClient.invalidateQueries({ queryKey: ['community-directory'] })
      queryClient.invalidateQueries({ queryKey: ['community-comments'] })
    },
  })
}

export function useMyCommunityReports(userId: string) {
  return useQuery({ queryKey: ['my-community-reports', userId], queryFn: () => fetchMyCommunityReports(userId) })
}
