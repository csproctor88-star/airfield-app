import { describe, it, expect } from 'vitest'
import {
  MOS_CATEGORIES, MOS_NOT_APPLICABLE, ARFF_PETITION_CONTENTS,
  ARFF_ADVANCE_FILING_DAYS, DEVIATION_NOTIFY_DAYS, RECONSIDERATION_WINDOW_DAYS,
  STATUSES_BY_TYPE, statusLabel, STATUS_COLORS,
  RECORD_TYPE_LABELS, ATTACHMENT_KIND_LABELS,
  type ModsExemptionStatus,
} from '@/lib/mods-exemptions/constants'

// Locks the encoded regulatory constants to the verified transcription in
// docs/references/part139-mos-exemptions-verified.md (gitignored — recreate
// from the owner's source PDFs if lost). If one of these fails, the code
// drifted from the verified source, not the other way around.

describe('Order 5300.1G Appendix A taxonomy', () => {
  it('has the nine categories from the appendix', () => {
    expect(Object.keys(MOS_CATEGORIES).sort()).toEqual([
      'ATC Facility',
      'Airport Equipment Standards',
      'Design',
      'Lighting',
      'Markings',
      'Methods & Materials',
      'NAVAIDS',
      'Signage',
      'Visual Aids',
    ])
  })

  it('carries the verified subcategory counts', () => {
    expect(MOS_CATEGORIES['Airport Equipment Standards']).toHaveLength(5)
    expect(MOS_CATEGORIES['ATC Facility']).toHaveLength(2)
    expect(MOS_CATEGORIES['Design']).toHaveLength(29)
    expect(MOS_CATEGORIES['Lighting']).toHaveLength(11)
    expect(MOS_CATEGORIES['Markings']).toHaveLength(4)
    expect(MOS_CATEGORIES['NAVAIDS']).toHaveLength(6)
    expect(MOS_CATEGORIES['Methods & Materials']).toHaveLength(12)
    expect(MOS_CATEGORIES['Signage']).toHaveLength(9)
    expect(MOS_CATEGORIES['Visual Aids']).toHaveLength(11)
  })

  it('spot-checks exact subcategory strings against the verified doc', () => {
    expect(MOS_CATEGORIES['Design']).toContain('Runway Protection Zone (RPZ)')
    expect(MOS_CATEGORIES['Design']).toContain('Taxiway/Taxilane Wingtip Clearance')
    expect(MOS_CATEGORIES['Design']).toContain('Airplane Design Group VI Standards')
    expect(MOS_CATEGORIES['Methods & Materials']).toContain('Rigid Pavement, P-501')
    expect(MOS_CATEGORIES['Visual Aids']).toContain('Visual Guidance Slope Indicator (VGSI) for IFR and VFR Runways')
    expect(MOS_CATEGORIES['ATC Facility']).toContain('Runway Visual Range')
  })

  it('every category offers Other except the two-item ATC Facility list', () => {
    for (const [cat, subs] of Object.entries(MOS_CATEGORIES)) {
      if (cat === 'ATC Facility') {
        expect(subs).not.toContain('Other')
      } else {
        expect(subs).toContain('Other')
      }
    }
  })
})

describe('¶8.i not-applicable list and §139.111(b)(2) petition contents', () => {
  it('lists the five ¶8.i exclusions', () => {
    expect(MOS_NOT_APPLICABLE).toHaveLength(5)
    expect(MOS_NOT_APPLICABLE.some((x) => x.includes('Runway Safety Area'))).toBe(true)
    expect(MOS_NOT_APPLICABLE.some((x) => x.includes('Obstacle Free Zone'))).toBe(true)
    expect(MOS_NOT_APPLICABLE.some((x) => x.includes('Runway Protection Zone'))).toBe(true)
  })

  it('lists the seven (b)(2) content items', () => {
    expect(ARFF_PETITION_CONTENTS).toHaveLength(7)
    expect(ARFF_PETITION_CONTENTS[0]).toMatch(/itemized cost/i)
    expect(ARFF_PETITION_CONTENTS.some((x) => x.includes('FAA Form 5100-127'))).toBe(true)
    expect(ARFF_PETITION_CONTENTS.some((x) => x.includes('previous 12 calendar months'))).toBe(true)
  })

  it('locks the verified day counts', () => {
    expect(ARFF_ADVANCE_FILING_DAYS).toBe(120)   // §139.111(b)(1)(i)
    expect(DEVIATION_NOTIFY_DAYS).toBe(14)       // §139.113
    expect(RECONSIDERATION_WINDOW_DAYS).toBe(60) // §11.101
  })
})

describe('status tracks per record type', () => {
  it('partially_granted is exemption-only (5280.5D §8.6 vs 5300.1G ¶8.h)', () => {
    expect(STATUSES_BY_TYPE.exemption).toContain('partially_granted')
    expect(STATUSES_BY_TYPE.mos).not.toContain('partially_granted')
    expect(STATUSES_BY_TYPE.deviation).not.toContain('partially_granted')
  })

  it('deviations use the notification track, never the petition track', () => {
    expect(STATUSES_BY_TYPE.deviation).toEqual(['notification_pending', 'notified', 'closed'])
    expect(STATUSES_BY_TYPE.deviation).not.toContain('submitted')
    expect(STATUSES_BY_TYPE.mos).not.toContain('notification_pending')
    expect(STATUSES_BY_TYPE.exemption).not.toContain('notified')
  })

  it('FAA grants exemptions but approves modifications', () => {
    expect(statusLabel('exemption', 'approved')).toBe('Granted')
    expect(statusLabel('mos', 'approved')).toBe('Approved')
    expect(statusLabel('exemption', 'denied')).toBe('Denied')
    expect(statusLabel('mos', 'denied')).toBe('Disapproved')
  })

  it('every status in every track has a label and a color', () => {
    const all = new Set<ModsExemptionStatus>([
      ...STATUSES_BY_TYPE.mos, ...STATUSES_BY_TYPE.exemption, ...STATUSES_BY_TYPE.deviation,
    ])
    for (const s of all) {
      expect(statusLabel('mos', s)).toBeTruthy()
      expect(STATUS_COLORS[s]).toBeTruthy()
    }
  })

  it('label maps cover every record type and attachment kind', () => {
    expect(Object.keys(RECORD_TYPE_LABELS).sort()).toEqual(['deviation', 'exemption', 'mos'])
    expect(Object.keys(ATTACHMENT_KIND_LABELS).sort()).toEqual(
      ['airspace_review', 'correspondence', 'decision_letter', 'other', 'petition', 'srm'],
    )
  })
})
