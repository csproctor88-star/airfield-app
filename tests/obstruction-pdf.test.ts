import { describe, it, expect } from 'vitest'
import { generateObstructionPdf } from '@/lib/obstruction-pdf'
import type { ObstructionRow } from '@/lib/supabase/obstructions'

// Covers the "Surface Standard" details-table row (SSE Task 8): the old
// set-aware "Surface Set" + "Runway Class" pair was collapsed into a single
// row driven by resolveStandardLabel(set, runway_class) — the same registry
// function the [id] detail page and Records Export use, so the three never
// disagree. UFC rows resolve to "UFC 3-260-01 — <label>"; Part 77 rows
// (whose runway_class is now NULL) resolve to "FAA Part 77 (14 CFR §77.19)".
// Legacy rows with a NULL surface_set fall back to UFC for backward
// compatibility, matching resolveStandardLabel's own default.
//
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

describe('generateObstructionPdf — Surface Standard row', () => {
  it('Part 77 evaluations print the FAA label and never a bare Class cell', async () => {
    const { doc, filename } = await generateObstructionPdf({
      evaluation: evaluation({ surface_set: 'faa_part77', runway_class: null }),
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test Muni',
      baseIcao: 'KTST',
    })

    const raw = doc.output()
    expect(raw).toContain('Surface Standard')
    // Literal parens are backslash-escaped inside a PDF content stream (per
    // the format's string-literal syntax), so the searched substring can't
    // include them — 'FAA Part 77' alone is still load-bearing.
    expect(raw).toContain('FAA Part 77')
    expect(raw).not.toContain('Runway Class')
    expect(raw).not.toContain('Class null')
    expect(filename).toMatch(/\.pdf$/i)
  })

  it('UFC evaluations resolve the class into the same row (Army Class B)', async () => {
    const { doc } = await generateObstructionPdf({
      evaluation: evaluation({ surface_set: 'ufc_3_260_01', runway_class: 'Army_B' }),
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test AFB',
      baseIcao: 'KTST',
    })

    const raw = doc.output()
    expect(raw).toContain('Surface Standard')
    expect(raw).toContain('UFC 3-260-01')
    expect(raw).toContain('Army Class B')
    expect(raw).not.toContain('FAA Part 77')
    expect(raw).not.toContain('Class null')
  })

  it('UFC Class A evaluations resolve to Air Force Class A', async () => {
    const { doc } = await generateObstructionPdf({
      evaluation: evaluation({ surface_set: 'ufc_3_260_01', runway_class: 'A' }),
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test AFB',
      baseIcao: 'KTST',
    })

    const raw = doc.output()
    expect(raw).toContain('Air Force Class A')
  })

  it('legacy rows with a NULL surface_set fall back to UFC (backward compatibility)', async () => {
    const { doc } = await generateObstructionPdf({
      evaluation: evaluation({ surface_set: null, runway_class: 'B' }),
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test AFB',
      baseIcao: 'KTST',
    })

    const raw = doc.output()
    expect(raw).toContain('Surface Standard')
    expect(raw).toContain('UFC 3-260-01')
    expect(raw).toContain('Air Force Class B')
  })

  it('a legacy row with BOTH surface_set and runway_class NULL still never prints "Class null"', async () => {
    // Defensive input: the live schema doesn't allow this combination today
    // (obstruction_evaluations.runway_class is NOT NULL for UFC rows), but
    // resolveStandardLabel's NULL-class default (Class B) must hold even here.
    const { doc } = await generateObstructionPdf({
      evaluation: evaluation({ surface_set: null, runway_class: null }),
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test AFB',
      baseIcao: 'KTST',
    })

    const raw = doc.output()
    expect(raw).not.toContain('Class null')
    expect(raw).toContain('Air Force Class B')
  })
})
