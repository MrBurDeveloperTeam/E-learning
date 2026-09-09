import { useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addCommunityRule, archiveCommunity, cancelFriendRequest, checkCommunityCommentSafety, createCommunity, createCommunityComment, createCommunityPost, decideCommunityJoinRequest, deleteCommunityComment, deleteCommunityMessage, deleteCommunityRule, fetchCloseFriends, fetchCommunityBlockedUsers, fetchCommunityComments, fetchCommunityDirectory, fetchCommunityManagement, fetchCommunityMembers, fetchCommunityMentionUsers, fetchCommunityPosts, fetchCommunityPreferences, fetchDirectConversations, fetchDirectMessages, fetchFollowingPeople, fetchFriendRequests, fetchFriends, fetchManagedPosts, followCommunityPerson, hideCommunityMessageForCurrentUser, joinPublicCommunity, leaveCommunity, markConversationRead, moveCommunityRule, openCommunityConversation, openDirectConversation, removeCommunityMember, removeCommunitySettingRelation, requestPrivateCommunityJoin, respondFriendRequest, restoreOwnCommunityPost, saveCommunityAbout, saveCommunityAnnouncement, saveCommunityPreferences, searchCommunityPeople, sendDirectMessage, setCloseFriend, setCommunityCommentFeature, setCommunityCommentLike, setCommunityMemberMute, setCommunityPostInteraction, setCommunityUserBlock, toggleCommunityMessageReaction, updateCommunityComment, updateCommunityMessage, updateCommunityRule, type CommunityFeedCursor, type CommunityFeedMode, type CommunitySettingsSection } from '@/features/community/api/communityApi'
import type { CommunityComment, CommunityManagedPost, CommunityPerson, DirectConversation, DirectMessage } from '@/features/community/types'
import { supabase } from '@/lib/supabase'
import { recordCommunityPostShare, recordCommunityPostView, softDeleteCommunityPost, updateCommunityPost } from '@/features/community/api/communityApi'
import { fetchCommunityPost } from '@/features/community/api/communityApi'
import { recordCommunityOperationalEvent } from '@/features/community/api/communityReleaseApi'
import { deleteCommunityDraft, fetchCommunityDrafts, migrateLocalCommunityDrafts, saveCommunityDraft, type CommunityDraftInput } from '@/features/community/api/communityDraftApi'
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility'

