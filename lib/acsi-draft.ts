// ACSI draft — persisted in localStorage
// Survives page refreshes until explicitly filed or cleared

import { ACSI_CHECKLIST_SECTIONS, ACSI_SUB_FIELD_LABELS } from '@/lib/constants'
import type { AcsiItem, AcsiItemResponse, AcsiDiscrepancyDetail, AcsiTeamMember, AcsiSignatureBlock, AcsiDraftData } from '@/lib/supabase/types'

const DRAFT_KEY_PREFIX = 'acsi_inspection_draft'

function getDraftKey(baseId?: string): string {
  return baseId ? `${DRAFT_KEY_PREFIX}_${baseId}` : DRAFT_KEY_PREFIX
}

export function createNewAcsiDraft(): AcsiDraftData {
  return {
    responses: {},
    comments: {},
    discrepancies: {},
    team: [
      { id: crypto.randomUUID(), role: 'afm', name: '', rank: '', title: 'Airfield Manager' },
      { id: crypto.randomUUID(), role: 'ce', name: '', rank: '', title: 'CE Representative' },
      { id: crypto.randomUUID(), role: 'safety', name: '', rank: '', title: 'Safety' },
    ],
    signatures: [
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
    return JSON.parse(raw) as AcsiDraftData
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
): { items: AcsiItem[]; passed: number; failed: number; na: number; total: number } {
  const items: AcsiItem[] = []

  function buildDiscrepancy(d: AcsiDiscrepancyDetail) {
    return {
      comment: d.comment || '',
      work_order: d.work_order || '',
      project_number: d.project_number || '',
      estimated_cost: d.estimated_cost || '',
      estimated_completion: d.estimated_completion || '',
      photo_ids: d.photo_ids || [],
      areas: d.areas || [],
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      pins: d.pins || [],
    }
  }

  for (const section of ACSI_CHECKLIST_SECTIONS) {
    for (const item of section.items) {
      // Skip non-answerable headings
      if (item.isHeading) continue

      if (item.hasSubFields) {
        // Expand to A/B/C sub-field items
        for (const sf of ACSI_SUB_FIELD_LABELS) {
          const subId = `${item.id}.${sf.key}`
          const response: AcsiItemResponse = draft.responses[subId] ?? null
          const discrepancy = response === 'fail' ? (draft.discrepancies[subId] || null) : null
          items.push({
            id: subId,
            section_id: section.id,
            item_number: subId,
            question: `${item.question} — ${sf.label}`,
            response,
            discrepancy: discrepancy ? buildDiscrepancy(discrepancy) : null,
          })
        }
      } else {
        const response: AcsiItemResponse = draft.responses[item.id] ?? null
        const discrepancy = response === 'fail' ? (draft.discrepancies[item.id] || null) : null
        items.push({
          id: item.id,
          section_id: section.id,
          item_number: item.id,
          question: item.question,
          response,
          discrepancy: discrepancy ? buildDiscrepancy(discrepancy) : null,
        })
      }
    }
  }

  // Add locally-defined items (Section 10 extras)
  for (const local of draft.localItems) {
    const response: AcsiItemResponse = draft.responses[local.id] ?? null
    const discrepancy = response === 'fail' ? (draft.discrepancies[local.id] || null) : null
    items.push({
      id: local.id,
      section_id: 'acsi-10',
      item_number: local.id,
      question: local.question,
      response,
      discrepancy: discrepancy ? buildDiscrepancy(discrepancy) : null,
    })
  }

  const passed = items.filter(i => i.response === 'pass').length
  const failed = items.filter(i => i.response === 'fail').length
  const na = items.filter(i => i.response === 'na').length

  return { items, passed, failed, na, total: items.length }
}
