import { supabase } from '@/lib/supabase'
import type { CommunityComment, CommunityManagedPost, CommunityPerson, CommunityPost, CommunityPostTopic, CommunitySummary, DirectConversation, DirectMessage } from '@/features/community/types'
import { prepareCommunityMedia } from '@/features/community/utils/media'
import {
  COMMUNITY_BUCKETS,
  COMMUNITY_TABLES,
  CommunityBackendUnavailableError,
  mapCommunity,
  mapCommunityComment,
  mapCommunityPost,
  mapDirectMessage,
  toDbPostStatus,
  type DbCommunity,
  type DbCommunityComment,
  type DbCommunityMessage,
  type DbCommunityPost,
} from '@/features/community/api/communityContract'

const PAGE_SIZE = 10

async function findCommunityTopic(topic: CommunityPostTopic) {
  const normalize = (value: string) => value
    .trim()
    .toLocaleLowerCase()
    .replace('paediatric', 'pediatric')
    .replace(/[^a-z0-9]+/g, '')
  const result = await supabase
    .from(COMMUNITY_TABLES.topics)
    .select('id,slug')
  if (result.error) throw result.error
  return (result.data ?? []).find((row) => normalize(row.slug) === normalize(topic)) ?? null
}

async function addCommunityVerification<T extends { user_id: string; is_verified?: boolean | null }>(profiles: T[]): Promise<T[]> {
  if (profiles.length === 0) return profiles
  const userIds = [...new Set(profiles.map((profile) => profile.user_id))]
  const result = await supabase
    .from(COMMUNITY_TABLES.professionalBadges)
    .select('user_id,badge_status,expires_at')
    .in('user_id', userIds)
  if (result.error) throw result.error
  const now = Date.now()
  const verified = new Map((result.data ?? []).map((row) => [
    row.user_id,
    row.badge_status === 'active' && (!row.expires_at || Date.parse(row.expires_at) > now),
  ]))
  return profiles.map((profile) => ({ ...profile, is_verified: verified.get(profile.user_id) ?? false }))
}

export type CommunityFeedMode = 'home' | 'following' | 'friends' | 'video'

export type CommunityFeedCursor = {
  snapshotAt: string
  pinned: boolean
  score: number
  publishedAt: string
  id: string
}

export type CommunityPostPage = CommunityPost[] & { nextCursor?: CommunityFeedCursor }

export async function fetchCommunityPosts(cursor: CommunityFeedCursor | undefined, userId?: string, mode: CommunityFeedMode = 'home', search = '', topic = 'all', sort: 'relevant'|'newest'|'popular' = 'relevant', communityId?: string, authorId?: string): Promise<CommunityPostPage> {
  let authorIds: string[] | null = null
  let activityPostIds: string[] | null = null
  let hiddenPostIds: string[] = []
  let blockedAuthorIds: string[] = []

  if (userId) {
    const [hidden, blocked] = await Promise.all([
      supabase.from(COMMUNITY_TABLES.userHiddenContent).select('post_id').eq('user_id', userId).not('post_id', 'is', null),
      supabase.from(COMMUNITY_TABLES.userBlocks).select('blocker_id,blocked_user_id').or(`blocker_id.eq.${userId},blocked_user_id.eq.${userId}`),
    ])
    if (hidden.error) throw hidden.error
    if (blocked.error) throw blocked.error
    hiddenPostIds = (hidden.data ?? []).flatMap((row) => row.post_id ? [row.post_id] : [])
    blockedAuthorIds = (blocked.data ?? []).map((row) => row.blocker_id === userId ? row.blocked_user_id : row.blocker_id)
  }

  if (mode === 'following') {
    if (!userId) return []
    const result = await supabase.from(COMMUNITY_TABLES.follows).select('following_id').eq('follower_id', userId)
    if (result.error) throw result.error
    authorIds = (result.data ?? []).map((row) => row.following_id)
    if (!authorIds.length) return []
  }

  if (mode === 'friends') {
    if (!userId) return []
    const friendships = await supabase
      .from(COMMUNITY_TABLES.friendships)
      .select('requester_id,addressee_id')
      .eq('friendship_status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    if (friendships.error) throw friendships.error
    const friendIds = (friendships.data ?? []).map((row) => row.requester_id === userId ? row.addressee_id : row.requester_id)
    if (!friendIds.length) return []
    const [likes, reposts] = await Promise.all([
      supabase.from(COMMUNITY_TABLES.postLikes).select('post_id').in('user_id', friendIds),
      supabase.from(COMMUNITY_TABLES.postReposts).select('post_id').in('user_id', friendIds),
    ])
    if (likes.error) throw likes.error
    if (reposts.error) throw reposts.error
    activityPostIds = [...new Set([...(likes.data ?? []), ...(reposts.data ?? [])].map((row) => row.post_id))]
    if (!activityPostIds.length) return []
  }

  let topicPostIds: string[] | null = null
  if (topic !== 'all') {
    const topicRow = await findCommunityTopic(topic as CommunityPostTopic)
    if (!topicRow) return []
    const links = await supabase.from(COMMUNITY_TABLES.postTopics).select('post_id').eq('topic_id', topicRow.id)
    if (links.error) throw links.error
    topicPostIds = (links.data ?? []).map((row) => row.post_id)
    if (!topicPostIds.length) return []
  }

  let query = supabase
    .from(COMMUNITY_TABLES.posts)
    .select(`id,author_id,community_id,post_kind,title,content,moderation_status,published_at,created_at,profiles!community_posts_author_id_fkey(user_id,full_name,name,avatar_url,is_verified),communities(name,slug,moderation_status)`)
    .eq('moderation_status', 'visible')
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)

  if (cursor) query = query.lt('published_at', cursor.publishedAt)
  if (mode === 'video') query = query.eq('post_kind', 'video')
  if (communityId) query = query.eq('community_id', communityId)
  if (authorId) query = query.eq('author_id', authorId)
  if (authorIds) query = query.in('author_id', authorIds)
  if (activityPostIds) query = query.in('id', activityPostIds)
  if (topicPostIds) query = query.in('id', topicPostIds)
  if (hiddenPostIds.length) query = query.not('id', 'in', `(${hiddenPostIds.join(',')})`)
  if (blockedAuthorIds.length) query = query.not('author_id', 'in', `(${blockedAuthorIds.join(',')})`)
  if (search.trim()) {
    const safeSearch = search.trim().replaceAll('%', '').replaceAll(',', ' ')
    query = query.or(`title.ilike.%${safeSearch}%,content.ilike.%${safeSearch}%`)
  }

  const result = await query
  if (result.error) throw result.error
  const dbRows = (result.data ?? []) as unknown as DbCommunityPost[]
  const posts = dbRows.map((row) => mapCommunityPost(row))
  await hydrateCommunityPosts(posts, userId)

  const last = dbRows.at(-1)
  const nextCursor = dbRows.length === PAGE_SIZE && last ? {
    snapshotAt: cursor?.snapshotAt ?? new Date().toISOString(),
    pinned: false,
    score: 0,
    publishedAt: last.published_at,
    id: last.id,
  } : undefined

  if (sort === 'popular') posts.sort((a, b) => (b.like_count + b.comment_count + b.repost_count) - (a.like_count + a.comment_count + a.repost_count))
  return Object.assign(posts, { nextCursor }) as CommunityPostPage
}

