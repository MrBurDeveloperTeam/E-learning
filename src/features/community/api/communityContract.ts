import type {
  CommunityComment,
  CommunityCommentStatus,
  CommunityPost,
  CommunityPostStatus,
  CommunityPostTopic,
  CommunitySummary,
  DirectMessage,
} from '@/features/community/types'

/**
 * Canonical contract for the 31 Community tables deployed on 2026-09-01.
 * Keep database names in this module so UI components never depend on raw
 * production column names.
 */
export const COMMUNITY_TABLES = {
  communities: 'communities',
  members: 'community_members',
  joinRequests: 'community_join_requests',
  posts: 'community_posts',
  postMedia: 'community_post_media',
  postLikes: 'community_post_likes',
  postBookmarks: 'community_post_bookmarks',
  postReposts: 'community_post_reposts',
  comments: 'community_comments',
  commentLikes: 'community_comment_likes',
  follows: 'community_follows',
  friendships: 'community_friendships',
  reports: 'community_reports',
  professionalBadges: 'community_professional_badges',
  conversations: 'community_conversations',
  conversationParticipants: 'community_conversation_participants',
  messages: 'community_messages',
  messageAttachments: 'community_message_attachments',
  notifications: 'community_notifications',
  videoInteractions: 'community_video_interactions',
  topics: 'community_topics',
  postTopics: 'community_post_topics',
  userTopicPreferences: 'community_user_topic_preferences',
  userSettings: 'community_user_settings',
  userBlocks: 'community_user_blocks',
  userHiddenContent: 'community_user_hidden_content',
} as const

export const COMMUNITY_BUCKETS = {
  postMedia: 'community-post-media',
  commentMedia: 'community-comment-media',
  messageAttachments: 'community-message-attachments',
  verificationEvidence: 'community-verification-evidence',
} as const

export class CommunityBackendUnavailableError extends Error {
  readonly feature: string

  constructor(feature: string) {
    super(`${feature} is waiting for the Community production access package.`)
    this.name = 'CommunityBackendUnavailableError'
    this.feature = feature
  }
}

export type DbCommunity = {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  visibility: 'public' | 'private'
  moderation_status: 'pending' | 'active' | 'rejected' | 'hidden' | 'archived'
  avatar_url: string | null
  created_at: string
}

export type DbCommunityPost = {
  id: string
  author_id: string
  community_id: string | null
  post_kind: 'text' | 'image' | 'video' | 'link' | 'mixed'
  title: string | null
  content: string | null
  moderation_status: 'visible' | 'auto_hidden' | 'admin_hidden' | 'removed'
  published_at: string
  created_at: string
  profiles?: CommunityPost['profiles']
  communities?: CommunityPost['communities']
}

export type DbCommunityComment = {
  id: string
  post_id: string
  author_id: string | null
  parent_comment_id: string | null
  content: string
  moderation_status: 'visible' | 'auto_hidden' | 'admin_hidden' | 'removed'
  moderation_reason: string | null
  created_at: string
  updated_at: string
  profiles?: CommunityComment['profiles']
}

export type DbCommunityMessage = {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string | null
  message_status: 'sent' | 'edited' | 'deleted' | 'admin_hidden'
  created_at: string
  edited_at: string | null
}

const postStatusMap: Record<DbCommunityPost['moderation_status'], CommunityPostStatus> = {
  visible: 'published',
  auto_hidden: 'hidden',
  admin_hidden: 'hidden',
  removed: 'deleted',
}

const commentStatusMap: Record<DbCommunityComment['moderation_status'], CommunityCommentStatus> = {
  visible: 'visible',
  auto_hidden: 'hidden',
  admin_hidden: 'hidden',
  removed: 'deleted',
}

export function toDbPostStatus(status: CommunityPostStatus): DbCommunityPost['moderation_status'] {
  if (status === 'published') return 'visible'
  if (status === 'deleted') return 'removed'
  if (status === 'hidden' || status === 'rejected') return 'admin_hidden'
  return 'visible'
}

export function toDbCommentStatus(status: CommunityCommentStatus): DbCommunityComment['moderation_status'] {
  if (status === 'deleted') return 'removed'
  if (status === 'hidden' || status === 'collapsed' || status === 'pending_review' || status === 'rejected') return 'admin_hidden'
  return 'visible'
}

export function mapCommunity(row: DbCommunity, memberCount = 0): CommunitySummary {
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    visibility: row.visibility === 'private' ? 'private' : 'public',
    status: row.moderation_status === 'pending' ? 'pending_review' : row.moderation_status,
    avatar_url: row.avatar_url,
    member_count: memberCount,
    announcement: null,
    rules: [],
    created_at: row.created_at,
    viewer_is_member: false,
    viewer_membership_role: null,
  }
}

export function mapCommunityPost(
  row: DbCommunityPost,
  topic: CommunityPostTopic = 'general_dentistry',
): CommunityPost {
  return {
    id: row.id,
    author_id: row.author_id,
    community_id: row.community_id,
    post_type: row.post_kind === 'video' ? 'video' : row.post_kind === 'image' ? 'image' : 'text',
    topic,
    title: row.title,
    body: row.content,
    status: postStatusMap[row.moderation_status],
    like_count: 0,
    comment_count: 0,
    repost_count: 0,
    view_count: 0,
    bookmark_count: 0,
    share_count: 0,
    heat_score: 0,
    is_pinned: false,
    published_at: row.published_at,
    created_at: row.created_at,
    profiles: row.profiles ?? null,
    communities: row.communities ?? null,
    viewer_has_liked: false,
    viewer_has_reposted: false,
    viewer_has_bookmarked: false,
    media: [],
  }
}

export function mapCommunityComment(row: DbCommunityComment): CommunityComment {
  return {
    id: row.id,
    post_id: row.post_id,
    author_id: row.author_id ?? '',
    parent_comment_id: row.parent_comment_id,
    body: row.content,
    status: commentStatusMap[row.moderation_status],
    created_at: row.created_at,
    updated_at: row.updated_at,
    like_count: 0,
    risk_score: 0,
    moderation_source: row.moderation_reason ? 'admin' : null,
    is_pinned: false,
    is_best_answer: false,
    deleted_at: row.moderation_status === 'removed' ? row.updated_at : null,
    viewer_has_liked: false,
    profiles: row.profiles ?? null,
    media: [],
  }
}

export function mapDirectMessage(row: DbCommunityMessage): DirectMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id ?? '',
    body: row.content ?? '',
    created_at: row.created_at,
    edited_at: row.edited_at,
  }
}
