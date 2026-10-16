import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const mocks = fileURLToPath(new URL('./home-category-mocks.tsx', import.meta.url))
const mocked = [
  'components/layout/Navbar', 'components/library/UnifiedVideoGrid', 'components/creator/FollowButton',
  'components/shared/UserAvatar', 'hooks/useFollow', 'hooks/useNotifications', 'hooks/usePageDurationTracker',
  'lib/dentalVideosApi', 'lib/queries/videosPaginated', 'lib/queries/profiles', 'lib/logActivityToOdoo',
  'store/authStore', 'aiExperience/hooks/useElearningPersonalizedInsight', 'aiExperience/petDialogue/PersonalizedInsightBridge',
]
export default defineConfig({
  root, publicDir: false, plugins: [react()],
  cacheDir: 'node_modules/.vite-home-categories',
  optimizeDeps: { entries: ['tests/fixtures/qa-home-categories.html'] },
  resolve: { alias: [...mocked.map(path => ({ find: `@/${path}`, replacement: mocks })), { find: '@', replacement: `${root}/src` }] },
  server: { host: '127.0.0.1', port: 3014, strictPort: true },
})
