// Daily inspection draft — persisted in localStorage
// Survives page refreshes and browser closes until explicitly filed or cleared

import type { InspectionSection } from '@/lib/constants'
import type { InspectionItem } from '@/lib/supabase/types'

const DRAFT_KEY_PREFIX = 'airfield_daily_inspection_draft'

function getDraftKey(baseId?: string): string {
  return baseId ? `${DRAFT_KEY_PREFIX}_${baseId}` : DRAFT_KEY_PREFIX
}

export interface InspectionHalfDraft {
  responses: Record<string, 'pass' | 'fail' | 'na' | null>
  bwcValue: string | null
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
): { items: InspectionItem[]; passed: number; failed: number; na: number; total: number } {
  const visSecs = sections.filter((s) => !s.conditional || half.enabledConditionals[s.id])
  const visItems = visSecs.flatMap((s) => s.items)

  const items: InspectionItem[] = visItems.map((item) => {
    const section = visSecs.find((s) => s.items.some((i) => i.id === item.id))
    const response = item.type === 'bwc'
      ? (half.bwcValue ? 'pass' : null)
      : (half.responses[item.id] ?? null)
    return {
      id: item.id,
      section: section?.title || '',
      item: item.item,
      response: response as 'pass' | 'fail' | 'na' | null,
      notes: item.type === 'bwc' ? (half.bwcValue || '') : (half.comments[item.id] || ''),
      photo_id: null,
      generated_discrepancy_id: null,
    }
  })

  const passed = visItems.filter((i) => {
    if (i.type === 'bwc') return half.bwcValue !== null
    return half.responses[i.id] === 'pass'
  }).length
  const failed = visItems.filter((i) => half.responses[i.id] === 'fail').length
  const na = visItems.filter((i) => {
    if (i.type === 'bwc') return false
    return half.responses[i.id] === 'na'
  }).length

  return { items, passed, failed, na, total: visItems.length }
}
