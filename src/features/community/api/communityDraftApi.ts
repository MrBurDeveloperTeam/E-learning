import { supabase } from '@/lib/supabase'
import type { CommunityPostTopic } from '@/features/community/types'

export type CommunityPostDraft = {
  id: string
  author_id: string
  community_id: string | null
  title: string
  content: string
  tags: string[]
  topic: CommunityPostTopic | null
  created_at: string
  updated_at: string
}

export type CommunityDraftInput = {
  id?: string
  authorId: string
  communityId?: string
  title: string
  body: string
  tags: string[]
  topic?: CommunityPostTopic | null
}

export async function fetchCommunityDrafts(userId: string): Promise<CommunityPostDraft[]> {
  const { data, error } = await supabase
    .from('community_post_drafts')
    .select('id,author_id,community_id,title,content,tags,topic,created_at,updated_at')
    .eq('author_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CommunityPostDraft[]
}

export async function saveCommunityDraft(input: CommunityDraftInput): Promise<CommunityPostDraft> {
  const values = {
    author_id: input.authorId,
    community_id: input.communityId ?? null,
    title: input.title,
    content: input.body,
    tags: input.tags,
    topic: input.topic ?? null,
    updated_at: new Date().toISOString(),
  }
  const request = input.id
    ? supabase.from('community_post_drafts').update(values).eq('id', input.id).eq('author_id', input.authorId)
    : supabase.from('community_post_drafts').insert(values)
  const { data, error } = await request.select('id,author_id,community_id,title,content,tags,topic,created_at,updated_at').single()
  if (error) throw error
  return data as CommunityPostDraft
}

export async function deleteCommunityDraft(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('community_post_drafts').delete().eq('id', id).eq('author_id', userId)
  if (error) throw error
}

export async function migrateLocalCommunityDrafts(userId: string): Promise<number> {
  const prefix = `community-post-draft:${userId}:`
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith(prefix)))
  let migrated = 0
  for (const key of keys) {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '{}') as { id?: string; title?: string; body?: string; tags?: string; topic?: CommunityPostTopic }
      const location = key.slice(prefix.length)
      const id = value.id ?? crypto.randomUUID()
      if (!value.id) localStorage.setItem(key, JSON.stringify({ ...value, id }))
      const tags = [...new Set((value.tags ?? '').split(/[;,\s]+/).map(tag => tag.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 8)
      const { error } = await supabase.from('community_post_drafts').upsert({
        id,
        author_id: userId,
        community_id: location === 'general' ? null : location,
        title: value.title ?? '',
        content: value.body ?? '',
        tags,
        topic: value.topic ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (error) throw error
      localStorage.removeItem(key)
      migrated += 1
    } catch {
      // Preserve unreadable or unsynced local drafts for a later retry.
    }
  }
  return migrated
}
