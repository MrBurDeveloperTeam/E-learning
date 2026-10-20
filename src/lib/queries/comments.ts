import { supabase } from '../supabase'
import { logElearningActivity } from '../logActivityToOdoo'
import type { CommentWithAuthor } from '../../types'

function isNoRowsError(error: { code?: string } | null) {
  return error?.code === 'PGRST116'
}

type CommentRow = Omit<CommentWithAuthor, 'profiles'> & { profiles?: CommentWithAuthor['profiles'] }

type CommentAuthor = NonNullable<CommentWithAuthor['profiles']>

/**
 * Comments live in `comments` for uploaded videos and in `dental_video_comments`
 * for imported YouTube videos. Rows from both are returned with a `video_id`
 * field so the UI doesn't care which source it is looking at.
 */
export type CommentSource = 'video' | 'dental'

function tablesFor(source: CommentSource) {
  return source === 'dental'
    ? {
        comments: 'dental_video_comments',
        likes: 'dental_video_comment_likes',
        fk: 'dental_video_id',
        select: `
  id,
  video_id:dental_video_id,
  author_id,
  parent_id,
  body,
  is_pinned,
  like_count,
  created_at,
  updated_at
`,
      }
    : {
        comments: 'comments',
        likes: 'comment_likes',
        fk: 'video_id',
        select: `
  id,
  video_id,
  author_id,
  parent_id,
  body,
  is_pinned,
  like_count,
  created_at,
  updated_at
`,
      }
}

async function attachCommentAuthors(comments: CommentRow[]): Promise<CommentWithAuthor[]> {
  if (comments.length === 0) {
    return comments as CommentWithAuthor[]
  }

  const authorIds = [...new Set(comments.map((comment) => comment.author_id).filter(Boolean))]

  const { data, error } = await supabase
    .from('public_profiles')
    .select(`
      user_id,
      name,
      full_name,
      username,
      avatar_url,
      is_verified,
      specialty
    `)
    .in('user_id', authorIds)

  if (error) throw error

  const authors = new Map(
    ((data ?? []) as CommentAuthor[]).map((author) => [author.user_id, author])
  )

  return comments.map((comment) => ({
    ...comment,
    profiles: authors.get(comment.author_id) ?? null,
  }))
}

async function fetchReplyCounts(parentIds: string[], source: CommentSource) {
  if (parentIds.length === 0) {
    return new Map<string, number>()
  }

  const { data, error } = await supabase
    .from(tablesFor(source).comments)
    .select('parent_id')
    .in('parent_id', parentIds)

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.parent_id) continue
    counts.set(row.parent_id, (counts.get(row.parent_id) ?? 0) + 1)
  }

  return counts
}

export async function fetchComments(
  videoId: string,
  source: CommentSource = 'video'
): Promise<CommentWithAuthor[]> {
  const t = tablesFor(source)
  const { data, error } = await supabase
    .from(t.comments)
    .select(t.select)
    .eq(t.fk, videoId)
    .is('parent_id', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  const comments = await attachCommentAuthors((data ?? []) as unknown as CommentRow[])
  const replyCounts = await fetchReplyCounts(comments.map((comment) => comment.id), source)

  return comments.map((comment) => ({
    ...comment,
    reply_count: replyCounts.get(comment.id) ?? 0,
  }))
}

export async function fetchCommentCount(
  videoId: string,
  source: CommentSource = 'video'
): Promise<number> {
  const t = tablesFor(source)
  const { count, error } = await supabase
    .from(t.comments)
    .select('id', { count: 'exact', head: true })
    .eq(t.fk, videoId)

  if (error) throw error

  return count ?? 0
}

export async function fetchReplies(
  parentId: string,
  source: CommentSource = 'video'
): Promise<CommentWithAuthor[]> {
  const t = tablesFor(source)
  const { data, error } = await supabase
    .from(t.comments)
    .select(t.select)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return attachCommentAuthors((data ?? []) as unknown as CommentRow[])
}

export async function createComment(payload: {
  video_id: string
  author_id: string
  body: string
  parent_id?: string
  source?: CommentSource
}) {
  const { source = 'video', video_id, ...rest } = payload
  const t = tablesFor(source)
  const { data, error } = await supabase
    .from(t.comments)
    .insert({ ...rest, [t.fk]: video_id })
    .select()
    .single()

  if (error) throw error
  logElearningActivity('comment_posted', `Posted a comment on video ${payload.video_id}`)
  return data
}

/**
 * Moderator delete (video creator or admin). Unlike deleteOwnComment this does
 * not filter on the author; row-level security decides who is allowed, and an
 * empty result means the database refused it.
 */
export async function deleteCommentAsModerator(commentId: string, source: CommentSource = 'video') {
  const { data, error } = await supabase
    .from(tablesFor(source).comments)
    .delete()
    .eq('id', commentId)
    .select('id')

  if (error) throw error
  if (!data?.length) {
    throw new Error('You do not have permission to delete this comment.')
  }
  logElearningActivity('comment_deleted', `Moderated (deleted) comment ${commentId}`)
}

export async function deleteOwnComment(
  userId: string,
  commentId: string,
  source: CommentSource = 'video'
) {
  const { data, error } = await supabase
    .from(tablesFor(source).comments)
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId)
    .select('id')

  if (error) throw error
  if (!data?.length) {
    throw new Error('Comment not found or you do not have permission to delete it.')
  }
  logElearningActivity('comment_deleted', `Deleted comment ${commentId}`)
}

export async function likeComment(userId: string, commentId: string, source: CommentSource = 'video') {
  const { error } = await supabase
    .from(tablesFor(source).likes)
    .upsert(
      { user_id: userId, comment_id: commentId },
      { onConflict: 'user_id,comment_id', ignoreDuplicates: true }
    )

  if (error) throw error
}

export async function unlikeComment(userId: string, commentId: string, source: CommentSource = 'video') {
  const { error } = await supabase
    .from(tablesFor(source).likes)
    .delete()
    .eq('user_id', userId)
    .eq('comment_id', commentId)

  if (error) throw error
}

export async function checkCommentLiked(
  userId: string,
  commentId: string,
  source: CommentSource = 'video'
): Promise<boolean> {
  const { data, error } = await supabase
    .from(tablesFor(source).likes)
    .select('comment_id')
    .eq('user_id', userId)
    .eq('comment_id', commentId)
    .maybeSingle()

  if (error && !isNoRowsError(error)) throw error

  return !!data
}
