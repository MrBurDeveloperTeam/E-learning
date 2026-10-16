import React from 'react'
const notReady = { status: 'not_ready' }
const auth = { profile: null, user: null }
export const useAuthStore = (select: any) => select(auth)
export const useElearningPersonalizedInsightState = () => notReady
export const usePublishPersonalizedInsight = () => {}
export const useMarkRead = () => ({ mutate: () => {} })
export const useFollowing = () => ({ data: [] })
export default function usePageDurationTracker() {}
export const logElearningActivity = () => {}
export const fetchTopPublicCreators = async () => []
export function Navbar() { return <nav className="h-14 border-b px-6 py-4">Snabbb. · Home · Local category preview</nav> }
export function FollowButton() { return null }
export function UserAvatar() { return null }
export function UnifiedVideoGrid({ items, isLoading, emptyDescription }: any) {
  if (isLoading) return <p role="status">Loading videos…</p>
  if (!items.length) return <p role="status">{emptyDescription}</p>
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{items.map((item: any) => <article key={item.id} className="rounded-xl border p-6">
    <p>{item.video.title}</p><p>{item.kind} · {item.video.category}</p>
  </article>)}</div>
}
const uploaded = [
  { id: '1', title: 'Uploaded orthodontics lesson', category: 'Orthodontics', created_at: '2026-10-16' },
  { id: '2', title: 'Uploaded general lesson', category: 'General Dentistry', created_at: '2026-10-15' },
  { id: '3', title: 'Uploaded periodontology lesson', category: 'Periodontology', created_at: '2026-10-14' },
]
const curated = [
  { id: '4', title: 'Curated orthodontics lesson', category: 'Orthodontics', published_at: '2026-10-16' },
  { id: '5', title: 'Curated general lesson', category: 'General Dentistry', published_at: '2026-10-15' },
  { id: '6', title: 'Curated periodontics lesson', category: 'Periodontics', published_at: '2026-10-14' },
]
const wait = () => new Promise(resolve => setTimeout(resolve, 120))
export const getCategories = async () => ['Orthodontics', 'Periodontics', 'General Dentistry'].map(category => ({ category, count: 1 }))
export async function fetchVideosPaginated(filters: any, page: number) {
  await wait()
  return page ? [] : uploaded.filter(v => (!filters.category || v.category === filters.category) && (!filters.q || v.title.includes(filters.q)))
}
export async function getVideos(filters: any) {
  await wait()
  return { data: curated.filter(v => (!filters.category || v.category === filters.category) && (!filters.q || v.title.includes(filters.q))), page: 1, totalPages: 1 }
}
