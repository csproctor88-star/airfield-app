// Daily inspection draft — persisted in localStorage
// Survives page refreshes and browser closes until explicitly filed or cleared

import type { InspectionSection } from '@/lib/constants'
import type { InspectionItem, SimpleDiscrepancy } from '@/lib/supabase/types'

const DRAFT_KEY_PREFIX = 'airfield_daily_inspection_draft'

function getDraftKey(baseId?: string): string {
  return baseId ? `${DRAFT_KEY_PREFIX}_${baseId}` : DRAFT_KEY_PREFIX
}

export interface InspectionHalfDraft {
  responses: Record<string, 'pass' | 'fail' | 'na' | null>
  bwcValue: string | null
  rscCondition: string | null
  rcrReported: boolean
  rcrValue: string | null
  rcrConditionType: string | null
  comments: Record<string, string>
  enabledConditionals: Record<string, boolean>
  notes: string
  inspectorName: string | null
  inspectorId: string | null
  savedAt: string | null
  weatherConditions: string | null
  temperatureF: number | null
  specialComment: string
  selectedPersonnel: string[]
  personnelNames: Record<string, string>
  dbRowId: string | null
  discrepancies: Record<string, SimpleDiscrepancy[]>
}

export interface DailyInspectionDraft {
  id: string
  createdAt: string
  airfield: InspectionHalfDraft
  lighting: InspectionHalfDraft
  construction_meeting: InspectionHalfDraft
  joint_monthly: InspectionHalfDraft
}

function createEmptyHalf(): InspectionHalfDraft {
  return {
    responses: {},
    bwcValue: null,
    rscCondition: null,
    rcrReported: false,
    rcrValue: null,
    rcrConditionType: null,
    comments: {},
    enabledConditionals: {},
    notes: '',
    inspectorName: null,
    inspectorId: null,
    savedAt: null,
    weatherConditions: null,
    temperatureF: null,
    specialComment: '',
    selectedPersonnel: [],
    personnelNames: {},
    dbRowId: null,
    discrepancies: {},
  }
}

export function createNewDraft(): DailyInspectionDraft {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    airfield: createEmptyHalf(),
    lighting: createEmptyHalf(),
    construction_meeting: createEmptyHalf(),
    joint_monthly: createEmptyHalf(),
  }
}

export function loadDraft(baseId?: string | null): DailyInspectionDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(getDraftKey(baseId ?? undefined))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailyInspectionDraft
    // Backward-compat: add CM/JM halves if missing from older drafts
    if (!parsed.construction_meeting) parsed.construction_meeting = createEmptyHalf()
    if (!parsed.joint_monthly) parsed.joint_monthly = createEmptyHalf()
    // Backward-compat: add RSC/RCR fields if missing from older drafts
    for (const key of ['airfield', 'lighting', 'construction_meeting', 'joint_monthly'] as const) {
      const half = parsed[key]
      if (half.rscCondition === undefined) half.rscCondition = null
      if (half.rcrReported === undefined) half.rcrReported = false
      if (half.rcrValue === undefined) half.rcrValue = null
      if (half.rcrConditionType === undefined) half.rcrConditionType = null
    }
    // Backward-compat: add discrepancies field if missing from older drafts
    for (const key of ['airfield', 'lighting', 'construction_meeting', 'joint_monthly'] as const) {
      const half = parsed[key]
      if (!half.discrepancies) {
        half.discrepancies = {}
        // Migrate existing comments into discrepancies
        for (const [itemId, comment] of Object.entries(half.comments)) {
          if (comment && half.responses[itemId] === 'fail') {
            half.discrepancies[itemId] = [{ comment, location: null, photo_ids: [] }]
          }
        }
      }
    }
    return parsed
  } catch {
    return null
  }
}

export function saveDraftToStorage(draft: DailyInspectionDraft, baseId?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getDraftKey(baseId ?? undefined), JSON.stringify(draft))
}

export function clearDraft(baseId?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getDraftKey(baseId ?? undefined))
}

/** Build InspectionItem[] from a half draft and its visible sections.
 *  Extracts the duplicated items-building logic used when filing. */
export function halfDraftToItems(
  half: InspectionHalfDraft,
  sections: InspectionSection[],
  itemLocations?: Record<string, { lat: number; lon: number }>,
): { items: InspectionItem[]; passed: number; failed: number; na: number; total: number } {
  const visSecs = sections.filter((s) => !s.conditional || half.enabledConditionals[s.id])
  const visItems = visSecs.flatMap((s) => s.items)

  const items: InspectionItem[] = visItems.map((item) => {
    const section = visSecs.find((s) => s.items.some((i) => i.id === item.id))
    let response: 'pass' | 'fail' | 'na' | null
    let notes: string
    if (item.type === 'bwc') {
      response = half.bwcValue ? 'pass' : null
      notes = half.bwcValue || ''
    } else if (item.type === 'rsc') {
      response = half.rscCondition ? 'pass' : null
      notes = half.rscCondition || ''
    } else if (item.type === 'rcr') {
      response = half.rcrReported && half.rcrValue ? 'pass' : (half.rscCondition ? 'pass' : null)
      notes = half.rcrReported && half.rcrValue ? `${half.rcrValue}${half.rcrConditionType ? ` (${half.rcrConditionType})` : ''}` : (half.rcrReported ? '' : 'N/A — RSC only')
    } else {
      response = half.responses[item.id] ?? 'pass'
      const discs = half.discrepancies?.[item.id]
      const firstDisc = discs?.[0]
      notes = firstDisc?.comment || half.comments[item.id] || ''
    }
    const discs = half.discrepancies?.[item.id]
    const firstDisc = discs?.[0]
    return {
      id: item.id,
      section: section?.title || '',
      item: item.item,
      response,
      notes,
      photo_id: null,
      generated_discrepancy_id: null,
      location: firstDisc?.location || itemLocations?.[item.id] || null,
      discrepancies: discs && discs.length > 0 ? discs : undefined,
    }
  })

  const passed = visItems.filter((i) => {
    if (i.type === 'bwc') return half.bwcValue !== null
    if (i.type === 'rsc') return half.rscCondition !== null
    if (i.type === 'rcr') return half.rcrReported ? half.rcrValue !== null : half.rscCondition !== null
    return (half.responses[i.id] ?? 'pass') === 'pass'
  }).length
  const failed = visItems.filter((i) => half.responses[i.id] === 'fail').length
  const na = visItems.filter((i) => {
    if (i.type === 'bwc' || i.type === 'rsc' || i.type === 'rcr') return false
    return half.responses[i.id] === 'na'
  }).length

  return { items, passed, failed, na, total: visItems.length }
}
