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
    | 'company_member'
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

export type CreatorApplicationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revoked'

export interface CreatorApplication {
  user_id: string
  status: CreatorApplicationStatus
  submitted_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

// Video

export type VideoStatus =
  | 'processing'
  | 'published'
  | 'unlisted'
  | 'removed'

export type VideoVisibility = 'public' | 'followers_only'

export type VideoCategory =
  | 'General Dentistry'
  | 'Others'
  | 'Implantology'
  | 'Orthodontics'
  | 'Endodontics'
  | 'Periodontology'
  | 'Oral Surgery'
  | 'Pediatric Dentistry'
  | 'Prosthodontics'
  | 'Oral Hygiene'
  | 'Dental Burs'
  | 'Handpieces'
  | 'Clinic Management'
  | 'Radiology'

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

// Featured products (E-Learning product purchase feature)

export interface VideoProduct {
  id: string
  video_id: string
  creator_id: string
  product_ref: string
  product_name: string
  product_image_url: string | null
  product_price: number
  currency: string
  product_url: string
  cta_label: string
  position: number
  created_at: string
  updated_at: string
}

/** A Snabbb partner product returned by the catalog search API, before it's attached to a video. */
export interface PartnerProduct {
  product_ref: string
  name: string
  image_url: string | null
  price: number
  currency: string
  product_url: string
  in_stock?: boolean
}

export type PurchaseOrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded' | 'failed'
export type CreditStatus = 'pending' | 'awarded' | 'failed' | 'not_applicable'

export interface VideoProductPurchase {
  id: string
  video_id: string
  video_product_id: string | null
  product_ref: string
  doctor_id: string
  odoo_order_id: string
  odoo_order_line_id: string | null
  buyer_partner_id: string | null
  buyer_email: string | null
  amount: number
  currency: string
  order_status: PurchaseOrderStatus
  credit_amount: number | null
  credit_status: CreditStatus
  credited_at: string | null
  created_at: string
  updated_at: string
}

export type SnabbbCreditType = 'flat' | 'percentage'

export interface SnabbbCreditSettings {
  credit_type: SnabbbCreditType
  credit_value: number
  currency: string
  is_active: boolean
  updated_by: string | null
  updated_at: string
  created_at: string
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
  | 'community_comment_reply'
  | 'community_comment_like'
  | 'community_mention'
  | 'community_report_resolved'
  | 'community_post_reviewed'
  | 'community_content_hidden'
  | 'community_join_request'
  | 'community_join_decided'
  | 'community_friend_request'
  | 'community_friend_decided'
  | 'community_appeal_decided'
  | 'community_announcement'
  | 'community_direct_message'
  | 'community_group_message'
  | 'community_post_like'
  | 'community_comment'
  | 'community_reply'
  | 'community_friend_accepted'
  | 'community_join_decision'
  | 'community_message'
  | 'community_post_review'
  | 'community_report_result'
  | 'community_verification_result'
  | 'community_appeal_result'

export interface Notification {
  id: string
  recipient_id: string
  actor_id: string
  type: NotificationType
  video_id: string | null
  comment_id: string | null
  community_post_id?: string | null
  community_comment_id?: string | null
  community_id?: string | null
  title?: string | null
  message?: string | null
  action_url?: string | null
  metadata?: Record<string,unknown>
  is_read: boolean
  created_at: string
}

export interface NotificationWithActor extends Notification {
  profiles: Pick<
    Profile,
    'user_id' | 'name' | 'full_name' | 'username' | 'avatar_url'
  > | null
  videos?: Pick<Video, 'id' | 'title' | 'thumbnail_url'> | null
  source?: 'platform' | 'community'
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
  'Implantology',
  'Orthodontics',
  'Endodontics',
  'Periodontology',
  'Oral Surgery',
  'Pediatric Dentistry',
  'Prosthodontics',
  'Oral Hygiene',
  'Dental Burs',
  'Handpieces',
  'Clinic Management',
  'Radiology',
  'Others',
]

export const CATEGORY_SLUGS: Record<VideoCategory, string> = {
  'General Dentistry': 'general-dentistry',
  Others: 'others',
  Implantology: 'implantology',
  Orthodontics: 'orthodontics',
  Endodontics: 'endodontics',
  Periodontology: 'periodontology',
  'Oral Surgery': 'oral-surgery',
  'Pediatric Dentistry': 'pediatric-dentistry',
  Prosthodontics: 'prosthodontics',
  'Oral Hygiene': 'oral-hygiene',
  'Dental Burs': 'dental-burs',
  Handpieces: 'handpieces',
  'Clinic Management': 'clinic-management',
  Radiology: 'radiology',
}

export const SLUG_TO_CATEGORY: Record<string, VideoCategory> =
  Object.fromEntries(
    Object.entries(CATEGORY_SLUGS).map(([k, v]) => [
      v,
      k as VideoCategory,
    ])
  )
