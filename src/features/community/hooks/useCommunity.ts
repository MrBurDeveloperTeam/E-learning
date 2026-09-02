import { useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addCommunityRule, cancelFriendRequest, checkCommunityCommentSafety, createCommunity, createCommunityComment, createCommunityPost, decideCommunityJoinRequest, deleteCommunityComment, deleteCommunityMessage, deleteCommunityRule, fetchCommunityBlockedUsers, fetchCommunityComments, fetchCommunityDirectory, fetchCommunityManagement, fetchCommunityMembers, fetchCommunityMentionUsers, fetchCommunityPosts, fetchCommunityPreferences, fetchDirectConversations, fetchDirectMessages, fetchFollowingPeople, fetchFriendRequests, fetchFriends, fetchManagedPosts, joinPublicCommunity, leaveCommunity, markConversationRead, moveCommunityRule, openCommunityConversation, openDirectConversation, removeCommunityMember, removeCommunitySettingRelation, requestPrivateCommunityJoin, respondFriendRequest, restoreOwnCommunityPost, saveCommunityAnnouncement, saveCommunityPreferences, sendDirectMessage, setCommunityCommentFeature, setCommunityCommentLike, setCommunityMemberMute, setCommunityPostInteraction, setCommunityUserBlock, updateCommunityComment, updateCommunityMessage, updateCommunityRule, type CommunityFeedCursor, type CommunityFeedMode, type CommunitySettingsSection } from '@/features/community/api/communityApi'
import type { CommunityManagedPost, CommunityPerson } from '@/features/community/types'
import { supabase } from '@/lib/supabase'
import { recordCommunityPostShare, recordCommunityPostView, setCommunityPostNotInterested, softDeleteCommunityPost, updateCommunityPost } from '@/features/community/api/communityApi'
import { fetchCommunityPost } from '@/features/community/api/communityApi'
import { recordCommunityOperationalEvent } from '@/features/community/api/communityReleaseApi'

