import { describe, it, expect } from 'vitest'
import {
  PART139_CERT_SECTIONS,
  sectionsForAirportType,
  sectionMetaById,
} from '@/lib/part139-cert-checklist'
import { ACSI_CHECKLIST_SECTIONS } from '@/lib/constants'
import { acsiDraftToItems, createNewAcsiDraft } from '@/lib/acsi-draft'

describe('PART139_CERT_SECTIONS shape', () => {
  it('has the 22 Form 5280-4 sections with p139- ids', () => {
    expect(PART139_CERT_SECTIONS).toHaveLength(22)
    for (const s of PART139_CERT_SECTIONS) {
      expect(s.id).toMatch(/^p139-/)
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.reference.length).toBeGreaterThan(0)
      expect(s.items.length).toBeGreaterThan(0)
    }
  })

  it('every answerable item has a non-empty label and a CFR citation', () => {
    for (const s of PART139_CERT_SECTIONS) {
      for (const it of s.items) {
        if (it.isHeading) continue
        expect(it.question.length, `${it.id} label`).toBeGreaterThan(0)
        expect(it.citation, `${it.id} citation`).toMatch(/§139\./)
      }
    }
  })

  it('has ~123 answerable items total', () => {
    const n = PART139_CERT_SECTIONS
      .flatMap(s => s.items).filter(i => !i.isHeading).length
    expect(n).toBeGreaterThanOrEqual(118)
    expect(n).toBeLessThanOrEqual(128)
  })

  it('uses no section_id that collides with the USAF array', () => {
    const usaf = new Set(ACSI_CHECKLIST_SECTIONS.map(s => s.id))
    for (const s of PART139_CERT_SECTIONS) expect(usaf.has(s.id)).toBe(false)
  })
})

describe('sectionsForAirportType', () => {
  it('returns the Part 139 array for faa_part139, USAF array otherwise', () => {
    expect(sectionsForAirportType('faa_part139')).toBe(PART139_CERT_SECTIONS)
    expect(sectionsForAirportType('usaf')).toBe(ACSI_CHECKLIST_SECTIONS)
  })
})

describe('sectionMetaById', () => {
  it('resolves ids from both namespaces and returns undefined for junk', () => {
    expect(sectionMetaById('p139-paved')?.title).toBe('Paved Areas')
    expect(sectionMetaById('acsi-1')?.number).toBe(1)
    expect(sectionMetaById('nope')).toBeUndefined()
  })
})

describe('acsiDraftToItems with the civilian array', () => {
  it('emits civilian items and counts S/U/N-A via pass/fail/na', () => {
    const draft = createNewAcsiDraft('faa_part139')
    draft.responses = { 'rec.1': 'pass', 'rec.2': 'fail' }
    draft.discrepancies = { 'rec.2': [{ comment: 'x', work_order: '', project_number: '',
      estimated_cost: '', estimated_completion: '', risk_control_measure: '',
      photo_ids: [], areas: [], latitude: null, longitude: null, pins: [] }] }
    const { items, passed, failed } = acsiDraftToItems(draft, PART139_CERT_SECTIONS)
    expect(items.find(i => i.item_number === 'rec.1')?.response).toBe('pass')
    expect(items.find(i => i.item_number === 'rec.2')?.discrepancies?.length).toBe(1)
    expect(passed).toBe(1); expect(failed).toBe(1)
  })
})

describe('createNewAcsiDraft', () => {
  it('seeds civilian team + no signatures for faa_part139', () => {
    const d = createNewAcsiDraft('faa_part139')
    expect(d.team[0].role).toBe('ops')
    expect(d.signatures).toHaveLength(0)
  })
  it('seeds the military team by default', () => {
    expect(createNewAcsiDraft().team[0].role).toBe('afm')
  })
})

describe('Part 139 physical-airfield guidance (Phase 3.1)', () => {
  const items = PART139_CERT_SECTIONS.flatMap(s => s.items)
  it('paved-area hole item carries the 5-inch/45-degree test guidance', () => {
    const hole = items.find(i => i.citation === '§139.305(a)(2)')
    expect(hole?.guidance ?? '').toMatch(/5[- ]?inch|45/)
  })
  it('every item in the 4 physical-airfield sections has non-empty guidance', () => {
    const secs = ['p139-paved','p139-safety','p139-msl','p139-wind']
    const missing = PART139_CERT_SECTIONS.filter(s => secs.includes(s.id))
      .flatMap(s => s.items).filter(i => !(i.guidance && i.guidance.trim().length > 0)).map(i => i.id)
    expect(missing).toEqual([])
  })
})

