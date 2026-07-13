/**
 * Per-base shift configuration (1-3 shifts, renameable).
 *
 * Internal keys are fixed ('day' | 'swing' | 'mid') — they appear in
 * shift_checklist_items.shift and in the daily_reviews signature column
 * names, so they never change. What a base configures is how many of
 * them are active (bases.shift_count, 1-3) and what each is called
 * (bases.shift_name_day / _swing / _mid; NULL or blank = default label).
 *
 * This module is the single source of truth for resolving a base's
 * active shifts. UI must never hardcode shift names or counts.
 */

export type ShiftKey = 'day' | 'swing' | 'mid'

export interface ShiftDef {
  key: ShiftKey
  label: string
}

/** The subset of the bases row that shift resolution reads. */
export interface ShiftConfigSource {
  shift_count?: number | null
  shift_name_day?: string | null
  shift_name_swing?: string | null
  shift_name_mid?: string | null
}

export const SHIFT_ORDER: ShiftKey[] = ['day', 'swing', 'mid']

export const DEFAULT_SHIFT_LABELS: Record<ShiftKey, string> = {
  day: 'Day Shift',
  swing: 'Swing Shift',
  mid: 'Mid Shift',
}

/** Trimmed custom name for a shift, or null when unset/blank. */
export function customShiftName(
  base: ShiftConfigSource | null | undefined,
  key: ShiftKey,
): string | null {
  const raw =
    key === 'day' ? base?.shift_name_day
    : key === 'swing' ? base?.shift_name_swing
    : base?.shift_name_mid
  const trimmed = (raw || '').trim()
  return trimmed || null
}

/** Display label for a shift: custom name, else the default. */
export function getShiftLabel(
  base: ShiftConfigSource | null | undefined,
  key: ShiftKey,
): string {
  return customShiftName(base, key) || DEFAULT_SHIFT_LABELS[key]
}

/**
 * The base's active shifts, in canonical order, with resolved labels.
 * shift_count is clamped to 1..3; a missing count means 2 (the DB default).
 */
export function getActiveShifts(base: ShiftConfigSource | null | undefined): ShiftDef[] {
  const raw = base?.shift_count ?? 2
  const count = Math.min(3, Math.max(1, raw))
  return SHIFT_ORDER.slice(0, count).map((key) => ({ key, label: getShiftLabel(base, key) }))
}

/**
 * Group checklist-style items (anything with a `shift` key) into one
 * bucket per active shift. Items whose shift is not active on this base
 * (e.g. created before a shift-count reduction synced) fold into the
 * FIRST bucket — items must never silently vanish from a compliance
 * checklist.
 */
export function bucketItemsByShift<T extends { shift: string }>(
  items: T[],
  base: ShiftConfigSource | null | undefined,
): Array<ShiftDef & { items: T[] }> {
  const shifts = getActiveShifts(base)
  const activeKeys = new Set<string>(shifts.map((s) => s.key))
  const buckets = shifts.map((s) => ({ ...s, items: items.filter((i) => i.shift === s.key) }))
  const strays = items.filter((i) => !activeKeys.has(i.shift))
  if (strays.length > 0) buckets[0].items = [...buckets[0].items, ...strays]
  return buckets
}