export function useCommunityPosts(userId?: string, mode: CommunityFeedMode = 'home', search = '', topic = 'all', sort: 'relevant'|'newest'|'popular'='relevant', communityId?: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['community-posts'] })
    const channel = supabase.channel(`community-feed:${mode}:${userId ?? 'guest'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, refresh)
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [mode, queryClient, userId])
  return useInfiniteQuery({
    queryKey: ['community-posts', mode, userId ?? 'guest', search, topic, sort, communityId ?? 'all'],
    queryFn: ({ pageParam }) => fetchCommunityPosts(pageParam, userId, mode, search, topic, sort, communityId),
    initialPageParam: undefined as CommunityFeedCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

export function useCreateCommunityPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCommunityPost,
    onSuccess: (_data,input) => {queryClient.invalidateQueries({ queryKey: ['community-posts'] });void recordCommunityOperationalEvent({userId:input.authorId,eventName:input.draft?'post_draft_saved':'post_submitted',targetType:'post'})},
    onError: (_error,input) => {void recordCommunityOperationalEvent({userId:input.authorId,eventName:'post_submission_failed',severity:'error',targetType:'post'})},
  })
}

export function useCommunityPostInteraction(userId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ table, postId, active, comment }: {
      table: 'community_post_likes' | 'community_post_reposts' | 'community_post_bookmarks'
      postId: string
      active: boolean
      comment?: string
    }) => {
      if (!userId) throw new Error('Sign in to interact with posts.')
      await setCommunityPostInteraction(table, postId, userId, active, comment)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
  })
}

export function useCommunityPost(postId:string,userId?:string){return useQuery({queryKey:['community-post',postId,userId],queryFn:()=>fetchCommunityPost(postId,userId),enabled:Boolean(postId)})}

export function useCommunityPostActions(userId?:string){const client=useQueryClient();return useMutation({mutationFn:async(input:{action:'edit'|'delete'|'share'|'not_interested'|'view';postId:string;title?:string;body?:string;topic?:import('@/features/community/types').CommunityPostTopic;watchSeconds?:number;progress?:number})=>{if(!userId)throw new Error('Sign in to manage posts.');if(input.action==='edit')return updateCommunityPost({id:input.postId,authorId:userId,title:input.title??'',body:input.body??'',topic:input.topic??'general_dentistry'});if(input.action==='delete')return softDeleteCommunityPost(input.postId,userId);if(input.action==='share')return recordCommunityPostShare(input.postId);if(input.action==='not_interested')return setCommunityPostNotInterested(input.postId,userId);return recordCommunityPostView(input.postId,input.watchSeconds,input.progress)},onSuccess:()=>client.invalidateQueries({queryKey:['community-posts']})})}

export function useCommunityComments(postId: string, userId: string | undefined, enabled: boolean, page = 0, search = '') {
  const client = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const channel = supabase.channel(`community-comments:${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments', filter: `post_id=eq.${postId}` }, () => void client.invalidateQueries({ queryKey: ['community-comments', postId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comment_likes' }, () => void client.invalidateQueries({ queryKey: ['community-comments', postId] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [client, enabled, postId])
  return useQuery({
    queryKey: ['community-comments', postId, page, search, userId],
    queryFn: () => fetchCommunityComments(postId, userId, page, search),
    enabled,
  })
}

export function useCheckCommunityCommentSafety() {
  return useMutation({ mutationFn: checkCommunityCommentSafety })
}

export function useCommunityMentionUsers(query: string) {
  return useQuery({ queryKey: ['community-mention-users', query], queryFn: () => fetchCommunityMentionUsers(query), enabled: query.length > 0, staleTime: 60_000 })
}

export function useCreateCommunityComment(postId: string, userId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, parentCommentId, files }: { body: string; parentCommentId?: string | null; files?: File[] }) => {
      if (!userId) throw new Error('Sign in to comment.')
      return createCommunityComment({ postId, authorId: userId, body, parentCommentId, files })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      queryClient.invalidateQueries({ queryKey: ['admin-community-comments'] })
    },
  })
}

export function useCommunityCommentFeature(postId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ commentId, feature, enabled }: { commentId: string; feature: 'pinned' | 'best_answer'; enabled: boolean }) => setCommunityCommentFeature(commentId, feature, enabled), onSuccess: () => client.invalidateQueries({ queryKey: ['community-comments', postId] }) })
}

export function useCommunityUserBlock(postId: string, userId?: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ blockedUserId, active }: { blockedUserId: string; active: boolean }) => {
    if (!userId) throw new Error('Sign in to block a user.')
    return setCommunityUserBlock(blockedUserId, userId, active)
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['community-comments', postId] }) })
}

export function useCommunityBlockedUsers(userId: string) {
  return useQuery({ queryKey: ['community-blocked-users', userId], queryFn: () => fetchCommunityBlockedUsers(userId) })
}

export function useUnblockCommunityUser(userId: string) {
  const client=useQueryClient()
  return useMutation({ mutationFn:(blockedUserId:string)=>setCommunityUserBlock(blockedUserId,userId,false),onSuccess:()=>{client.invalidateQueries({queryKey:['community-blocked-users',userId]});client.invalidateQueries({queryKey:['community-comments']})} })
}

export function useUpdateCommunityComment(postId: string, userId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) => {
      if (!userId) throw new Error('Sign in to edit this comment.')
      return updateCommunityComment(commentId, userId, body)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-comments', postId] }),
  })
}

export function useDeleteCommunityComment(postId: string, userId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => {
      if (!userId) throw new Error('Sign in to delete this comment.')
      return deleteCommunityComment(commentId, userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
    },
  })
}

export function useCommunityCommentLike(postId: string, userId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, active }: { commentId: string; active: boolean }) => {
      if (!userId) throw new Error('Sign in to like comments.')
      return setCommunityCommentLike(commentId, userId, active)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-comments', postId] }),
  })
}