describe('Part 139 records/personnel/manual guidance (Phase 3.2)', () => {
  const items = PART139_CERT_SECTIONS.flatMap(s => s.items)
  it('personnel training-records item cites the 24-month retention', () => {
    const trainRec = items.find(i => i.citation === '§139.303(d)')
    expect(trainRec?.guidance ?? '').toMatch(/24|month/i)
  })
  it('every item in mpc/exempt/acm/records/personnel has non-empty guidance', () => {
    const secs = ['p139-mpc','p139-exempt','p139-acm','p139-records','p139-personnel']
    const missing = PART139_CERT_SECTIONS.filter(s => secs.includes(s.id))
      .flatMap(s => s.items).filter(i => !(i.guidance && i.guidance.trim().length > 0)).map(i => i.id)
    expect(missing).toEqual([])
  })
})

describe('Part 139 programs guidance A (Phase 3.3a)', () => {
  const items = PART139_CERT_SECTIONS.flatMap(s => s.items)
  it('AEP full-scale-exercise item references the 36-month/triennial cycle', () => {
    const ex = items.find(i => i.citation === '§139.325(h)')
    expect(ex?.guidance ?? '').toMatch(/36|trienni/i)
  })
  it('every item in snow/hazmat/aep has non-empty guidance', () => {
    const secs = ['p139-snow','p139-hazmat','p139-aep']
    const missing = PART139_CERT_SECTIONS.filter(s => secs.includes(s.id))
      .flatMap(s => s.items).filter(i => !(i.guidance && i.guidance.trim().length > 0)).map(i => i.id)
    expect(missing).toEqual([])
  })
})

describe('Part 139 programs guidance B (Phase 3.3b)', () => {
  const items = PART139_CERT_SECTIONS.flatMap(s => s.items)
  it('self-inspection daily item references daily/as-required inspection', () => {
    const daily = items.find(i => i.citation === '§139.327(a)(1)')
    expect(daily?.guidance ?? '').toMatch(/dail|as required/i)
  })
  it('every item in selfinsp/vehicles/condrpt has non-empty guidance', () => {
    const secs = ['p139-selfinsp','p139-vehicles','p139-condrpt']
    const missing = PART139_CERT_SECTIONS.filter(s => secs.includes(s.id))
      .flatMap(s => s.items).filter(i => !(i.guidance && i.guidance.trim().length > 0)).map(i => i.id)
    expect(missing).toEqual([])
  })
})

describe('Part 139 obstructions/navaids/public/wildlife/construction guidance (Phase 3.4)', () => {
  const items = PART139_CERT_SECTIONS.flatMap(s => s.items)
  it('wildlife biologist item references a qualified wildlife biologist', () => {
    const bio = items.find(i => i.citation === '§139.337(f)(7)')
    expect(bio?.guidance ?? '').toMatch(/biologist/i)
  })
  it('every item in the 6 sections has non-empty guidance', () => {
    const secs = ['p139-obstruct','p139-navaids','p139-public','p139-wildlife','p139-construction','p139-noncomply']
    const missing = PART139_CERT_SECTIONS.filter(s => secs.includes(s.id))
      .flatMap(s => s.items).filter(i => !(i.guidance && i.guidance.trim().length > 0)).map(i => i.id)
    expect(missing).toEqual([])
  })
})

describe('Part 139 ARFF guidance + completion (Phase 4)', () => {
  const items = PART139_CERT_SECTIONS.flatMap(s => s.items)
  it('ARFF response-drill item carries the 3-minute/midpoint standard', () => {
    const drill = items.find(i => (i.citation || '').includes('319(h)'))
    expect(drill?.guidance ?? '').toMatch(/3[- ]?min|midpoint/i)
  })
  it('EVERY item in the whole audit now has non-empty guidance', () => {
    const missing = PART139_CERT_SECTIONS.flatMap(s => s.items)
      .filter(i => !(i.guidance && i.guidance.trim().length > 0)).map(i => i.id)
    expect(missing).toEqual([])
  })
})
