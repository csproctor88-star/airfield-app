// iCalendar (RFC 5545) meeting invite for an approved PPR.
//
// Attached to the approval email so the requester can add the transient
// visit straight to Outlook. Phase 1 is an ALL-DAY event on the arrival
// date — `ppr_entries.arrival_date` is date-only, so there's no
// timezone math and no VTIMEZONE block to get wrong. METHOD:REQUEST with
// ORGANIZER = the sending address (info@glidepathops.com) is what makes
// Outlook render a real Accept/Decline invite rather than a bare
// appointment.
//
// Pure + dependency-free: returns a Resend-ready attachment. No Microsoft
// API, no auth.

/** Escape a TEXT value per RFC 5545 §3.3.11 (backslash, ; , and newlines). */
function icalEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Quote a parameter value (e.g. CN). Param values can't use backslash
 *  escaping — they're DQUOTE-wrapped, so strip any embedded quotes. */
function quoteParam(text: string): string {
  return `"${text.replace(/[\r\n"]/g, ' ').trim()}"`
}

/**
 * Fold a content line at 75 octets per RFC 5545 §3.1. Continuation lines
 * begin with a single space (which counts toward the 75), so they carry
 * at most 74 octets of content. Byte-aware so multibyte chars (—, •)
 * never push a line over the limit or get split mid-codepoint.
 */
function fold(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line
  const chunks: string[] = []
  let cur = ''
  let curBytes = 0
  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, 'utf8')
    const limit = chunks.length === 0 ? 75 : 74
    if (curBytes + chBytes > limit) {
      chunks.push(cur)
      cur = ch
      curBytes = chBytes
    } else {
      cur += ch
      curBytes += chBytes
    }
  }
  if (cur) chunks.push(cur)
  return chunks.join('\r\n ')
}

/** UTC compact stamp: YYYYMMDDTHHMMSSZ. */
function utcStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

/** 'YYYY-MM-DD' → 'YYYYMMDD' (all-day VALUE=DATE form). */
function dateValue(ymd: string): string {
  return ymd.replace(/-/g, '')
}

export type PprInviteAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export function buildPprInvite(input: {
  entryId: string
  pprNumber: string
  baseName: string
  baseIcao?: string | null
  arrivalDate: string // 'YYYY-MM-DD'
  summary: string // e.g. "REACH123 • C-17"
  requesterName?: string | null
  requesterEmail?: string | null
  organizerEmail: string
  amopsEmail?: string | null
  notes?: string | null
  dtstamp: Date
  sequence?: number
  /**
   * REQUEST → a true meeting invite with Accept/Decline, addressed to the
   * requester as ATTENDEE (used for the requester's approval email).
   * PUBLISH → an "add to calendar" event with no attendee/RSVP, for
   * coordinating groups who just want the visit on their calendar.
   */
  method?: 'REQUEST' | 'PUBLISH'
}): PprInviteAttachment {
  const {
    entryId, pprNumber, baseName, baseIcao, arrivalDate, summary,
    requesterName, requesterEmail, organizerEmail, amopsEmail, notes,
    dtstamp, sequence = 0, method = 'REQUEST',
  } = input

  // All-day end date is exclusive → arrival + 1 day.
  const endDate = new Date(`${arrivalDate}T00:00:00Z`)
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  const endValue = utcStamp(endDate).slice(0, 8) // YYYYMMDD

  const locationText = baseIcao ? `${baseName} (${baseIcao})` : baseName
  const summaryText = `PPR ${pprNumber} — ${summary} @ ${baseName}`
  const descriptionText = [
    'Prior Permission Required approved.',
    `PPR #: ${pprNumber}`,
    requesterName ? `Requester: ${requesterName}` : null,
    notes ? `Notes: ${notes}` : null,
    amopsEmail ? `AMOPS: ${amopsEmail}` : null,
  ].filter(Boolean).join('\n')

  const lines: (string | null)[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Glidepath//PPR//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:ppr-${entryId}@glidepathops.com`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${utcStamp(dtstamp)}`,
    `DTSTART;VALUE=DATE:${dateValue(arrivalDate)}`,
    `DTEND;VALUE=DATE:${endValue}`,
    `SUMMARY:${icalEscape(summaryText)}`,
    `LOCATION:${icalEscape(locationText)}`,
    `DESCRIPTION:${icalEscape(descriptionText)}`,
    `ORGANIZER;CN=${quoteParam(`${baseName} AMOPS`)}:mailto:${organizerEmail}`,
    // ATTENDEE only on a REQUEST — a PUBLISH "add to calendar" event has no
    // RSVP recipient (the coordinating group isn't the visiting aircrew).
    method === 'REQUEST' && requesterEmail
      ? `ATTENDEE;CN=${quoteParam(requesterName || 'Requester')};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${requesterEmail}`
      : null,
    'STATUS:CONFIRMED',
    // All-day planning marker — don't block the attendee's whole day as busy.
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const ics = lines.filter((l): l is string => l !== null).map(fold).join('\r\n') + '\r\n'

  return {
    filename: 'ppr-invite.ics',
    content: Buffer.from(ics, 'utf8'),
    contentType: `text/calendar; method=${method}; charset=UTF-8`,
  }
}
