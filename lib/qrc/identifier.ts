import type { QrcExecution, QrcStep, QrcStepResponse, QrcTemplate } from '@/lib/supabase/types'

/** Depth-first walk of a step tree (parent, then its sub-steps) — same order
 *  the page and PDF render steps in. */
function flattenSteps(steps: QrcStep[]): QrcStep[] {
  const flat: QrcStep[] = []
  for (const step of steps) {
    flat.push(step)
    if (step.sub_steps) flat.push(...flattenSteps(step.sub_steps))
  }
  return flat
}

/**
 * The distinguishing identifier for an active QRC, used in the Active/History
 * lists, the dashboard widget, and the closed-QRC PDF.
 *
 * Resolution order (convention-based, zero-config so it survives template edits):
 *   1. A manual `label` on the execution wins outright.
 *   2. SCN-form QRCs use the Call Sign field (+ " / " + aircraft type if set).
 *   3. Otherwise the first `fill_field` (in render order) that has a value.
 *   4. Nothing entered yet → "" (caller renders the row as before).
 */
export function deriveQrcIdentifier(
  execution: Pick<QrcExecution, 'label' | 'scn_data' | 'step_responses'>,
  template: Pick<QrcTemplate, 'has_scn_form' | 'steps'> | null | undefined,
): string {
  const manual = (execution.label ?? '').trim()
  if (manual) return manual

  if (template?.has_scn_form) {
    const scn = (execution.scn_data || {}) as Record<string, unknown>
    const callSign = String(scn.call_sign ?? '').trim()
    const aircraft = String(scn.type_of_aircraft ?? '').trim()
    if (callSign) return aircraft ? `${callSign} / ${aircraft}` : callSign
  }

  const responses = (execution.step_responses || {}) as Record<string, QrcStepResponse>
  const steps = (template?.steps as unknown as QrcStep[] | null) || []
  for (const step of flattenSteps(steps)) {
    if (step.type !== 'fill_field') continue
    const value = String(responses[step.id]?.value ?? '').trim()
    if (value) return value
  }

  return ''
}

/** Identifier truncated for compact list/PDF display. */
export function deriveQrcIdentifierShort(
  execution: Pick<QrcExecution, 'label' | 'scn_data' | 'step_responses'>,
  template: Pick<QrcTemplate, 'has_scn_form' | 'steps'> | null | undefined,
  max = 40,
): string {
  const id = deriveQrcIdentifier(execution, template)
  return id.length > max ? `${id.slice(0, max - 1).trimEnd()}…` : id
}
