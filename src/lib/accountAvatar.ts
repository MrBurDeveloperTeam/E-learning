export function getAccountAvatarUrl(userId: string | null | undefined) {
  if (!userId) return null

  // The production custom domain's /api/* path is handled by the shared SSO
  // gateway. The Pages domain reaches E-learning's avatar Function directly.
  const origin = window.location.hostname === 'e-learning.snabbb.com'
    ? 'https://e-learning-ddw.pages.dev'
    : ''

  return `${origin}/api/account/public-avatar?userId=${encodeURIComponent(userId)}`
}