async function hydrateCommunityPosts(posts: CommunityPost[], userId?: string) {
  if (!posts.length) return
  const ids = posts.map((post) => post.id)
  const [likes, comments, reposts, bookmarks, media, topicLinks] = await Promise.all([
    supabase.from(COMMUNITY_TABLES.postLikes).select('post_id,user_id').in('post_id', ids),
    supabase.from(COMMUNITY_TABLES.comments).select('post_id').in('post_id', ids).neq('moderation_status', 'removed'),
    supabase.from(COMMUNITY_TABLES.postReposts).select('post_id,user_id').in('post_id', ids),
    supabase.from(COMMUNITY_TABLES.postBookmarks).select('post_id,user_id').in('post_id', ids),
    supabase.from(COMMUNITY_TABLES.postMedia).select('id,post_id,media_type,storage_bucket,storage_path,external_url,alt_text,sort_order').in('post_id', ids).order('sort_order'),
    supabase.from(COMMUNITY_TABLES.postTopics).select('post_id,topic_id').in('post_id', ids),
  ])
  for (const response of [likes, comments, reposts, bookmarks, media, topicLinks]) if (response.error) throw response.error

  const topicIds = [...new Set((topicLinks.data ?? []).map((row) => row.topic_id))]
  const topics = topicIds.length ? await supabase.from(COMMUNITY_TABLES.topics).select('id,slug').in('id', topicIds) : { data: [], error: null }
  if (topics.error) throw topics.error
  const topicSlug = new Map((topics.data ?? []).map((row) => [row.id, row.slug.replaceAll('-', '_') as CommunityPostTopic]))
  const postTopic = new Map((topicLinks.data ?? []).map((row) => [row.post_id, topicSlug.get(row.topic_id)]))

  const countByPost = (rows: Array<{ post_id: string }>) => rows.reduce((counts, row) => counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1), new Map<string, number>())
  const likeCounts = countByPost(likes.data ?? [])
  const commentCounts = countByPost(comments.data ?? [])
  const repostCounts = countByPost(reposts.data ?? [])
  const bookmarkCounts = countByPost(bookmarks.data ?? [])
  const liked = new Set((likes.data ?? []).filter((row) => row.user_id === userId).map((row) => row.post_id))
  const reposted = new Set((reposts.data ?? []).filter((row) => row.user_id === userId).map((row) => row.post_id))
  const bookmarked = new Set((bookmarks.data ?? []).filter((row) => row.user_id === userId).map((row) => row.post_id))

  const authorIds = [...new Set(posts.map((post) => post.author_id).filter(Boolean))]
  const publicProfiles = authorIds.length
    ? await supabase.from('public_profiles').select('user_id,full_name,name,username,avatar_url,is_verified').in('user_id', authorIds)
    : { data: [], error: null }
  if (publicProfiles.error) throw publicProfiles.error
  const verifiedProfiles = await addCommunityVerification(publicProfiles.data ?? [])
  const profiles = new Map(verifiedProfiles.map((profile) => [profile.user_id, profile]))

  const mediaByPost = new Map<string, CommunityPost['media']>()
  const mediaRows = media.data ?? []
  const bucketGroups = new Map<string, typeof mediaRows>()
  for (const row of mediaRows) {
    if (row.external_url) {
      mediaByPost.set(row.post_id, [...(mediaByPost.get(row.post_id) ?? []), { id: row.id, media_type: row.media_type as 'image'|'video', public_url: row.external_url, alt_text: row.alt_text }])
    } else if (row.storage_bucket && row.storage_path) {
      bucketGroups.set(row.storage_bucket, [...(bucketGroups.get(row.storage_bucket) ?? []), row])
    }
  }
  for (const [bucket, rows] of bucketGroups) {
    const signed = await supabase.storage.from(bucket).createSignedUrls(rows.map((row) => row.storage_path!), 3600)
    if (signed.error) throw signed.error
    const urls = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]))
    for (const row of rows) {
      const url = urls.get(row.storage_path!)
      if (url) mediaByPost.set(row.post_id, [...(mediaByPost.get(row.post_id) ?? []), { id: row.id, media_type: row.media_type as 'image'|'video', public_url: url, alt_text: row.alt_text }])
    }
  }

  for (const post of posts) {
    post.topic = postTopic.get(post.id) ?? 'general_dentistry'
    post.like_count = likeCounts.get(post.id) ?? 0
    post.comment_count = commentCounts.get(post.id) ?? 0
    post.repost_count = repostCounts.get(post.id) ?? 0
    post.bookmark_count = bookmarkCounts.get(post.id) ?? 0
    post.viewer_has_liked = liked.has(post.id)
    post.viewer_has_reposted = reposted.has(post.id)
    post.viewer_has_bookmarked = bookmarked.has(post.id)
    post.media = mediaByPost.get(post.id) ?? []
    post.profiles = profiles.get(post.author_id) ?? post.profiles
  }
}

export type CommunityUploadProgress = {
  completed: number
  total: number
  currentFile: string
  stage: 'preparing' | 'uploading' | 'saving'
}

