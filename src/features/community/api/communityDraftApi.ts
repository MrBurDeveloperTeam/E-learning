import { supabase } from '@/lib/supabase'
import { COMMUNITY_BUCKETS } from '@/features/community/api/communityContract'
import type { CommunityPostTopic } from '@/features/community/types'

export type CommunityDraftMedia = {
  id: string
  draft_id: string
  file_name: string
  mime_type: string
  file_size_bytes: number
  storage_path: string
  sort_order: number
}

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
  media: CommunityDraftMedia[]
}

export type CommunityDraftInput = {
  id?: string
  authorId: string
  communityId?: string
  title: string
  body: string
  tags: string[]
  topic?: CommunityPostTopic | null
  files?: File[]
  retainedMediaIds?: string[]
}

const draftSelect = 'id,author_id,community_id,title,content,tags,topic,created_at,updated_at'
const mediaSelect = 'id,draft_id,file_name,mime_type,file_size_bytes,storage_path,sort_order'
const missingDraftMediaTable = (code?: string) => code === '42P01' || code === 'PGRST205'

async function attachDraftMedia(drafts: Omit<CommunityPostDraft, 'media'>[]): Promise<CommunityPostDraft[]> {
  if (!drafts.length) return []
  const result = await supabase.from('community_post_draft_media').select(mediaSelect).in('draft_id', drafts.map((draft) => draft.id)).order('sort_order')
  if (result.error && !missingDraftMediaTable(result.error.code)) throw result.error
  const byDraft = new Map<string, CommunityDraftMedia[]>()
  for (const media of (result.data ?? []) as CommunityDraftMedia[]) byDraft.set(media.draft_id, [...(byDraft.get(media.draft_id) ?? []), media])
  return drafts.map((draft) => ({ ...draft, media: byDraft.get(draft.id) ?? [] }))
}

export async function fetchCommunityDrafts(userId: string): Promise<CommunityPostDraft[]> {
  const { data, error } = await supabase
    .from('community_post_drafts')
    .select(draftSelect)
    .eq('author_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return attachDraftMedia((data ?? []) as Omit<CommunityPostDraft, 'media'>[])
}

export async function saveCommunityDraft(input: CommunityDraftInput): Promise<CommunityPostDraft> {
  const id = input.id ?? crypto.randomUUID()
  const values = {
    id,
    author_id: input.authorId,
    community_id: input.communityId ?? null,
    title: input.title,
    content: input.body,
    tags: input.tags,
    topic: input.topic ?? null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('community_post_drafts').upsert(values, { onConflict: 'id' }).select(draftSelect).single()
  if (error) throw error

  if (input.retainedMediaIds) {
    const existing = await supabase.from('community_post_draft_media').select(mediaSelect).eq('draft_id', id)
    if (existing.error) throw existing.error
    const retained = new Set(input.retainedMediaIds)
    const removed = ((existing.data ?? []) as CommunityDraftMedia[]).filter((media) => !retained.has(media.id))
    if (removed.length) {
      const storage = await supabase.storage.from(COMMUNITY_BUCKETS.draftMedia).remove(removed.map((media) => media.storage_path))
      if (storage.error) throw storage.error
      const metadata = await supabase.from('community_post_draft_media').delete().eq('draft_id', id).in('id', removed.map((media) => media.id))
      if (metadata.error) throw metadata.error
    }
  }

  const uploadedPaths: string[] = []
  try {
    const retainedCount = input.retainedMediaIds?.length ?? 0
    for (const [index, file] of (input.files ?? []).entries()) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${input.authorId}/${id}/${crypto.randomUUID()}-${safeName}`
      const upload = await supabase.storage.from(COMMUNITY_BUCKETS.draftMedia).upload(path, file, { contentType: file.type })
      if (upload.error) throw upload.error
      uploadedPaths.push(path)
      const metadata = await supabase.from('community_post_draft_media').insert({
        draft_id: id,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        storage_path: path,
        sort_order: retainedCount + index,
      })
      if (metadata.error) throw metadata.error
    }
  } catch (cause) {
    if (uploadedPaths.length) {
      await supabase.storage.from(COMMUNITY_BUCKETS.draftMedia).remove(uploadedPaths)
      await supabase.from('community_post_draft_media').delete().eq('draft_id', id).in('storage_path', uploadedPaths)
    }
    throw cause
  }

  const [saved] = await attachDraftMedia([data as Omit<CommunityPostDraft, 'media'>])
  return saved
}

export async function deleteCommunityDraft(id: string, userId: string): Promise<void> {
  const media = await supabase.from('community_post_draft_media').select('storage_path').eq('draft_id', id)
  if (media.error && !missingDraftMediaTable(media.error.code)) throw media.error
  const paths = (media.data ?? []).map((item) => item.storage_path)
  if (paths.length) {
    const storage = await supabase.storage.from(COMMUNITY_BUCKETS.draftMedia).remove(paths)
    if (storage.error) throw storage.error
  }
  const { error } = await supabase.from('community_post_drafts').delete().eq('id', id).eq('author_id', userId)
  if (error) throw error
}

export async function downloadCommunityDraftMedia(media: CommunityDraftMedia[]): Promise<File[]> {
  const files: File[] = []
  for (const item of media) {
    const { data, error } = await supabase.storage.from(COMMUNITY_BUCKETS.draftMedia).download(item.storage_path)
    if (error) throw error
    files.push(new File([data], item.file_name, { type: item.mime_type }))
  }
  return files
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
