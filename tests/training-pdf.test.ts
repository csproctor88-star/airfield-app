import { describe, it, expect } from 'vitest'
import { generateModuleReferencePdf } from '@/lib/training-pdf'
import { MODULES } from '@/lib/training/modules'

// Smoke coverage for the Help & Training "Module Reference" PDF export. Mirrors
// what app/(app)/help/page.tsx feeds the generator: the live MODULES guides
// mapped to the PDF's ModuleData subset. Screenshot fetches fail in the test env
// (no server / relative URLs) and are skipped gracefully by fetchImageDataUrl, so
// this exercises the text + layout path over the REAL current guide data — i.e.
// it verifies the export renders the current content without throwing.

const toModuleData = (m: (typeof MODULES)[number]) => ({
  name: m.name,
  tagline: m.tagline,
  overview: m.overview,
  keyFeatures: m.keyFeatures,
  howToAccess: m.howToAccess,
  screenshots: m.screenshots,
})

describe('generateModuleReferencePdf', () => {
  it('renders the full current guide set without throwing', async () => {
    const { doc, filename } = await generateModuleReferencePdf(MODULES.map(toModuleData))
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toMatch(/\.pdf$/i)
  })

  it('handles an empty set and a single guide', async () => {
    expect((await generateModuleReferencePdf([])).doc).toBeDefined()
    const one = await generateModuleReferencePdf([toModuleData(MODULES[0])])
    expect(one.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})

describe('MODULES guide content completeness', () => {
  it('every guide has the fields the PDF + page render', () => {
    const bad = MODULES.filter(
      (m) =>
        !m.name?.trim() ||
        !m.tagline?.trim() ||
        !m.overview?.trim() ||
        !m.keyFeatures?.length ||
        !m.howToAccess?.trim(),
    ).map((m) => m.id)
    expect(bad, `guides missing required content: ${bad.join(', ')}`).toEqual([])
  })
})
