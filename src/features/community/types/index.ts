import type { Profile } from '@/types'

export type CommunityPostStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'hidden'
  | 'deleted'

export interface CommunityPost {
  id: string
  author_id: string
  community_id: string | null
  post_type: 'text' | 'image' | 'video'
  topic: CommunityPostTopic
  title: string | null
  body: string | null
  status: CommunityPostStatus
  like_count: number
  comment_count: number
  repost_count: number
  view_count: number
  bookmark_count: number
  share_count: number
  heat_score: number
  is_pinned: boolean
  published_at: string | null
  created_at: string
  profiles: Pick<Profile, 'user_id' | 'full_name' | 'name' | 'avatar_url' | 'is_verified'> | null
  communities: { name: string; slug: string } | null
  viewer_has_liked: boolean
  viewer_has_reposted: boolean
  viewer_has_bookmarked: boolean
  friend_activity?: Array<'liked' | 'reposted'>
  friend_activity_names?: string[]
  friend_activity_at?: string
  recommendation_reason?: string
  viewer_progress?: number
  viewer_completed?: boolean
  media: Array<{ id: string; media_type: 'image' | 'video'; public_url: string; alt_text: string | null }>
}

export type CommunityCommentStatus = 'pending_review' | 'visible' | 'collapsed' | 'rejected' | 'hidden' | 'deleted'

export interface CommunityComment {
  id: string
  post_id: string
  author_id: string
  parent_comment_id: string | null
  body: string
  status: CommunityCommentStatus
  created_at: string
  updated_at: string
  like_count: number
  risk_score: number
  moderation_source: 'blocked_word' | 'reports' | 'admin' | null
  is_pinned: boolean
  is_best_answer: boolean
  deleted_at: string | null
  viewer_has_liked: boolean
  profiles: Pick<Profile, 'user_id' | 'full_name' | 'name' | 'username' | 'avatar_url' | 'is_verified'> | null
  media: Array<{ id: string; file_name: string; mime_type: string; public_url: string }>
}

export type CommunityPostTopic =
  | 'general_dentistry'
  | 'implantology'
  | 'orthodontics'
  | 'endodontics'
  | 'periodontology'
  | 'oral_surgery'
  | 'prosthodontics'
  | 'pediatric_dentistry'
  | 'digital_dentistry'
  | 'practice_management'

export interface CommunitySummary {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  visibility: 'public' | 'private'
  status: 'pending_review' | 'active' | 'rejected' | 'hidden' | 'archived'
  avatar_url: string | null
  member_count: number
  announcement: string | null
  rules: Array<{id:string;title:string;description:string|null;position:number}>
  created_at: string
  viewer_is_member: boolean
  viewer_membership_role: 'owner' | 'member' | null
}

export interface DirectConversation {
  id: string
  other_user: {
    user_id: string
    full_name: string | null
    name: string | null
    avatar_url: string | null
    is_verified: boolean
  }
  last_message_at: string | null
  unread_count: number
}

export interface DirectMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  edited_at: string | null
}

export interface CommunityManagedPost {
  id: string
  title: string | null
  body: string | null
  status: CommunityPostStatus
  topic: CommunityPostTopic
  post_type: 'text' | 'image' | 'video'
  created_at: string
}

export interface CommunityPerson {
  user_id: string
  full_name: string | null
  name: string | null
  avatar_url: string | null
  is_verified: boolean
  relation_id?: string
}