export function useCommunityDirectory(userId?: string) {
  return useQuery({
    queryKey: ['community-directory', userId],
    queryFn: () => fetchCommunityDirectory(userId!),
    enabled: Boolean(userId),
  })
}

export function useJoinPublicCommunity(userId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (communityId: string) => {
      if (!userId) throw new Error('Sign in to join a community.')
      await joinPublicCommunity(communityId, userId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-directory', userId] }),
  })
}

export function useCreateCommunity(userId?: string) { const client=useQueryClient(); return useMutation({ mutationFn:(input:{name:string;description:string;visibility:'public'|'private'})=>{if(!userId)throw new Error('Sign in to create a community.');return createCommunity({ownerId:userId,...input})}, onSuccess:()=>client.invalidateQueries({queryKey:['community-directory',userId]}) }) }
export function useLeaveCommunity(userId?: string) { const client=useQueryClient(); return useMutation({mutationFn:(communityId:string)=>{if(!userId)throw new Error('Sign in to leave.');return leaveCommunity(communityId,userId)},onSuccess:()=>client.invalidateQueries({queryKey:['community-directory',userId]})}) }
export function useCommunityManagement(communityId?:string){return useQuery({queryKey:['community-management',communityId],queryFn:()=>fetchCommunityManagement(communityId!),enabled:Boolean(communityId)})}
export function useCommunityMembers(communityId?:string){return useQuery({queryKey:['community-members',communityId],queryFn:()=>fetchCommunityMembers(communityId!),enabled:Boolean(communityId)})}
export function useDecideCommunityJoinRequest(communityId:string,userId:string){const client=useQueryClient();return useMutation({mutationFn:({id,decision}:{id:string;decision:'approved'|'rejected'})=>decideCommunityJoinRequest(id,decision,userId),onSuccess:()=>{client.invalidateQueries({queryKey:['community-management',communityId]});client.invalidateQueries({queryKey:['community-directory']})}})}
export function useRemoveCommunityMember(communityId:string){const client=useQueryClient();return useMutation({mutationFn:removeCommunityMember,onSuccess:()=>{client.invalidateQueries({queryKey:['community-management',communityId]});client.invalidateQueries({queryKey:['community-directory']})}})}
export function useCommunityOwnerActions(communityId:string){const client=useQueryClient(),refresh=()=>client.invalidateQueries({queryKey:['community-management',communityId]});return useMutation({mutationFn:(input:{action:'announcement'|'add_rule'|'update_rule'|'move_rule'|'delete_rule'|'mute';announcement?:string;title?:string;description?:string;position?:number;ruleId?:string;direction?:'up'|'down';memberId?:string;until?:string|null;reason?:string|null})=>input.action==='announcement'?saveCommunityAnnouncement(communityId,input.announcement??''):input.action==='add_rule'?addCommunityRule(communityId,input.title??'',input.description??'',input.position??0):input.action==='update_rule'?updateCommunityRule(input.ruleId!,input.title??'',input.description??''):input.action==='move_rule'?moveCommunityRule(input.ruleId!,input.direction!):input.action==='delete_rule'?deleteCommunityRule(input.ruleId!):setCommunityMemberMute(input.memberId!,input.until??null,input.reason??null),onSuccess:refresh})}
export function useRequestPrivateCommunityJoin(){return useMutation({mutationFn:({slug,message}:{slug:string;message:string})=>requestPrivateCommunityJoin(slug,message)})}

