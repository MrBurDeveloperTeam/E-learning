import { VIDEO_CATEGORIES } from '@/types'
import type { DentalCategory } from '@/types/dentalVideo'

const CATEGORY_NORMALIZATION_MAP: Record<string, string> = {
  'Pediatric Dentistry': 'Paediatric Dentistry',
  Periodontics: 'Periodontology',
}

const DENTAL_CATEGORY_FILTER_MAP: Record<string, string> = {
  'Paediatric Dentistry': 'Pediatric Dentistry',
  Periodontology: 'Periodontics',
}

export function normalizeLibraryCategory(
  category: string | null | undefined
): string | undefined {
  const normalized = category?.trim()
  if (!normalized) return undefined

  return CATEGORY_NORMALIZATION_MAP[normalized] ?? normalized
}

export function getDentalCategoryFilter(
  category: string | null | undefined
): string | undefined {
  const normalized = normalizeLibraryCategory(category)
  if (!normalized) return undefined

  return DENTAL_CATEGORY_FILTER_MAP[normalized] ?? normalized
}

export function buildCombinedCategoryList(
  dentalCategories: DentalCategory[] = []
): string[] {
  const seen = new Set<string>()
  const categories: string[] = []

  function addCategory(category: string | null | undefined) {
    const normalized = normalizeLibraryCategory(category)
    if (!normalized || seen.has(normalized)) return

    seen.add(normalized)
    categories.push(normalized)
  }

  VIDEO_CATEGORIES.forEach(addCategory)

  dentalCategories
    .map((item) => item.category)
    .sort((left, right) => left.localeCompare(right))
    .forEach(addCategory)

  return categories
}
