import { DAF803_SECTIONS } from './reference-data'

export type Section803 = { id?: string; key: string; label: string; builtin: boolean; seedDefault?: boolean }

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
        seedDefault: r.seed_default === true,
      }))
  }
  return DAF803_SECTIONS.map((s) => ({ key: s.key, label: s.label, builtin: true }))
}

/** Pick the seed_default custom sections (+ their tasks) to seed into a new base:
 *  drop sections already present (by key) and de-duplicate by key, then keep only
 *  tasks belonging to the chosen sections (de-duped by section|sts_item). Pure. */
export function dedupeSeed803(
  seedSections: Record<string, unknown>[],
  seedTasks: Record<string, unknown>[],
  existingKeys: Set<string>,
): { sections: Record<string, unknown>[]; tasks: Record<string, unknown>[] } {
  const byKey = new Map<string, Record<string, unknown>>()
  for (const s of seedSections) {
    const k = String(s.section_key ?? '')
    if (!k || existingKeys.has(k) || byKey.has(k)) continue
    byKey.set(k, s)
  }
  const sections = Array.from(byKey.values())
  const addKeys = new Set(sections.map((s) => String(s.section_key)))
  const seen = new Set<string>()
  const tasks: Record<string, unknown>[] = []
  for (const t of seedTasks) {
    const k = String(t.section ?? '')
    if (!addKeys.has(k)) continue
    const tk = `${k}|${String(t.sts_item ?? '').trim()}`
    if (seen.has(tk)) continue
    seen.add(tk)
    tasks.push(t)
  }
  return { sections, tasks }
}