export function useCommunityPosts(userId?: string, mode: CommunityFeedMode = 'home', search = '', topic = 'all', sort: 'relevant'|'newest'|'popular'='relevant', communityId?: string) {
  const queryClient = useQueryClient()
  const isPageVisible = useDocumentVisibility()
  useEffect(() => {
    if (!isPageVisible) return
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      void queryClient.invalidateQueries({ queryKey: ['community-post'] })
    }
    const channel = supabase.channel(`community-feed:${mode}:${userId ?? 'guest'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_post_likes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_post_reposts' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh()
      })
    return () => { void supabase.removeChannel(channel) }
  }, [isPageVisible, mode, queryClient, userId])
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

export function useCommunityPostActions(userId?:string){const client=useQueryClient();return useMutation({mutationFn:async(input:{action:'edit'|'delete'|'share'|'view';postId:string;title?:string;body?:string;topic?:import('@/features/community/types').CommunityPostTopic;retainedMediaIds?:string[];files?:File[];watchSeconds?:number;progress?:number})=>{if(!userId)throw new Error('Sign in to manage posts.');if(input.action==='edit')return updateCommunityPost({id:input.postId,authorId:userId,title:input.title??'',body:input.body??'',topic:input.topic??'general_dentistry',retainedMediaIds:input.retainedMediaIds??[],files:input.files});if(input.action==='delete')return softDeleteCommunityPost(input.postId,userId);if(input.action==='share')return recordCommunityPostShare(input.postId);return recordCommunityPostView(input.postId,input.watchSeconds,input.progress)},onSuccess:(_data,input)=>{client.invalidateQueries({queryKey:['community-posts']});if(input.action==='view'&&userId)client.invalidateQueries({queryKey:['community-settings',userId,'history']})}})}

export function useCommunityComments(postId: string, userId: string | undefined, enabled: boolean, page = 0, search = '') {
  const client = useQueryClient()
  const isPageVisible = useDocumentVisibility()
  useEffect(() => {
    if (!enabled || !isPageVisible) return
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['community-comments', postId] })
      void client.invalidateQueries({ queryKey: ['community-posts'] })
      void client.invalidateQueries({ queryKey: ['community-post', postId] })
    }
    const channel = supabase.channel(`community-comments:${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments', filter: `post_id=eq.${postId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comment_likes' }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh()
      })
    return () => { void supabase.removeChannel(channel) }
  }, [client, enabled, isPageVisible, postId])
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
    onMutate: async ({ commentId, active }) => {
      await queryClient.cancelQueries({ queryKey: ['community-comments', postId] })
      const previous = queryClient.getQueriesData<CommunityComment[]>({ queryKey: ['community-comments', postId] })
      queryClient.setQueriesData<CommunityComment[]>({ queryKey: ['community-comments', postId] }, (comments) => comments?.map((comment) => comment.id === commentId ? {
        ...comment,
        viewer_has_liked: active,
        like_count: Math.max(0, comment.like_count + (active ? 1 : -1)),
      } : comment))
      return { previous }
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['community-comments', postId] }),
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
export function useCommunityOwnerActions(communityId:string){const client=useQueryClient(),refresh=()=>{client.invalidateQueries({queryKey:['community-management',communityId]});client.invalidateQueries({queryKey:['community-directory']})};return useMutation({mutationFn:(input:{action:'about'|'announcement'|'add_rule'|'update_rule'|'move_rule'|'delete_rule'|'mute';announcement?:string;title?:string;description?:string;position?:number;ruleId?:string;direction?:'up'|'down';memberId?:string;until?:string|null;reason?:string|null})=>input.action==='about'?saveCommunityAbout(communityId,input.description??''):input.action==='announcement'?saveCommunityAnnouncement(communityId,input.announcement??''):input.action==='add_rule'?addCommunityRule(communityId,input.title??'',input.description??'',input.position??0):input.action==='update_rule'?updateCommunityRule(input.ruleId!,input.title??'',input.description??''):input.action==='move_rule'?moveCommunityRule(input.ruleId!,input.direction!):input.action==='delete_rule'?deleteCommunityRule(input.ruleId!):setCommunityMemberMute(input.memberId!,input.until??null,input.reason??null),onSuccess:refresh})}
export function useArchiveCommunity(){const client=useQueryClient();return useMutation({mutationFn:archiveCommunity,onSuccess:()=>{client.invalidateQueries({queryKey:['community-directory']});client.invalidateQueries({queryKey:['community-posts']})}})}
export function useRequestPrivateCommunityJoin(){return useMutation({mutationFn:({slug,message}:{slug:string;message:string})=>requestPrivateCommunityJoin(slug,message)})}

