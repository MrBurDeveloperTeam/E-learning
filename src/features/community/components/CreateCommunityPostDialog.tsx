import { useEffect, useRef, useState, type ReactElement } from 'react'
import { FileText, ImagePlus, Loader2, Paperclip, Save, Send, Sparkles, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateCommunityPost, useDeleteCommunityDraft, useSaveCommunityDraft } from '@/features/community/hooks/useCommunity'
import type { CommunityUploadProgress } from '@/features/community/api/communityApi'
import type { CommunityPostTopic } from '@/features/community/types'
import { downloadCommunityDraftMedia, type CommunityDraftMedia, type CommunityPostDraft } from '@/features/community/api/communityDraftApi'

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
const maxFileSize = 25 * 1024 * 1024
const maxFiles = 20
const formatSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
const normalizeTags = (value: string) => [...new Set(value.split(/[;,\s]+/).map(tag => tag.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 8)

export function CreateCommunityPostDialog({ userId, communityId, communityName, draft, trigger }: { userId: string; communityId?: string; communityName?: string; draft?: CommunityPostDraft; trigger?: ReactElement }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [topic, setTopic] = useState<CommunityPostTopic>('general_dentistry')
  const [tags, setTags] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [persistedMedia, setPersistedMedia] = useState<CommunityDraftMedia[]>([])
  const [preparingDraftMedia, setPreparingDraftMedia] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<CommunityUploadProgress | null>(null)
  const [draftId, setDraftId] = useState(draft?.id)
  const createPost = useCreateCommunityPost()
  const saveDraft = useSaveCommunityDraft(userId)
  const deleteDraft = useDeleteCommunityDraft(userId)

  useEffect(() => {
    if (!open || !draft) return
    setDraftId(draft.id)
    setTitle(draft.title)
    setBody(draft.content)
    setTags(draft.tags.join(', '))
    setTopic(draft.topic ?? 'general_dentistry')
    setPersistedMedia(draft.media ?? [])
    setFiles([])
    setError(null)
  }, [draft?.id, open])

  useEffect(() => {
    if (!open || !draftId) return
    const timer = window.setTimeout(() => {
      void saveDraft.mutateAsync({ id: draftId, communityId: communityId ?? draft?.community_id ?? undefined, title, body, tags: normalizeTags(tags), topic }).catch(() => undefined)
    }, 700)
    return()=>window.clearTimeout(timer)
  },[body,communityId,draft?.community_id,draftId,open,tags,title,topic])

  const chooseFiles = (incoming: File[]) => {
    const combined = [...files, ...incoming]
    if (persistedMedia.length + combined.length > maxFiles) { setError(`You can attach up to ${maxFiles} files.`); return }
    const invalid = incoming.find(file => !acceptedTypes.has(file.type) || file.size === 0 || file.size > maxFileSize)
    if (invalid) { setError(!acceptedTypes.has(invalid.type) ? `${invalid.name} is not a supported image or video.` : invalid.size === 0 ? `${invalid.name} is empty.` : `${invalid.name} is larger than 25 MB.`); return }
    const unique = combined.filter((file, index, all) => all.findIndex(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index)
    setFiles(unique);setError(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();setError(null)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const isDraft = submitter?.value === 'draft'
    if (isDraft) {
      try {
        const saved = await saveDraft.mutateAsync({ id: draftId, communityId: communityId ?? draft?.community_id ?? undefined, title, body, tags: normalizeTags(tags), topic, files, retainedMediaIds: persistedMedia.map(media => media.id) })
        setPersistedMedia(saved.media)
        setFiles([])
        setDraftId(draft ? saved.id : undefined)
        setOpen(false)
        if (!draft) { setTitle('');setBody('');setTags('');setFiles([]);setTopic('general_dentistry') }
        toast.success('Draft saved to your account.')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The draft could not be saved.')
      }
      return
    }
    if (!title.trim()) { setError('Add a title before publishing.');return }
    if (!tags.trim()) { setError('Add at least one tag before publishing.');return }
    if (!body.trim()) { setError('Write your post before publishing.');return }
    if (!files.length && !persistedMedia.length) { setError('Attach at least one image or video before publishing.');return }
    const controller = new AbortController();abortRef.current=controller
    try {
      setPreparingDraftMedia(true)
      const restoredFiles = persistedMedia.length ? await downloadCommunityDraftMedia(persistedMedia) : []
      const normalizedTags = normalizeTags(tags).map(tag=>`#${tag.replace(/[^a-z0-9_]/g,'')}`).filter(tag=>tag.length>1)
      const taggedBody = normalizedTags.length ? `${body.trim()}\n\n${normalizedTags.join(' ')}` : body
      await createPost.mutateAsync({authorId:userId,communityId,title,body:taggedBody,topic,files:[...restoredFiles, ...files],draft:false,signal:controller.signal,onProgress:setProgress})
      if (draftId) {
        try { await deleteDraft.mutateAsync(draftId) }
        catch { toast.warning('Post published, but its draft could not be removed. You can delete it from Drafts.') }
      }
      setDraftId(undefined);setTitle('');setBody('');setTags('');setFiles([]);setPersistedMedia([]);setTopic('general_dentistry');setProgress(null);setOpen(false)
      toast.success('Published successfully. Your post is now visible.')
    } catch (cause) {
      setError(cause instanceof DOMException&&cause.name==='AbortError'?'Upload cancelled. Your text and selected files are still here so you can retry.':cause instanceof Error?cause.message:'The post could not be submitted. Your files were kept for retry.')
      setProgress(null)
    } finally { abortRef.current=null;setPreparingDraftMedia(false) }
  }

  const progressPercent = progress?.total ? Math.round(progress.completed / progress.total * 100) : 0

  const busy = createPost.isPending || saveDraft.isPending || preparingDraftMedia

  return <Dialog open={open} onOpenChange={next=>{if(!busy)setOpen(next)}}>
    {trigger ? <DialogTrigger render={trigger} /> : <DialogTrigger render={<Button size="lg" />}><FileText />Create post</DialogTrigger>}
    <DialogContent overlayClassName="z-[120]" showCloseButton={!busy} className="z-[121] h-[calc(100dvh-1rem)] max-h-[860px] max-w-[calc(100vw-1rem)] overflow-hidden p-0 sm:h-[calc(100dvh-2rem)] sm:max-w-3xl">
      <form noValidate onSubmit={submit} className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-4 py-3 pr-12 sm:px-6 sm:py-5 sm:pr-14">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-5"/></span><div><DialogTitle className="text-xl">Create a community post</DialogTitle><DialogDescription className="mt-1">{communityName ? `Share with ${communityName}. ` : ''}Drafts may be empty. Publishing requires every section.</DialogDescription></div></div>
        </DialogHeader>

        <div className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(240px,.85fr)]">
            <section className="space-y-5">
              <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="community-post-title">Title</Label><span className="text-[11px] text-muted-foreground">{title.length}/200</span></div><Input id="community-post-title" value={title} maxLength={200} className="h-11 text-base" onChange={event=>{setTitle(event.target.value);setError(null)}} placeholder="What would you like to discuss?" /></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="community-post-body">Post</Label><span className="text-[11px] text-muted-foreground">{body.length}/20,000</span></div><Textarea id="community-post-body" value={body} maxLength={20000} aria-invalid={Boolean(error)} className="min-h-40 resize-none text-base leading-7 sm:min-h-52 lg:min-h-64" onChange={event=>{setBody(event.target.value);setError(null)}} placeholder="Share your question, clinical insight, workflow, or useful resource…"/><p className="text-xs text-muted-foreground">Protect patient privacy and remove identifying information.</p></div>
              <div className="space-y-2"><Label htmlFor="community-post-tags">Tags <span className="font-normal text-muted-foreground">· up to 8</span></Label><Input id="community-post-tags" value={tags} onChange={event=>{setTags(event.target.value);setError(null)}} placeholder="implant, workflow, clinical_case" /><p className="text-xs text-muted-foreground">Separate tags with spaces or commas.</p></div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-2xl border bg-muted/25 p-4"><Label>Topic</Label><Select value={topic} onValueChange={value=>setTopic(value as CommunityPostTopic)}><SelectTrigger className="mt-2 w-full bg-background"><SelectValue /></SelectTrigger><SelectContent>{['general_dentistry','implantology','orthodontics','endodontics','periodontology','oral_surgery','prosthodontics','pediatric_dentistry','digital_dentistry','practice_management'].map(value=><SelectItem key={value} value={value}>{value.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>
              <div><div className="mb-2 flex items-center gap-2"><ImagePlus className="size-4 text-primary"/><Label>Media</Label><span className="ml-auto text-[11px] text-muted-foreground">{persistedMedia.length + files.length}/{maxFiles}</span></div><div role="button" tabIndex={busy?-1:0} aria-label="Add images or videos" className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all sm:min-h-40 sm:p-5 ${dragging?'scale-[1.01] border-primary bg-primary/10':'border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5'}`} onClick={()=>!busy&&inputRef.current?.click()} onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&!busy)inputRef.current?.click()}} onDragOver={event=>{event.preventDefault();if(!busy)setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);if(!busy)chooseFiles([...event.dataTransfer.files])}}><span className="grid size-11 place-items-center rounded-full bg-primary/10"><UploadCloud className="size-5 text-primary"/></span><span className="mt-3 text-sm font-semibold">Add photos or videos</span><span className="mt-1 text-xs leading-5 text-muted-foreground">Drop files or browse<br/>25 MB each · up to {maxFiles}</span><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={event=>{chooseFiles([...(event.target.files??[])]);event.target.value=''}} /></div></div>
              {persistedMedia.length>0&&<div className="max-h-44 space-y-2 overflow-y-auto pr-1" aria-live="polite">{persistedMedia.map(media=><div key={media.id} className="flex items-center gap-2 rounded-xl border bg-primary/5 px-3 py-2 text-sm"><Save className="size-4 shrink-0 text-primary"/><span className="min-w-0 flex-1 truncate font-medium">{media.file_name}</span><span className="text-[11px] tabular-nums text-muted-foreground">Saved · {formatSize(media.file_size_bytes)}</span><Button type="button" size="icon-sm" variant="ghost" disabled={busy} aria-label={`Remove ${media.file_name}`} onClick={()=>setPersistedMedia(current=>current.filter(item=>item.id!==media.id))}><X/></Button></div>)}</div>}
              {files.length>0&&<div className="max-h-44 space-y-2 overflow-y-auto pr-1" aria-live="polite">{files.map((file,index)=><div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm"><Paperclip className="size-4 shrink-0 text-primary"/><span className="min-w-0 flex-1 truncate font-medium">{file.name}</span><span className="text-[11px] tabular-nums text-muted-foreground">{formatSize(file.size)}</span><Button type="button" size="icon-sm" variant="ghost" disabled={createPost.isPending} aria-label={`Remove ${file.name}`} onClick={()=>setFiles(current=>current.filter((_,itemIndex)=>itemIndex!==index))}><X/></Button></div>)}</div>}
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><Save className="mr-2 inline size-4 text-primary"/>Draft text and media are saved privately and sync across your devices.</div>
            </aside>
          </div>
          {progress&&<div className="mt-5 rounded-xl bg-muted p-3" role="status" aria-live="polite"><div className="flex justify-between gap-3 text-xs font-medium"><span className="truncate capitalize">{progress.stage} {progress.currentFile}</span><span>{progress.completed}/{progress.total} files</span></div><progress className="mt-2 h-2 w-full accent-primary" value={progress.completed} max={progress.total}>{progressPercent}%</progress></div>}
          {error&&<div id="community-post-error" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>}
        </div>

        <DialogFooter className="mx-0 mb-0 max-h-[40dvh] overflow-y-auto rounded-none border-t bg-background/95 px-4 py-3 backdrop-blur sm:max-h-none sm:items-center sm:px-6 sm:py-4"><span className="mr-auto hidden text-xs text-muted-foreground md:block">Drafts sync across devices. Complete every section to publish.</span>{createPost.isPending?<Button type="button" variant="outline" onClick={()=>abortRef.current?.abort()}>Cancel upload</Button>:<DialogClose render={<Button type="button" variant="ghost" disabled={busy} />}>Cancel</DialogClose>}<Button type="submit" name="intent" value="draft" variant="outline" disabled={busy}>{saveDraft.isPending?<Loader2 className="animate-spin"/>:<Save/>}{saveDraft.isPending?'Saving…':'Save draft'}</Button><Button type="submit" name="intent" value="publish" disabled={busy} className="sm:min-w-36">{createPost.isPending?<><Loader2 className="animate-spin"/>Publishing</>:<><Send/>Publish post</>}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
