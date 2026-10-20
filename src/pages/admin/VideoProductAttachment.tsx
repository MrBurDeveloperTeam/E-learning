import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Save } from 'lucide-react'
import { toast } from 'sonner'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  AdminFilterTabs,
  AdminSearchField,
  AdminSectionCard,
  AdminStatusBadge,
} from '@/components/admin/AdminPrimitives'
import { ProductPicker } from '@/components/creator/ProductPicker'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { isAdminProfile } from '@/lib/auth'
import {
  fetchDentalVideoProducts,
  fetchVideoProducts,
  replaceDentalVideoProducts,
  replaceVideoProducts,
} from '@/lib/queries/products'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { PartnerProduct, VideoProduct } from '@/types'

type VideoSource = 'uploaded' | 'youtube'

type UploadedVideoRecord = {
  id: string
  title: string
  creator_id: string
  thumbnail_url: string | null
  status: string
  created_at: string
  profiles: { name: string | null; full_name: string | null; username: string | null } | null
}

type YoutubeVideoRecord = {
  id: string
  title: string
  thumbnail_url: string | null
  channel_name: string
}

// One shape for both sources so the list and detail panel don't care which it is.
type VideoRow = {
  source: VideoSource
  id: string
  title: string
  thumbnail_url: string | null
  subtitle: string
  status: string | null
  /** Only uploaded videos have a creator; YouTube videos never earn credit. */
  creator_id: string | null
}

function toPartnerProduct(row: VideoProduct): PartnerProduct {
  return {
    product_ref: row.product_ref,
    name: row.product_name,
    image_url: row.product_image_url,
    price: Number(row.product_price),
    currency: row.currency,
    product_url: row.product_url,
  }
}

function creatorLabel(video: UploadedVideoRecord) {
  const p = video.profiles
  return p?.full_name || p?.name || p?.username || 'Unknown creator'
}

