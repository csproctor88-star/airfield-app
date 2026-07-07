// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { createRequire } from 'module'

// Regression guard for the enforcing Content-Security-Policy in next.config.js.
//
// `frame-src` MUST allow `blob:`. The app previews client-generated PDFs
// (jsPDF `doc.output('blob')` -> `URL.createObjectURL`) inline in an <iframe> in
// at least three places: the daily-review sign modal, the PDF Library, and the
// Regulation viewer. A `blob:` URL is matched by neither `'self'` nor the
// `https:` scheme-source, so dropping `blob:` from frame-src (e.g. during a
// future CSP-tightening pass) silently breaks every inline PDF preview with a
// frame-src violation. See next.config.js "L-6".

const require = createRequire(import.meta.url)

let csp = ''
let directives: string[] = []

beforeAll(async () => {
  const nextConfig = require('../next.config.js')
  const groups: { headers: { key: string; value: string }[] }[] = await nextConfig.headers()
  const header = groups
    .flatMap((g) => g.headers)
    .find((h) => h.key === 'Content-Security-Policy')
  csp = header?.value ?? ''
  directives = csp.split(';').map((d) => d.trim()).filter(Boolean)
})

const directive = (name: string) => directives.find((d) => d === name || d.startsWith(`${name} `))

describe('next.config Content-Security-Policy', () => {
  it('emits an enforcing CSP header', () => {
    expect(csp).toContain('default-src')
  })

  it('allows blob: in frame-src so inline PDF previews render', () => {
    const frameSrc = directive('frame-src')
    expect(frameSrc, 'frame-src directive present').toBeTruthy()
    expect(frameSrc).toContain('blob:')
  })

  it('keeps object-src locked to none (no <object>/<embed> relied on)', () => {
    expect(directive('object-src')).toBe("object-src 'none'")
  })
})
