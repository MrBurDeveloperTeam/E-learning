import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Upload as UploadIcon, CheckCircle, Image as ImageIcon, Video, X } from 'lucide-react'
import * as UpChunk from '@mux/upchunk'
import { useAuthStore } from '@/store/authStore'
import { useCreateVideo, useUpdateVideo, useUploadVideoThumbnail, useVideo } from '@/hooks/useVideos'
import { Navbar } from '@/components/layout/Navbar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VIDEO_CATEGORIES, type VideoCategory } from '@/types'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

function formatDuration(seconds: number | null | undefined) {
  if (!seconds && seconds !== 0) return 'Duration unavailable'

  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function Upload() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { videoId?: string }
  const videoId = search.videoId?.trim() ?? ''
  const isEditMode = !!videoId
  const profile = useAuthStore((state) => state.profile)
  const session = useAuthStore((state) => state.session)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { mutateAsync: createVideo } = useCreateVideo()
  const { mutateAsync: updateVideo } = useUpdateVideo()
  const { mutateAsync: uploadThumbnail } = useUploadVideoThumbnail()
  const editVideoQuery = useVideo(videoId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<VideoCategory>(VIDEO_CATEGORIES[0])
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'followers_only'>('public')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null)
  const [originalThumbnailUrl, setOriginalThumbnailUrl] = useState<string | null>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle('')
    setDescription('')
    setCategory(VIDEO_CATEGORIES[0])
    setTags('')
    setVisibility('public')
    setThumbnailFile(null)
    setThumbnailPreviewUrl(null)
    setOriginalThumbnailUrl(null)
    setFile(null)
    setUploading(false)
    setProgress(0)
  }, [videoId])

  useEffect(() => {
    if (!editVideoQuery.data) return

    const video = editVideoQuery.data
    setTitle(video.title ?? '')
    setDescription(video.description ?? '')
    setCategory(video.category)
    setTags((video.tags ?? []).join(', '))
    setVisibility(video.visibility)
    setOriginalThumbnailUrl(video.thumbnail_url ?? null)
    setThumbnailFile(null)
    setFile(null)
    setProgress(0)
  }, [editVideoQuery.data])

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreviewUrl(originalThumbnailUrl)
      return
    }

    const objectUrl = URL.createObjectURL(thumbnailFile)
    setThumbnailPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [thumbnailFile, originalThumbnailUrl])

  useEffect(() => {
    if (!isEditMode || isAuthLoading || !profile || !editVideoQuery.data) return

    if (editVideoQuery.data.creator_id !== profile.user_id) {
      toast.error("You can only edit your own videos.")
      navigate({ to: '/studio', replace: true })
    }
  }, [editVideoQuery.data, isEditMode, isAuthLoading, navigate, profile])

  useEffect(() => {
    if (!isEditMode || !editVideoQuery.isError) return

    toast.error('Video not found.')
    navigate({ to: '/studio', replace: true })
  }, [editVideoQuery.isError, isEditMode, navigate])

  useEffect(() => {
    if (!isAuthLoading && session && profile && (!profile.is_verified || !profile.is_creator)) {
       toast.error("You don't have permission to upload videos.")
       navigate({ to: '/studio', replace: true })
    }
  }, [session, profile, navigate, isAuthLoading])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files[0].type.startsWith("video/")) {
        setFile(e.dataTransfer.files[0])
      } else {
        toast.error("Please upload a valid video file.")
      }
    }
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      if (!selectedFile.type.startsWith('image/')) {
        toast.error('Please upload a valid image file for the thumbnail.')
        e.target.value = ''
        return
      }

      if (selectedFile.size > 2 * 1024 * 1024) {
        toast.error('Thumbnail images must be 2MB or smaller.')
        e.target.value = ''
        return
      }

      setThumbnailFile(selectedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return toast.error("Please enter a title")
    if (!profile) return toast.error("You must be logged in")

    try {
      setUploading(true)
      let thumbnailUrl: string | null | undefined = undefined

      if (thumbnailFile) {
        try {
          thumbnailUrl = await uploadThumbnail({
            userId: profile.user_id,
            file: thumbnailFile,
          })
        } catch (thumbnailError) {
          console.error('Thumbnail upload error:', thumbnailError)
          toast.error('Thumbnail upload failed. Continuing without a custom thumbnail.')
          thumbnailUrl = isEditMode ? editVideoQuery.data?.thumbnail_url ?? null : null
        }
      } else if (isEditMode) {
        thumbnailUrl = editVideoQuery.data?.thumbnail_url ?? null
      }

      if (isEditMode) {
        if (!editVideoQuery.data) throw new Error('Video data is still loading.')

        await updateVideo({
          user_id: profile.user_id,
          videoId,
          title,
          description,
          category,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          visibility,
          thumbnail_url: thumbnailUrl,
        })

        toast.success('Video updated successfully.')
        navigate({ to: '/studio', replace: true })
        return
      }

      if (!file) return toast.error("Please select a video file")

      // 1. Get the direct upload URL from our Cloudflare Pages Function
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) throw new Error("Not authenticated")

      const uploadRes = await fetch('/api/get-mux-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
      })

      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error || "Failed to get upload URL")
      if (!uploadData.uploadUrl) throw new Error("Failed to get upload URL")

      const { uploadUrl, uploadId } = uploadData

      let createThumbnailUrl: string | null = null
      if (thumbnailFile) {
        createThumbnailUrl = thumbnailUrl ?? null
      }

      // 2. Insert DB record as processing
      await createVideo({
        creator_id: profile.user_id,
        title,
        description,
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        visibility,
        mux_upload_id: uploadId,
        thumbnail_url: createThumbnailUrl,
      })

      // 3. Upload file to Mux using UpChunk
      const upload = UpChunk.createUpload({
        endpoint: uploadUrl,
        file,
        chunkSize: 5120, // 5MB chunks
      })

      upload.on('progress', progress => {
        setProgress(Math.round(progress.detail))
      })

      upload.on('success', () => {
        toast.success("Video uploaded successfully! It's now processing.")
        navigate({ to: '/studio', replace: true })
      })

      upload.on('error', err => {
        console.error('Upload error:', err)
        toast.error("Upload failed: " + err.detail.message)
        setUploading(false)
      })

    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error starting upload')
      setUploading(false)
    }
  }

  if (isAuthLoading) {
    return <div className="p-8 text-center text-sm text-[#9BB5B5]">Loading...</div>
  }

  if (isEditMode && editVideoQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-[#9BB5B5]">Loading video data...</div>
  }

  if (!session || !profile?.is_verified) {
    return null // Redirected by effect
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8 pb-20 md:pb-8">
        <PageHeader
          title={isEditMode ? 'Edit video' : 'Upload video'}
          subtitle={
            isEditMode
              ? 'Update your video details and thumbnail'
              : 'Share your knowledge with the dental community'
          }
        />

        {isEditMode && editVideoQuery.data && (
          <div className="mb-6 rounded-xl border border-[#88C1BD] bg-[#EAF4F3]/70 px-4 py-3 text-sm text-[#2D6E6A]">
            Editing <span className="font-medium">{editVideoQuery.data.title}</span>
            {' '} - the original video file stays attached to this post.
          </div>
        )}
      
        <div className="mt-8 grid md:grid-cols-2 gap-8">
          <div>
            <form id="upload-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input 
                  id="title" 
                  autoFocus
                  placeholder="e.g. Masterclass: Advanced Restorative Techniques" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  disabled={uploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  rows={5}
                  placeholder="Tell viewers what your video is about"
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  disabled={uploading}
                />
              </div>

              <div className="space-y-2">
                <Label>Custom thumbnail</Label>
                <div className="rounded-xl border border-dashed border-[#88C1BD] bg-[#EAF4F3]/40 p-4">
                  {!thumbnailPreviewUrl ? (
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center rounded-lg px-6 py-8 text-center transition-colors hover:bg-white/70"
                      disabled={uploading}
                    >
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                        <ImageIcon className="h-5 w-5 text-[#2D6E6A]" />
                      </div>
                      <p className="text-sm font-medium text-[#1E3333]">
                        Upload a custom thumbnail
                      </p>
                      <p className="mt-1 text-xs text-[#6B8E8E]">
                        JPG, PNG, or WebP up to 2MB
                      </p>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-lg border border-[#D4E8E7] bg-white">
                        <img
                          src={thumbnailPreviewUrl}
                          alt="Selected thumbnail preview"
                          className="aspect-video w-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#1E3333]">
                            {thumbnailFile?.name ?? 'Current thumbnail'}
                          </p>
                          <p className="text-xs text-[#6B8E8E]">
                            {thumbnailFile
                              ? `${(thumbnailFile.size / (1024 * 1024)).toFixed(2)} MB`
                              : 'Saved thumbnail preview'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => thumbnailInputRef.current?.click()}
                            disabled={uploading}
                            className="rounded-lg border border-[#D4E8E7] bg-white px-3 py-1.5 text-xs font-medium text-[#2D6E6A] transition-colors hover:bg-[#EAF4F3]"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setThumbnailFile(null)
                              setThumbnailPreviewUrl(originalThumbnailUrl)
                              if (thumbnailInputRef.current) {
                                thumbnailInputRef.current.value = ''
                              }
                            }}
                            disabled={uploading}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#DC2626] transition-colors hover:bg-[#FEE2E2]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleThumbnailChange}
                    disabled={uploading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as VideoCategory)} disabled={uploading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={visibility} onValueChange={(val: any) => setVisibility(val)} disabled={uploading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="followers_only">Followers only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input 
                  id="tags" 
                  placeholder="orthodontics, brackets, tips" 
                  value={tags} 
                  onChange={e => setTags(e.target.value)} 
                  disabled={uploading}
                />
              </div>
            </form>
          </div>

          <div className="flex flex-col space-y-4">
            <Label>{isEditMode ? 'Video file' : 'Video File *'}</Label>
            
            {isEditMode ? (
              <div className="border border-[#D4E8E7] rounded-xl overflow-hidden bg-white p-5">
                {editVideoQuery.data ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-[#EAF4F3] flex items-center justify-center">
                        <Video className="h-5 w-5 text-[#2D6E6A]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1E3333] truncate">
                          {editVideoQuery.data.title}
                        </p>
                        <p className="text-xs text-[#6B8E8E]">
                          {editVideoQuery.data.status} - {editVideoQuery.data.category}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-[#6B8E8E]">
                      <div className="rounded-lg bg-[#F7FAFA] px-3 py-2">
                        Duration: {formatDuration(editVideoQuery.data.duration_seconds)}
                      </div>
                      <div className="rounded-lg bg-[#F7FAFA] px-3 py-2">
                        Visibility: {editVideoQuery.data.visibility}
                      </div>
                    </div>
                    <p className="text-xs text-[#9BB5B5]">
                      The original video file cannot be replaced from this page. Update the details and thumbnail instead.
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-[#9BB5B5]">Loading video details...</div>
                )}
              </div>
            ) : !file ? (
              <div 
                className="border-2 border-dashed border-[#88C1BD] rounded-xl flex flex-col items-center justify-center p-12 text-center bg-[#EAF4F3]/50 hover:bg-[#EAF4F3] transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  accept="video/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                />
                <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <UploadIcon className="h-6 w-6 text-[#2D6E6A]" />
                </div>
                <h3 className="text-base font-semibold text-[#1E3333]">Drag & drop video</h3>
                <p className="text-sm text-[#6B8E8E] mt-1">or click to browse from your device</p>
                <p className="text-xs text-[#9BB5B5] mt-4">MP4, MOV, WebM up to 2GB</p>
              </div>
            ) : (
             <div className="border border-[#D4E8E7] rounded-xl overflow-hidden bg-white">
               <div className="bg-[#EAF4F3] p-16 flex items-center justify-center relative">
                 <Video className="h-12 w-12 text-[#2D6E6A]" />
                 {!uploading && (
                  <button 
                    onClick={() => setFile(null)} 
                    className="absolute top-3 right-3 p-1.5 bg-white rounded-full text-[#6B8E8E] hover:text-[#DC2626] transition-colors"
                  >
                   <X className="h-4 w-4" />
                  </button>
                 )}
               </div>
               <div className="p-4 flex flex-col space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-sm font-medium text-[#1E3333] truncate pr-4" title={file.name}>
                     {file.name}
                   </span>
                   <span className="text-xs text-[#6B8E8E] whitespace-nowrap">
                     {(file.size / (1024 * 1024)).toFixed(2)} MB
                   </span>
                 </div>
                 
                 {uploading && (
                   <div className="space-y-1 mt-1">
                     <div className="flex justify-between text-xs text-[#6B8E8E] mb-1">
                       <span>Uploading...</span>
                       <span className="font-medium text-[#2D6E6A]">{progress}%</span>
                     </div>
                     <div className="h-2 w-full bg-[#EDF2F2] rounded-full overflow-hidden">
                       <div className="h-full bg-[#88C1BD] transition-all duration-300" style={{ width: `${progress}%` }} />
                     </div>
                   </div>
                 )}

                 {uploading && progress === 100 && (
                   <div className="flex items-center gap-2 text-sm text-[#059669] pt-2">
                     <CheckCircle className="h-4 w-4" />
                     <span>Upload complete. Processing...</span>
                   </div>
                 )}
               </div>
             </div>
            )}

            <div className="pt-6 flex justify-end">
               <Button 
                type="submit" 
                form="upload-form"
                className="w-full md:w-auto px-8" 
                disabled={uploading || !title || (!isEditMode && !file)}
              >
                 {uploading ? 'Saving...' : isEditMode ? 'Save changes' : 'Publish Video'}
               </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
