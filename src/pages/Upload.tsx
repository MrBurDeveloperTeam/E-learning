import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Upload as UploadIcon, CheckCircle, Video, X } from 'lucide-react'
import * as UpChunk from '@mux/upchunk'
import { useAuthStore } from '@/store/authStore'
import { useCreateVideo } from '@/hooks/useVideos'
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

export function Upload() {
  const navigate = useNavigate()
  const profile = useAuthStore((state) => state.profile)
  const session = useAuthStore((state) => state.session)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const { mutateAsync: createVideo } = useCreateVideo()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<VideoCategory>(VIDEO_CATEGORIES[0])
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'followers_only'>('public')
  
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAuthLoading && session && profile && (!profile.is_verified || !profile.is_creator)) {
       toast.error("You don't have permission to upload videos.")
       navigate({ to: '/studio' })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return toast.error("Please select a video file")
    if (!title) return toast.error("Please enter a title")
    if (!profile) return toast.error("You must be logged in")

    try {
      setUploading(true)

      // 1. Get the direct upload URL from our edge function
      const { data: uploadData, error: fnError } = await supabase.functions.invoke('get-mux-upload-url')

      if (fnError) throw new Error(fnError.message)
      if (!uploadData || !uploadData.uploadUrl) throw new Error("Failed to get upload URL")

      const { uploadUrl, uploadId } = uploadData

      // 2. Insert DB record as processing
      await createVideo({
        creator_id: profile.user_id,
        title,
        description,
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        visibility,
        mux_upload_id: uploadId
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
        navigate({ to: '/studio' })
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

  if (!session || !profile?.is_verified) {
    return null // Redirected by effect
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8 pb-20 md:pb-8">
        <PageHeader title="Upload video" subtitle="Share your knowledge with the dental community" />
      
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
            <Label>Video File *</Label>
            
            {!file ? (
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
                disabled={!file || !title || uploading}
               >
                 {uploading ? 'Uploading...' : 'Publish Video'}
               </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