export async function createCommunityPost(input: { authorId: string; communityId?: string; title: string; body: string; topic?: CommunityPostTopic; files?: File[]; draft?: boolean; signal?: AbortSignal; onProgress?: (progress: CommunityUploadProgress) => void }) {
  if (input.draft) throw new CommunityBackendUnavailableError('Community post drafts')
  const postId = crypto.randomUUID()
  const { error } = await supabase.from(COMMUNITY_TABLES.posts).insert({
    id: postId,
    author_id: input.authorId,
    community_id: input.communityId ?? null,
    audience: input.communityId ? 'community' : 'public',
    post_kind: input.files?.some(file=>file.type.startsWith('video/'))?'video':input.files?.length?'image':'text',
    title: input.title.trim() || null,
    content: input.body.trim(),
    moderation_status: 'visible',
  })
  if (error) throw error
  const uploaded:string[]=[]
  const files=input.files??[]
  const ensureActive=()=>{if(input.signal?.aborted)throw new DOMException('Upload cancelled.','AbortError')}
  try{for(const [position,original] of files.entries()){ensureActive();input.onProgress?.({completed:position,total:files.length,currentFile:original.name,stage:'preparing'});const file=await prepareCommunityMedia(original);ensureActive();const path=`${input.authorId}/${postId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;input.onProgress?.({completed:position,total:files.length,currentFile:original.name,stage:'uploading'});const upload=await supabase.storage.from(COMMUNITY_BUCKETS.postMedia).upload(path,file,{contentType:file.type});if(upload.error)throw upload.error;uploaded.push(path);ensureActive();input.onProgress?.({completed:position,total:files.length,currentFile:original.name,stage:'saving'});const row=await supabase.from(COMMUNITY_TABLES.postMedia).insert({post_id:postId,media_type:file.type.startsWith('video/')?'video':'image',storage_bucket:COMMUNITY_BUCKETS.postMedia,storage_path:path,mime_type:file.type,file_size_bytes:file.size,sort_order:position});if(row.error)throw row.error;input.onProgress?.({completed:position+1,total:files.length,currentFile:original.name,stage:'saving'})}ensureActive()}catch(cause){if(uploaded.length)await supabase.storage.from(COMMUNITY_BUCKETS.postMedia).remove(uploaded);await supabase.from(COMMUNITY_TABLES.posts).delete().eq('id',postId);throw cause}
  if (input.topic) {
    const topic = await findCommunityTopic(input.topic)
    if (topic) {
      const link = await supabase.from(COMMUNITY_TABLES.postTopics).insert({ post_id: postId, topic_id: topic.id, assigned_by: input.authorId })
      if (link.error) throw link.error
    }
  }
  return { id: postId, status: 'published' as const }
}

export async function setCommunityPostInteraction(
  table: 'community_post_likes' | 'community_post_reposts' | 'community_post_bookmarks',
  postId: string,
  userId: string,
  active: boolean,
  comment?: string,
) {
  const query = supabase.from(table)
  const { error } = active
    ? await query.insert({ post_id: postId, user_id: userId, ...(table==='community_post_reposts'&&comment?.trim()?{quote_content:comment.trim()}:{}) })
    : await query.delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw error
}

export type CommunityPostUpdateInput = {
  id: string
  authorId: string
  title: string
  body: string
  topic: CommunityPostTopic
  retainedMediaIds: string[]
  files?: File[]
}

export async function updateCommunityPost(input: CommunityPostUpdateInput): Promise<void> {
  const currentMedia = await supabase
    .from(COMMUNITY_TABLES.postMedia)
    .select('id,media_type,storage_bucket,storage_path,sort_order')
    .eq('post_id', input.id)
    .order('sort_order')
  if (currentMedia.error) throw currentMedia.error

  const retainedIds = new Set(input.retainedMediaIds)
  const retained = (currentMedia.data ?? []).filter((media) => retainedIds.has(media.id))
  const removed = (currentMedia.data ?? []).filter((media) => !retainedIds.has(media.id))
  const files = input.files ?? []
  if (retained.length + files.length > 20) throw new Error('A post can contain up to 20 images or videos.')

  const uploadedPaths: string[] = []
  const insertedMediaIds: string[] = []
  try {
    for (const [offset, original] of files.entries()) {
      const file = await prepareCommunityMedia(original)
      const storagePath = `${input.authorId}/${input.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const upload = await supabase.storage.from(COMMUNITY_BUCKETS.postMedia).upload(storagePath, file, { contentType: file.type, upsert: false })
      if (upload.error) throw upload.error
      uploadedPaths.push(storagePath)
      const mediaId = crypto.randomUUID()
      const media = await supabase.from(COMMUNITY_TABLES.postMedia).insert({
        id: mediaId,
        post_id: input.id,
        media_type: file.type.startsWith('video/') ? 'video' : 'image',
        storage_bucket: COMMUNITY_BUCKETS.postMedia,
        storage_path: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        sort_order: retained.length + offset,
      })
      if (media.error) throw media.error
      insertedMediaIds.push(mediaId)
    }

    const finalTypes = [
      ...retained.map((media) => media.media_type),
      ...files.map((file) => file.type.startsWith('video/') ? 'video' : 'image'),
    ]
    const postKind = finalTypes.includes('video') ? 'video' : finalTypes.includes('image') ? 'image' : 'text'
    const update = await supabase.from(COMMUNITY_TABLES.posts).update({
      title: input.title.trim() || null,
      content: input.body.trim(),
      post_kind: postKind,
      edited_at: new Date().toISOString(),
    }).eq('id', input.id).eq('author_id', input.authorId).select('id').single()
    if (update.error) throw update.error

    const topic = await findCommunityTopic(input.topic)
    if (!topic) throw new Error('This topic is unavailable. Choose another topic and try again.')
    const currentTopics = await supabase.from(COMMUNITY_TABLES.postTopics).select('topic_id').eq('post_id', input.id)
    if (currentTopics.error) throw currentTopics.error
    if (!(currentTopics.data ?? []).some((row) => row.topic_id === topic.id)) {
      const addTopic = await supabase.from(COMMUNITY_TABLES.postTopics).insert({ post_id: input.id, topic_id: topic.id, assigned_by: input.authorId })
      if (addTopic.error) throw addTopic.error
    }
    const removeOtherTopics = await supabase.from(COMMUNITY_TABLES.postTopics).delete().eq('post_id', input.id).neq('topic_id', topic.id)
    if (removeOtherTopics.error) throw removeOtherTopics.error

    if (removed.length) {
      const removeRows = await supabase.from(COMMUNITY_TABLES.postMedia).delete().in('id', removed.map((media) => media.id)).eq('post_id', input.id)
      if (removeRows.error) throw removeRows.error
      const storedPaths = removed.filter((media) => media.storage_bucket === COMMUNITY_BUCKETS.postMedia && media.storage_path).map((media) => media.storage_path!)
      if (storedPaths.length) {
        const removeObjects = await supabase.storage.from(COMMUNITY_BUCKETS.postMedia).remove(storedPaths)
        if (removeObjects.error) throw removeObjects.error
      }
    }
  } catch (cause) {
    if (insertedMediaIds.length) await supabase.from(COMMUNITY_TABLES.postMedia).delete().in('id', insertedMediaIds)
    if (uploadedPaths.length) await supabase.storage.from(COMMUNITY_BUCKETS.postMedia).remove(uploadedPaths)
    throw cause
  }
}
export async function softDeleteCommunityPost(id:string,authorId:string): Promise<void>{void authorId;const{error}=await supabase.rpc('community_delete_own_post',{p_post_id:id});if(error)throw error}
// Sharing is performed by the Clipboard API. There is no share-event table or
// RPC in the current production contract, so missing analytics must not block it.
export async function recordCommunityPostShare(_id:string): Promise<void>{}
export async function recordCommunityPostView(postId:string,_watchSeconds=0,_progress=0): Promise<void>{
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Sign in to save your watch history.')
  const { error } = await supabase.from(COMMUNITY_TABLES.postViews).upsert(
    { user_id: user.id, post_id: postId, viewed_at: new Date().toISOString() },
    { onConflict: 'user_id,post_id' },
  )
  if (error) throw error
}

export async function fetchCommunityPost(postId:string,userId?:string){
  const{data,error}=await supabase.from(COMMUNITY_TABLES.posts).select(`id,author_id,community_id,post_kind,title,content,moderation_status,published_at,created_at,profiles!community_posts_author_id_fkey(user_id,full_name,name,avatar_url,is_verified),communities(name,slug,moderation_status)`).eq('id',postId).single()
  if(error)throw error
  const post = mapCommunityPost(data as unknown as DbCommunityPost)
  await hydrateCommunityPosts([post], userId)
  return post
}

export const COMMENT_PAGE_SIZE = 6

export async function fetchCommunityComments(postId: string, userId?: string, page = 0, search = '') {
  const runCommentQuery = (includeCuration: boolean) => {
    let request = supabase
      .from(COMMUNITY_TABLES.comments)
      .select(includeCuration
        ? 'id,post_id,author_id,parent_comment_id,content,moderation_status,moderation_reason,is_pinned,is_best_answer,created_at,updated_at'
        : 'id,post_id,author_id,parent_comment_id,content,moderation_status,moderation_reason,created_at,updated_at')
      .eq('post_id', postId)
      .neq('moderation_status', 'removed')
      .order('created_at', { ascending: false })
      .limit(200)
    if (search.trim()) request = request.ilike('content', `%${search.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
    return request
  }

  let result = await runCommentQuery(true)
  if (result.error && (result.error.code === '42703' || result.error.code === 'PGRST204')) {
    result = await runCommentQuery(false)
  }
  if (result.error) throw result.error
  const data = result.data as unknown as DbCommunityComment[] | null

  let hiddenCommentIds = new Set<string>()
  if (userId) {
    const hidden = await supabase.from(COMMUNITY_TABLES.reports)
      .select('comment_id')
      .eq('reporter_id', userId)
      .not('comment_id', 'is', null)
    if (hidden.error) throw hidden.error
    hiddenCommentIds = new Set((hidden.data ?? []).flatMap((row) => row.comment_id ? [row.comment_id] : []))
  }

  let comments = (data ?? [])
    .filter((row) => !hiddenCommentIds.has(row.id))
    .map((row) => mapCommunityComment(row))

  let priorityAuthors=new Set<string>()
  if(userId){
    const[following,friendships]=await Promise.all([
      supabase.from(COMMUNITY_TABLES.follows).select('following_id').eq('follower_id',userId),
      supabase.from(COMMUNITY_TABLES.friendships).select('requester_id,addressee_id').eq('friendship_status','accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    ])
    if(following.error)throw following.error
    if(friendships.error)throw friendships.error
    priorityAuthors=new Set([
      ...(following.data??[]).map(row=>row.following_id),
      ...(friendships.data??[]).map(row=>row.requester_id===userId?row.addressee_id:row.requester_id),
    ])
  }
  comments=comments
    .map(comment=>({...comment,viewer_is_followed_or_friend:priorityAuthors.has(comment.author_id)}))
    .sort((left,right)=>Number(right.viewer_is_followed_or_friend)-Number(left.viewer_is_followed_or_friend)||Date.parse(right.created_at)-Date.parse(left.created_at))
  if(page>=0)comments=comments.slice(page*COMMENT_PAGE_SIZE,(page+1)*COMMENT_PAGE_SIZE)

  const authorIds = [...new Set(comments.map((comment) => comment.author_id).filter(Boolean))]
  const profiles = new Map<string, CommunityComment['profiles']>()
  if (authorIds.length > 0) {
    const result = await supabase.from('public_profiles').select('user_id,full_name,name,username,avatar_url,is_verified').in('user_id', authorIds)
    if (result.error) throw result.error
    const verifiedProfiles = await addCommunityVerification(result.data ?? [])
    for (const profile of verifiedProfiles) profiles.set(profile.user_id, profile)
  }

  let liked = new Set<string>()
  let likeCounts = new Map<string, number>()
  const mediaByComment = new Map<string, CommunityComment['media']>()
  if (comments.length > 0) {
    const commentIds = comments.map((comment) => comment.id)
    const [result, mediaResult] = await Promise.all([
      supabase.from(COMMUNITY_TABLES.commentLikes).select('comment_id,user_id').in('comment_id', commentIds),
      supabase.from(COMMUNITY_TABLES.commentMedia).select('id,comment_id,storage_bucket,storage_path,file_name,mime_type,sort_order').in('comment_id', commentIds).order('sort_order'),
    ])
    if (result.error) throw result.error
    if (mediaResult.error && !['42P01', 'PGRST205'].includes(mediaResult.error.code ?? '')) throw mediaResult.error
    const rows = result.data ?? []
    liked = new Set(rows.filter((row) => row.user_id === userId).map((row) => row.comment_id))
    likeCounts = rows.reduce((counts, row) => counts.set(row.comment_id, (counts.get(row.comment_id) ?? 0) + 1), new Map<string, number>())
    const mediaRows = mediaResult.error ? [] : (mediaResult.data ?? [])
    const bucketGroups = new Map<string, typeof mediaRows>()
    for (const row of mediaRows) bucketGroups.set(row.storage_bucket, [...(bucketGroups.get(row.storage_bucket) ?? []), row])
    for (const [bucket, bucketRows] of bucketGroups) {
      const signed = await supabase.storage.from(bucket).createSignedUrls(bucketRows.map((row) => row.storage_path), 3600)
      if (signed.error) throw signed.error
      const urls = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]))
      for (const row of bucketRows) {
        const publicUrl = urls.get(row.storage_path)
        if (publicUrl) mediaByComment.set(row.comment_id, [...(mediaByComment.get(row.comment_id) ?? []), { id: row.id, file_name: row.file_name, mime_type: row.mime_type, public_url: publicUrl }])
      }
    }
  }
  return comments.map((comment) => ({ ...comment, profiles: profiles.get(comment.author_id) ?? null, like_count: likeCounts.get(comment.id) ?? 0, viewer_has_liked: liked.has(comment.id), media: mediaByComment.get(comment.id) ?? [] }))
}

export async function checkCommunityCommentSafety(body: string): Promise<'safe' | 'warn' | 'review' | 'block'> {
  const value=body.trim()
  if(!value)throw new Error('Write something before publishing your comment.')
  if(value.length>5000)throw new Error('Comments must be 5,000 characters or fewer.')
  const { data, error } = await supabase.rpc('community_check_comment_safety', { input_body: value })
  if(error)throw error
  return data as 'safe' | 'warn' | 'review' | 'block'
}

export async function createCommunityComment(input: { postId: string; authorId: string; body: string; parentCommentId?: string | null; files?: File[] }) {
  const commentId=crypto.randomUUID()
  const safety = await checkCommunityCommentSafety(input.body)
  if (safety === 'block') {
    throw new Error('This comment contains blocked words or phrases and cannot be published. Please revise it and try again.')
  }
  const autoHidden = safety === 'review'
  const { error } = await supabase.from(COMMUNITY_TABLES.comments).insert({
    id:commentId,
    post_id: input.postId,
    author_id: input.authorId,
    content: input.body.trim(),
    parent_comment_id: input.parentCommentId ?? null,
    moderation_status: autoHidden ? 'auto_hidden' : 'visible',
    moderation_reason: autoHidden ? `blocked_word:${safety}` : null,
  })
  if (error) throw error
  const files = input.files ?? []
  const uploadedPaths: string[] = []
  try {
    for (const [sortOrder, file] of files.entries()) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${input.authorId}/${commentId}/${crypto.randomUUID()}-${safeName}`
      const upload = await supabase.storage.from(COMMUNITY_BUCKETS.commentMedia).upload(storagePath, file, { contentType: file.type, upsert: false })
      if (upload.error) throw upload.error
      uploadedPaths.push(storagePath)
      const media = await supabase.from(COMMUNITY_TABLES.commentMedia).insert({
        comment_id: commentId,
        uploader_id: input.authorId,
        storage_bucket: COMMUNITY_BUCKETS.commentMedia,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        sort_order: sortOrder,
      })
      if (media.error) throw media.error
    }
  } catch (cause) {
    await supabase.from(COMMUNITY_TABLES.commentMedia).delete().eq('comment_id', commentId).eq('uploader_id', input.authorId)
    if (uploadedPaths.length) await supabase.storage.from(COMMUNITY_BUCKETS.commentMedia).remove(uploadedPaths)
    await supabase.rpc('community_delete_own_comment', { p_comment_id: commentId })
    throw cause
  }
  return { id:commentId, status:(autoHidden ? 'hidden' : 'visible') as CommunityComment['status'] }
}

export async function updateCommunityComment(commentId: string, authorId: string, body: string) {
  const { error } = await supabase.from(COMMUNITY_TABLES.comments).update({ content: body.trim(), edited_at: new Date().toISOString() }).eq('id', commentId).eq('author_id', authorId)
  if (error) throw error
}

export async function deleteCommunityComment(commentId: string, authorId: string) {
  void authorId
  const { error } = await supabase.rpc('community_delete_own_comment', {
    p_comment_id: commentId,
  })
  if (error) throw error
}

export async function setCommunityCommentFeature(commentId: string, feature: 'pinned' | 'best_answer', enabled: boolean) {
  const { error } = await supabase.rpc('community_set_comment_feature', {
    p_comment_id: commentId,
    p_feature: feature,
    p_enabled: enabled,
  })
  if (error) throw error
}

export async function setCommunityUserBlock(blockedUserId: string, userId: string, active: boolean) {
  const query = supabase.from(COMMUNITY_TABLES.userBlocks)
  const { error } = active ? await query.insert({ blocker_id: userId, blocked_user_id: blockedUserId }) : await query.delete().eq('blocker_id', userId).eq('blocked_user_id', blockedUserId)
  if (error) throw error
}

export async function fetchCommunityMentionUsers(query: string) {
  const cleaned = query.trim().replace(/[^a-zA-Z0-9_. -]/g, '')
  if (cleaned.length < 1) return []
  const pattern = `%${cleaned}%`
  const { data, error } = await supabase
    .from('public_profiles')
    .select('user_id,username,full_name,name,avatar_url')
    .not('username', 'is', null)
    .or(`username.ilike.${pattern},full_name.ilike.${pattern},name.ilike.${pattern}`)
    .order('username')
    .limit(6)
  if (error) throw error
  return data ?? []
}

export async function fetchCommunityBlockedUsers(userId: string) {
  const { data, error } = await supabase.from(COMMUNITY_TABLES.userBlocks).select('blocked_user_id,created_at').eq('blocker_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  const ids=(data??[]).map(row=>row.blocked_user_id)
  if(ids.length===0)return []
  const profiles=await supabase.from('public_profiles').select('user_id,full_name,name,avatar_url,is_verified').in('user_id',ids)
  if(profiles.error)throw profiles.error
  const verifiedProfiles=await addCommunityVerification(profiles.data??[])
  const byId=new Map(verifiedProfiles.map(profile=>[profile.user_id,profile]))
  return ids.flatMap(id=>{const profile=byId.get(id);return profile?[profile]:[]})
}

export async function setCommunityCommentLike(commentId: string, userId: string, active: boolean) {
  const query = supabase.from(COMMUNITY_TABLES.commentLikes)
  const { error } = active ? await query.insert({ comment_id: commentId, user_id: userId }) : await query.delete().eq('comment_id', commentId).eq('user_id', userId)
  if (error) throw error
}

export { PAGE_SIZE }

export async function fetchCommunityDirectory(userId: string) {
  const [communitiesResult, membershipsResult, memberCountsResult] = await Promise.all([
    supabase
      .from(COMMUNITY_TABLES.communities)
      .select('id,owner_id,name,slug,description,visibility,moderation_status,avatar_url,announcement,created_at')
      .in('moderation_status', ['active', 'archived'])
      .order('created_at', { ascending: false }),
    supabase
      .from(COMMUNITY_TABLES.members)
      .select('community_id,membership_status,muted_until,mute_reason')
      .eq('user_id', userId)
      .eq('membership_status', 'active'),
    supabase.from(COMMUNITY_TABLES.members).select('community_id,user_id').eq('membership_status', 'active'),
  ])
  if (communitiesResult.error) throw communitiesResult.error
  if (membershipsResult.error) throw membershipsResult.error
  if (memberCountsResult.error) throw memberCountsResult.error

  const memberships = new Map((membershipsResult.data ?? []).map((membership) => [membership.community_id, membership]))
  const membersByCommunity = (memberCountsResult.data ?? []).reduce((members, row) => {
    const users = members.get(row.community_id) ?? new Set<string>()
    users.add(row.user_id)
    members.set(row.community_id, users)
    return members
  }, new Map<string, Set<string>>())
  const localRules = new Map<string, CommunitySummary['rules']>()
  const rules = await supabase.from('community_rules').select('id,community_id,title,description,position').order('position')
  if (rules.error) throw rules.error
  for (const row of rules.data ?? []) localRules.set(row.community_id, [...(localRules.get(row.community_id) ?? []), { id: row.id, title: row.title, description: row.description, position: row.position }])

  return (communitiesResult.data ?? []).map((row) => {
    const memberIds = membersByCommunity.get(row.id) ?? new Set<string>()
    const community = mapCommunity(row as DbCommunity, memberIds.size + (memberIds.has(row.owner_id) ? 0 : 1))
    community.rules = localRules.get(row.id) ?? []
    const membership = memberships.get(row.id)
    community.viewer_is_member = Boolean(membership) || row.owner_id === userId
    community.viewer_membership_role = row.owner_id === userId ? 'owner' : membership ? 'member' : null
    community.viewer_muted_until = membership?.muted_until ?? null
    community.viewer_mute_reason = membership?.mute_reason ?? null
    return community
  }).sort((a, b) => b.member_count - a.member_count)
}

export async function joinPublicCommunity(communityId: string, userId: string) {
  void userId
  const { error } = await supabase.rpc('community_join_public', { target_community_id: communityId })
  if (error) throw error
}

export async function createCommunity(input: { ownerId: string; name: string; description: string; visibility: 'public' | 'private' }) {
  const base = input.name.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54) || 'community'
  const id = crypto.randomUUID()
  const { error } = await supabase.from(COMMUNITY_TABLES.communities).insert({ id, owner_id: input.ownerId, name: input.name.trim(), slug: `${base}-${crypto.randomUUID().slice(0, 6)}`, description: input.description.trim() || null, visibility: input.visibility, moderation_status: 'pending' })
  if (error) throw error
  return { id }
}

export async function leaveCommunity(communityId: string, _userId: string) {
  const { error } = await supabase.rpc('community_leave', { target_community_id: communityId })
  if (error) throw error
}

export async function fetchCommunityManagement(communityId: string) {
  const [community, members, requests, rules] = await Promise.all([
    supabase.from(COMMUNITY_TABLES.communities).select('id,owner_id,description,announcement').eq('id', communityId).single(),
    supabase.from(COMMUNITY_TABLES.members).select('community_id,user_id,membership_status,membership_role,muted_until,mute_reason,joined_at').eq('community_id', communityId).eq('membership_status', 'active').order('joined_at'),
    supabase.from(COMMUNITY_TABLES.joinRequests).select('id,requester_id,request_message,request_status,created_at').eq('community_id', communityId).eq('request_status', 'pending').order('created_at'),
    supabase.from('community_rules').select('id,community_id,title,description,position').eq('community_id', communityId).order('position'),
  ])
  if (community.error) throw community.error
  if (members.error) throw members.error
  if (requests.error) throw requests.error
  if (rules.error) throw rules.error
  const ids = [...new Set([...(members.data ?? []).map(row => row.user_id), ...(requests.data ?? []).map(row => row.requester_id)])]
  const profiles = ids.length ? await supabase.from('public_profiles').select('user_id,full_name,name,avatar_url').in('user_id', ids) : { data: [], error: null }
  if (profiles.error) throw profiles.error
  const names = new Map((profiles.data ?? []).map(profile => [profile.user_id, profile]))
  return {
    members: (members.data ?? []).map(row => ({ ...row, id: `${row.community_id}:${row.user_id}`, membership_role: row.user_id === community.data.owner_id ? 'owner' : row.membership_role, status: row.membership_status, profile: names.get(row.user_id) ?? null })),
    requests: (requests.data ?? []).map(row => ({ ...row, message: row.request_message, status: row.request_status, profile: names.get(row.requester_id) ?? null })),
    description: community.data.description as string|null,
    announcement: community.data.announcement as string|null,
    rules: rules.data ?? [],
  }
}

export async function fetchCommunityMembers(communityId: string) {
  const members = await supabase
    .from(COMMUNITY_TABLES.members)
    .select('user_id,joined_at')
    .eq('community_id', communityId)
    .eq('membership_status', 'active')
    .order('joined_at')
  if (members.error) throw members.error
  const ids = (members.data ?? []).map((row) => row.user_id)
  if (!ids.length) return []
  const profiles = await supabase.from('public_profiles').select('user_id,full_name,name,avatar_url,is_verified').in('user_id', ids)
  if (profiles.error) throw profiles.error
  const verified = await addCommunityVerification(profiles.data ?? [])
  const byId = new Map(verified.map((profile) => [profile.user_id, profile]))
  return (members.data ?? []).flatMap((member) => {
    const profile = byId.get(member.user_id)
    return profile ? [{ ...profile, joined_at: member.joined_at }] : []
  })
}

export async function decideCommunityJoinRequest(requestId: string, decision: 'approved' | 'rejected', _userId: string) {
  const { error } = await supabase.rpc('community_review_join_request', {
    target_request_id: requestId,
    target_decision: decision,
  })
  if (error) throw error
}

export async function removeCommunityMember(memberId: string) {
  const [communityId, userId] = memberId.split(':')
  if (!communityId || !userId) throw new Error('The selected member is invalid.')
  const result = await supabase.from(COMMUNITY_TABLES.members).delete().eq('community_id', communityId).eq('user_id', userId).select('user_id').single()
  if (result.error) throw result.error
}

export async function saveCommunityAbout(communityId:string,description:string){const result=await supabase.from(COMMUNITY_TABLES.communities).update({description:description.trim()||null,updated_at:new Date().toISOString()}).eq('id',communityId).select('id').single();if(result.error)throw result.error}
export async function archiveCommunity(communityId:string){const result=await supabase.from(COMMUNITY_TABLES.communities).update({moderation_status:'archived',updated_at:new Date().toISOString()}).eq('id',communityId).select('id').single();if(result.error)throw result.error}
export async function saveCommunityAnnouncement(communityId:string,announcement:string){const result=await supabase.from(COMMUNITY_TABLES.communities).update({announcement:announcement.trim()||null,updated_at:new Date().toISOString()}).eq('id',communityId).select('id').single();if(result.error)throw result.error}
export async function addCommunityRule(communityId:string,title:string,description:string,position:number){const result=await supabase.from('community_rules').insert({community_id:communityId,title:title.trim(),description:description.trim()||null,position,created_by:(await supabase.auth.getUser()).data.user?.id}).select('id').single();if(result.error)throw result.error}
export async function updateCommunityRule(ruleId:string,title:string,description:string){const result=await supabase.from('community_rules').update({title:title.trim(),description:description.trim()||null,updated_at:new Date().toISOString()}).eq('id',ruleId).select('id').single();if(result.error)throw result.error}
export async function moveCommunityRule(ruleId:string,direction:'up'|'down'){
  const current=await supabase.from('community_rules').select('id,community_id,position').eq('id',ruleId).single();if(current.error)throw current.error
  const neighbour=await supabase.from('community_rules').select('id,position').eq('community_id',current.data.community_id).order('position',{ascending:direction==='down'}).filter('position',direction==='up'?'lt':'gt',current.data.position).limit(1).maybeSingle();if(neighbour.error)throw neighbour.error;if(!neighbour.data)return
  const first=await supabase.from('community_rules').update({position:neighbour.data.position,updated_at:new Date().toISOString()}).eq('id',current.data.id);if(first.error)throw first.error
  const second=await supabase.from('community_rules').update({position:current.data.position,updated_at:new Date().toISOString()}).eq('id',neighbour.data.id);if(second.error)throw second.error
}
export async function deleteCommunityRule(ruleId:string){const result=await supabase.from('community_rules').delete().eq('id',ruleId).select('id').single();if(result.error)throw result.error}
export async function setCommunityMemberMute(memberId:string,until:string|null,reason:string|null){const[communityId,userId]=memberId.split(':');if(!communityId||!userId)throw new Error('The selected member is invalid.');const result=await supabase.from(COMMUNITY_TABLES.members).update({muted_until:until,mute_reason:until?reason?.trim()||null:null,updated_at:new Date().toISOString()}).eq('community_id',communityId).eq('user_id',userId).select('user_id').single();if(result.error)throw result.error}

export async function requestPrivateCommunityJoin(slug: string, message: string): Promise<void> {
  const { error } = await supabase.rpc('community_request_join_by_slug', { target_slug: slug.trim().toLowerCase(), request_message: message.trim() || null })
  if (error) throw error
}

export async function fetchCommunityInvitePreview(slug: string): Promise<{ name: string; slug: string; visibility: 'public' | 'private' }> {
  const { data, error } = await supabase.rpc('community_invite_preview', { target_slug: slug.trim().toLowerCase() })
  if (error) throw error
  const preview = Array.isArray(data) ? data[0] : data
  if (!preview) throw new Error('This Community invitation is unavailable.')
  return { name: preview.community_name, slug: preview.community_slug, visibility: preview.community_visibility as 'public' | 'private' }
}

export type CommunitySearchResult = { id: string; name: string; slug: string; description: string | null; visibility: 'public' | 'private'; memberCount: number; viewerIsMember: boolean }

export async function searchJoinableCommunities(searchText: string): Promise<CommunitySearchResult[]> {
  const query = searchText.trim()
  if (query.length < 2) return []
  const { data, error } = await supabase.rpc('community_search_joinable', { search_text: query })
  if (error) throw error
  return (data ?? []).map((row: any) => ({ id: row.community_id, name: row.community_name, slug: row.community_slug, description: row.community_description, visibility: row.community_visibility, memberCount: Number(row.member_count ?? 0), viewerIsMember: Boolean(row.viewer_is_member) }))
}

export async function browseCommunities(visibility: 'public' | 'private'): Promise<CommunitySearchResult[]> {
  const { data, error } = await supabase.rpc('community_browse', { target_visibility: visibility })
  if (error) throw error
  return (data ?? []).map((row: any) => ({ id: row.community_id, name: row.community_name, slug: row.community_slug, description: row.community_description, visibility: row.community_visibility, memberCount: Number(row.member_count ?? 0), viewerIsMember: Boolean(row.viewer_is_member) }))
}

export async function fetchDirectConversations(userId: string) {
  const { data: ownParticipants, error: ownError } = await supabase
    .from(COMMUNITY_TABLES.conversationParticipants)
    .select('conversation_id,last_read_at')
    .eq('user_id', userId)
  if (ownError) throw ownError
  const conversationIds = (ownParticipants ?? []).map((row) => row.conversation_id)
  if (conversationIds.length === 0) return [] as DirectConversation[]

  const [conversationsResult, participantsResult] = await Promise.all([
    supabase
      .from(COMMUNITY_TABLES.conversations)
      .select('id,last_message_at')
      .in('id', conversationIds)
      .eq('conversation_type','direct')
      .order('last_message_at', { ascending: false, nullsFirst: false }),
    supabase
      .from(COMMUNITY_TABLES.conversationParticipants)
      .select('conversation_id,user_id')
      .in('conversation_id', conversationIds)
      .neq('user_id', userId),
  ])
  if (conversationsResult.error) throw conversationsResult.error
  if (participantsResult.error) throw participantsResult.error

  const otherUserIds = [...new Set((participantsResult.data ?? []).map((row) => row.user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('public_profiles')
    .select('user_id,full_name,name,avatar_url,is_verified')
    .in('user_id', otherUserIds)
  if (profilesError) throw profilesError
  const verifiedProfiles = await addCommunityVerification(profiles ?? [])
  const profileMap = new Map(verifiedProfiles.map((profile) => [profile.user_id, profile]))
  const participantMap = new Map((participantsResult.data ?? []).map((row) => [row.conversation_id, row.user_id]))

  const messageResult = await supabase.from(COMMUNITY_TABLES.messages).select('conversation_id,sender_id,created_at').in('conversation_id',conversationIds).neq('message_status','deleted')
  if(messageResult.error)throw messageResult.error
  const reads=new Map((ownParticipants??[]).map(row=>[row.conversation_id,row.last_read_at]))
  const unread=new Map<string,number>();for(const message of messageResult.data??[]){if(message.sender_id!==userId&&(!reads.get(message.conversation_id)||message.created_at>reads.get(message.conversation_id)!))unread.set(message.conversation_id,(unread.get(message.conversation_id)??0)+1)}
  return (conversationsResult.data ?? []).flatMap((conversation) => {
    const otherId = participantMap.get(conversation.id)
    const profile = otherId ? profileMap.get(otherId) : null
    return profile ? [{ ...conversation, other_user: profile, unread_count: unread.get(conversation.id)??0 } as DirectConversation] : []
  })
}

export async function fetchDirectMessages(conversationId: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Sign in before viewing messages.')
  const [hiddenResult, recipientResult] = await Promise.all([
    supabase.from(COMMUNITY_TABLES.messageHiddenUsers).select('message_id').eq('user_id', user.id),
    supabase.from(COMMUNITY_TABLES.conversationParticipants).select('last_read_at').eq('conversation_id', conversationId).neq('user_id', user.id).maybeSingle(),
  ])
  if (hiddenResult.error) throw hiddenResult.error
  if (recipientResult.error) throw recipientResult.error
  const hiddenIds = new Set((hiddenResult.data ?? []).map((row) => row.message_id))
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.messages)
    .select('id,conversation_id,sender_id,content,message_status,created_at,edited_at,reply_to_message_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  const visibleRows = (data ?? []).filter((row) => !hiddenIds.has(row.id))
  const messageIds = visibleRows.map((row) => row.id)
  const reactionResult = messageIds.length
    ? await supabase.from(COMMUNITY_TABLES.messageReactions).select('message_id,user_id,emoji').in('message_id', messageIds)
    : { data: [], error: null }
  if (reactionResult.error) throw reactionResult.error
  const rowById = new Map((data ?? []).map((row) => [row.id, row]))
  return visibleRows.map((row) => {
    const message = mapDirectMessage(row as DbCommunityMessage)
    const replyRow = row.reply_to_message_id ? rowById.get(row.reply_to_message_id) : null
    const reactionMap = new Map<string, { emoji: string; count: number; viewer_reacted: boolean }>()
    for (const reaction of reactionResult.data ?? []) {
      if (reaction.message_id !== row.id) continue
      const current = reactionMap.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, viewer_reacted: false }
      current.count += 1
      current.viewer_reacted ||= reaction.user_id === user.id
      reactionMap.set(reaction.emoji, current)
    }
    message.reactions = [...reactionMap.values()]
    message.reply_to = replyRow ? {
      id: replyRow.id,
      sender_id: replyRow.sender_id ?? '',
      body: replyRow.content ?? '',
      status: replyRow.message_status,
    } : null
    if (message.sender_id === user.id) {
      message.delivery_status = recipientResult.data?.last_read_at && Date.parse(recipientResult.data.last_read_at) >= Date.parse(message.created_at) ? 'read' : 'sent'
    }
    return message
  })
}

export async function sendDirectMessage(conversationId: string, body: string, clientNonce: string, replyToMessageId?: string): Promise<DirectMessage> {
  const content=body.trim()
  if(!content)throw new Error('Write a message before sending.')

  const {data:{user},error:userError}=await supabase.auth.getUser()
  if(userError)throw userError
  if(!user)throw new Error('Sign in before sending a message.')

  const messageRow={
    id:clientNonce,
    conversation_id:conversationId,
    sender_id:user.id,
    content,
    message_status:'sent' as const,
    reply_to_message_id:replyToMessageId??null,
  }
  const inserted=await supabase
    .from(COMMUNITY_TABLES.messages)
    .insert(messageRow)
    .select('id,conversation_id,sender_id,content,message_status,created_at,edited_at,reply_to_message_id')
    .single()

  if(!inserted.error)return mapDirectMessage(inserted.data as DbCommunityMessage)

  // Retrying uses the same UUID. If the first request was committed but its
  // response was lost, return that message instead of creating a duplicate.
  if(inserted.error.code==='23505'){
    const existing=await supabase
      .from(COMMUNITY_TABLES.messages)
      .select('id,conversation_id,sender_id,content,message_status,created_at,edited_at,reply_to_message_id')
      .eq('id',clientNonce)
      .eq('conversation_id',conversationId)
      .eq('sender_id',user.id)
      .single()
    if(existing.error)throw existing.error
    return mapDirectMessage(existing.data as DbCommunityMessage)
  }

  throw inserted.error
}

export async function openDirectConversation(userId: string): Promise<string> {
  const targetUserId = userId.trim()
  if (!targetUserId) throw new Error('Choose a member before starting a conversation.')

  const { data, error } = await supabase.rpc('community_open_direct_conversation', {
    target_user_id: targetUserId,
  })

  if (error) throw error
  if (typeof data !== 'string' || !data) {
    throw new Error('The conversation could not be opened.')
  }

  return data
}
export async function openCommunityConversation(_communityId:string): Promise<string>{throw new CommunityBackendUnavailableError('Community group conversations')}
export async function markConversationRead(conversationId:string): Promise<void>{const{error}=await supabase.rpc('community_mark_conversation_read',{target_conversation_id:conversationId});if(error)throw error}
export async function updateCommunityMessage(messageId:string,body:string){const{error}=await supabase.from(COMMUNITY_TABLES.messages).update({content:body.trim(),edited_at:new Date().toISOString()}).eq('id',messageId);if(error)throw error}
export async function deleteCommunityMessage(messageId: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Sign in before withdrawing a message.')

  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.messages)
    .update({
      message_status: 'deleted',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('sender_id', user.id)
    .neq('message_status', 'deleted')
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('This message could not be withdrawn. It may already be deleted or you may not have permission.')
}

export async function hideCommunityMessageForCurrentUser(messageId: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Sign in before deleting a message.')
  const { error } = await supabase.from(COMMUNITY_TABLES.messageHiddenUsers).upsert(
    { message_id: messageId, user_id: user.id },
    { onConflict: 'message_id,user_id' },
  )
  if (error) throw error
}

export async function toggleCommunityMessageReaction(messageId: string, emoji: string, reacted: boolean): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Sign in before reacting to a message.')
  const removed = await supabase
    .from(COMMUNITY_TABLES.messageReactions)
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)
  if (removed.error) throw removed.error

  // Clicking the active reaction removes it. Choosing a different emoji first
  // removes the previous reaction, then stores the replacement.
  if (reacted) return
  const inserted = await supabase
    .from(COMMUNITY_TABLES.messageReactions)
    .insert({ message_id: messageId, user_id: user.id, emoji })
  if (inserted.error) throw inserted.error
}

export type CommunitySettingsSection = 'posts' | 'likes' | 'reposts' | 'bookmarks' | 'history' | 'deleted' | 'following' | 'friends'

export async function fetchManagedPosts(userId: string, section: 'posts' | 'likes' | 'reposts' | 'bookmarks' | 'history' | 'deleted') {
  if (section === 'posts' || section === 'deleted') {
    const { data, error } = await supabase
      .from(COMMUNITY_TABLES.posts)
      .select('id,title,content,moderation_status,post_kind,created_at')
      .eq('author_id', userId)
      [section==='deleted'?'eq':'neq']('moderation_status', 'removed')
      .order('created_at', { ascending: false })
    if (error) throw error
    const posts=(data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.content, status: row.moderation_status === 'visible' ? 'published' : row.moderation_status === 'removed' ? 'deleted' : 'hidden', topic: 'general_dentistry', post_type: row.post_kind === 'video' ? 'video' : row.post_kind === 'image' ? 'image' : 'text', created_at: row.created_at })) as CommunityManagedPost[]
    await hydrateManagedPostPreviews(posts)
    return posts
  }

  const table = section === 'likes' ? COMMUNITY_TABLES.postLikes : section==='reposts'?COMMUNITY_TABLES.postReposts:section==='bookmarks'?COMMUNITY_TABLES.postBookmarks:COMMUNITY_TABLES.postViews
  const orderColumn = section === 'history' ? 'viewed_at' : 'created_at'
  const { data: relations, error: relationError } = await supabase
    .from(table)
    .select('post_id')
    .eq('user_id', userId)
    .order(orderColumn, { ascending: false })
  if (relationError) throw relationError
  const ids = (relations ?? []).map((row) => row.post_id)
  if (ids.length === 0) return [] as CommunityManagedPost[]
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.posts)
    .select('id,title,content,moderation_status,post_kind,created_at')
    .in('id', ids)
  if (error) throw error
  const order = new Map(ids.map((id, index) => [id, index]))
  const posts=(data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.content, status: row.moderation_status === 'visible' ? 'published' : row.moderation_status === 'removed' ? 'deleted' : 'hidden', topic: 'general_dentistry', post_type: row.post_kind === 'video' ? 'video' : row.post_kind === 'image' ? 'image' : 'text', created_at: row.created_at } as CommunityManagedPost)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  await hydrateManagedPostPreviews(posts)
  return posts
}