export function useDirectConversations(userId?: string) {
  const client = useQueryClient()
  useEffect(() => {
    if (!userId) return
    const refresh = () => void client.invalidateQueries({ queryKey: ['community-direct-conversations', userId] })
    const channel = supabase
      .channel(`community-conversation-list:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_conversation_participants', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') refresh()
      })
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refreshWhenActive)
    window.addEventListener('online', refreshWhenActive)
    document.addEventListener('visibilitychange', refreshWhenActive)
    return () => {
      window.removeEventListener('focus', refreshWhenActive)
      window.removeEventListener('online', refreshWhenActive)
      document.removeEventListener('visibilitychange', refreshWhenActive)
      void supabase.removeChannel(channel)
    }
  }, [client, userId])
  return useQuery({
    queryKey: ['community-direct-conversations', userId],
    queryFn: () => fetchDirectConversations(userId!),
    enabled: Boolean(userId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
}

export function useCommunityDrafts(userId: string) {
  const client = useQueryClient()
  useEffect(() => {
    if (!userId) return
    void migrateLocalCommunityDrafts(userId).then(count => {
      if (count) void client.invalidateQueries({ queryKey: ['community-drafts', userId] })
    })
  }, [client, userId])
  return useQuery({ queryKey: ['community-drafts', userId], queryFn: () => fetchCommunityDrafts(userId), enabled: Boolean(userId) })
}

export function useSaveCommunityDraft(userId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CommunityDraftInput, 'authorId'>) => saveCommunityDraft({ ...input, authorId: userId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['community-drafts', userId] }),
  })
}

export function useDeleteCommunityDraft(userId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCommunityDraft(id, userId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['community-drafts', userId] }),
  })
}

export function useDirectMessages(conversationId?: string, userId?: string) {
  const client = useQueryClient()
  useEffect(() => {
    if (!conversationId) return
    const conversationKey = ['community-direct-conversations', userId]
    const messageKey = ['community-direct-messages', conversationId]
    const markRead = async () => {
      client.setQueryData<DirectConversation[]>(conversationKey, current => current?.map(conversation => conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation))
      try {
        await markConversationRead(conversationId)
        await client.invalidateQueries({ queryKey: conversationKey })
      } catch {
        await client.invalidateQueries({ queryKey: conversationKey })
      }
    }
    const refreshMessages = () => {
      void client.invalidateQueries({ queryKey: messageKey })
    }
    const receiveReadReceipt = (payload: { new: Record<string, unknown> }) => {
      const receipt = payload.new as { conversation_id?: string; user_id?: string; last_read_at?: string | null }
      if (receipt.conversation_id !== conversationId || receipt.user_id === userId || !receipt.last_read_at) return

      const readAt = Date.parse(receipt.last_read_at)
      client.setQueryData<DirectMessage[]>(messageKey, current => current?.map(message => (
        message.sender_id === userId
        && message.delivery_status !== 'failed'
        && Date.parse(message.created_at) <= readAt
          ? { ...message, delivery_status: 'read' }
          : message
      )))
      refreshMessages()
    }
    const receiveMessage = () => {
      refreshMessages()
      void client.invalidateQueries({ queryKey: conversationKey })
      if (document.visibilityState === 'visible') void markRead()
    }
    const refreshWhenActive = () => {
      if (document.visibilityState !== 'visible') return
      refreshMessages()
      void markRead()
    }
    void markRead()
    const channel = supabase
      .channel(`community-messages:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages', filter: `conversation_id=eq.${conversationId}` }, receiveMessage)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_message_attachments' }, refreshMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_message_reactions' }, refreshMessages)
      // Listen to participant receipt updates allowed by RLS, then scope the
      // event client-side. This avoids a filtered UPDATE being missed and keeps
      // the sender's Read label instant without writing another receipt.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_conversation_participants' }, receiveReadReceipt)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') refreshWhenActive()
      })
    window.addEventListener('focus', refreshWhenActive)
    window.addEventListener('online', refreshWhenActive)
    document.addEventListener('visibilitychange', refreshWhenActive)
    return () => {
      window.removeEventListener('focus', refreshWhenActive)
      window.removeEventListener('online', refreshWhenActive)
      document.removeEventListener('visibilitychange', refreshWhenActive)
      void supabase.removeChannel(channel)
    }
  }, [client, conversationId, userId])
  return useQuery({
    queryKey: ['community-direct-messages', conversationId],
    queryFn: () => fetchDirectMessages(conversationId!),
    enabled: Boolean(conversationId),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  })
}

