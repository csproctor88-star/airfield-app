import { describe, it, expect } from 'vitest'
import {
  composeTemplateText,
  bundled623aCommentTemplates,
  COMMENT_TEMPLATES,
} from '@/lib/amtr/reference-data'
import { CATALOG_SYNC_META } from '@/lib/amtr/seed-data'

// ─── Editable 623A comment templates ───
// Templates are stored per-base as { key, label, cite, body }; the inserted
// shell recomposes the "(Label — IAW Cite)" header on top of the body so that
// editing the citation updates what gets inserted. These lock the compose +
// the default→row derivation (which must reproduce the shipped const verbatim).

describe('composeTemplateText', () => {
  it('prepends the "(Label — IAW Cite)" header and a blank line', () => {
    expect(composeTemplateText('Monthly Eval', 'DAFMAN 13-204v2 Para 8.1', 'Field A: \nField B: ')).toBe(
      '(Monthly Eval — IAW DAFMAN 13-204v2 Para 8.1)\n\nField A: \nField B: ',
    )
  })

  it('strips only leading/trailing blank lines from the body (keeps trailing spaces on content lines)', () => {
    expect(composeTemplateText('L', 'C', '\n\nField: \n\n')).toBe('(L — IAW C)\n\nField: ')
  })
})

describe('comment-templates catalog sync config', () => {
  // runSyncCatalogs builds INSERT payloads from `fields` only — the natural-key
  // column ('key') MUST be in fields or imports/syncs insert a NULL key and hit
  // the NOT NULL constraint. Guards against re-dropping it.
  it("includes 'key' in the synced fields", () => {
    expect(CATALOG_SYNC_META.amtr_623a_comment_templates.fields).toContain('key')
  })
})

describe('bundled623aCommentTemplates', () => {
  const bundled = bundled623aCommentTemplates()

  it('returns one row per shipped template', () => {
    expect(bundled).toHaveLength(COMMENT_TEMPLATES.length)
  })

  it('each row has a non-empty key/label/cite/body and a numeric sort_order', () => {
    bundled.forEach((r, i) => {
      expect(r.key).toBeTruthy()
      expect(r.label).toBeTruthy()
      expect(r.cite).toBeTruthy()
      expect(r.body).toBeTruthy()
      expect(r.sort_order).toBe(i)
    })
  })

  it('body excludes the auto-header line', () => {
    bundled.forEach((r) => {
      expect(r.body.startsWith(`(${r.label} — IAW`)).toBe(false)
    })
  })

  it('round-trips: composeTemplateText(label, cite, body) reproduces the shipped const text', () => {
    bundled.forEach((r) => {
      const original = COMMENT_TEMPLATES.find((t) => t.key === r.key)!
      expect(composeTemplateText(r.label, r.cite, r.body)).toBe(original.text)
    })
  })
})
