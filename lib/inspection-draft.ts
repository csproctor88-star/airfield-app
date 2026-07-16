// Daily inspection draft — persisted in localStorage
// Survives page refreshes and browser closes until explicitly filed or cleared

import type { InspectionSection } from '@/lib/constants'
import type { InspectionItem, SimpleDiscrepancy } from '@/lib/supabase/types'

// ── Per-type draft storage (for separated airfield/lighting forms) ──
const TYPE_DRAFT_PREFIX = 'glidepath_inspection_draft'

function getTypeDraftKey(type: string, baseId?: string): string {
  return baseId ? `${TYPE_DRAFT_PREFIX}_${type}_${baseId}` : `${TYPE_DRAFT_PREFIX}_${type}`
}

export interface SingleInspectionDraft {
  id: string
  createdAt: string
  type: 'airfield' | 'lighting'
  half: InspectionHalfDraft
}

export function createSingleDraft(type: 'airfield' | 'lighting'): SingleInspectionDraft {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    type,
    half: createEmptyHalf(),
  }
}

export function loadTypeDraft(type: 'airfield' | 'lighting', baseId?: string | null): SingleInspectionDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(getTypeDraftKey(type, baseId ?? undefined))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SingleInspectionDraft
    return { ...parsed, half: normalizeHalfDraft(parsed.half) }
  } catch {
    return null
  }
}

export function saveTypeDraft(type: 'airfield' | 'lighting', draft: SingleInspectionDraft, baseId?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getTypeDraftKey(type, baseId ?? undefined), JSON.stringify(draft))
}

export function clearTypeDraft(type: 'airfield' | 'lighting', baseId?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getTypeDraftKey(type, baseId ?? undefined))
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
  /** Photo IDs already uploaded to Supabase Storage — keyed by item ID */
  uploadedPhotos?: Record<string, string[]>
}

export interface DailyInspectionDraft {
  id: string
  createdAt: string
  airfield: InspectionHalfDraft
  lighting: InspectionHalfDraft
  construction_meeting: InspectionHalfDraft
  joint_monthly: InspectionHalfDraft
  /** Set when the airfield half has been filed — persists across reloads so the lighting prompt shows */
  airfieldFiled?: boolean
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

/**
 * Normalize an untrusted draft blob — from localStorage OR a DB `Json` column —
 * into a complete InspectionHalfDraft. Missing, old, or wrong-typed fields fall
 * back to empty-draft defaults, so resuming an out-of-date or partial draft can
 * never render blank or throw. This is the single backward-compat boundary for
 * both storage paths (the DB load path previously trusted the blob shape blind).
 */
export function normalizeHalfDraft(raw: unknown): InspectionHalfDraft {
  const base = createEmptyHalf()
  if (!raw || typeof raw !== 'object') return base
  const merged = { ...base, ...(raw as Partial<InspectionHalfDraft>) }
  // Guard the container fields so a wrong-typed / old blob can't break rendering.
  const isRec = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)
  if (!isRec(merged.responses)) merged.responses = base.responses
  if (!isRec(merged.comments)) merged.comments = base.comments
  if (!isRec(merged.enabledConditionals)) merged.enabledConditionals = base.enabledConditionals
  if (!isRec(merged.personnelNames)) merged.personnelNames = base.personnelNames
  if (!isRec(merged.discrepancies)) merged.discrepancies = base.discrepancies
  if (!Array.isArray(merged.selectedPersonnel)) merged.selectedPersonnel = base.selectedPersonnel
  if (typeof merged.rcrReported !== 'boolean') merged.rcrReported = base.rcrReported
  return merged
}

/** Reconstruct a draft half from completed inspection items (for reopened inspections) */
export function itemsToDraftHalf(
  items: InspectionItem[],
  dbRowId: string,
  inspectorName?: string | null,
  inspectorId?: string | null,
  rscCondition?: string | null,
  rcrValue?: string | null,
  rcrCondition?: string | null,
  bwcValue?: string | null,
  weatherConditions?: string | null,
  temperatureF?: number | null,
  notes?: string | null,
): InspectionHalfDraft {
  const responses: Record<string, 'pass' | 'fail' | 'na' | null> = {}
  const comments: Record<string, string> = {}
  const discrepancies: Record<string, SimpleDiscrepancy[]> = {}

  for (const item of items) {
    if (item.response) {
      responses[item.id] = item.response
    }
    if (item.notes) {
      comments[item.id] = item.notes
    }
    if (item.discrepancies && item.discrepancies.length > 0) {
      discrepancies[item.id] = item.discrepancies
    } else if (item.response === 'fail' && item.notes) {
      discrepancies[item.id] = [{
        comment: item.notes,
        location: item.location || null,
        photo_ids: [],
        generated_discrepancy_id: item.generated_discrepancy_id || null,
      }]
    }
  }

  return {
    responses,
    bwcValue: bwcValue || null,
    rscCondition: rscCondition || null,
    rcrReported: !!rcrValue,
    rcrValue: rcrValue || null,
    rcrConditionType: rcrCondition || null,
    comments,
    enabledConditionals: {},
    notes: notes || '',
    inspectorName: inspectorName || null,
    inspectorId: inspectorId || null,
    savedAt: null,
    weatherConditions: weatherConditions || null,
    temperatureF: temperatureF ?? null,
    specialComment: '',
    selectedPersonnel: [],
    personnelNames: {},
    dbRowId,
    discrepancies,
  }
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
