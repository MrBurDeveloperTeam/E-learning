import { supabase } from '../supabase'
import type { CommentWithAuthor } from '../../types'

const commentAuthorSelect = `
  *,
  profiles:profiles!comments_author_id_fkey(
    user_id,
    name,
    full_name,
    username,
    avatar_url,
    is_verified,
    specialty
  )
`

function isNoRowsError(error: { code?: string } | null) {
  return error?.code === 'PGRST116'
}

async function fetchReplyCounts(parentIds: string[]) {
  if (parentIds.length === 0) {
    return new Map<string, number>()
  }

  const { data, error } = await supabase
    .from('comments')
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

export async function fetchComments(videoId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(commentAuthorSelect)
    .eq('video_id', videoId)
    .is('parent_id', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  const comments = (data ?? []) as CommentWithAuthor[]
  const replyCounts = await fetchReplyCounts(comments.map((comment) => comment.id))

  return comments.map((comment) => ({
    ...comment,
    reply_count: replyCounts.get(comment.id) ?? 0,
  }))
}

export async function fetchCommentCount(videoId: string): Promise<number> {
  const { count, error } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('video_id', videoId)

  if (error) throw error

  return count ?? 0
}

export async function fetchReplies(parentId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(commentAuthorSelect)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []) as CommentWithAuthor[]
}

export async function createComment(payload: {
  video_id: string
  author_id: string
  body: string
  parent_id?: string
}) {
  const { data, error } = await supabase
    .from('comments')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) throw error
}

export async function deleteOwnComment(userId: string, commentId: string) {
  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId)
    .select('id')

  if (error) throw error
  if (!data?.length) {
    throw new Error('Comment not found or you do not have permission to delete it.')
  }
}

export async function likeComment(userId: string, commentId: string) {
  const { error } = await supabase
    .from('comment_likes')
    .upsert(
      { user_id: userId, comment_id: commentId },
      { onConflict: 'user_id,comment_id', ignoreDuplicates: true }
    )

  if (error) throw error
}

export async function unlikeComment(userId: string, commentId: string) {
  const { error } = await supabase
    .from('comment_likes')
    .delete()
    .eq('user_id', userId)
    .eq('comment_id', commentId)

  if (error) throw error
}

export async function checkCommentLiked(userId: string, commentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .eq('comment_id', commentId)
    .maybeSingle()

  if (error && !isNoRowsError(error)) throw error

  return !!data
}
