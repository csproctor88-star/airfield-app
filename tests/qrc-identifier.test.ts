import { describe, it, expect } from 'vitest'
import { deriveQrcIdentifier, deriveQrcIdentifierShort } from '@/lib/qrc/identifier'
import type { QrcExecution, QrcStep, QrcTemplate } from '@/lib/supabase/types'

// Minimal shapes — the helper only reads the Pick'd fields.
const exec = (over: Partial<Pick<QrcExecution, 'label' | 'scn_data' | 'step_responses'>>) =>
  ({ label: null, scn_data: null, step_responses: null, ...over }) as Pick<
    QrcExecution, 'label' | 'scn_data' | 'step_responses'
  >

const tmpl = (over: Partial<Pick<QrcTemplate, 'has_scn_form' | 'steps'>>) =>
  ({ has_scn_form: false, steps: [], ...over }) as Pick<QrcTemplate, 'has_scn_form' | 'steps'>

const steps = (s: QrcStep[]) => s as unknown as QrcTemplate['steps']

describe('deriveQrcIdentifier', () => {
  it('manual label wins over everything', () => {
    const e = exec({ label: 'PRIORITY ONE', scn_data: { call_sign: 'REACH471' } })
    const t = tmpl({ has_scn_form: true })
    expect(deriveQrcIdentifier(e, t)).toBe('PRIORITY ONE')
  })

  it('trims a whitespace-only label and falls through', () => {
    const e = exec({ label: '   ', scn_data: { call_sign: 'REACH471' } })
    const t = tmpl({ has_scn_form: true })
    expect(deriveQrcIdentifier(e, t)).toBe('REACH471')
  })

  it('SCN: call sign only', () => {
    const e = exec({ scn_data: { call_sign: 'REACH471' } })
    const t = tmpl({ has_scn_form: true })
    expect(deriveQrcIdentifier(e, t)).toBe('REACH471')
  })

  it('SCN: call sign + aircraft type', () => {
    const e = exec({ scn_data: { call_sign: 'REACH471', type_of_aircraft: 'C-17' } })
    const t = tmpl({ has_scn_form: true })
    expect(deriveQrcIdentifier(e, t)).toBe('REACH471 / C-17')
  })

  it('non-SCN: first fill_field with a value, in render order (sub-steps included)', () => {
    const t = tmpl({
      steps: steps([
        { id: '1', type: 'checkbox', label: 'do a thing' },
        {
          id: '2', type: 'fill_field', label: 'details',
          sub_steps: [
            { id: '2a', type: 'fill_field', label: 'Name' },
            { id: '2b', type: 'fill_field', label: 'Vehicle' },
          ],
        },
      ]),
    })
    // 2 has no value; 2a is the first filled fill_field.
    const e = exec({ step_responses: { '2a': { completed: true, value: 'SSgt Smith' }, '2b': { completed: true, value: 'Truck' } } })
    expect(deriveQrcIdentifier(e, t)).toBe('SSgt Smith')
  })

  it('non-SCN: ignores checkbox/time_field values and empty strings', () => {
    const t = tmpl({
      steps: steps([
        { id: '1', type: 'time_field', label: 'time' },
        { id: '2', type: 'fill_field', label: 'tail' },
      ]),
    })
    const e = exec({ step_responses: { '1': { completed: true, value: '1432' }, '2': { completed: true, value: 'TAIL 58-0220' } } })
    expect(deriveQrcIdentifier(e, t)).toBe('TAIL 58-0220')
  })

  it('returns empty string when nothing is filled', () => {
    const t = tmpl({ steps: steps([{ id: '1', type: 'fill_field', label: 'tail' }]) })
    expect(deriveQrcIdentifier(exec({}), t)).toBe('')
    expect(deriveQrcIdentifier(exec({}), null)).toBe('')
  })

  it('short variant truncates with an ellipsis', () => {
    const e = exec({ label: 'A'.repeat(60) })
    const out = deriveQrcIdentifierShort(e, null, 40)
    expect(out.length).toBe(40)
    expect(out.endsWith('…')).toBe(true)
  })
})