async function fetchPeopleProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, CommunityPerson>()
  const { data, error } = await supabase
    .from('public_profiles')
    .select('user_id,full_name,name,avatar_url,is_verified')
    .in('user_id', userIds)
  if (error) throw error
  const verifiedProfiles = await addCommunityVerification((data ?? []) as CommunityPerson[])
  return new Map(verifiedProfiles.map((person) => [person.user_id, person]))
}

export async function fetchFollowingPeople(userId: string) {
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.follows)
    .select('following_id')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const ids = (data ?? []).map((row) => row.following_id)
  const profiles = await fetchPeopleProfiles(ids)
  const [incoming, closeFriends] = ids.length ? await Promise.all([
    supabase.from(COMMUNITY_TABLES.follows).select('follower_id').eq('following_id', userId).in('follower_id', ids),
    supabase.from(COMMUNITY_TABLES.closeFriends).select('close_friend_id').eq('owner_id', userId).in('close_friend_id', ids),
  ]) : [{ data: [], error: null }, { data: [], error: null }]
  if (incoming.error) throw incoming.error
  if (closeFriends.error) throw closeFriends.error
  const mutualIds = new Set((incoming.data ?? []).map(row => row.follower_id))
  const closeFriendIds = new Set((closeFriends.data ?? []).map(row => row.close_friend_id))
  return (data ?? []).flatMap((row) => {
    const profile = profiles.get(row.following_id)
    return profile ? [{ ...profile, relation_id: row.following_id, is_mutual: mutualIds.has(row.following_id), is_close_friend: closeFriendIds.has(row.following_id) }] : []
  })
}

