import { Play } from 'lucide-react'
import { formatDuration, cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useHoverPreview } from '@/hooks/useHoverPreview'
import { MuxHoverPreview } from '@/components/video/HoverPreview'

interface VideoThumbnailProps {
  src: string | null
  title: string
  durationSeconds: number | null
  status?: string
  className?: string
  imageClassName?: string
  /** Mux playback id; when set, hovering plays a muted preview. */
  previewPlaybackId?: string | null
}

export function VideoThumbnail({
  src,
  title,
  durationSeconds,
  status,
  className,
  imageClassName,
  previewPlaybackId,
}: VideoThumbnailProps) {
  const canPreview = Boolean(previewPlaybackId) && status !== 'processing'
  const { active, handlers } = useHoverPreview(canPreview)

  return (
    <div
      {...handlers}
      className={cn(
        'relative overflow-hidden rounded-xl bg-muted',
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          className={cn(
            'h-full w-full object-cover transition-transform duration-300 group-hover:scale-105',
            imageClassName
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <Play className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {active && previewPlaybackId && <MuxHoverPreview playbackId={previewPlaybackId} />}

      <div className="absolute bottom-2 right-2 z-10 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
        {formatDuration(durationSeconds)}
      </div>

      {status === 'processing' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
          <div className="text-center">
            <LoadingSpinner size="md" />
            <p className="mt-2 text-xs text-white">Processing...</p>
          </div>
        </div>
      )}
    </div>
  )
}
