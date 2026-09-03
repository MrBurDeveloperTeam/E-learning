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

// PHASE 2B-GAP-3: strips TOP-LEVEL native CSS cascade-layer wrappers
// (`@layer <name>;` and `@layer <name> { ... }`) from the raw-imported
// Shared stylesheet before it is injected, converting its Tailwind v4
// `@layer theme/utilities/properties` output into equivalent unlayered
// CSS.
//
// WHY: this host's own Tailwind v3 output never uses native `@layer` —
// it is entirely unlayered. Per the CSS Cascade Layers spec, an
// UNLAYERED author declaration always outranks a LAYERED one of equal
// importance, regardless of specificity or source order. Left as-is,
// any utility class name this host's own pages also happen to use
// (confirmed for `absolute`, `bg-black`, `left-1/2`, `-translate-x-1/2`,
// `rounded-3xl`, `bg-gradient-to-br`, at minimum — see the Phase
// 2B-GAP-2 audit) silently defeats the Shared package's own more
// specific, later-loaded `.snabbb-molar-experience`-scoped selectors —
// proven to be exactly why Virtual Pet's Kitchen gradient background
// and desktop panel positioning failed to render correctly. Flattening
// removes only the layer boundary; every selector, media query,
// `@supports` block, `@property`/custom-property declaration, and
// declaration order inside is preserved byte-for-byte, so scoping and
// specificity behave exactly as the Shared package's own architecture
// already assumes a host will experience.
//
// A hand-written balanced-brace/string/comment-aware scanner is used
// instead of a regex: the stylesheet nests `@supports`/media/keyframe
// blocks (and gradient/custom-property values) inside these layers, so
// a regex that stops at the first `}` would truncate real content.
function flattenTopLevelCascadeLayers(css: string): string {
  const n = css.length
  let out = ''
  let i = 0

  // Advances past a CSS comment or a quoted string (honoring `\`
  // escapes), appending what it consumes to `out`; otherwise appends a
  // single plain character. Shared by both scan passes below so that
  // `{`/`}`/`;` characters inside comments or strings are never mistaken
  // for real CSS structure.
  const consumeOne = () => {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      out += css.slice(i, stop)
      i = stop
      return
    }
    if (ch === '"' || ch === "'") {
      const quote = ch
      let j = i + 1
      while (j < n) {
        if (css[j] === '\\') { j += 2; continue }
        if (css[j] === quote) { j += 1; break }
        j += 1
      }
      out += css.slice(i, j)
      i = j
      return
    }
    out += ch
    i += 1
  }

  // Returns the index just past the `}` that balances the `{` found at
  // `openIndex`, tracking nesting depth through arbitrarily nested
  // blocks (media queries, @supports, keyframes, selectors) while
  // skipping comments/strings exactly as `consumeOne` does.
  const findMatchingBraceEnd = (openIndex: number): number => {
    let depth = 0
    let j = openIndex
    while (j < n) {
      const ch = css[j]
      if (ch === '/' && css[j + 1] === '*') {
        const end = css.indexOf('*/', j + 2)
        j = end === -1 ? n : end + 2
        continue
      }
      if (ch === '"' || ch === "'") {
        const quote = ch
        j += 1
        while (j < n) {
          if (css[j] === '\\') { j += 2; continue }
          if (css[j] === quote) { j += 1; break }
          j += 1
        }
        continue
      }
      if (ch === '{') { depth += 1; j += 1; continue }
      if (ch === '}') {
        depth -= 1
        j += 1
        if (depth === 0) return j
        continue
      }
      j += 1
    }
    return n
  }

  while (i < n) {
    // Only matches `@layer` at the CURRENT (top) scanning level — this
    // loop never recurses into `findMatchingBraceEnd`'s skipped content,
    // so a nested `@layer` (none exist in the current stylesheet) would
    // be left untouched rather than flattened, matching the "top-level
    // only" requirement.
    if (css.startsWith('@layer', i) && /\s/.test(css[i + 6] ?? '')) {
      let j = i + 6
      let sawBrace = false
      while (j < n) {
        const ch = css[j]
        if (ch === '/' && css[j + 1] === '*') {
          const end = css.indexOf('*/', j + 2)
          j = end === -1 ? n : end + 2
          continue
        }
        if (ch === ';') { j += 1; break }
        if (ch === '{') { sawBrace = true; break }
        j += 1
      }
      if (sawBrace) {
        const blockEnd = findMatchingBraceEnd(j)
        // Keep only the content strictly between the matched `{`/`}` —
        // this is the "unwrap the block, drop the wrapper" step.
        out += css.slice(j + 1, blockEnd - 1)
        i = blockEnd
      } else {
        // `@layer <name>[, <name>...];` order statement — drop entirely.
        i = j
      }
      continue
    }
    consumeOne()
  }

  return out
}

const molarExperienceStyleEl = document.createElement('style')
molarExperienceStyleEl.setAttribute('data-source', '@mrburdeveloperteam/molar-experience')
molarExperienceStyleEl.textContent = flattenTopLevelCascadeLayers(molarExperienceStyles)
document.head.appendChild(molarExperienceStyleEl)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
)

