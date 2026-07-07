// ACSI draft — persisted in localStorage
// Survives page refreshes until explicitly filed or cleared

import { ACSI_CHECKLIST_SECTIONS, ACSI_SUB_FIELD_LABELS } from '@/lib/constants'
import type { AcsiChecklistSection } from '@/lib/constants'
import type { AcsiItem, AcsiItemResponse, AcsiDiscrepancyDetail, AcsiTeamMember, AcsiSignatureBlock, AcsiDraftData } from '@/lib/supabase/types'
import type { AirportType } from '@/lib/airport-mode'

const DRAFT_KEY_PREFIX = 'acsi_inspection_draft'

/** Normalize legacy single-discrepancy data to the new array format */
export function normalizeAcsiDraftDiscrepancies(
  raw: Record<string, AcsiDiscrepancyDetail | AcsiDiscrepancyDetail[]>,
): Record<string, AcsiDiscrepancyDetail[]> {
  const result: Record<string, AcsiDiscrepancyDetail[]> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[key] = Array.isArray(value) ? value : [value]
  }
  return result
}

function getDraftKey(baseId?: string): string {
  return baseId ? `${DRAFT_KEY_PREFIX}_${baseId}` : DRAFT_KEY_PREFIX
}

export function createNewAcsiDraft(mode?: AirportType): AcsiDraftData {
  const isFaa = mode === 'faa_part139'
  return {
    responses: {},
    comments: {},
    discrepancies: {},
    team: isFaa
      ? [
          { id: crypto.randomUUID(), role: 'ops', name: '', rank: '', title: 'Airport Operations', signature_required: true },
        ]
      : [
          { id: crypto.randomUUID(), role: 'afm', name: '', rank: '', title: 'Airfield Manager', signature_required: true },
          { id: crypto.randomUUID(), role: 'ce', name: '', rank: '', title: 'CE Representative', signature_required: true },
          { id: crypto.randomUUID(), role: 'safety', name: '', rank: '', title: 'Safety', signature_required: true },
        ],
    signatures: isFaa
      ? []
      : [
          { label: 'OG/CC', organization: '', name: '', rank: '', title: '' },
          { label: 'MSG/CC', organization: '', name: '', rank: '', title: '' },
          { label: 'WG/CC', organization: '', name: '', rank: '', title: '' },
        ],
    notes: '',
    collapsedSections: {},
    localItems: [],
  }
}

export function loadAcsiDraft(baseId?: string | null): AcsiDraftData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(getDraftKey(baseId ?? undefined))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AcsiDraftData
    if (parsed.discrepancies) {
      parsed.discrepancies = normalizeAcsiDraftDiscrepancies(parsed.discrepancies)
    }
    return parsed
  } catch {
    return null
  }
}

export function saveAcsiDraftToStorage(draft: AcsiDraftData, baseId?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getDraftKey(baseId ?? undefined), JSON.stringify(draft))
}

export function clearAcsiDraft(baseId?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getDraftKey(baseId ?? undefined))
}

/** Build AcsiItem[] from draft state. Returns items array + counts. */
export function acsiDraftToItems(
  draft: AcsiDraftData,
  sections: AcsiChecklistSection[] = ACSI_CHECKLIST_SECTIONS,
): { items: AcsiItem[]; passed: number; failed: number; na: number; total: number } {
  const items: AcsiItem[] = []

  function buildDiscrepancy(d: AcsiDiscrepancyDetail) {
    return {
      comment: d.comment || '',
      work_order: d.work_order || '',
      project_number: d.project_number || '',
      estimated_cost: d.estimated_cost || '',
      estimated_completion: d.estimated_completion || '',
      risk_control_measure: d.risk_control_measure || '',
      photo_ids: d.photo_ids || [],
      areas: d.areas || [],
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      pins: d.pins || [],
      linked_discrepancy_id: d.linked_discrepancy_id ?? null,
    }
  }

  for (const section of sections) {
    for (const item of section.items) {
      // Skip non-answerable headings
      if (item.isHeading) continue

      if (item.hasSubFields) {
        // Expand to A/B/C sub-field items
        for (const sf of ACSI_SUB_FIELD_LABELS) {
          const subId = `${item.id}.${sf.key}`
          const response: AcsiItemResponse = draft.responses[subId] ?? null
          const discArray = response === 'fail' ? (draft.discrepancies[subId] || []) : []
          items.push({
            id: subId,
            section_id: section.id,
            item_number: subId,
            question: `${item.question} — ${sf.label}`,
            response,
            discrepancy: discArray.length > 0 ? buildDiscrepancy(discArray[0]) : null,
            discrepancies: discArray.map(d => buildDiscrepancy(d)),
          })
        }
      } else {
        const response: AcsiItemResponse = draft.responses[item.id] ?? null
        const discArray = response === 'fail' ? (draft.discrepancies[item.id] || []) : []
        items.push({
          id: item.id,
          section_id: section.id,
          item_number: item.id,
          question: item.question,
          response,
          discrepancy: discArray.length > 0 ? buildDiscrepancy(discArray[0]) : null,
          discrepancies: discArray.map(d => buildDiscrepancy(d)),
        })
      }
    }
  }

  // Add locally-defined items (Section 10 extras)
  for (const local of draft.localItems) {
    const response: AcsiItemResponse = draft.responses[local.id] ?? null
    const discArray = response === 'fail' ? (draft.discrepancies[local.id] || []) : []
    items.push({
      id: local.id,
      section_id: 'acsi-10',
      item_number: local.id,
      question: local.question,
      response,
      discrepancy: discArray.length > 0 ? buildDiscrepancy(discArray[0]) : null,
      discrepancies: discArray.map(d => buildDiscrepancy(d)),
    })
  }

  const passed = items.filter(i => i.response === 'pass').length
  const failed = items.filter(i => i.response === 'fail').length
  const na = items.filter(i => i.response === 'na').length

  return { items, passed, failed, na, total: items.length }
}