export async function fetchCloseFriends(userId: string) {
  const following = await fetchFollowingPeople(userId)
  return following.filter(person => person.is_mutual && person.is_close_friend)
}

export async function setCloseFriend(userId: string, closeFriendId: string, active: boolean) {
  const request = active
    ? supabase.from(COMMUNITY_TABLES.closeFriends).insert({ owner_id: userId, close_friend_id: closeFriendId })
    : supabase.from(COMMUNITY_TABLES.closeFriends).delete().eq('owner_id', userId).eq('close_friend_id', closeFriendId)
  const { error } = await request
  if (error) throw error
}

export async function searchCommunityPeople(userId:string,search:string){
  const term=search.trim().replaceAll('%','').replaceAll('_','').replaceAll(',',' ')
  let request=supabase.from('public_profiles').select('user_id,full_name,name,username,avatar_url,is_verified').neq('user_id',userId).limit(20)
  if(term)request=request.or(`full_name.ilike.%${term}%,name.ilike.%${term}%,username.ilike.%${term}%`)
  const{data,error}=await request
  if(error)throw error
  const profiles=await addCommunityVerification(data??[])
  if(profiles.length===0)return []
  const profileIds=profiles.map(profile=>profile.user_id)
  const [follows,settings,requests]=await Promise.all([
    supabase.from(COMMUNITY_TABLES.follows).select('following_id').eq('follower_id',userId).in('following_id',profileIds),
    supabase.from(COMMUNITY_TABLES.userSettings).select('user_id,profile_visibility').in('user_id',profileIds),
    supabase.from(COMMUNITY_TABLES.friendships).select('addressee_id').eq('requester_id',userId).eq('friendship_status','pending').in('addressee_id',profileIds),
  ])
  if(follows.error)throw follows.error
  if(settings.error)throw settings.error
  if(requests.error)throw requests.error
  const followed=new Set((follows.data??[]).map(row=>row.following_id))
  const visibility=new Map((settings.data??[]).map(row=>[row.user_id,row.profile_visibility==='private'?'private':'public']))
  const pending=new Set((requests.data??[]).map(row=>row.addressee_id))
  return profiles.map(profile=>({...profile,profile_visibility:visibility.get(profile.user_id)??'public',viewer_is_following:followed.has(profile.user_id),viewer_request_pending:pending.has(profile.user_id)}))
}

