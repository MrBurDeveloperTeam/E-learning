import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateCommunityPost } from '@/features/community/hooks/useCommunity'
import type { CommunityUploadProgress } from '@/features/community/api/communityApi'
import type { CommunityPostTopic } from '@/features/community/types'

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
const maxFileSize = 25 * 1024 * 1024
const formatSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`

export function CreateCommunityPostDialog({ userId, communityId, communityName }: { userId: string; communityId?: string; communityName?: string }) {
  const draftKey = `community-post-draft:${userId}:${communityId ?? 'general'}`
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [topic, setTopic] = useState<CommunityPostTopic>('general_dentistry')
  const [tags, setTags] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<CommunityUploadProgress | null>(null)
  const createPost = useCreateCommunityPost()

  useEffect(() => {
    if (!open) return
    const saved = localStorage.getItem(draftKey)
    if (!saved || title || body || tags) return
    try { const draft = JSON.parse(saved) as { title?:string;body?:string;tags?:string;topic?:CommunityPostTopic };setTitle(draft.title??'');setBody(draft.body??'');setTags(draft.tags??'');setTopic(draft.topic??'general_dentistry') }
    catch { localStorage.removeItem(draftKey) }
  }, [body, draftKey, open, tags, title])

  useEffect(() => {
    if (!open || (!title.trim()&&!body.trim()&&!tags.trim())) return
    const timer=window.setTimeout(()=>localStorage.setItem(draftKey,JSON.stringify({title,body,tags,topic,savedAt:new Date().toISOString()})),500)
    return()=>window.clearTimeout(timer)
  },[body,draftKey,open,tags,title,topic])

  const chooseFiles = (incoming: File[]) => {
    const combined = [...files, ...incoming]
    if (combined.length > 6) { setError('You can attach up to 6 files.'); return }
    const invalid = incoming.find(file => !acceptedTypes.has(file.type) || file.size === 0 || file.size > maxFileSize)
    if (invalid) { setError(!acceptedTypes.has(invalid.type) ? `${invalid.name} is not a supported image or video.` : invalid.size === 0 ? `${invalid.name} is empty.` : `${invalid.name} is larger than 25 MB.`); return }
    const unique = combined.filter((file, index, all) => all.findIndex(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index)
    setFiles(unique);setError(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();setError(null)
    if (!body.trim()) { setError('Write something before submitting your post.');return }
    const controller = new AbortController();abortRef.current=controller
    try {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
      const normalizedTags = [...new Set(tags.split(/[;,\s]+/).map(tag=>tag.replace(/^#/,'').trim().toLowerCase()).filter(Boolean))].slice(0,8).map(tag=>`#${tag.replace(/[^a-z0-9_]/g,'')}`).filter(tag=>tag.length>1)
      const taggedBody = normalizedTags.length ? `${body.trim()}\n\n${normalizedTags.join(' ')}` : body
      await createPost.mutateAsync({authorId:userId,communityId,title,body:taggedBody,topic,files,draft:submitter?.value==='draft',signal:controller.signal,onProgress:setProgress})
      localStorage.removeItem(draftKey);setTitle('');setBody('');setTags('');setFiles([]);setTopic('general_dentistry');setProgress(null);setOpen(false)
      toast.success(submitter?.value==='draft'?'Draft saved.':'Published successfully. Your post is now visible.')
    } catch (cause) {
      setError(cause instanceof DOMException&&cause.name==='AbortError'?'Upload cancelled. Your text and selected files are still here so you can retry.':cause instanceof Error?cause.message:'The post could not be submitted. Your files were kept for retry.')
      setProgress(null)
    } finally { abortRef.current=null }
  }

  const progressPercent = progress?.total ? Math.round(progress.completed / progress.total * 100) : 0

  return <Dialog open={open} onOpenChange={next=>{if(!createPost.isPending)setOpen(next)}}>
    <DialogTrigger render={<Button size="lg" />}><FileText />Create post</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><form noValidate onSubmit={submit}>
      <DialogHeader><DialogTitle>Create a community post</DialogTitle><DialogDescription>{communityName ? `Share with ${communityName}. ` : ''}Your post will be published immediately and may be reviewed if it is reported.</DialogDescription></DialogHeader>
      <div className="mt-5 space-y-4">
        {(title||body||tags)&&<p className="text-xs text-muted-foreground" role="status">Text changes save locally on this device. Selected files must be reselected after closing the browser.</p>}
        <div className="space-y-2"><Label>Topic</Label><Select value={topic} onValueChange={value=>setTopic(value as CommunityPostTopic)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['general_dentistry','implantology','orthodontics','endodontics','periodontology','oral_surgery','prosthodontics','pediatric_dentistry','digital_dentistry','practice_management'].map(value=><SelectItem key={value} value={value}>{value.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="community-post-title">Title <span className="text-muted-foreground">(optional)</span></Label><Input id="community-post-title" value={title} maxLength={200} onChange={event=>setTitle(event.target.value)} placeholder="Give your post a clear title" /></div>
        <div className="space-y-2"><Label htmlFor="community-post-tags">Tags <span className="text-muted-foreground">(optional, up to 8)</span></Label><Input id="community-post-tags" value={tags} onChange={event=>setTags(event.target.value)} placeholder="implant, workflow, clinical_case" /><p className="text-xs text-muted-foreground">Separate tags with spaces or commas. They become searchable hashtags.</p></div>
        <div role="button" tabIndex={createPost.isPending?-1:0} aria-label="Add images or videos" className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${dragging?'border-primary bg-primary/5':'border-border hover:border-primary/40 hover:bg-primary/5'}`} onClick={()=>!createPost.isPending&&inputRef.current?.click()} onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&!createPost.isPending)inputRef.current?.click()}} onDragOver={event=>{event.preventDefault();if(!createPost.isPending)setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);if(!createPost.isPending)chooseFiles([...event.dataTransfer.files])}}><UploadCloud className="size-6 text-primary"/><span className="mt-2 text-sm font-medium">Drop files here or choose files</span><span className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF, MP4 or WebM · 25 MB each · up to 6</span><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={event=>{chooseFiles([...(event.target.files??[])]);event.target.value=''}} /></div>
        {files.length>0&&<div className="space-y-2" aria-live="polite">{files.map((file,index)=><div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm"><Paperclip className="size-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 truncate font-medium">{file.name}</span><span className="text-xs tabular-nums text-muted-foreground">{formatSize(file.size)}</span><Button type="button" size="icon-sm" variant="ghost" disabled={createPost.isPending} aria-label={`Remove ${file.name}`} onClick={()=>setFiles(current=>current.filter((_,itemIndex)=>itemIndex!==index))}><X/></Button></div>)}</div>}
        {progress&&<div className="rounded-xl bg-muted p-3" role="status" aria-live="polite"><div className="flex justify-between gap-3 text-xs font-medium"><span className="truncate capitalize">{progress.stage} {progress.currentFile}</span><span className="shrink-0 tabular-nums">{progress.completed}/{progress.total} files</span></div><progress className="mt-2 h-2 w-full accent-primary" value={progress.completed} max={progress.total} aria-label="File upload progress">{progressPercent}%</progress><p className="mt-1 text-xs text-muted-foreground">Cancel waits for the current file request, then removes partial uploads.</p></div>}
        <div className="space-y-2"><Label htmlFor="community-post-body">Post</Label><Textarea id="community-post-body" value={body} maxLength={20000} aria-invalid={Boolean(error)} aria-describedby={error?'community-post-error':'community-post-help'} className="min-h-36 resize-none" onChange={event=>setBody(event.target.value)} placeholder="Share a case insight, question, or useful resource…"/><div className="flex justify-between gap-3 text-xs text-muted-foreground"><span id={error?'community-post-error':'community-post-help'} className={error?'text-destructive':''} role={error?'alert':undefined}>{error??'Do not include identifiable patient information.'}</span><span>{body.length}/20,000</span></div></div>
      </div>
      <DialogFooter className="mt-5">{createPost.isPending?<Button type="button" variant="outline" onClick={()=>abortRef.current?.abort()}>Cancel upload</Button>:<DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>}<Button type="submit" name="intent" value="draft" variant="outline" disabled={createPost.isPending}>Save draft</Button><Button type="submit" name="intent" value="publish" disabled={createPost.isPending} className="min-w-32">{createPost.isPending?<><Loader2 className="animate-spin"/>Publishing</>:'Publish post'}</Button></DialogFooter>
    </form></DialogContent>
  </Dialog>
}
