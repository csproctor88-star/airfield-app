// Glidepath — Aircraft Characteristics Database
// Sources: USACE TSC 13-2 (Military) & TSC 13-3 (Commercial)

import type { AircraftCharacteristics } from '../aircraft_database_schema'
import commercialRaw from '../commercial_aircraft.json'
import militaryRaw from '../military_aircraft.json'

// Merge and tag both datasets — military first, then commercial, each sorted A–Z
const allAircraft: AircraftCharacteristics[] = [
  ...(militaryRaw as AircraftCharacteristics[]).map(a => ({ ...a, category: 'military' })).sort((a, b) => a.aircraft.localeCompare(b.aircraft)),
  ...(commercialRaw as AircraftCharacteristics[]).map(a => ({ ...a, category: 'commercial' })).sort((a, b) => a.aircraft.localeCompare(b.aircraft)),
]

export { allAircraft }

export const AIRCRAFT_COUNT = {
  total: allAircraft.length,
  commercial: commercialRaw.length,
  military: militaryRaw.length,
}

// Get unique manufacturers sorted
export const MANUFACTURERS = Array.from(
  new Set(allAircraft.map(a => a.manufacturer).filter(Boolean) as string[])
).sort()

// Sort field options for the UI
export type AircraftSortField = 'name' | 'manufacturer' | 'wingspan' | 'length' | 'max_weight' | 'turn_radius'

export const SORT_OPTIONS: { value: AircraftSortField; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'wingspan', label: 'Wingspan' },
  { value: 'length', label: 'Length' },
  { value: 'max_weight', label: 'Max Takeoff Weight' },
  { value: 'turn_radius', label: 'Turn Radius' },
]

function parseNum(v: string | undefined): number {
  if (!v) return 0
  return parseFloat(v.replace(/,/g, '')) || 0
}

export function getSortValue(ac: AircraftCharacteristics, field: AircraftSortField): string | number {
  switch (field) {
    case 'name': return ac.aircraft
    case 'manufacturer': return ac.manufacturer || ''
    case 'wingspan': return parseNum(ac.wing_span_ft)
    case 'length': return parseNum(ac.length_ft)
    case 'max_weight': return parseNum(ac.max_to_wt_klbs)
    case 'turn_radius': return parseNum(ac.turn_radius_ft)
  }
}

export function sortAircraft(
  list: AircraftCharacteristics[],
  field: AircraftSortField,
  desc = false
): AircraftCharacteristics[] {
  return [...list].sort((a, b) => {
    const va = getSortValue(a, field)
    const vb = getSortValue(b, field)
    let cmp = 0
    if (typeof va === 'string' && typeof vb === 'string') {
      cmp = va.localeCompare(vb)
    } else {
      cmp = (va as number) - (vb as number)
    }
    return desc ? -cmp : cmp
  })
}

// Format helpers
export function fmtNum(v: string | undefined, unit?: string): string {
  if (!v) return '—'
  const n = v.replace(/,/g, '')
  const parsed = parseFloat(n)
  if (isNaN(parsed)) return v
  const formatted = parsed.toLocaleString('en-US', { maximumFractionDigits: 1 })
  return unit ? `${formatted} ${unit}` : formatted
}

export function fmtWeight(v: string | undefined): string {
  if (!v) return '—'
  const n = parseFloat(v.replace(/,/g, ''))
  if (isNaN(n)) return v
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}k lbs`
}

// Favorites persistence
const FAVORITES_KEY = 'glidepath_aircraft_favorites'

export function getFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function setFavorites(favorites: Set<string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)))
}
