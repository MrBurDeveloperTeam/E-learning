import { Link } from '@tanstack/react-router'
import type { DentalVideo } from '@/types/dentalVideo'
import { CategoryBadge } from '@/components/CategoryBadge'

interface DentalVideoCardProps {
  video: DentalVideo
}

/**
 * Format an ISO date string to "Mar 2024" style.
 */
function formatPublishedDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * Extract a YouTube thumbnail URL from a video_id.
 * Falls back to the stored thumbnail_url if available.
 */
function getThumbnailUrl(video: DentalVideo): string {
  if (video.thumbnail_url) return video.thumbnail_url
  return `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`
}

export function DentalVideoCard({ video }: DentalVideoCardProps) {
  return (
    <Link
      to="/dental-videos/$id"
      params={{ id: video.id }}
      className="group block cursor-pointer animate-fade-in outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden rounded-xl aspect-video bg-muted">
        <img
          src={getThumbnailUrl(video)}
          alt={`Thumbnail for ${video.title}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Play button overlay — CSS only */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 scale-75">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="#1E3333"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Category badge — top-left corner */}
        {video.category && (
          <div className="absolute top-2 left-2">
            <CategoryBadge
              category={video.category}
              needsReview={video.needs_review}
            />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-2.5 min-w-0">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[#1E3333] dark:text-foreground transition-colors group-hover:text-[#2D6E6A] dark:group-hover:text-primary">
          {video.title}
        </h3>
        <p className="mt-1 text-xs text-[#6B8E8E] dark:text-muted-foreground truncate">
          {video.channel_name}
        </p>
        <p className="text-xs text-[#9BB5B5] dark:text-muted-foreground/70">
          {formatPublishedDate(video.published_at)}
        </p>
      </div>
    </Link>
  )
}