export async function followCommunityPerson(userId:string,followingId:string){
  if(userId===followingId)throw new Error('You cannot follow your own profile.')
  const{data,error}=await supabase.rpc('community_follow_or_request',{target_user_id:followingId})
  if(error)throw error
  return data as 'following'|'request_pending'
}

export async function unfollowCommunityPerson(userId:string,followingId:string){
  const{error}=await supabase.from(COMMUNITY_TABLES.follows).delete().eq('follower_id',userId).eq('following_id',followingId)
  if(error)throw error
}

export type CommunityProfileAccess = {
  profile_visibility: 'public' | 'private'
  viewer_is_following: boolean
  viewer_request_pending: boolean
  can_view_details: boolean
  follower_count: number
  following_count: number
}

export async function fetchCommunityProfileAccess(targetUserId:string):Promise<CommunityProfileAccess>{
  const{data,error}=await supabase.rpc('community_get_profile_access',{target_user_id:targetUserId})
  if(error)throw error
  const row=Array.isArray(data)?data[0]:data
  if(!row)throw new Error('Community profile access could not be determined.')
  return row as CommunityProfileAccess
}

export async function fetchCommunityProfilePosts(viewerId:string|undefined,authorId:string){
  const posts=await fetchCommunityPosts(undefined,viewerId,'home','','all','newest',undefined,authorId)
  return posts.map(post=>({id:post.id,title:post.title,body:post.body,status:post.status,topic:post.topic,post_type:post.post_type,created_at:post.created_at,preview_media:post.media[0]??null} as CommunityManagedPost))
}

