// Pure helpers for grouping the Airfield Status board's NAVAIDs into
// per-runway-end columns. Grouping is name-based (base_navaids and
// navaid_statuses are keyed by navaid_name); these helpers are the single
// source of truth for which column a name lands in — the status page, and
// the Base Config NAVAIDs tab's grouping preview, both consume them.

/**
 * True when a NAVAID name belongs to a runway end. Case-insensitive.
 * Accepts the canonical prefix form ("26 ILS"), the natural suffix form
 * ("ILS 26"), the ICAO-import form ("MALSR RWY 26"), and a bare designator.
 * Suffix matching is token-bounded: "PAPI 18" does NOT match designator "8".
 */
export function navaidMatchesEnd(name: string, designator: string): boolean {
  const n = name.trim().toUpperCase()
  const d = designator.trim().toUpperCase()
  if (!n || !d) return false
  return n === d || n.startsWith(d + ' ') || n.endsWith(' ' + d)
}

/**
 * Board item label with the runway part stripped, so items under a
 * "RWY 26" heading don't repeat the 26: "26 ILS" → "ILS", "ILS 26" → "ILS",
 * "MALSR RWY 26" → "MALSR". Never returns empty (a bare "26" stays "26").
 */
export function navaidDisplayName(name: string, designators: readonly string[]): string {
  const n = name.trim()
  const upper = n.toUpperCase()
  for (const des of designators) {
    const d = des.trim().toUpperCase()
    if (!d) continue
    let stripped: string | null = null
    if (upper.startsWith(d + ' ')) stripped = n.slice(d.length + 1)
    else if (upper.endsWith(' RWY ' + d)) stripped = n.slice(0, n.length - (d.length + 5))
    else if (upper.endsWith(' ' + d)) stripped = n.slice(0, n.length - (d.length + 1))
    if (stripped !== null) {
      const trimmed = stripped.trim()
      if (trimmed) return trimmed
    }
  }
  return n
}

export type NavaidEndGroups<T> = {
  groups: { designator: string; items: T[] }[]
  other: T[]
}

/**
 * Assign each NAVAID to at most ONE group — the first matching runway end
 * in the given order wins (independent per-end filters could double-list a
 * name matching two ends). Groups keep the board's ILS-first sort; the
 * ungrouped remainder sorts alphabetically. Empty groups are kept (callers
 * filter) so the group list always mirrors the designator list.
 */
export function groupNavaidsByEnd<T extends { navaid_name: string }>(
  items: readonly T[],
  designators: readonly string[],
): NavaidEndGroups<T> {
  const groups = designators.map((designator) => ({ designator, items: [] as T[] }))
  const other: T[] = []
  for (const item of items) {
    const g = groups.find((grp) => navaidMatchesEnd(item.navaid_name, grp.designator))
    if (g) g.items.push(item)
    else other.push(item)
  }
  for (const g of groups) {
    g.items.sort((a, b) => (a.navaid_name.includes('ILS') ? -1 : b.navaid_name.includes('ILS') ? 1 : 0))
  }
  other.sort((a, b) => a.navaid_name.localeCompare(b.navaid_name))
  return { groups, other }
}
