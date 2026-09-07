import { useState } from 'react'
import { FilePenLine, FileText, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { CreateCommunityPostDialog } from '@/features/community/components/CreateCommunityPostDialog'
import { useCommunityDrafts, useDeleteCommunityDraft } from '@/features/community/hooks/useCommunity'
import type { CommunityPostDraft } from '@/features/community/api/communityDraftApi'

export function CommunityDrafts({ userId }: { userId: string }) {
  const query = useCommunityDrafts(userId)
  const removeDraft = useDeleteCommunityDraft(userId)
  const [pendingDelete, setPendingDelete] = useState<CommunityPostDraft | null>(null)

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await removeDraft.mutateAsync(pendingDelete.id)
      setPendingDelete(null)
      toast.success('Draft deleted.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The draft could not be deleted.')
    }
  }

  if (query.isLoading) return <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  if (query.isError) return <div className="mt-6"><RetryCard onRetry={() => void query.refetch()} /></div>
  const drafts = query.data ?? []
  if (drafts.length === 0) return <div className="mt-6"><EmptyState icon={<FilePenLine />} title="No drafts yet" description="Posts saved to your account will appear here on every device." /></div>

  return <>
    <div className="mt-5 space-y-3">
      {drafts.map(draft => <article key={draft.id} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2"><Badge variant="secondary"><FileText className="mr-1 size-3"/>Draft</Badge>{draft.topic&&<Badge variant="outline">{draft.topic.replaceAll('_', ' ')}</Badge>}<span className="text-xs text-muted-foreground">{draft.community_id ? `Community ${draft.community_id.slice(0, 8)}` : 'General feed'}</span></div>
            <h3 className="truncate font-semibold">{draft.title.trim() || 'Untitled draft'}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{draft.content.trim() || 'This draft does not have any content yet.'}</p>
            {draft.tags.length > 0 && <p className="mt-2 truncate text-xs text-primary">{draft.tags.map(tag => `#${tag}`).join(' ')}</p>}
            <time className="mt-3 block text-xs text-muted-foreground">Saved {new Date(draft.updated_at).toLocaleString()}</time>
          </div>
          <div className="flex shrink-0 gap-2">
            <CreateCommunityPostDialog userId={userId} communityId={draft.community_id ?? undefined} draft={draft} trigger={<Button type="button" size="sm" variant="outline"><Pencil/>Edit</Button>} />
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(draft)}><Trash2/>Delete</Button>
          </div>
        </div>
      </article>)}
    </div>

    <Dialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open && !removeDraft.isPending) setPendingDelete(null) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Delete this draft?</DialogTitle><DialogDescription>{pendingDelete?.title.trim() || 'This untitled draft'} will be removed from your account and all of your devices. This action cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter><DialogClose render={<Button variant="outline" disabled={removeDraft.isPending} />}>Cancel</DialogClose><Button variant="destructive" disabled={removeDraft.isPending} onClick={() => void confirmDelete()}>{removeDraft.isPending ? 'Deleting…' : <><Trash2/>Delete draft</>}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