export function useDirectConversations(userId?: string) {
  const client=useQueryClient();useEffect(()=>{if(!userId)return;const channel=supabase.channel(`community-conversation-list:${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'community_messages'},()=>void client.invalidateQueries({queryKey:['community-direct-conversations',userId]})).subscribe();return()=>{void supabase.removeChannel(channel)}},[client,userId])
  return useQuery({
    queryKey: ['community-direct-conversations', userId],
    queryFn: () => fetchDirectConversations(userId!),
    enabled: Boolean(userId),
  })
}

export function useDirectMessages(conversationId?: string) {
  const client=useQueryClient();useEffect(()=>{if(!conversationId)return;void markConversationRead(conversationId);const channel=supabase.channel(`community-messages:${conversationId}`).on('postgres_changes',{event:'*',schema:'public',table:'community_messages',filter:`conversation_id=eq.${conversationId}`},()=>void client.invalidateQueries({queryKey:['community-direct-messages',conversationId]})).subscribe();return()=>{void supabase.removeChannel(channel)}},[client,conversationId])
  return useQuery({
    queryKey: ['community-direct-messages', conversationId],
    queryFn: () => fetchDirectMessages(conversationId!),
    enabled: Boolean(conversationId),
  })
}

export function useOpenDirectConversation(userId:string){const client=useQueryClient();return useMutation({mutationFn:openDirectConversation,onSuccess:()=>client.invalidateQueries({queryKey:['community-direct-conversations',userId]})})}
export function useOpenCommunityConversation(){return useMutation({mutationFn:openCommunityConversation})}
export function useCommunityMessageActions(conversationId?:string){const client=useQueryClient();return useMutation({mutationFn:({id,action,body}:{id:string;action:'edit'|'delete';body?:string})=>action==='edit'?updateCommunityMessage(id,body??''):deleteCommunityMessage(id),onSuccess:()=>client.invalidateQueries({queryKey:['community-direct-messages',conversationId]})})}

export function useSendDirectMessage(userId: string, conversationId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({body,clientNonce}:{body:string;clientNonce:string}) => sendDirectMessage(conversationId!, body, clientNonce),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-direct-messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['community-direct-conversations', userId] })
    },
  })
}

export function useCommunitySettings(userId: string, section: CommunitySettingsSection) {
  return useQuery<CommunityManagedPost[] | CommunityPerson[]>({
    queryKey: ['community-settings', userId, section],
    queryFn: async () => {
      if (section === 'following') return await fetchFollowingPeople(userId)
      if (section === 'friends') return await fetchFriends(userId)
      return await fetchManagedPosts(userId, section)
    },
  })
}

export function useFriends(userId:string){return useQuery({queryKey:['community-friends',userId],queryFn:()=>fetchFriends(userId)})}
export function useFriendRequests(userId:string){return useQuery({queryKey:['community-friend-requests',userId],queryFn:()=>fetchFriendRequests(userId)})}
export function useFriendRequestAction(userId:string){const client=useQueryClient();return useMutation({mutationFn:({id,action}:{id:string;action:'accept'|'reject'|'cancel'})=>action==='cancel'?cancelFriendRequest(id):respondFriendRequest(id,action==='accept'?'accepted':'rejected'),onSuccess:()=>{client.invalidateQueries({queryKey:['community-friend-requests',userId]});client.invalidateQueries({queryKey:['community-settings',userId,'friends']})}})}

export function useRemoveCommunitySettingRelation(userId: string, section: CommunitySettingsSection) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeCommunitySettingRelation(section as Exclude<CommunitySettingsSection, 'posts'>, id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-settings', userId, section] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      queryClient.invalidateQueries({ queryKey: ['community-direct-conversations', userId] })
    },
  })
}

export function useRestoreOwnCommunityPost(userId:string){const client=useQueryClient();return useMutation({mutationFn:restoreOwnCommunityPost,onSuccess:()=>client.invalidateQueries({queryKey:['community-settings',userId]})})}
export function useCommunityPreferences(userId:string){return useQuery({queryKey:['community-preferences',userId],queryFn:()=>fetchCommunityPreferences(userId),enabled:Boolean(userId)})}
export function useSaveCommunityPreferences(userId:string){const client=useQueryClient();return useMutation({mutationFn:(values:Awaited<ReturnType<typeof fetchCommunityPreferences>>)=>saveCommunityPreferences(userId,values),onSuccess:()=>client.invalidateQueries({queryKey:['community-preferences',userId]})})}