export function useOpenDirectConversation(userId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: openDirectConversation,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['community-direct-conversations', userId] })
    },
  })
}
export function useOpenCommunityConversation(){return useMutation({mutationFn:openCommunityConversation})}
export function useCommunityMessageActions(conversationId?:string){const client=useQueryClient();return useMutation({mutationFn:({id,action,body}:{id:string;action:'edit'|'withdraw'|'hide';body?:string})=>action==='edit'?updateCommunityMessage(id,body??''):action==='withdraw'?deleteCommunityMessage(id):hideCommunityMessageForCurrentUser(id),onSuccess:()=>client.invalidateQueries({queryKey:['community-direct-messages',conversationId]})})}
export function useCommunityMessageReaction(conversationId?: string) {
  const client = useQueryClient()
  const queryKey = ['community-direct-messages', conversationId]
  return useMutation({
    mutationFn: ({ id, emoji, reacted }: { id: string; emoji: string; reacted: boolean }) =>
      toggleCommunityMessageReaction(id, emoji, reacted),
    onMutate: async ({ id, emoji, reacted }) => {
      await client.cancelQueries({ queryKey })
      const previous = client.getQueryData<DirectMessage[]>(queryKey)
      client.setQueryData<DirectMessage[]>(queryKey, (messages = []) => messages.map((message) => {
        if (message.id !== id) return message
        const reactions = message.reactions
          .map((reaction) => reaction.viewer_reacted
            ? { ...reaction, count: reaction.count - 1, viewer_reacted: false }
            : reaction)
          .filter((reaction) => reaction.count > 0)
        if (!reacted) {
          const selected = reactions.find((reaction) => reaction.emoji === emoji)
          if (selected) {
            selected.count += 1
            selected.viewer_reacted = true
          } else {
            reactions.push({ emoji, count: 1, viewer_reacted: true })
          }
        }
        return { ...message, reactions }
      }))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  })
}

export function useSendDirectMessage(userId: string, conversationId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({body,clientNonce,conversationId:targetConversationId,replyToMessageId,files=[]}:{body:string;clientNonce:string;conversationId?:string;replyToMessageId?:string;files?:File[]}) => {
      const resolvedConversationId=targetConversationId??conversationId
      if(!resolvedConversationId)throw new Error('Choose a member before sending a message.')
      return sendDirectMessage(resolvedConversationId, body, clientNonce, replyToMessageId, files)
    },
    onMutate: async ({ body, clientNonce, conversationId: targetConversationId, replyToMessageId }) => {
      const resolvedConversationId = targetConversationId ?? conversationId
      if (!resolvedConversationId) return
      const queryKey = ['community-direct-messages', resolvedConversationId]
      await queryClient.cancelQueries({ queryKey })
      const optimistic: DirectMessage = { id: clientNonce, conversation_id: resolvedConversationId, sender_id: userId, body: body.trim(), created_at: new Date().toISOString(), edited_at: null, status: 'sent', reply_to_message_id: replyToMessageId ?? null, reply_to: null, reactions: [], attachments: [], delivery_status: 'sending' }
      queryClient.setQueryData<DirectMessage[]>(queryKey, current => {
        const rows = current ?? []
        return rows.some(message => message.id === clientNonce) ? rows.map(message => message.id === clientNonce ? { ...message, ...optimistic } : message) : [...rows, optimistic]
      })
    },
    onSuccess: (message) => {
      queryClient.setQueryData<DirectMessage[]>(['community-direct-messages', message.conversation_id], current => current?.map(row => row.id === message.id ? { ...message, delivery_status: 'sent' } : row))
      queryClient.invalidateQueries({ queryKey: ['community-direct-messages', message.conversation_id] })
      queryClient.invalidateQueries({ queryKey: ['community-direct-conversations', userId] })
    },
    onError: (_error, variables) => {
      const resolvedConversationId = variables.conversationId ?? conversationId
      if (!resolvedConversationId) return
      queryClient.setQueryData<DirectMessage[]>(['community-direct-messages', resolvedConversationId], current => current?.map(message => message.id === variables.clientNonce ? { ...message, delivery_status: 'failed' } : message))
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
export function useCloseFriends(userId:string){return useQuery({queryKey:['community-close-friends',userId],queryFn:()=>fetchCloseFriends(userId),enabled:Boolean(userId)})}
export function useCloseFriendAction(userId:string){const client=useQueryClient();return useMutation({mutationFn:({targetUserId,active}:{targetUserId:string;active:boolean})=>setCloseFriend(userId,targetUserId,active),onSuccess:()=>{client.invalidateQueries({queryKey:['community-settings',userId,'following']});client.invalidateQueries({queryKey:['community-close-friends',userId]})}})}
export function useCommunityPeopleSearch(userId:string,search:string){return useQuery({queryKey:['community-people-search',userId,search.trim()],queryFn:()=>searchCommunityPeople(userId,search),enabled:Boolean(userId)&&search.trim().length>=2})}
export function useFollowCommunityPerson(userId:string){const client=useQueryClient();return useMutation({mutationFn:(followingId:string)=>followCommunityPerson(userId,followingId),onSuccess:()=>{client.invalidateQueries({queryKey:['community-settings',userId,'following']});client.invalidateQueries({queryKey:['community-people-search',userId]});client.invalidateQueries({queryKey:['community-posts']})}})}
export function useFriendRequests(userId:string){return useQuery({queryKey:['community-friend-requests',userId],queryFn:()=>fetchFriendRequests(userId),enabled:Boolean(userId)})}
export function useFriendRequestAction(userId:string){const client=useQueryClient();return useMutation({mutationFn:({id,action}:{id:string;action:'accept'|'reject'|'cancel'})=>action==='cancel'?cancelFriendRequest(id):respondFriendRequest(id,action==='accept'?'accepted':'rejected'),onSuccess:()=>{client.invalidateQueries({queryKey:['community-friend-requests',userId]});client.invalidateQueries({queryKey:['community-settings',userId,'friends']});client.invalidateQueries({queryKey:['community-profile-access']});client.invalidateQueries({queryKey:['community-people-search']});client.invalidateQueries({queryKey:['community-settings',userId,'following']});client.invalidateQueries({queryKey:['community-posts']})}})}

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
