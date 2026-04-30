// FAA airfield-construction inspection checklist used by the
// "Construction" check type on /checks. Each item evaluates to one of
// three statuses; default is P (Pass) so the user only flips items
// that aren't passing.
//
// Source: FAA Advisory Circular guidance for airfield construction
// safety items (provided by the user as the canonical list, 2026-04-29).
//
// Storage: rows live in `airfield_checks.data.construction_items` as
// `{ [itemId]: 'P' | 'F' | 'N/A' }`. The `id` is the storage key —
// changing labels later is safe; changing ids requires a data backfill.

export type ConstructionItemStatus = 'P' | 'F' | 'N/A'

export type ConstructionItem = {
  id: string
  label: string
}

export type ConstructionSection = {
  id: string
  title: string
  items: ConstructionItem[]
}

export const CONSTRUCTION_CHECKLIST: ConstructionSection[] = [
  {
    id: 'safety',
    title: 'Safety and Security',
    items: [
      { id: 'barricades', label: 'Barricades — properly positioned with red lights to define hazardous areas' },
      { id: 'fencing',    label: 'Fencing — temporary fencing installed to prevent unauthorized access' },
      { id: 'fod_mgmt',   label: 'FOD Management — continuous cleanup of construction debris' },
      { id: 'stockpile',  label: 'Stockpiled Materials — properly stored to prevent displacement by wind or jet blast' },
    ],
  },
  {
    id: 'operational',
    title: 'Operational Areas',
    items: [
      { id: 'movement',    label: 'Movement Areas — construction equipment parked in designated areas outside safety zones' },
      { id: 'rwy_taxi',    label: 'Runway/Taxiway Openings — reopened areas swept clean for FOD' },
      { id: 'markings',    label: 'Markings/Lighting — temporary closures or deviations properly marked and lighted' },
      { id: 'obstruction', label: 'Obstruction Lights — operable and in place on temporary structures' },
    ],
  },
  {
    id: 'documentation',
    title: 'Documentation and Coordination',
    items: [
      { id: 'notams',   label: 'NOTAMs — verification of accuracy and timeliness' },
      { id: 'vehicles', label: 'Vehicles — checked for authorized access and radio communication capability' },
      { id: 'signage',  label: 'Signage — updated, correct, and visible' },
    ],
  },
]

export const CONSTRUCTION_ITEM_STATUSES: ConstructionItemStatus[] = ['P', 'F', 'N/A']

/** Default state used when starting a new Construction check — every
 *  item is P. The user only changes items that aren't passing. */
export const DEFAULT_CONSTRUCTION_ITEM_STATE: Record<string, ConstructionItemStatus> = (() => {
  const init: Record<string, ConstructionItemStatus> = {}
  for (const section of CONSTRUCTION_CHECKLIST) {
    for (const item of section.items) {
      init[item.id] = 'P'
    }
  }
  return init
})()

/** Counts of P / F / N/A — used by the detail card and PDF summary. */
export function summarizeConstructionItems(state: Record<string, ConstructionItemStatus> | undefined | null) {
  const counts = { P: 0, F: 0, 'N/A': 0 }
  if (!state) return counts
  for (const section of CONSTRUCTION_CHECKLIST) {
    for (const item of section.items) {
      const v = state[item.id]
      if (v === 'P' || v === 'F' || v === 'N/A') counts[v]++
    }
  }
  return counts
}
