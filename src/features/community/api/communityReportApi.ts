import { supabase } from '@/lib/supabase'
import { COMMUNITY_TABLES, CommunityBackendUnavailableError } from '@/features/community/api/communityContract'

export type CommunityReportReason = 'patient_privacy' | 'misinformation' | 'harassment' | 'spam' | 'copyright' | 'other'

export interface CommunityReportRow {
  id: string
  reporter_id: string
  reporter_name: string
  post_id: string | null
  community_id: string | null
  comment_id: string | null
  target_name: string
  target_user_id: string | null
  reason: CommunityReportReason
  details: string | null
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
  resolution_action: 'no_action' | 'content_hidden' | null
  created_at: string
  report_count: number
  report_ids: string[]
  reasons: Partial<Record<CommunityReportReason, number>>
  reporter_names: string[]
}

export async function createCommunityReport(input: { reporterId: string; postId?: string; communityId?: string; commentId?: string; reason: CommunityReportReason; details?: string }) {
  const legacyPrivacyReason = input.reason === 'patient_privacy'
  const { error } = await supabase.from(COMMUNITY_TABLES.reports).insert({
    reporter_id: input.reporterId,
    post_id: input.postId ?? null,
    community_id: input.communityId ?? null,
    comment_id: input.commentId ?? null,
    reason: legacyPrivacyReason ? 'other' : input.reason,
    details: legacyPrivacyReason ? `[patient_privacy] ${input.details?.trim() || 'Patient privacy concern'}` : input.details?.trim() || null,
  })
  if (error) {
    if (error.code === '23505') throw new Error('You already have an open report for this item.')
    throw error
  }
}

export async function fetchCommunityReports() {
  const { data, error } = await supabase.from(COMMUNITY_TABLES.reports).select('id,reporter_id,post_id,community_id,comment_id,reason,details,report_status,resolution_action,created_at').order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  const rows = data ?? []
  const reporterIds = [...new Set(rows.map((row) => row.reporter_id))]
  const postIds = rows.flatMap((row) => row.post_id ? [row.post_id] : [])
  const groupIds = rows.flatMap((row) => row.community_id ? [row.community_id] : [])
  const commentIds = rows.flatMap((row) => row.comment_id ? [row.comment_id] : [])
  const [profiles, posts, groups, comments] = await Promise.all([
    reporterIds.length ? supabase.from('public_profiles').select('user_id,full_name,name').in('user_id', reporterIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? supabase.from('community_posts').select('id,title,author_id').in('id', postIds) : Promise.resolve({ data: [], error: null }),
    groupIds.length ? supabase.from('communities').select('id,name,owner_id').in('id', groupIds) : Promise.resolve({ data: [], error: null }),
    commentIds.length ? supabase.from(COMMUNITY_TABLES.comments).select('id,content,author_id').in('id', commentIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (profiles.error) throw profiles.error
  if (posts.error) throw posts.error
  if (groups.error) throw groups.error
  if (comments.error) throw comments.error
  const people = new Map((profiles.data ?? []).map((profile) => [profile.user_id, profile.full_name || profile.name || 'Unknown member']))
  const postNames = new Map((posts.data ?? []).map((post) => [post.id, post.title || 'Untitled post']))
  const groupNames = new Map((groups.data ?? []).map((group) => [group.id, group.name]))
  const commentNames = new Map((comments.data ?? []).map((comment) => [comment.id, comment.content.length > 80 ? `${comment.content.slice(0, 80)}…` : comment.content]))
  const postAuthors = new Map((posts.data ?? []).map((post) => [post.id, post.author_id]))
  const groupOwners = new Map((groups.data ?? []).map((group) => [group.id, group.owner_id]))
  const commentAuthors = new Map((comments.data ?? []).map((comment) => [comment.id, comment.author_id]))
  const enriched = rows.map((row) => ({ ...row, status: row.report_status === 'pending' ? 'open' : row.report_status, reporter_name: people.get(row.reporter_id) ?? 'Unknown member', target_name: row.comment_id ? commentNames.get(row.comment_id) ?? 'Unavailable comment' : row.post_id ? postNames.get(row.post_id) ?? 'Unavailable post' : groupNames.get(row.community_id!) ?? 'Unavailable community', target_user_id: row.comment_id ? commentAuthors.get(row.comment_id) ?? null : row.post_id ? postAuthors.get(row.post_id) ?? null : groupOwners.get(row.community_id!) ?? null }))
  const groupsMap = new Map<string, typeof enriched>()
  for (const row of enriched) {
    const key = row.comment_id ? `comment:${row.comment_id}` : row.post_id ? `post:${row.post_id}` : `community:${row.community_id}`
    groupsMap.set(key, [...(groupsMap.get(key) ?? []), row])
  }
  return [...groupsMap.values()].map((group) => {
    const newest = [...group].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    const open = group.filter((row) => row.status === 'open' || row.status === 'reviewing')
    const reasons = group.reduce<Partial<Record<CommunityReportReason, number>>>((result, row) => {
      const reason = row.reason as CommunityReportReason
      return { ...result, [reason]: (result[reason] ?? 0) + 1 }
    }, {})
    return {
      ...newest,
      id: open[0]?.id ?? newest.id,
      status: open.length ? 'open' : newest.status,
      report_count: group.length,
      report_ids: group.map((row) => row.id),
      reasons,
      reporter_names: [...new Set(group.map((row) => row.reporter_name))],
    }
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)) as CommunityReportRow[]
}

export async function resolveCommunityReport(_id: string, _action: 'dismiss' | 'resolve' | 'hide'): Promise<void> {
  throw new CommunityBackendUnavailableError('Community report resolution')
}

export async function fetchMyCommunityReports(userId: string) {
  const { data, error } = await supabase.from(COMMUNITY_TABLES.reports)
    .select('id,post_id,community_id,comment_id,reason,details,report_status,resolution_action,resolution_note,created_at,reviewed_at')
    .eq('reporter_id', userId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, status: row.report_status === 'pending' ? 'open' : row.report_status }))
}
