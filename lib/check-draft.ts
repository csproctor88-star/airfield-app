// Airfield check draft — persisted in localStorage
// Survives page refreshes and browser closes until explicitly completed or cleared

import type { SimpleDiscrepancy, CheckType } from '@/lib/supabase/types'

const DRAFT_KEY_PREFIX = 'airfield_check_draft'

function getDraftKey(baseId?: string): string {
  return baseId ? `${DRAFT_KEY_PREFIX}_${baseId}` : DRAFT_KEY_PREFIX
}

export interface CheckDraft {
  checkType: CheckType | ''
  areas: string[]
  issueFound: boolean
  issues: SimpleDiscrepancy[]
  remarks: { id: string; comment: string; user_name: string; created_at: string }[]
  remarkText: string
  // Type-specific fields
  rscCondition: string
  reportRcr: boolean
  rcrValue: string
  rcrConditionType: string
  bashCondition: string
  bashSpecies: string
  aircraftType: string
  callsign: string
  emergencyNature: string
  checkedActions: string[]
  notifiedAgencies: string[]
  heavyAircraftType: string
  savedAt: string
  dbRowId: string | null
}

export function createEmptyCheckDraft(): CheckDraft {
  return {
    checkType: '',
    areas: [],
    issueFound: false,
    issues: [],
    remarks: [],
    remarkText: '',
    rscCondition: '',
    reportRcr: false,
    rcrValue: '',
    rcrConditionType: '',
    bashCondition: '',
    bashSpecies: '',
    aircraftType: '',
    callsign: '',
    emergencyNature: '',
    checkedActions: [],
    notifiedAgencies: [],
    heavyAircraftType: '',
    savedAt: '',
    dbRowId: null,
  }
}

export function loadCheckDraft(baseId?: string | null): CheckDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(getDraftKey(baseId ?? undefined))
    if (!raw) return null
    return JSON.parse(raw) as CheckDraft
  } catch {
    return null
  }
}

export function saveCheckDraft(draft: CheckDraft, baseId?: string | null): void {
  if (typeof window === 'undefined') return
  draft.savedAt = new Date().toISOString()
  localStorage.setItem(getDraftKey(baseId ?? undefined), JSON.stringify(draft))
}

export function clearCheckDraft(baseId?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getDraftKey(baseId ?? undefined))
}