export type CommunityActivityVisibility = {
  likes_visibility: 'public' | 'private'
  reposts_visibility: 'public' | 'private'
}

export async function fetchCommunityActivityVisibility(targetUserId:string):Promise<CommunityActivityVisibility>{
  const{data,error}=await supabase.rpc('community_get_profile_activity_visibility',{target_user_id:targetUserId})
  if(error)throw error
  const row=Array.isArray(data)?data[0]:data
  return (row??{likes_visibility:'private',reposts_visibility:'private'}) as CommunityActivityVisibility
}

export async function fetchVisibleCommunityProfileActivity(targetUserId:string,section:'likes'|'reposts'){
  const{data,error}=await supabase.rpc('community_get_visible_profile_activity',{target_user_id:targetUserId,activity_type:section})
  if(error)throw error
  const posts=(data??[]).map((row:{id:string;title:string|null;content:string|null;moderation_status:string;post_kind:string;created_at:string})=>({
    id:row.id,
    title:row.title,
    body:row.content,
    status:row.moderation_status==='visible'?'published':row.moderation_status==='removed'?'deleted':'hidden',
    topic:'general_dentistry',
    post_type:row.post_kind==='video'?'video':row.post_kind==='image'?'image':'text',
    created_at:row.created_at,
  } as CommunityManagedPost))
  await hydrateManagedPostPreviews(posts)
  return posts
}

