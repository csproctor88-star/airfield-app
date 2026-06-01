import { describe, it, expect } from 'vitest'
import { buildAgencyEmail } from '@/lib/ppr-agency-notify'

const base = { name: 'Volk Field', amops_email: 'amops@volk.mil' }
const entry = {
  id: 'e1',
  base_id: 'b',
  ppr_number: '151-002-ZW',
  arrival_date: '2026-06-13',
  requester_name: 'Capt Smith',
}

describe('buildAgencyEmail', () => {
  it('preserves the approved subject (characterization)', () => {
    const { subject } = buildAgencyEmail({ base, entry, agencyName: 'Security Forces', outcome: 'approved' })
    expect(subject).toBe('Volk Field PPR APPROVED — 151-002-ZW (Security Forces)')
  })

  it('updated: subject says UPDATED and the body lists the changes + current details', () => {
    const { subject, html, text } = buildAgencyEmail({
      base,
      entry,
      agencyName: 'Security Forces',
      outcome: 'updated',
      changes: [
        { label: 'Arrival Date', from: '12 Jun 2026', to: '13 Jun 2026' },
        { label: 'Parking', from: 'Apron A', to: 'Apron B' },
      ],
      currentDetails: [
        { label: 'Parking', value: 'Apron B' },
        { label: 'Notes', value: 'Bringing pax' },
      ],
    })
    expect(subject).toBe('Volk Field PPR UPDATED — 151-002-ZW (Security Forces)')
    for (const body of [html, text]) {
      expect(body).toContain('Arrival Date')
      expect(body).toContain('Apron A')
      expect(body).toContain('Apron B')
      expect(body).toContain('Bringing pax')
    }
    // Informational framing — no re-coordination asked.
    expect(text.toLowerCase()).toContain('no action')
    // .mil deliverability: no clickable app deep link.
    expect(html).not.toMatch(/https?:\/\/[^"']*glidepathops\.com\//)
  })

  it('updated: renders a newly-set field (empty "from")', () => {
    const { text } = buildAgencyEmail({
      base,
      entry,
      agencyName: 'A',
      outcome: 'updated',
      changes: [{ label: 'Parking', from: '', to: 'Apron C' }],
    })
    expect(text).toContain('Parking')
    expect(text).toContain('Apron C')
  })
})
