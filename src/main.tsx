import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './components/shared/ThemeProvider'
import './index.css'
// Loaded via `?raw` + manual <style> injection, NOT a plain CSS import:
// this package's compiled styles.css is pre-built by Tailwind v4 and
// contains raw `@layer utilities { ... }` blocks with no matching
// `@tailwind utilities` in the same file. E-Learning's own PostCSS
// pipeline (still on Tailwind v3, unlike every other Snabbb app in this
// migration) reprocesses every CSS module that flows through Vite's
// normal CSS import handling and fails on that shape with "`@layer
// utilities` is used but no matching `@tailwind utilities` directive is
// present". A `?raw` import bypasses Vite's CSS/PostCSS pipeline entirely
// (plain text asset), so the already-compiled CSS is injected verbatim,
// unreprocessed — identical runtime styling to a normal import, just
// loaded through a path that no longer collides with Tailwind v3.
import molarExperienceStyles from '@mrburdeveloperteam/molar-experience/styles.css?raw'

const molarExperienceStyleEl = document.createElement('style')
molarExperienceStyleEl.setAttribute('data-source', '@mrburdeveloperteam/molar-experience')
molarExperienceStyleEl.textContent = molarExperienceStyles
document.head.appendChild(molarExperienceStyleEl)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
)

