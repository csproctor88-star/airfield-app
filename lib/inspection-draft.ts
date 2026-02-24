// Daily inspection draft — persisted in localStorage
// Survives page refreshes and browser closes until explicitly filed or cleared

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
}

export interface DailyInspectionDraft {
  id: string
  createdAt: string
  airfield: InspectionHalfDraft
  lighting: InspectionHalfDraft
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
  }
}

export function createNewDraft(): DailyInspectionDraft {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    airfield: createEmptyHalf(),
    lighting: createEmptyHalf(),
  }
}

export function loadDraft(baseId?: string | null): DailyInspectionDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(getDraftKey(baseId ?? undefined))
    if (!raw) return null
    return JSON.parse(raw) as DailyInspectionDraft
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
