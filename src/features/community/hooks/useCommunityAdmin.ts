import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCommunityAuditActions, fetchCommunityReviewComments, fetchCommunityReviewGroups, fetchCommunityReviewPosts, reviewCommunityComment, reviewCommunityGroup, reviewCommunityPost, setCommunityPostPin } from '@/features/community/api/communityAdminApi'

export function useCommunityReviewPosts() {
  return useQuery({ queryKey: ['admin-community-posts'], queryFn: fetchCommunityReviewPosts })
}

export function useCommunityReviewGroups() {
  return useQuery({ queryKey: ['admin-community-groups'], queryFn: fetchCommunityReviewGroups })
}

export function useCommunityReviewComments() {
  return useQuery({ queryKey: ['admin-community-comments'], queryFn: fetchCommunityReviewComments })
}

export function useReviewCommunityPost(adminId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'publish' | 'reject' | 'restore' }) => reviewCommunityPost(id, decision, adminId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-community-posts'] }),
  })
}

export function useCommunityPostPin(){const client=useQueryClient();return useMutation({mutationFn:({id,enabled}:{id:string;enabled:boolean})=>setCommunityPostPin(id,enabled),onSuccess:()=>{client.invalidateQueries({queryKey:['admin-community-posts']});client.invalidateQueries({queryKey:['community-posts']})}})}
export function useCommunityAuditActions(){return useQuery({queryKey:['admin-community-audit'],queryFn:fetchCommunityAuditActions})}

export function useReviewCommunityGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) => reviewCommunityGroup(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-groups'] })
      queryClient.invalidateQueries({ queryKey: ['community-directory'] })
    },
  })
}

export function useReviewCommunityComment(adminId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'publish' | 'reject' | 'hide' | 'restore' }) => reviewCommunityComment(id, decision, adminId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-comments'] })
      queryClient.invalidateQueries({ queryKey: ['community-comments'] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
    },
  })
}
