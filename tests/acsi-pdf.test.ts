import { describe, it, expect } from 'vitest'
import { generateAcsiPdf } from '@/lib/acsi-pdf'
import type { AcsiInspection, AcsiItem, AcsiDiscrepancyDetail } from '@/lib/supabase/types'

// Smoke coverage for the ACSI PDF generator across both layouts it now renders:
// the USAF ACSI checklist (unchanged) and the civilian FAA Form 5280-4 layout
// added for Part 139 (Task 5.1). `skipPhotos: true` keeps this hermetic — it
// short-circuits both photo-resolution branches in generateAcsiPdf so the test
// never touches Supabase/network, matching the Records Export's text-only use
// of the same flag.

function discrepancy(overrides: Partial<AcsiDiscrepancyDetail> = {}): AcsiDiscrepancyDetail {
  return {
    comment: '',
    work_order: '',
    project_number: '',
    estimated_cost: '',
    estimated_completion: '',
    risk_control_measure: '',
    photo_ids: [],
    areas: [],
    latitude: null,
    longitude: null,
    pins: [],
    ...overrides,
  }
}

function baseInspection(overrides: Partial<AcsiInspection>): AcsiInspection {
  return {
    id: 'insp-1',
    display_id: 'TEST-2026-01',
    base_id: 'base-1',
    airfield_name: 'Test Airfield',
    inspection_date: '2026-07-06',
    fiscal_year: 2026,
    status: 'completed',
    items: [],
    total_items: 0,
    passed_count: 0,
    failed_count: 0,
    na_count: 0,
    inspection_team: [],
    risk_cert_signatures: [],
    notes: null,
    inspector_id: null,
    inspector_name: null,
    arff_index: null,
    airport_class: null,
    inspector: null,
    draft_data: null,
    completed_at: null,
    completed_by_name: null,
    completed_by_id: null,
    filed_at: null,
    filed_by_name: null,
    filed_by_id: null,
    saved_at: null,
    saved_by_name: null,
    saved_by_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('generateAcsiPdf', () => {
  it('renders a civilian (FAA Part 139 / Form 5280-4) inspection without throwing', async () => {
    const items: AcsiItem[] = [
      {
        id: 'item-1',
        section_id: 'p139-mpc',
        item_number: 'mpc.1',
        question: 'Compliance with Advisory Circulars',
        response: 'pass',
        discrepancy: null,
      },
      {
        id: 'item-2',
        section_id: 'p139-paved',
        item_number: 'paved.2',
        question: 'Holes',
        response: 'fail',
        discrepancy: discrepancy({
          comment: 'Hole near threshold exceeds 3in depth',
          risk_control_measure: 'Cordoned off, work order submitted',
        }),
      },
      {
        id: 'item-3',
        section_id: 'p139-safety',
        item_number: 'safety.1',
        question: 'Dimensions Maintained',
        response: 'na',
        discrepancy: null,
      },
    ]

    const inspection = baseInspection({
      display_id: 'P139-2026-01',
      airfield_name: 'Test Muni Airport',
      items,
      total_items: items.length,
      passed_count: 1,
      failed_count: 1,
      na_count: 1,
      arff_index: 'B',
      airport_class: 'I',
      inspector: 'Jane ASI',
    })

    const { doc, filename } = await generateAcsiPdf(inspection, {
      baseName: 'Test Muni',
      baseIcao: 'KTST',
      airportType: 'faa_part139',
      skipPhotos: true,
    })

    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toMatch(/\.pdf$/i)
  })

  it('renders a USAF ACSI inspection without throwing (regression)', async () => {
    const items: AcsiItem[] = [
      {
        id: 'u-item-1',
        section_id: 'acsi-1',
        item_number: '1.1',
        question: 'Are pavement areas free of depressions and drain sufficiently?',
        response: 'pass',
        discrepancy: null,
      },
      {
        id: 'u-item-2',
        section_id: 'acsi-1',
        item_number: '1.2',
        question: 'Are pavement areas free of excessive rubber deposits?',
        response: 'fail',
        discrepancy: discrepancy({
          comment: 'Rubber buildup on touchdown zone',
          risk_control_measure: 'Scheduled rubber removal',
        }),
      },
    ]

    const inspection = baseInspection({
      display_id: 'ACSI-2026-01',
      airfield_name: 'Test AFB',
      items,
      total_items: items.length,
      passed_count: 1,
      failed_count: 1,
      na_count: 0,
      inspector_name: 'MSgt Doe',
    })

    const { doc, filename } = await generateAcsiPdf(inspection, {
      baseName: 'Test AFB',
      baseIcao: 'KTST',
      skipPhotos: true,
    })

    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toMatch(/\.pdf$/i)
  })
})
