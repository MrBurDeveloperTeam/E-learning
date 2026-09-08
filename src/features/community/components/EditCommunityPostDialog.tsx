import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Loader2, Paperclip, Pencil, Save, UploadCloud, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCommunityPostActions } from '@/features/community/hooks/useCommunity'
import type { CommunityPost, CommunityPostTopic } from '@/features/community/types'

const topics: CommunityPostTopic[] = ['general_dentistry','implantology','orthodontics','endodontics','periodontology','oral_surgery','prosthodontics','pediatric_dentistry','digital_dentistry','practice_management']
const acceptedTypes = new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
const maxFiles = 20
const maxFileSize = 25 * 1024 * 1024

function splitPostBody(value: string | null) {
  const body = value ?? ''
  const match = body.match(/(?:\r?\n){2,}((?:#[a-zA-Z0-9_]+(?:\s+|$))+?)\s*$/)
  if (!match) return { content: body, tags: '' }
  return { content: body.slice(0, match.index).trimEnd(), tags: [...match[1].matchAll(/#([a-zA-Z0-9_]+)/g)].map((item) => item[1]).join(', ') }
}

function normalizeTags(value: string) {
  return [...new Set(value.split(/[;,\s]+/).map((tag) => tag.replace(/^#/, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean))].slice(0, 8)
}

export function EditCommunityPostDialog({ post, userId }: { post: CommunityPost; userId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = splitPostBody(post.body)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(post.title ?? '')
  const [body, setBody] = useState(parsed.content)
  const [tags, setTags] = useState(parsed.tags)
  const [topic, setTopic] = useState<CommunityPostTopic>(post.topic)
  const [retainedMediaIds, setRetainedMediaIds] = useState(() => post.media.map((media) => media.id))
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const actions = useCommunityPostActions(userId)

  useEffect(() => {
    if (!open) return
    const current = splitPostBody(post.body)
    setTitle(post.title ?? '')
    setBody(current.content)
    setTags(current.tags)
    setTopic(post.topic)
    setRetainedMediaIds(post.media.map((media) => media.id))
    setFiles([])
    setError(null)
  }, [open, post])

  function chooseFiles(incoming: File[]) {
    if (retainedMediaIds.length + files.length + incoming.length > maxFiles) return setError(`A post can contain up to ${maxFiles} images or videos.`)
    const invalid = incoming.find((file) => !acceptedTypes.has(file.type) || file.size === 0 || file.size > maxFileSize)
    if (invalid) return setError(!acceptedTypes.has(invalid.type) ? `${invalid.name} is not a supported image or video.` : invalid.size === 0 ? `${invalid.name} is empty.` : `${invalid.name} is larger than 25 MB.`)
    setFiles((current) => [...current, ...incoming].filter((file, index, all) => all.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index))
    setError(null)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!title.trim()) return setError('Add a title before saving.')
    if (!body.trim()) return setError('Write your post before saving.')
    const normalizedTags = normalizeTags(tags).map((tag) => `#${tag}`)
    const content = normalizedTags.length ? `${body.trim()}\n\n${normalizedTags.join(' ')}` : body.trim()
    try {
      await actions.mutateAsync({ action: 'edit', postId: post.id, title, body: content, topic, retainedMediaIds, files })
      setOpen(false)
      toast.success('Post updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update post. Your changes are still here.')
    }
  }

  const retainedMedia = post.media.filter((media) => retainedMediaIds.includes(media.id))
  return <Dialog open={open} onOpenChange={(next) => { if (!actions.isPending) setOpen(next) }}>
    <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Edit post" />}><Pencil /></DialogTrigger>
    <DialogContent overlayClassName="z-[120]" showCloseButton={!actions.isPending} className="z-[121] max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-3xl">
      <form noValidate onSubmit={submit} className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader className="border-b px-5 py-4 sm:px-6"><DialogTitle>Edit post</DialogTitle></DialogHeader>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(240px,.8fr)]">
            <section className="space-y-5">
              <div className="space-y-2"><div className="flex justify-between"><Label htmlFor={`edit-title-${post.id}`}>Title</Label><span className="text-xs text-muted-foreground">{title.length}/200</span></div><Input id={`edit-title-${post.id}`} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></div>
              <div className="space-y-2"><div className="flex justify-between"><Label htmlFor={`edit-body-${post.id}`}>Post</Label><span className="text-xs text-muted-foreground">{body.length}/20,000</span></div><Textarea id={`edit-body-${post.id}`} value={body} maxLength={20000} className="min-h-52 resize-none" onChange={(event) => setBody(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor={`edit-tags-${post.id}`}>Tags <span className="font-normal text-muted-foreground">· up to 8</span></Label><Input id={`edit-tags-${post.id}`} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="implant, workflow, clinical_case" /></div>
            </section>
            <aside className="space-y-5">
              <div className="rounded-2xl border bg-muted/25 p-4"><Label>Topic</Label><Select value={topic} onValueChange={(value) => setTopic(value as CommunityPostTopic)}><SelectTrigger className="mt-2 w-full bg-background"><SelectValue /></SelectTrigger><SelectContent positionerClassName="z-[130]">{topics.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><Label>Images and videos</Label><span className="text-xs text-muted-foreground">{retainedMedia.length + files.length}/{maxFiles}</span></div>
                <div className="grid grid-cols-2 gap-2">{retainedMedia.map((media, index) => <div key={media.id} className="relative overflow-hidden rounded-xl border bg-muted/30"><div className="flex aspect-video items-center justify-center">{media.media_type === 'image' ? <img src={media.public_url} alt={media.alt_text ?? `Post image ${index + 1}`} className="h-full w-full object-contain" /> : <video src={media.public_url} aria-label={`Post video ${index + 1}`} className="h-full w-full object-contain" preload="metadata" />}</div><Button type="button" variant="secondary" size="icon-sm" className="absolute right-1 top-1" aria-label={`Remove existing ${media.media_type} ${index + 1}`} onClick={() => setRetainedMediaIds((current) => current.filter((id) => id !== media.id))}><X /></Button></div>)}</div>
                {files.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><Paperclip className="size-4 text-primary"/><span className="min-w-0 flex-1 truncate">{file.name}</span><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X/></Button></div>)}
                <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}><UploadCloud />Add images or videos</Button><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={(event) => { chooseFiles([...(event.target.files ?? [])]); event.target.value = '' }} />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{retainedMedia.some((media) => media.media_type === 'video') || files.some((file) => file.type.startsWith('video/')) ? <Video className="size-3.5"/> : <ImageIcon className="size-3.5"/>} JPG, PNG, WebP, GIF, MP4 or WebM · 25 MB each</p>
              </div>
            </aside>
          </div>
          {error && <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>}
        </div>
        <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6"><Button type="button" variant="ghost" disabled={actions.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={actions.isPending}>{actions.isPending ? <><Loader2 className="animate-spin"/>Saving…</> : <><Save/>Save changes</>}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
