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

export async function fetchCommunityPosts(cursor: CommunityFeedCursor | undefined, userId?: string, mode: CommunityFeedMode = 'home', search = '', topic = 'all', sort: 'relevant'|'newest'|'popular' = 'relevant', communityId?: string): Promise<CommunityPostPage> {
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
    const topicRow = await supabase.from(COMMUNITY_TABLES.topics).select('id').eq('slug', topic.replaceAll('_', '-')).maybeSingle()
    if (topicRow.error) throw topicRow.error
    if (!topicRow.data) return []
    const links = await supabase.from(COMMUNITY_TABLES.postTopics).select('post_id').eq('topic_id', topicRow.data.id)
    if (links.error) throw links.error
    topicPostIds = (links.data ?? []).map((row) => row.post_id)
    if (!topicPostIds.length) return []
  }

  let query = supabase
    .from(COMMUNITY_TABLES.posts)
    .select(`id,author_id,community_id,post_kind,title,content,moderation_status,published_at,created_at,profiles!community_posts_author_id_fkey(user_id,full_name,name,avatar_url,is_verified),communities(name,slug)`)
    .eq('moderation_status', 'visible')
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)

  if (cursor) query = query.lt('published_at', cursor.publishedAt)
  if (mode === 'video') query = query.eq('post_kind', 'video')
  if (communityId) query = query.eq('community_id', communityId)
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

  const verifiedProfiles = await addCommunityVerification(posts.flatMap((post) => post.profiles ? [post.profiles] : []))
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
    if (post.profiles) post.profiles = profiles.get(post.profiles.user_id) ?? post.profiles
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
    const topic = await supabase.from(COMMUNITY_TABLES.topics).select('id').eq('slug', input.topic.replaceAll('_', '-')).maybeSingle()
    if (topic.error) throw topic.error
    if (topic.data) {
      const link = await supabase.from(COMMUNITY_TABLES.postTopics).insert({ post_id: postId, topic_id: topic.data.id, assigned_by: input.authorId })
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

export async function updateCommunityPost(input:{id:string;authorId:string;title:string;body:string;topic:CommunityPostTopic}): Promise<void>{
  const update=await supabase.from(COMMUNITY_TABLES.posts).update({title:input.title.trim()||null,content:input.body.trim(),edited_at:new Date().toISOString()}).eq('id',input.id).eq('author_id',input.authorId)
  if(update.error)throw update.error
  const topic=await supabase.from(COMMUNITY_TABLES.topics).select('id').eq('slug',input.topic.replaceAll('_','-')).eq('is_active',true).maybeSingle()
  if(topic.error)throw topic.error
  // Older posts can have no matching topic row. Their text must still remain
  // editable; only synchronize the topic link when the selected topic exists.
  if(!topic.data)return
  const removeTopic=await supabase.from(COMMUNITY_TABLES.postTopics).delete().eq('post_id',input.id).eq('assignment_source','author')
  if(removeTopic.error)throw removeTopic.error
  const addTopic=await supabase.from(COMMUNITY_TABLES.postTopics).insert({post_id:input.id,topic_id:topic.data.id,assignment_source:'author',assigned_by:input.authorId})
  if(addTopic.error)throw addTopic.error
}
export async function softDeleteCommunityPost(id:string,authorId:string): Promise<void>{const{error}=await supabase.from(COMMUNITY_TABLES.posts).update({moderation_status:'removed',edited_at:new Date().toISOString()}).eq('id',id).eq('author_id',authorId);if(error)throw error}
// Sharing is performed by the Clipboard API. There is no share-event table or
// RPC in the current production contract, so missing analytics must not block it.
export async function recordCommunityPostShare(_id:string): Promise<void>{}
export async function setCommunityPostNotInterested(postId:string,userId:string){const{error}=await supabase.from(COMMUNITY_TABLES.userHiddenContent).upsert({post_id:postId,user_id:userId,hide_reason:'not_interested'});if(error)throw error}
export async function recordCommunityPostView(_postId:string,_watchSeconds=0,_progress=0): Promise<void>{throw new CommunityBackendUnavailableError('Community post view tracking')}

export async function fetchCommunityPost(postId:string,userId?:string){
  const{data,error}=await supabase.from(COMMUNITY_TABLES.posts).select(`id,author_id,community_id,post_kind,title,content,moderation_status,published_at,created_at,profiles!community_posts_author_id_fkey(user_id,full_name,name,avatar_url,is_verified),communities(name,slug)`).eq('id',postId).single()
  if(error)throw error
  const post = mapCommunityPost(data as unknown as DbCommunityPost)
  await hydrateCommunityPosts([post], userId)
  return post
}

export const COMMENT_PAGE_SIZE = 6

export async function fetchCommunityComments(postId: string, userId?: string, page = 0, search = '') {
  let request = supabase
    .from(COMMUNITY_TABLES.comments)
    .select('id,post_id,author_id,parent_comment_id,content,moderation_status,moderation_reason,created_at,updated_at')
    .eq('post_id', postId)
    .neq('moderation_status', 'removed')
    .order('created_at', { ascending: false })
    .limit(200)
  if (search.trim()) request = request.ilike('content', `%${search.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
  const { data, error } = await request
  if (error) throw error

  let comments = (data ?? []).map((row) => mapCommunityComment(row as DbCommunityComment))

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
    .slice(page*COMMENT_PAGE_SIZE,(page+1)*COMMENT_PAGE_SIZE)

  const authorIds = [...new Set(comments.map((comment) => comment.author_id).filter(Boolean))]
  const profiles = new Map<string, CommunityComment['profiles']>()
  if (authorIds.length > 0) {
    const result = await supabase.from('public_profiles').select('user_id,full_name,name,username,avatar_url,is_verified').in('user_id', authorIds)
    if (result.error) throw result.error
    const verifiedProfiles = await addCommunityVerification(result.data ?? [])
    for (const profile of verifiedProfiles) profiles.set(profile.user_id, profile)
  }

  let liked = new Set<string>()
  if (userId && comments.length > 0) {
    const result = await supabase.from(COMMUNITY_TABLES.commentLikes).select('comment_id').eq('user_id', userId).in('comment_id', comments.map((comment) => comment.id))
    if (result.error) throw result.error
    liked = new Set((result.data ?? []).map((row) => row.comment_id))
  }
  return comments.map((comment) => ({ ...comment, profiles: profiles.get(comment.author_id) ?? null, viewer_has_liked: liked.has(comment.id) }))
}

export async function checkCommunityCommentSafety(body: string): Promise<'safe' | 'warn' | 'review' | 'block'> {
  const value=body.trim()
  if(!value)throw new Error('Write something before publishing your comment.')
  if(value.length>5000)throw new Error('Comments must be 5,000 characters or fewer.')
  return 'safe'
}

export async function createCommunityComment(input: { postId: string; authorId: string; body: string; parentCommentId?: string | null; files?: File[] }) {
  if (input.files?.length) throw new CommunityBackendUnavailableError('Comment attachments')
  const commentId=crypto.randomUUID()
  const { error } = await supabase.from(COMMUNITY_TABLES.comments).insert({
    id:commentId,
    post_id: input.postId,
    author_id: input.authorId,
    content: input.body.trim(),
    parent_comment_id: input.parentCommentId ?? null,
    moderation_status: 'visible',
    moderation_reason:null,
  })
  if (error) throw error
  return { id:commentId, status:'visible' as CommunityComment['status'] }
}

export async function updateCommunityComment(commentId: string, authorId: string, body: string) {
  const { error } = await supabase.from(COMMUNITY_TABLES.comments).update({ content: body.trim(), edited_at: new Date().toISOString() }).eq('id', commentId).eq('author_id', authorId)
  if (error) throw error
}

export async function deleteCommunityComment(commentId: string, authorId: string) {
  const{error}=await supabase.from(COMMUNITY_TABLES.comments).update({moderation_status:'removed',edited_at:new Date().toISOString()}).eq('id',commentId).eq('author_id',authorId)
  if(error)throw error
}

export async function setCommunityCommentFeature(commentId: string, feature: 'pinned' | 'best_answer', enabled: boolean) {
  void commentId
  void feature
  void enabled
  throw new CommunityBackendUnavailableError('Community comment curation')
}

export async function setCommunityUserBlock(blockedUserId: string, userId: string, active: boolean) {
  const query = supabase.from(COMMUNITY_TABLES.userBlocks)
  const { error } = active ? await query.insert({ blocker_id: userId, blocked_user_id: blockedUserId }) : await query.delete().eq('blocker_id', userId).eq('blocked_user_id', blockedUserId)
  if (error) throw error
}

export async function fetchCommunityMentionUsers(query: string) {
  if (query.length < 1) return []
  const { data, error } = await supabase.from('public_profiles').select('user_id,username,full_name,name,avatar_url').ilike('username', `${query.replaceAll('%', '')}%`).not('username', 'is', null).limit(6)
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
      .select('id,owner_id,name,slug,description,visibility,moderation_status,avatar_url,created_at')
      .or(`moderation_status.eq.active,owner_id.eq.${userId}`)
      .order('created_at', { ascending: false }),
    supabase
      .from(COMMUNITY_TABLES.members)
      .select('community_id,membership_status')
      .eq('user_id', userId)
      .eq('membership_status', 'active'),
    supabase.from(COMMUNITY_TABLES.members).select('community_id').eq('membership_status', 'active'),
  ])
  if (communitiesResult.error) throw communitiesResult.error
  if (membershipsResult.error) throw membershipsResult.error
  if (memberCountsResult.error) throw memberCountsResult.error

  const memberships = new Set((membershipsResult.data ?? []).map((membership) => membership.community_id))
  const memberCounts = (memberCountsResult.data ?? []).reduce((counts, row) => counts.set(row.community_id, (counts.get(row.community_id) ?? 0) + 1), new Map<string, number>())
  const isLocalSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(import.meta.env.VITE_SUPABASE_URL ?? '')
  const localAnnouncements = new Map<string, string|null>()
  const localRules = new Map<string, CommunitySummary['rules']>()
  if (isLocalSupabase) {
    const [announcements, rules] = await Promise.all([
      supabase.from(COMMUNITY_TABLES.communities).select('id,announcement'),
      supabase.from('community_rules').select('id,community_id,title,description,position').order('position'),
    ])
    if (!announcements.error) for (const row of announcements.data ?? []) localAnnouncements.set(row.id, row.announcement)
    if (!rules.error) for (const row of rules.data ?? []) localRules.set(row.community_id, [...(localRules.get(row.community_id) ?? []), { id: row.id, title: row.title, description: row.description, position: row.position }])
  }

  return (communitiesResult.data ?? []).map((row) => {
    const community = mapCommunity(row as DbCommunity, memberCounts.get(row.id) ?? 0)
    community.announcement = localAnnouncements.get(row.id) ?? null
    community.rules = localRules.get(row.id) ?? []
    community.viewer_is_member = memberships.has(row.id) || row.owner_id === userId
    community.viewer_membership_role = row.owner_id === userId ? 'owner' : memberships.has(row.id) ? 'member' : null
    return community
  }).sort((a, b) => b.member_count - a.member_count)
}

export async function joinPublicCommunity(communityId: string, userId: string) {
  const { data: existing, error: readError } = await supabase
    .from(COMMUNITY_TABLES.members)
    .select('community_id,membership_status')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw readError

  if (existing?.membership_status === 'active') return
  if (existing) throw new CommunityBackendUnavailableError('Community rejoining')
  const { error } = await supabase.from(COMMUNITY_TABLES.members).insert({
    community_id: communityId,
    user_id: userId,
    membership_status: 'active',
  })
  if (error) throw error
}

export async function createCommunity(input: { ownerId: string; name: string; description: string; visibility: 'public' | 'private' }) {
  const base = input.name.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54) || 'community'
  const { data, error } = await supabase.from(COMMUNITY_TABLES.communities).insert({ owner_id: input.ownerId, name: input.name.trim(), slug: `${base}-${crypto.randomUUID().slice(0, 6)}`, description: input.description.trim() || null, visibility: input.visibility, moderation_status: 'pending' }).select('id').single()
  if (error) throw error
  return data
}

export async function leaveCommunity(communityId: string, _userId: string) {
  const { error } = await supabase.rpc('community_leave', { target_community_id: communityId })
  if (error) throw error
}

export async function fetchCommunityManagement(communityId: string) {
  const [members, requests] = await Promise.all([
    supabase.from(COMMUNITY_TABLES.members).select('community_id,user_id,membership_status,joined_at').eq('community_id', communityId).eq('membership_status', 'active').order('joined_at'),
    supabase.from(COMMUNITY_TABLES.joinRequests).select('id,requester_id,request_message,request_status,created_at').eq('community_id', communityId).eq('request_status', 'pending').order('created_at'),
  ])
  if (members.error) throw members.error
  if (requests.error) throw requests.error
  const ids = [...new Set([...(members.data ?? []).map(row => row.user_id), ...(requests.data ?? []).map(row => row.requester_id)])]
  const profiles = ids.length ? await supabase.from('public_profiles').select('user_id,full_name,name,avatar_url').in('user_id', ids) : { data: [], error: null }
  if (profiles.error) throw profiles.error
  const names = new Map((profiles.data ?? []).map(profile => [profile.user_id, profile]))
  return {
    members: (members.data ?? []).map(row => ({ ...row, id: `${row.community_id}:${row.user_id}`, membership_role: 'member', status: row.membership_status, muted_until: null, mute_reason: null, profile: names.get(row.user_id) ?? null })),
    requests: (requests.data ?? []).map(row => ({ ...row, message: row.request_message, status: row.request_status, profile: names.get(row.requester_id) ?? null })),
    announcement: null as string|null,
    rules: [],
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
  const { error } = await supabase.rpc('community_decide_join_request', {
    target_request_id: requestId,
    decision: decision === 'approved' ? 'approve' : 'reject',
  })
  if (error) throw error
}

export async function removeCommunityMember(_memberId: string) {
  throw new CommunityBackendUnavailableError('Community member removal')
}

export async function saveCommunityAnnouncement(_communityId:string,_announcement:string){throw new CommunityBackendUnavailableError('Community announcements')}
export async function addCommunityRule(_communityId:string,_title:string,_description:string,_position:number){throw new CommunityBackendUnavailableError('Community rules')}
export async function updateCommunityRule(_ruleId:string,_title:string,_description:string){throw new CommunityBackendUnavailableError('Community rules')}
export async function moveCommunityRule(_ruleId:string,_direction:'up'|'down'){throw new CommunityBackendUnavailableError('Community rule ordering')}
export async function deleteCommunityRule(_ruleId:string){throw new CommunityBackendUnavailableError('Community rules')}
export async function setCommunityMemberMute(_memberId:string,_until:string|null,_reason:string|null){throw new CommunityBackendUnavailableError('Community member mute controls')}

export async function requestPrivateCommunityJoin(_slug: string, _message: string): Promise<void> {
  throw new CommunityBackendUnavailableError('Private Community join requests')
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
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.messages)
    .select('id,conversation_id,sender_id,content,message_status,created_at,edited_at')
    .eq('conversation_id', conversationId)
    .neq('message_status', 'deleted')
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((row) => mapDirectMessage(row as DbCommunityMessage))
}

export async function sendDirectMessage(_conversationId: string, _body: string, _clientNonce: string): Promise<DirectMessage> {
  throw new CommunityBackendUnavailableError('Community direct-message sending')
}

export async function openDirectConversation(_userId:string): Promise<string>{throw new CommunityBackendUnavailableError('Community direct conversations')}
export async function openCommunityConversation(_communityId:string): Promise<string>{throw new CommunityBackendUnavailableError('Community group conversations')}
export async function markConversationRead(conversationId:string): Promise<void>{const{error}=await supabase.rpc('community_mark_conversation_read',{target_conversation_id:conversationId});if(error)throw error}
export async function updateCommunityMessage(messageId:string,body:string){const{error}=await supabase.from(COMMUNITY_TABLES.messages).update({content:body.trim(),edited_at:new Date().toISOString()}).eq('id',messageId);if(error)throw error}
export async function deleteCommunityMessage(_messageId:string):Promise<void>{throw new CommunityBackendUnavailableError('Community message deletion')}

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
    return (data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.content, status: row.moderation_status === 'visible' ? 'published' : row.moderation_status === 'removed' ? 'deleted' : 'hidden', topic: 'general_dentistry', post_type: row.post_kind === 'video' ? 'video' : row.post_kind === 'image' ? 'image' : 'text', created_at: row.created_at })) as CommunityManagedPost[]
  }

  const table = section === 'likes' ? COMMUNITY_TABLES.postLikes : section==='reposts'?COMMUNITY_TABLES.postReposts:section==='bookmarks'?COMMUNITY_TABLES.postBookmarks:COMMUNITY_TABLES.videoInteractions
  const { data: relations, error: relationError } = await supabase
    .from(table)
    .select('post_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (relationError) throw relationError
  const ids = (relations ?? []).map((row) => row.post_id)
  if (ids.length === 0) return [] as CommunityManagedPost[]
  const { data, error } = await supabase
    .from(COMMUNITY_TABLES.posts)
    .select('id,title,content,moderation_status,post_kind,created_at')
    .in('id', ids)
  if (error) throw error
  const order = new Map(ids.map((id, index) => [id, index]))
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.content, status: row.moderation_status === 'visible' ? 'published' : row.moderation_status === 'removed' ? 'deleted' : 'hidden', topic: 'general_dentistry', post_type: row.post_kind === 'video' ? 'video' : row.post_kind === 'image' ? 'image' : 'text', created_at: row.created_at } as CommunityManagedPost)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
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
  const profiles = await fetchPeopleProfiles((data ?? []).map((row) => row.following_id))
  return (data ?? []).flatMap((row) => {
    const profile = profiles.get(row.following_id)
    return profile ? [{ ...profile, relation_id: row.following_id }] : []
  })
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
        ? supabase.from(COMMUNITY_TABLES.videoInteractions).delete().eq('post_id',id).eq('user_id',userId)
      : section === 'following'
        ? supabase.from(COMMUNITY_TABLES.follows).delete().eq('following_id', id).eq('follower_id', userId)
        : supabase.from(COMMUNITY_TABLES.friendships).delete().eq('id', id)
  const { error } = await operation
  if (error) throw error
}

export async function restoreOwnCommunityPost(_id:string): Promise<void>{throw new CommunityBackendUnavailableError('Community post restoration')}
export async function fetchCommunityPreferences(userId:string){const{data,error}=await supabase.from(COMMUNITY_TABLES.userSettings).select('allow_friend_requests,message_permission,show_likes_to_friends,show_reposts_to_friends,autoplay_videos').eq('user_id',userId).maybeSingle();if(error)throw error;return data?{allow_friend_requests:data.allow_friend_requests,allow_direct_messages:data.message_permission!=='nobody',show_friend_activity:data.show_likes_to_friends||data.show_reposts_to_friends,autoplay_videos:data.autoplay_videos}:{allow_friend_requests:true,allow_direct_messages:true,show_friend_activity:true,autoplay_videos:true}}
export async function saveCommunityPreferences(userId:string,values:{allow_friend_requests:boolean;allow_direct_messages:boolean;show_friend_activity:boolean;autoplay_videos:boolean}){const{error}=await supabase.from(COMMUNITY_TABLES.userSettings).upsert({user_id:userId,allow_friend_requests:values.allow_friend_requests,message_permission:values.allow_direct_messages?'friends':'nobody',show_likes_to_friends:values.show_friend_activity,show_reposts_to_friends:values.show_friend_activity,autoplay_videos:values.autoplay_videos});if(error)throw error}
