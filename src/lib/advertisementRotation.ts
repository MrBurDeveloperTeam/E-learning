type Rotation = { seen: string[]; last: string | null }
const storageKey = 'dental-ad-rotation-v1'
let rotation: Rotation = { seen: [], last: null }

// Storage may be unavailable; the in-memory rotation still prevents repeats.
export function selectAdvertisement<T extends { id: string }>(candidates: T[]): T | null {
  if (!candidates.length) return null
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null')
    if (stored && Array.isArray(stored.seen) && stored.seen.every((id: unknown) => typeof id === 'string') &&
      (stored.last === null || typeof stored.last === 'string')) rotation = stored
  } catch { /* Keep the in-memory state. */ }

  let remaining = candidates.filter((candidate) => !rotation.seen.includes(candidate.id))
  if (!remaining.length) {
    const eligibleIds = new Set(candidates.map((candidate) => candidate.id))
    rotation.seen = rotation.seen.filter((id) => !eligibleIds.has(id))
    remaining = candidates
  }
  const alternatives = remaining.filter((candidate) => candidate.id !== rotation.last)
  if (alternatives.length) remaining = alternatives
  const selected = remaining[Math.floor(Math.random() * remaining.length)]
  rotation.seen.push(selected.id)
  rotation.last = selected.id
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(rotation))
  } catch { /* Keep the in-memory state. */ }
  return selected
}
