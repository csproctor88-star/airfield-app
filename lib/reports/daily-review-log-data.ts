import { formatZuluDateTime } from '@/lib/utils'
import {
  signerCompact, getSlotLabel,
  type DailyReviewRow, type DailyReviewSlot, type SignerInfo,
} from '@/lib/supabase/daily-reviews'

export interface CertLogRow {
  date: string
  slots: string[]              // aligned to requiredSlots; signerCompact or '—'
  certifiedAt: string | null
  certifiedText: string        // Zulu time | 'PENDING' | 'PENDING (no entry)'
  notes: { slotLabel: string; note: string }[]
}

/** Every calendar day from startDate..endDate inclusive (UTC math, TZ-safe). [] if start > end. */
export function buildReviewDateSpine(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  let cur = Date.UTC(sy, sm - 1, sd)
  const end = Date.UTC(ey, em - 1, ed)
  const out: string[] = []
  while (cur <= end) {
    out.push(new Date(cur).toISOString().slice(0, 10))
    cur += 86400000
  }
  return out
}

/** Shape each spine day into a certification-log row. Pure. */
export function buildCertLogRows(
  spine: string[],
  rowByDate: Map<string, DailyReviewRow>,
  signers: Map<string, SignerInfo>,
  requiredSlots: DailyReviewSlot[],
  base: { airport_type?: 'usaf' | 'faa_part139' | null } | null,
): CertLogRow[] {
  return spine.map((date) => {
    const row = rowByDate.get(date) ?? null
    const slots = requiredSlots.map((slot) => {
      const id = row ? (row[`${slot}_signed_by` as keyof DailyReviewRow] as string | null) : null
      const signer = id ? signers.get(id) : null
      return signer ? signerCompact(signer) : '—'
    })
    const certifiedAt = row?.fully_certified_at ?? null
    const certifiedText = certifiedAt
      ? formatZuluDateTime(certifiedAt)
      : row ? 'PENDING' : 'PENDING (no entry)'
    const notes: { slotLabel: string; note: string }[] = []
    if (row) {
      for (const slot of requiredSlots) {
        const note = row[`${slot}_notes` as keyof DailyReviewRow] as string | null
        if (note && note.trim()) notes.push({ slotLabel: getSlotLabel(slot, base), note: note.trim() })
      }
    }
    return { date, slots, certifiedAt, certifiedText, notes }
  })
}
