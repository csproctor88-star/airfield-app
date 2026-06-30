import { DAF803_SECTIONS } from './reference-data'

export type Section803 = { id?: string; key: string; label: string; builtin: boolean }

/** Resolve the DAF 803 section chips from the per-base `amtr_803_sections` rows,
 *  sorted by sort_order. Falls back to the built-in defaults when the table is
 *  empty (defensive — e.g. before the backfill migration runs). Pure. */
export function resolveSections(fetched: Record<string, unknown>[] | null | undefined): Section803[] {
  if (fetched && fetched.length > 0) {
    return [...fetched]
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((r) => ({
        id: String(r.id),
        key: String(r.section_key),
        label: String(r.label ?? r.section_key),
        builtin: r.builtin === true,
      }))
  }
  return DAF803_SECTIONS.map((s) => ({ key: s.key, label: s.label, builtin: true }))
}
