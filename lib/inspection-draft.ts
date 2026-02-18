// Daily inspection draft — persisted in localStorage
// Survives page refreshes and browser closes until explicitly filed or cleared

const DRAFT_KEY = 'airfield_daily_inspection_draft'

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

export function loadDraft(): DailyInspectionDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DailyInspectionDraft
  } catch {
    return null
  }
}

export function saveDraftToStorage(draft: DailyInspectionDraft): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DRAFT_KEY)
}
