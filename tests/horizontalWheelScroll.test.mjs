import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Exercise the real hook's native event handlers without mounting an app/session.
function fixture() {
  const listeners = new Map(), windowListeners = new Map(), captures = new Set()
  let cleanup, captureCalls = 0
  const container = {
    scrollLeft: 100, scrollWidth: 1000, clientWidth: 300,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name),
    setPointerCapture: id => { captures.add(id); captureCalls++ },
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
  }
  const source = readFileSync(new URL('../src/hooks/useHorizontalWheelScroll.ts', import.meta.url), 'utf8')
  const js = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  const run = new Function('exports', 'useRef', 'useEffect', 'window', js)
  run(exports, () => ({ current: container }), effect => { cleanup = effect() }, {
    addEventListener: (name, handler) => windowListeners.set(name, handler),
    removeEventListener: name => windowListeners.delete(name),
  })
  exports.useHorizontalWheelScroll()
  function fire(name, values = {}) {
    const event = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
      clientX: 100, detail: 1, prevented: false, stopped: false,
      preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true }, ...values }
    ;(windowListeners.get(name) || listeners.get(name))?.(event)
    return event
  }
  return { fire, container, captures, listeners, windowListeners, cleanup: () => cleanup(), captureCalls: () => captureCalls }
}

test('ordinary category/follow clicks and small pointer jitter never capture the child click', () => {
  for (const pointerType of ['mouse', 'touch']) {
    const f = fixture()
    f.fire('pointerdown', { pointerType }); f.fire('pointermove', { clientX: 102 })
    f.fire('pointerup'); assert.equal(f.captureCalls(), 0)
    assert.equal(f.fire('click').stopped, false)
  }
})
test('drag captures only after threshold, scrolls, and suppresses accidental category activation', () => {
  const f = fixture()
  f.fire('pointerdown'); assert.equal(f.captureCalls(), 0)
  assert.equal(f.fire('pointermove', { clientX: 60 }).prevented, true)
  assert.equal(f.captureCalls(), 1); assert.equal(f.container.scrollLeft, 140)
  f.fire('pointerup'); assert.equal(f.captures.size, 0)
  assert.equal(f.fire('click').stopped, true)
  f.fire('pointerdown'); f.fire('pointerup')
  assert.equal(f.fire('click').stopped, false)
})
test('keyboard activation stays usable after a drag or pointer cancellation', () => {
  const f = fixture()
  f.fire('pointerdown'); f.fire('pointermove', { clientX: 70 }); f.fire('pointercancel')
  assert.equal(f.fire('click', { detail: 0 }).stopped, false)
})
test('outside release clears pressed state and unrelated pointers cannot drag', () => {
  const f = fixture()
  f.fire('pointerdown'); f.fire('pointermove', { clientX: 50, pointerId: 2 })
  assert.equal(f.captureCalls(), 0)
  f.fire('pointerup'); f.fire('pointermove', { clientX: 50 })
  assert.equal(f.captureCalls(), 0)
  f.fire('pointerdown', { isPrimary: false }); f.fire('pointermove', { clientX: 40 })
  assert.equal(f.captureCalls(), 0)
})
test('wheel scrolling remains conditional and listeners are cleaned up', () => {
  const f = fixture()
  assert.equal(f.fire('wheel', { deltaY: 40, deltaX: 0 }).prevented, true)
  assert.equal(f.container.scrollLeft, 140)
  f.container.scrollWidth = 200
  assert.equal(f.fire('wheel', { deltaY: 40, deltaX: 0 }).prevented, false)
  f.cleanup(); assert.equal(f.listeners.size + f.windowListeners.size, 0)
})
