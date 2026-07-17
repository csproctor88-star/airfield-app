import { describe, it, expect } from 'vitest'
import { generateObstructionPdf } from '@/lib/obstruction-pdf'
import type { ObstructionRow } from '@/lib/supabase/obstructions'

// Covers the set-aware details-table row (P77 Task 5b): Part 77 evaluations
// show a "Surface Set" row instead of "Runway Class" (a UFC-only concept);
// UFC evaluations — including legacy rows with a NULL surface_set — keep
// "Runway Class" and gain a "Surface Set" row above it for symmetry.
// The Part 77 case below fixtures runway_class: null so the
// `not.toContain('Class null')` assertion is load-bearing: `rwClass` is
// computed unconditionally in the generator as `Class ${runway_class}`, so a
// non-null fixture value could never produce the literal "Class null" even
// if a regression leaked rwClass into the Part 77 branch. (Checked against
// the live schema: obstruction_evaluations.runway_class is NOT NULL, so this
// is a defensive test input for the generator's null-handling, not a value
// the column can hold today.)
// `doc.output()` is safe to substring-search here because these generators
// construct the jsPDF with no `compress` option (defaults to false), so the
// content stream's text-showing operators are plain, un-deflated bytes.

function evaluation(overrides: Omit<Partial<ObstructionRow>, 'runway_class'> & { runway_class?: string | null } = {}): ObstructionRow {
  return {
    id: 'eval-1',
    display_id: 'OBS-2026-TEST',
    base_id: 'base-1',
    created_at: new Date().toISOString(),
    object_height_agl: 50,
    object_distance_ft: 100,
    distance_from_centerline_ft: 200,
    object_elevation_msl: 600,
    obstruction_top_msl: 650,
    latitude: null,
    longitude: null,
    description: null,
    notes: null,
    photo_storage_path: null,
    results: [],
    controlling_surface: null,
    violated_surfaces: [],
    has_violation: false,
    runway_class: 'B',
    surface_set: null,
    evaluated_by: null,
    linked_discrepancy_id: null,
    ...overrides,
  } as ObstructionRow
}

describe('generateObstructionPdf — surface-set details row', () => {
  it('Part 77 evaluations print a Surface Set row and never a Runway Class row', async () => {
    const { doc, filename } = await generateObstructionPdf({
      evaluation: evaluation({ surface_set: 'faa_part77', runway_class: null }),
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test Muni',
      baseIcao: 'KTST',
    })

    const raw = doc.output()
    expect(raw).toContain('Surface Set')
    expect(raw).toContain('FAA Part 77')
    expect(raw).not.toContain('Runway Class')
    expect(raw).not.toContain('Class null')
    expect(filename).toMatch(/\.pdf$/i)
  })

  it('UFC evaluations keep Runway Class and add a Surface Set row above it', async () => {
    const { doc } = await generateObstructionPdf({
      evaluation: evaluation({ surface_set: 'ufc_3_260_01', runway_class: 'Army_B' }),
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test AFB',
      baseIcao: 'KTST',
    })

    const raw = doc.output()
    expect(raw).toContain('Surface Set')
    expect(raw).toContain('UFC 3-260-01')
    expect(raw).toContain('Runway Class')
    expect(raw).toContain('Army Class B')
    expect(raw).not.toContain('FAA Part 77')
  })

  it('legacy rows with a NULL surface_set fall back to the UFC row (backward compatibility)', async () => {
    const { doc } = await generateObstructionPdf({
      evaluation: evaluation({ surface_set: null, runway_class: 'B' }),
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test AFB',
      baseIcao: 'KTST',
    })

    const raw = doc.output()
    expect(raw).toContain('Surface Set')
    expect(raw).toContain('UFC 3-260-01')
    expect(raw).toContain('Runway Class')
  })
})
