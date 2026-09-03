export const VIDEO_LANGUAGE_OPTIONS = [
  { value: 'All', label: 'All languages' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'th', label: 'Thai' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ar', label: 'Arabic' },
] as const

export type ImportVideoLanguage = Exclude<(typeof VIDEO_LANGUAGE_OPTIONS)[number]['value'], 'All'>

export const IMPORT_VIDEO_LANGUAGE_OPTIONS = VIDEO_LANGUAGE_OPTIONS.filter(
  (language): language is Extract<(typeof VIDEO_LANGUAGE_OPTIONS)[number], { value: ImportVideoLanguage }> =>
    language.value !== 'All',
)

export function getVideoLanguageLabel(language: string) {
  return VIDEO_LANGUAGE_OPTIONS.find((item) => item.value === language)?.label ?? language
}
