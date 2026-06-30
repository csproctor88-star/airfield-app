type AreaItem = { runway_or_taxiway: string | null }

/** Full runway names (RWY + contains "/") used to merge partial refs. */
export function buildFullRunwaysSet(items: AreaItem[]): Set<string> {
  const set = new Set<string>()
  for (const it of items) {
    const rt = it.runway_or_taxiway?.toUpperCase() || ''
    if (rt.startsWith('RWY') && rt.includes('/') && it.runway_or_taxiway) set.add(it.runway_or_taxiway)
  }
  return set
}

/** Normalize a system's free-text runway_or_taxiway onto a canonical area label. */
export function resolveArea(rwy: string | null, fullRunways: Set<string>): string {
  if (!rwy) return 'General'
  const upper = rwy.toUpperCase().replace(/^RWY\s*/, '')
  for (const full of Array.from(fullRunways)) {
    const fullUpper = full.toUpperCase().replace(/^RWY\s*/, '')
    const ends = fullUpper.split('/')
    if (ends.some(e => e.trim() === upper.trim())) return full
  }
  return rwy
}

/** Airfield precedence: full runway 100, single-end 200, TWY 300, named 500, general 900. */
export function areaSortKey(label: string): number {
  const u = label.toUpperCase()
  if (u.startsWith('RWY')) return u.includes('/') ? 100 : 200
  if (u.startsWith('TWY')) return 300
  if (u === 'GENERAL' || u === 'MISCELLANEOUS') return 900
  return 500
}

/** Distinct resolved areas (deduped by upper-case), sorted by precedence then numeric name. */
export function listAreas(systems: AreaItem[]): string[] {
  const full = buildFullRunwaysSet(systems)
  const byKey = new Map<string, string>()
  for (const s of systems) {
    const label = resolveArea(s.runway_or_taxiway, full)
    const key = label.toUpperCase()
    if (!byKey.has(key)) byKey.set(key, label)
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const d = areaSortKey(a) - areaSortKey(b)
    return d !== 0 ? d : a.localeCompare(b, undefined, { numeric: true })
  })
}

/** Systems whose resolved area equals `area`. */
export function systemsForArea<T extends AreaItem>(systems: T[], area: string): T[] {
  const full = buildFullRunwaysSet(systems)
  const key = area.toUpperCase()
  return systems.filter(s => resolveArea(s.runway_or_taxiway, full).toUpperCase() === key)
}
