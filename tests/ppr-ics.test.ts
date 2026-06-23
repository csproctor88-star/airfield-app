import { describe, it, expect } from 'vitest'
import { buildPprInvite } from '@/lib/ppr-ics'

function icsText(over: Partial<Parameters<typeof buildPprInvite>[0]> = {}): string {
  const att = buildPprInvite({
    entryId: '7c3a',
    pprNumber: 'JUN-001-JD',
    baseName: 'Selfridge ANGB',
    baseIcao: 'KMTC',
    arrivalDate: '2026-06-25',
    summary: 'REACH123 • C-17',
    requesterName: 'Jane Pilot',
    requesterEmail: 'jane.pilot@example.com',
    organizerEmail: 'info@glidepathops.com',
    amopsEmail: 'amops@selfridge.af.mil',
    notes: 'RON; needs fuel',
    dtstamp: new Date('2026-06-22T23:15:00Z'),
    ...over,
  })
  return att.content.toString('utf8')
}

describe('buildPprInvite', () => {
  it('emits a METHOD:REQUEST VEVENT with CRLF line endings', () => {
    const ics = icsText()
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('METHOD:REQUEST')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
    // RFC 5545 requires CRLF.
    expect(ics.includes('\r\n')).toBe(true)
    expect(ics).toMatch(/BEGIN:VCALENDAR\r\n/)
  })

  it('uses a stable per-PPR UID so re-approval updates the same event', () => {
    expect(icsText()).toContain('UID:ppr-7c3a@glidepathops.com')
  })

  it('renders an all-day event with an exclusive next-day end', () => {
    const ics = icsText()
    expect(ics).toContain('DTSTART;VALUE=DATE:20260625')
    expect(ics).toContain('DTEND;VALUE=DATE:20260626')
  })

  it('rolls the exclusive end across a month boundary', () => {
    const ics = icsText({ arrivalDate: '2026-06-30' })
    expect(ics).toContain('DTSTART;VALUE=DATE:20260630')
    expect(ics).toContain('DTEND;VALUE=DATE:20260701')
  })

  it('sets organizer to the sending address and requester as attendee', () => {
    const ics = icsText()
    expect(ics).toContain('ORGANIZER;CN="Selfridge ANGB AMOPS":mailto:info@glidepathops.com')
    expect(ics).toContain('mailto:jane.pilot@example.com')
    expect(ics).toContain('PARTSTAT=NEEDS-ACTION')
  })

  it('escapes TEXT values and renders the description as one folded property', () => {
    const unfold = (s: string) => s.replace(/\r\n /g, '')
    const ics = unfold(icsText({ notes: 'line; with, commas' }))
    // ; and , escaped inside DESCRIPTION
    expect(ics).toContain('line\\; with\\, commas')
    // multi-line description joined with literal \n
    expect(ics).toContain('DESCRIPTION:Prior Permission Required — APPROVED\\nPPR #:')
  })

  it('renders the details list (arrival, requester, columns) into DESCRIPTION', () => {
    const unfold = (s: string) => s.replace(/\r\n /g, '')
    const ics = unfold(icsText({ details: [
      { label: 'Arrival date', value: '2026-06-25' },
      { label: 'Requester', value: 'Jane Pilot — jane@x.mil — 555-1234' },
      { label: 'Callsign', value: 'REACH123' },
      { label: 'Aircraft Type', value: 'C-17' },
    ] }))
    expect(ics).toContain('Arrival date: 2026-06-25')
    expect(ics).toContain('Requester: Jane Pilot')
    expect(ics).toContain('Callsign: REACH123')
    expect(ics).toContain('Aircraft Type: C-17')
  })

  it('omits the attendee line when there is no requester email', () => {
    const ics = icsText({ requesterEmail: null })
    expect(ics).not.toContain('ATTENDEE')
    // still a valid event
    expect(ics).toContain('ORGANIZER')
  })

  it('PUBLISH variant drops the attendee and sets METHOD:PUBLISH', () => {
    const ics = icsText({ method: 'PUBLISH' })
    expect(ics).toContain('METHOD:PUBLISH')
    expect(ics).not.toContain('ATTENDEE')
    // organizer + event details still present
    expect(ics).toContain('ORGANIZER')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260625')
  })

  it('PUBLISH attachment carries the method=PUBLISH content-type', () => {
    const att = buildPprInvite({
      entryId: 'x', pprNumber: 'P1', baseName: 'B', arrivalDate: '2026-01-01',
      summary: 'S', organizerEmail: 'info@glidepathops.com',
      dtstamp: new Date('2026-01-01T00:00:00Z'), method: 'PUBLISH',
    })
    expect(att.contentType).toContain('method=PUBLISH')
  })

  it('returns a calendar attachment with the REQUEST method content-type', () => {
    const att = buildPprInvite({
      entryId: 'x', pprNumber: 'P1', baseName: 'B', arrivalDate: '2026-01-01',
      summary: 'S', organizerEmail: 'info@glidepathops.com', dtstamp: new Date('2026-01-01T00:00:00Z'),
    })
    expect(att.filename).toBe('ppr-invite.ics')
    expect(att.contentType).toContain('text/calendar')
    expect(att.contentType).toContain('method=REQUEST')
  })
})