export function VideoProductAttachment() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const [source, setSource] = useState<VideoSource>('uploaded')
  const [search, setSearch] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null)
  const [draft, setDraft] = useState<PartnerProduct[] | null>(null)

  const isAdmin = isAdminProfile(profile)

  const videosQuery = useQuery({
    queryKey: ['admin-video-products-videos', source, search],
    enabled: isAdmin,
    queryFn: async (): Promise<VideoRow[]> => {
      const term = search.trim().replace(/[%,()]/g, ' ')

      if (source === 'youtube') {
        let query = supabase
          .from('dental_videos')
          .select('id, title, thumbnail_url, channel_name')
          .order('fetched_at', { ascending: false })
          .limit(50)
        if (term) query = query.ilike('title', `%${term}%`)

        const { data, error } = await query
        if (error) throw error
        return ((data ?? []) as YoutubeVideoRecord[]).map((video) => ({
          source: 'youtube' as const,
          id: video.id,
          title: video.title,
          thumbnail_url: video.thumbnail_url,
          subtitle: video.channel_name,
          status: null,
          creator_id: null,
        }))
      }

      let query = supabase
        .from('videos')
        .select('id, title, creator_id, thumbnail_url, status, created_at, profiles!videos_creator_id_fkey(name, full_name, username)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (term) query = query.ilike('title', `%${term}%`)

      const { data, error } = await query
      if (error) throw error
      return ((data ?? []) as unknown as UploadedVideoRecord[]).map((video) => ({
        source: 'uploaded' as const,
        id: video.id,
        title: video.title,
        thumbnail_url: video.thumbnail_url,
        subtitle: creatorLabel(video),
        status: video.status,
        creator_id: video.creator_id,
      }))
    },
  })

  const attachedQuery = useQuery({
    queryKey: [
      selectedVideo?.source === 'youtube' ? 'dental-video-products' : 'video-products',
      selectedVideo?.id,
    ],
    enabled: isAdmin && !!selectedVideo,
    queryFn: () =>
      selectedVideo!.source === 'youtube'
        ? fetchDentalVideoProducts(selectedVideo!.id)
        : fetchVideoProducts(selectedVideo!.id),
  })

  const savedProducts = useMemo(
    () => (attachedQuery.data ?? []).map(toPartnerProduct),
    [attachedQuery.data]
  )
  const products = draft ?? savedProducts
  const isDirty = draft !== null

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVideo || !draft) return
      const inputs = draft.map((product) => ({
        product_ref: product.product_ref,
        product_name: product.name,
        product_image_url: product.image_url,
        product_price: product.price,
        currency: product.currency,
        product_url: product.product_url,
        cta_label: 'View Product',
      }))

      if (selectedVideo.source === 'youtube') {
        await replaceDentalVideoProducts(selectedVideo.id, inputs)
      } else {
        await replaceVideoProducts(selectedVideo.id, selectedVideo.creator_id!, inputs)
      }
    },
    onSuccess: () => {
      toast.success('Featured products updated')
      queryClient.invalidateQueries({
        queryKey: [
          selectedVideo?.source === 'youtube' ? 'dental-video-products' : 'video-products',
          selectedVideo?.id,
        ],
      })
      setDraft(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save featured products')
    },
  })

  function selectVideo(video: VideoRow) {
    if (isDirty && !window.confirm('Discard unsaved product changes?')) return
    setSelectedVideo(video)
    setDraft(null)
  }

  function changeSource(next: VideoSource) {
    if (next === source) return
    if (isDirty && !window.confirm('Discard unsaved product changes?')) return
    setSource(next)
    setSelectedVideo(null)
    setDraft(null)
  }

  if (!isAdmin) {
    return (
      <PageLayout>
        <AdminGuard />
      </PageLayout>
    )
  }

  return (
    <AdminLayout
      title="Featured products"
      subtitle="Attach Snabbb partner products to any video. Uploaded videos credit their creator; YouTube videos never award credit."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <AdminSectionCard title="Videos" description="Search by title and pick a video.">
          <div className="space-y-3">
            <AdminFilterTabs
              value={source}
              onChange={changeSource}
              options={[
                { value: 'uploaded', label: 'Uploaded videos' },
                { value: 'youtube', label: 'YouTube videos' },
              ]}
            />
            <AdminSearchField
              placeholder="Search videos by title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-[32rem] space-y-1.5 overflow-y-auto">
              {videosQuery.isLoading && (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading videos…</p>
              )}
              {videosQuery.isError && (
                <p className="py-6 text-center text-sm text-destructive">Couldn't load videos.</p>
              )}
              {videosQuery.data?.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No videos found.</p>
              )}
              {videosQuery.data?.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => selectVideo(video)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors',
                    selectedVideo?.id === video.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                  )}
                >
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {video.thumbnail_url && (
                      <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{video.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{video.subtitle}</p>
                  </div>
                  {video.status && (
                    <AdminStatusBadge
                      label={video.status}
                      tone={video.status === 'published' ? 'success' : 'warning'}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title={selectedVideo ? selectedVideo.title : 'Featured products'}
          description={
            selectedVideo
              ? selectedVideo.source === 'youtube'
                ? `YouTube · ${selectedVideo.subtitle} · no credit awarded`
                : `Creator: ${selectedVideo.subtitle}`
              : 'Select a video to manage its featured products.'
          }
        >
          {!selectedVideo ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Package className="h-8 w-8" />
              <p className="text-sm">No video selected</p>
            </div>
          ) : attachedQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading products…</p>
          ) : (
            <div className="space-y-4">
              <ProductPicker
                selected={products}
                onChange={setDraft}
                disabled={saveMutation.isPending}
              />
              <Button
                type="button"
                className="w-full gap-2"
                disabled={!isDirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving…' : 'Save featured products'}
              </Button>
            </div>
          )}
        </AdminSectionCard>
      </div>
    </AdminLayout>
  )
}
