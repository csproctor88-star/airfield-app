import type { InspectionRow } from '@/lib/supabase/inspections'

/**
 * Pick the inspection that represents a given type's status for a duty day.
 *
 * A COMPLETED inspection always wins over an in-progress one: once the day's
 * inspection is filed, the day is done and stays locked — even if a stray
 * in-progress draft exists for the same day (which can happen when a duplicate
 * row is persisted offline or before history finishes loading). Within a
 * status, the newest row (by created_at) wins.
 *
 * Callers must not rely on input ordering — this sorts explicitly.
 */
export function pickTodaysInspection(
  rows: InspectionRow[],
  type: InspectionRow['inspection_type'],
  dateStr: string,
): InspectionRow | null {
  const sameDay = rows.filter(
    r => r.inspection_type === type && r.inspection_date === dateStr,
  )
  if (sameDay.length === 0) return null

  const newestFirst = (a: InspectionRow, b: InspectionRow) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '')

  const completed = sameDay.filter(r => r.status === 'completed').sort(newestFirst)
  if (completed.length > 0) return completed[0]

  return [...sameDay].sort(newestFirst)[0]
}
