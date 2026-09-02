import { supabase } from '@/lib/supabase'
import { COMMUNITY_TABLES, CommunityBackendUnavailableError } from '@/features/community/api/communityContract'

export type CommunityReviewStatus = 'pending_review' | 'published' | 'rejected' | 'hidden'

export interface CommunityReviewPost {
  id: string
  author_id: string
  author_name: string
  title: string | null
  body: string | null
  post_type: 'text' | 'image' | 'video'
  topic: string
  status: CommunityReviewStatus | 'draft' | 'deleted'
  created_at: string
  is_pinned: boolean
}

export interface CommunityReviewGroup {
  id: string
  owner_id: string
  owner_name: string
  name: string
  description: string | null
  visibility: 'public' | 'private'
  status: 'pending_review' | 'active' | 'rejected' | 'hidden' | 'archived'
  created_at: string
}

export interface CommunityReviewComment {
  id: string
  post_id: string
  author_id: string
  author_name: string
  body: string
  status: 'pending_review' | 'visible' | 'collapsed' | 'rejected' | 'hidden' | 'deleted'
  created_at: string
}

async function profileNames(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>()
  const { data, error } = await supabase.from('public_profiles').select('user_id,full_name,name').in('user_id', ids)
  if (error) throw error
  return new Map((data ?? []).map((profile) => [profile.user_id, profile.full_name || profile.name || 'Unknown member']))
}

export async function fetchCommunityReviewPosts() {
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.posts)
    .select('id,author_id,title,content,post_kind,moderation_status,created_at')
    .in('moderation_status', ['visible', 'auto_hidden', 'admin_hidden', 'removed'])
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  const names = await profileNames([...new Set((data ?? []).map((post) => post.author_id))])
  return (data ?? []).map((post) => ({ ...post, body: post.content, post_type: post.post_kind, topic: 'general_dentistry', status: post.moderation_status === 'visible' ? 'published' : post.moderation_status === 'removed' ? 'deleted' : 'hidden', is_pinned: false, author_name: names.get(post.author_id) ?? 'Unknown member' })) as CommunityReviewPost[]
}

export async function fetchCommunityReviewGroups() {
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.communities)
    .select('id,owner_id,name,description,visibility,moderation_status,created_at')
    .in('moderation_status', ['pending', 'active', 'rejected', 'hidden'])
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  const names = await profileNames([...new Set((data ?? []).map((group) => group.owner_id))])
  return (data ?? []).map((group) => ({ ...group, status: group.moderation_status === 'pending' ? 'pending_review' : group.moderation_status, visibility: group.visibility === 'private' ? 'private' : 'public', owner_name: names.get(group.owner_id) ?? 'Unknown member' })) as CommunityReviewGroup[]
}

export async function fetchCommunityReviewComments() {
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.comments)
    .select('id,post_id,author_id,content,moderation_status,created_at')
    .in('moderation_status', ['visible', 'auto_hidden', 'admin_hidden', 'removed'])
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  const names = await profileNames([...new Set((data ?? []).map((comment) => comment.author_id))])
  return (data ?? []).map((comment) => ({ ...comment, body: comment.content, status: comment.moderation_status === 'visible' ? 'visible' : comment.moderation_status === 'removed' ? 'deleted' : 'hidden', author_name: names.get(comment.author_id ?? '') ?? 'Unknown member' })) as CommunityReviewComment[]
}

export async function reviewCommunityPost(id: string, decision: 'publish' | 'reject' | 'restore', _adminId: string) {
  const { error } = await supabase.rpc('community_review_post', {
    target_post_id: id,
    decision: decision === 'reject' ? 'remove' : decision,
  })
  if (error) throw error
}

export async function setCommunityPostPin(_id:string,_enabled:boolean): Promise<void>{throw new CommunityBackendUnavailableError('Community post pinning')}

export interface CommunityAuditAction {id:string;admin_id:string|null;target_user_id:string|null;action_type:string;reason:string|null;metadata:Record<string,unknown>;created_at:string;admin_name:string;target_name:string}
export async function fetchCommunityAuditActions(): Promise<CommunityAuditAction[]>{const{data,error}=await supabase.rpc('community_get_admin_audit_log',{result_limit:100});if(error)throw error;return ((data??[]) as Array<Record<string,unknown>>).map(row=>({id:String(row.id),admin_id:row.admin_id as string|null,target_user_id:null,action_type:String(row.action_type),reason:row.reason as string|null,metadata:(row.metadata as Record<string,unknown>|null)??{},created_at:String(row.created_at),admin_name:'Administrator',target_name:`${String(row.target_type)}:${String(row.target_id)}`}))}

export async function reviewCommunityGroup(id: string, decision: 'approve' | 'reject') {
  const { error } = await supabase.rpc('community_review_community', { target_community_id: id, decision })
  if (error) throw error
}

export async function reviewCommunityComment(id: string, decision: 'publish' | 'reject' | 'hide' | 'restore', _adminId: string) {
  const { error } = await supabase.rpc('community_review_comment', {
    target_comment_id: id,
    decision: decision === 'reject' ? 'remove' : decision,
  })
  if (error) throw error
}
