import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bookmark, FileText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCommunitySettings, useRemoveCommunitySettingRelation } from '@/features/community/hooks/useCommunity'
import type { CommunityManagedPost } from '@/features/community/types'
import { RetryCard } from '@/components/shared/RetryCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export function CommunitySavedPosts({ userId }: { userId: string }) {
  const query = useCommunitySettings(userId, 'bookmarks')
  const removeMutation = useRemoveCommunitySettingRelation(userId, 'bookmarks')
  const [postToRemove, setPostToRemove] = useState<CommunityManagedPost | null>(null)

  const removePost = async () => {
    if (!postToRemove) return
    try {
      await removeMutation.mutateAsync(postToRemove.id)
      setPostToRemove(null)
      toast.success('Post removed from saved posts.')
    } catch {
      toast.error('Could not remove this saved post. Try again.')
    }
  }

  if (query.isLoading) return <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  if (query.isError) return <RetryCard onRetry={() => void query.refetch()} />

  const posts = (query.data ?? []) as CommunityManagedPost[]

  return (
    <>
      {posts.length === 0 ? (
        <EmptyState icon={<Bookmark />} title="No saved posts" description="Save Community posts to find them here later." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {posts.map((post) => (
            <article key={post.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <Link
                to="/community/post/$postId"
                params={{ postId: post.id }}
                aria-label={`Open ${post.title || 'post'}`}
                className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {post.preview_media?.media_type === 'image' ? (
                  <img src={post.preview_media.public_url} alt={post.preview_media.alt_text || ''} loading="lazy" decoding="async" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]" />
                ) : post.preview_media?.media_type === 'video' ? (
                  <video src={post.preview_media.public_url} muted playsInline preload="metadata" aria-label={post.preview_media.alt_text || 'Video post preview'} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]" />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted px-5 text-center text-muted-foreground">
                    <FileText className="size-8" />
                    <span className="line-clamp-3 text-sm font-medium text-foreground">{post.title || post.body || 'Text post'}</span>
                  </span>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/55 via-black/10 to-transparent p-3 pt-12 text-white">
                  <span className="line-clamp-1 min-w-0 text-xs font-medium">{post.title || 'Untitled post'}</span>
                  {post.preview_media?.media_type === 'video' && <span className="shrink-0 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium">Video</span>}
                </span>
              </Link>
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                aria-label={`Remove ${post.title || 'post'} from saved posts`}
                className="absolute right-2 top-2 z-10 cursor-pointer bg-card/90 text-destructive shadow-sm backdrop-blur hover:bg-card hover:text-destructive"
                onClick={() => setPostToRemove(post)}
              >
                <Trash2 className="size-4" />
              </Button>
            </article>
          ))}
        </div>
      )}

      <Dialog open={Boolean(postToRemove)} onOpenChange={(open) => { if (!open && !removeMutation.isPending) setPostToRemove(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove saved post?</DialogTitle>
            <DialogDescription>Remove {postToRemove?.title || 'this post'} from your saved posts?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={removeMutation.isPending} />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={removeMutation.isPending} onClick={() => void removePost()}>{removeMutation.isPending ? 'Removing…' : 'Remove'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