async function hydrateManagedPostPreviews(posts:CommunityManagedPost[]){
  if(!posts.length)return
  const ids=posts.map(post=>post.id)
  const{data,error}=await supabase.from(COMMUNITY_TABLES.postMedia).select('id,post_id,media_type,storage_bucket,storage_path,external_url,alt_text,sort_order').in('post_id',ids).order('sort_order')
  if(error)throw error
  const firstRows=new Map<string,(typeof data)[number]>()
  for(const row of data??[])if(!firstRows.has(row.post_id))firstRows.set(row.post_id,row)
  const stored=[...firstRows.values()].filter(row=>!row.external_url&&row.storage_bucket&&row.storage_path)
  const signedUrls=new Map<string,string>()
  const buckets=[...new Set(stored.map(row=>row.storage_bucket!))]
  for(const bucket of buckets){
    const rows=stored.filter(row=>row.storage_bucket===bucket)
    const signed=await supabase.storage.from(bucket).createSignedUrls(rows.map(row=>row.storage_path!),3600)
    if(signed.error)throw signed.error
    for(const item of signed.data??[])if(item.signedUrl)signedUrls.set(`${bucket}:${item.path}`,item.signedUrl)
  }
  for(const post of posts){
    const row=firstRows.get(post.id)
    if(!row)continue
    const url=row.external_url||(row.storage_bucket&&row.storage_path?signedUrls.get(`${row.storage_bucket}:${row.storage_path}`):undefined)
    if(url)post.preview_media={media_type:row.media_type as 'image'|'video',public_url:url,alt_text:row.alt_text}
  }
}

export async function fetchFriends(userId: string) {
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.friendships)
    .select('id,requester_id,addressee_id')
    .eq('friendship_status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
  if (error) throw error
  const rows = data ?? []
  const ids = rows.map((row) => row.requester_id === userId ? row.addressee_id : row.requester_id)
  const profiles = await fetchPeopleProfiles(ids)
  return rows.flatMap((row) => {
    const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id
    const profile = profiles.get(otherId)
    return profile ? [{ ...profile, relation_id: row.id }] : []
  })
}

export async function fetchFriendRequests(userId:string){const{data,error}=await supabase.from(COMMUNITY_TABLES.friendships).select('id,requester_id,addressee_id,created_at').eq('friendship_status','pending').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).order('created_at',{ascending:false});if(error)throw error;const rows=data??[],ids=rows.map(row=>row.requester_id===userId?row.addressee_id:row.requester_id),profiles=await fetchPeopleProfiles(ids);return rows.map(row=>{const otherId=row.requester_id===userId?row.addressee_id:row.requester_id;return{...profiles.get(otherId)!,relation_id:row.id,direction:row.requester_id===userId?'outgoing':'incoming'} as CommunityPerson&{direction:'incoming'|'outgoing'}}).filter(row=>row.user_id)}
export async function respondFriendRequest(id:string,decision:'accepted'|'rejected'){const{error}=await supabase.rpc('community_respond_friend_request',{target_friendship_id:id,decision:decision==='accepted'?'accept':'reject'});if(error)throw error}
export async function cancelFriendRequest(id:string){const{error}=await supabase.from(COMMUNITY_TABLES.friendships).delete().eq('id',id);if(error)throw error}

export async function removeCommunitySettingRelation(section: Exclude<CommunitySettingsSection, 'posts'>, id: string, userId: string) {
  const operation = section === 'likes'
    ? supabase.from(COMMUNITY_TABLES.postLikes).delete().eq('post_id', id).eq('user_id', userId)
    : section === 'reposts'
      ? supabase.from(COMMUNITY_TABLES.postReposts).delete().eq('post_id', id).eq('user_id', userId)
      : section === 'bookmarks'
        ? supabase.from(COMMUNITY_TABLES.postBookmarks).delete().eq('post_id',id).eq('user_id',userId)
      : section === 'history'
        ? supabase.from(COMMUNITY_TABLES.postViews).delete().eq('post_id',id).eq('user_id',userId)
      : section === 'following'
        ? supabase.from(COMMUNITY_TABLES.follows).delete().eq('following_id', id).eq('follower_id', userId)
        : supabase.from(COMMUNITY_TABLES.friendships).delete().eq('id', id)
  const { error } = await operation
  if (error) throw error
}

export async function restoreOwnCommunityPost(_id:string): Promise<void>{throw new CommunityBackendUnavailableError('Community post restoration')}
export type CommunityMessagePermission='everyone'|'following'|'friends'|'nobody'
export async function fetchCommunityPreferences(userId:string){const{data,error}=await supabase.from(COMMUNITY_TABLES.userSettings).select('allow_friend_requests,message_permission,show_likes_to_friends,show_reposts_to_friends,profile_visibility,likes_visibility,reposts_visibility,autoplay_videos').eq('user_id',userId).maybeSingle();if(error)throw error;const permission=data?.message_permission;return data?{allow_friend_requests:data.allow_friend_requests,message_permission:(permission==='followers'?'following':permission==='friends'||permission==='nobody'?permission:'everyone') as CommunityMessagePermission,show_friend_activity:data.show_likes_to_friends||data.show_reposts_to_friends,profile_visibility:(data.profile_visibility==='private'?'private':'public') as 'public'|'private',likes_visibility:(data.likes_visibility==='public'?'public':'private') as 'public'|'private',reposts_visibility:(data.reposts_visibility==='public'?'public':'private') as 'public'|'private',autoplay_videos:data.autoplay_videos}:{allow_friend_requests:true,message_permission:'everyone' as CommunityMessagePermission,show_friend_activity:true,profile_visibility:'public' as const,likes_visibility:'private' as const,reposts_visibility:'private' as const,autoplay_videos:true}}
export async function saveCommunityPreferences(userId:string,values:{allow_friend_requests:boolean;message_permission:CommunityMessagePermission;show_friend_activity:boolean;profile_visibility:'public'|'private';likes_visibility:'public'|'private';reposts_visibility:'public'|'private';autoplay_videos:boolean}){const databasePermission=values.message_permission==='following'?'followers':values.message_permission;const{error}=await supabase.from(COMMUNITY_TABLES.userSettings).upsert({user_id:userId,allow_friend_requests:values.allow_friend_requests,message_permission:databasePermission,show_likes_to_friends:values.show_friend_activity,show_reposts_to_friends:values.show_friend_activity,profile_visibility:values.profile_visibility,likes_visibility:values.likes_visibility,reposts_visibility:values.reposts_visibility,autoplay_videos:values.autoplay_videos});if(error)throw error}
