// Pure diff of the user-editable PPR fields into human-readable changes, used
// to tell coordinated agencies what changed when a PPR is edited. Values render
// through the same formatPprColumnValue SoT the board/log use, so the change
// summary reads identically to what agencies see in Glidepath. The internal
// approver_oi field is intentionally not part of the diff.

import { formatPprColumnValue, type PprColumn } from '@/lib/supabase/ppr'

export type PprChange = { label: string; from: string; to: string }

type PprFields = {
  arrival_date: string
  column_values: Record<string, string>
  notes: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format a YYYY-MM-DD arrival date as "13 Jun 2026" (locale-independent). */
function formatArrivalDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return d
  return `${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`
}

/**
 * Diff two PPR field sets into an ordered list of changes: arrival date first,
 * then each custom column (in sort_order) whose displayed value changed, then
 * notes. Returns [] when nothing substantive changed.
 */
export function computePprChanges(
  before: PprFields,
  after: PprFields,
  columns: PprColumn[],
  opts?: { tz?: string },
): PprChange[] {
  const changes: PprChange[] = []

  if (before.arrival_date !== after.arrival_date) {
    changes.push({
      label: 'Arrival Date',
      from: formatArrivalDate(before.arrival_date),
      to: formatArrivalDate(after.arrival_date),
    })
  }

  for (const col of [...columns].sort((a, b) => a.sort_order - b.sort_order)) {
    if (col.column_type === 'info_only') continue
    // Anchor each side's local conversion to that side's arrival date so
    // a time column renders "1500Z (1000L)" accurately (and a midnight
    // rollover is flagged) in the change summary agencies receive.
    const from = formatPprColumnValue(col, before.column_values[col.id], { ...opts, dateISO: before.arrival_date })
    const to = formatPprColumnValue(col, after.column_values[col.id], { ...opts, dateISO: after.arrival_date })
    if (from !== to) changes.push({ label: col.column_name, from, to })
  }

  const beforeNotes = before.notes ?? ''
  const afterNotes = after.notes ?? ''
  if (beforeNotes !== afterNotes) {
    changes.push({ label: 'Notes', from: beforeNotes, to: afterNotes })
  }

  return changes
}
