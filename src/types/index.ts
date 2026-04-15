// Profile

export interface Profile {
  user_id: string
  email: string
  name: string | null
  full_name: string | null
  username: string | null
  account_type:
    | 'individual'
    | 'company'
    | 'admin'
    | null
  plan: string | null
  role: 'member' | 'creator' | 'admin'
  phone: string | null
  position: string | null
  company_name: string | null
  avatar_url: string | null
  background_url: string | null
  clinic_id: string | null
  status: string | null
  specialty: string | null
  bio: string | null
  registration_number: string | null
  institution: string | null
  is_verified: boolean
  is_creator: boolean
  follower_count: number
  following_count: number
  video_count: number
  created_at: string
  updated_at: string
}

export interface PublicProfile {
  user_id: string
  name: string | null
  full_name: string | null
  username: string | null
  avatar_url: string | null
  background_url: string | null
  specialty: string | null
  bio: string | null
  institution: string | null
  is_verified: boolean
  is_creator: boolean
  follower_count: number
  following_count: number
  video_count: number
}

export interface PublicCreatorProfile extends PublicProfile {}

// Video

export type VideoStatus =
  | 'processing'
  | 'published'
  | 'unlisted'
  | 'removed'

export type VideoVisibility = 'public' | 'followers_only'

export type VideoCategory =
  | 'General Dentistry'
  | 'Restorative'
  | 'Implantology'
  | 'Orthodontics'
  | 'Endodontics'
  | 'Periodontology'
  | 'Oral Surgery'
  | 'Paediatric Dentistry'
  | 'Prosthodontics'
  | 'Practice Management'

export interface Video {
  id: string
  creator_id: string
  title: string
  description: string | null
  category: VideoCategory
  tags: string[]
  mux_asset_id: string | null
  mux_playback_id: string | null
  mux_upload_id: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  view_count: number
  like_count: number
  comment_count: number
  status: VideoStatus
  visibility: VideoVisibility
  created_at: string
  updated_at: string
}

export interface VideoWithCreator extends Video {
  profiles: Pick<
    PublicCreatorProfile,
    | 'user_id'
    | 'name'
    | 'full_name'
    | 'username'
    | 'avatar_url'
    | 'is_verified'
    | 'is_creator'
    | 'specialty'
    | 'bio'
    | 'follower_count'
    | 'video_count'
  >
}

// Comment

export interface Comment {
  id: string
  video_id: string
  author_id: string
  parent_id: string | null
  body: string
  like_count: number
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface CommentWithAuthor extends Comment {
  profiles: Pick<
    Profile,
    | 'user_id'
    | 'name'
    | 'full_name'
    | 'username'
    | 'avatar_url'
    | 'is_verified'
    | 'specialty'
  > | null
  replies?: CommentWithAuthor[]
  reply_count?: number
}

// Follow

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

// Notification

export type NotificationType =
  | 'new_video'
  | 'new_comment'
  | 'new_reply'
  | 'new_like'
  | 'new_follower'

export interface Notification {
  id: string
  recipient_id: string
  actor_id: string
  type: NotificationType
  video_id: string | null
  comment_id: string | null
  is_read: boolean
  created_at: string
}

export interface NotificationWithActor extends Notification {
  profiles: Pick<
    Profile,
    'user_id' | 'name' | 'full_name' | 'username' | 'avatar_url'
  > | null
  videos?: Pick<Video, 'id' | 'title' | 'thumbnail_url'> | null
}

// Video interactions

export interface VideoLike {
  id: string
  user_id: string
  video_id: string
  created_at: string
}

export interface VideoSave {
  id: string
  user_id: string
  video_id: string
  created_at: string
}

export interface VideoSaveWithVideo extends VideoSave {
  videos: VideoWithCreator
}

export interface VideoView {
  id: string
  user_id: string
  video_id: string
  viewed_at: string
}

// Utility constants

export type SortOption = 'newest' | 'most_viewed' | 'most_liked'

export const VIDEO_CATEGORIES: VideoCategory[] = [
  'General Dentistry',
  'Restorative',
  'Implantology',
  'Orthodontics',
  'Endodontics',
  'Periodontology',
  'Oral Surgery',
  'Paediatric Dentistry',
  'Prosthodontics',
  'Practice Management',
]

export const CATEGORY_SLUGS: Record<VideoCategory, string> = {
  'General Dentistry': 'general-dentistry',
  Restorative: 'restorative',
  Implantology: 'implantology',
  Orthodontics: 'orthodontics',
  Endodontics: 'endodontics',
  Periodontology: 'periodontology',
  'Oral Surgery': 'oral-surgery',
  'Paediatric Dentistry': 'paediatric-dentistry',
  Prosthodontics: 'prosthodontics',
  'Practice Management': 'practice-management',
}

export const SLUG_TO_CATEGORY: Record<string, VideoCategory> =
  Object.fromEntries(
    Object.entries(CATEGORY_SLUGS).map(([k, v]) => [
      v,
      k as VideoCategory,
    ])
  )
