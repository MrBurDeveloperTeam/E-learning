import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMYR(amount: number): string {
  return amount.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' })
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatCEHours(hours: number): string {
  return `${hours.toFixed(1)} CE hours`
}

export function formatViewCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  }
  return Math.round(count).toString()
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return `${m}:${s.toString().padStart(2, '0')}`
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  return `${Math.floor(months / 12)}y ago`
}

type DisplayNameSource = {
  full_name?: string | null
  username?: string | null
  name?: string | null
  email?: string | null
}

export function getDisplayName(
  profile: DisplayNameSource | null | undefined,
  fallback = 'Unknown user'
): string {
  const candidates = [
    profile?.full_name,
    profile?.username,
    profile?.name,
    profile?.email?.split('@')[0],
  ]

  for (const candidate of candidates) {
    const normalized = candidate?.trim()
    if (normalized) return normalized
  }

  return fallback
}

export function getInitials(name: string | null | undefined): string {
  const normalizedName = name?.trim()
  if (!normalizedName) return '?'

  const words = normalizedName
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((word) => word && word !== 'Dr.' && word !== 'Dr')

  if (words.length === 0) return '?'

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export function categoryToSlug(category: string): string {
  return category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function slugToCategory(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
