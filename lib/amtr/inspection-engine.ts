// ─────────────────────────────────────────────────────────────
// AMTR Training Record Inspection — gap engine (pure, unit-tested).
//
// Reads a member's loaded AMTR datasets and, for each automatable
// checklist item (keyed by `auto_key`), returns a suggested Yes/No/
// N/A plus specific findings naming the offending rows. The inspect
// page pre-fills each checklist item from this and lets the inspector
// override. Items with no auto_key are answered manually.
// ─────────────────────────────────────────────────────────────

import { RAT_EXEMPT_STATUSES } from './status'
import type { InspectionAutoKey } from './inspection-checklist'

type Row = Record<string, unknown>
export type AutoStatus = 'yes' | 'no' | 'na' | null
export type AutoResult = { auto: AutoStatus; findings: string[] }

export type InspectionScanData = {
  member: Row
  roleAssignments: { user_id: string; role: string }[]
  jqsCatalog: Row[]; jqsProgress: Row[]
  r1098Catalog: Row[]; r1098Progress: Row[]
  ratCatalog: Row[]; ratProgress: Row[]
  e623a: Row[]
  items797: Row[]
  items803: Row[]
  milestoneProgress: Row[]
  formalCatalog: Row[]; formalProgress: Row[]
}

const has = (v: unknown): boolean => v != null && String(v).trim() !== ''
const label = (r: Row): string => String(r.number ?? r.item_number ?? r.task ?? r.course ?? r.title ?? r.sts_item ?? r.id ?? '?')

/** Cap a findings list so the UI stays readable. */
function summarize(missing: string[], noun: string): string[] {
  if (missing.length === 0) return []
  const shown = missing.slice(0, 6).join(', ')
  const more = missing.length > 6 ? `, +${missing.length - 6} more` : ''
  return [`${missing.length} ${noun}: ${shown}${more}`]
}

export function runInspectionScan(d: InspectionScanData): Record<InspectionAutoKey, AutoResult> {
  const out = {} as Record<InspectionAutoKey, AutoResult>
  const set = (k: InspectionAutoKey, auto: AutoStatus, findings: string[] = []) => { out[k] = { auto, findings } }

  const m = d.member
  const userId = m.user_id ? String(m.user_id) : null
  const holdsRole = (role: string) => !!userId && d.roleAssignments.some((a) => a.user_id === userId && a.role === role)

  // 2.1 — member identity fields
  {
    const fields: [string, string][] = [['full_name', 'name'], ['grade', 'rank'], ['duty_position', 'duty position'], ['dafsc', 'DAFSC'], ['tsc', 'TSC']]
    const missing = fields.filter(([f]) => !has(m[f])).map(([, n]) => n)
    set('member_identity', missing.length ? 'no' : 'yes', missing.length ? [`Missing: ${missing.join(', ')}`] : [])
  }

  // 2.5 / 2.6 — trainer / certifier qualified (annotated via role assignment)
  set('trainer_qualified', holdsRole('trainer') ? 'yes' : 'na')
  set('certifier_qualified', holdsRole('certifier') ? 'yes' : 'na')

  // 3.1 / 3.2 — formal PME / continuation start+complete dates
  {
    const catById = new Map(d.formalCatalog.map((c) => [String(c.id), c]))
    const progByCat = new Map(d.formalProgress.map((p) => [String(p.catalog_id), p]))
    const evalSection = (section: string, key: InspectionAutoKey) => {
      const cats = d.formalCatalog.filter((c) => c.section === section)
      const dated = cats.filter((c) => { const p = progByCat.get(String(c.id)); return p && (has(p.start_date) || has(p.complete_date)) })
      if (dated.length === 0) { set(key, 'na'); return }
      const missing = dated.filter((c) => { const p = progByCat.get(String(c.id))!; return !(has(p.start_date) && has(p.complete_date)) })
        .map((c) => String(catById.get(String(c.id))?.course ?? c.id))
      set(key, missing.length ? 'no' : 'yes', summarize(missing, 'course(s) missing a start or completion date'))
    }
    evalSection('haf', 'formal_pme_dates')
    evalSection('continuation', 'formal_continuation_dates')
  }

  // 4.1 — 623A entries signed by required members (trainee + trainer)
  {
    if (d.e623a.length === 0) set('623a_signed', 'na')
    else {
      const missing = d.e623a.filter((e) => !(has(e.trainee_initials) && has(e.trainer_initials)))
        .map((e) => String(e.entry_type ?? e.form_date ?? e.id))
      set('623a_signed', missing.length ? 'no' : 'yes', summarize(missing, 'entry/entries missing required initials'))
    }
  }

  // 4.8 / 9.2 — JQS core tasks fully signed
  {
    const core = d.jqsCatalog.filter((c) => c.kind !== 'section' && has(c.core_cert))
    if (core.length === 0) set('jqs_core_signed', 'na')
    else {
      const progByCat = new Map(d.jqsProgress.map((p) => [String(p.catalog_id), p]))
      const missing = core.filter((c) => {
        const p = progByCat.get(String(c.id))
        return !(p && has(p.trainee_initials) && has(p.trainer_initials) && has(p.certifier_initials))
      }).map((c) => label(c))
      set('jqs_core_signed', missing.length ? 'no' : 'yes', summarize(missing, 'core task(s) not fully signed'))
    }
  }

  // 7.1 — 803 results + UGT documented
  {
    if (d.items803.length === 0) set('803_results_ugt', 'na')
    else {
      const missing = d.items803.filter((r) => !(has(r.results) && has(r.in_ugt))).map((r) => label(r))
      set('803_results_ugt', missing.length ? 'no' : 'yes', summarize(missing, '803 row(s) missing results or UGT status'))
    }
  }
  // 4.9 / 7.3 — UNSAT 803 rows have remarks / corrective actions
  {
    const unsat = d.items803.filter((r) => String(r.results) === 'UNSAT')
    if (unsat.length === 0) set('803_unsat_remarks', 'na')
    else {
      const missing = unsat.filter((r) => !(has(r.remarks) || has(r.unsat_comment))).map((r) => label(r))
      set('803_unsat_remarks', missing.length ? 'no' : 'yes', summarize(missing, 'UNSAT row(s) missing reason/corrective action'))
    }
  }
  // 7.4 — 803 rows have eval date + evaluator initials
  {
    if (d.items803.length === 0) set('803_date_evaluator', 'na')
    else {
      const missing = d.items803.filter((r) => !(has(r.eval_date) && has(r.evaluator_initials))).map((r) => label(r))
      set('803_date_evaluator', missing.length ? 'no' : 'yes', summarize(missing, '803 row(s) missing date or evaluator initials'))
    }
  }

  // 5.1 — 797 completed tasks have dates + required initials
  {
    if (d.items797.length === 0) set('797_dates_initials', 'na')
    else {
      const missing = d.items797.filter((r) => {
        const started = has(r.start_date) || has(r.complete_date)
        if (!started) return false
        const needCert = !!r.requires_certifier
        return !(has(r.trainee_initials) && has(r.trainer_initials) && (!needCert || has(r.certifier_initials)))
      }).map((r) => label(r))
      set('797_dates_initials', missing.length ? 'no' : 'yes', summarize(missing, '797 task(s) missing required initials'))
    }
  }
  // 5.3 — 797 items have a local milestone assigned
  {
    if (d.items797.length === 0) set('797_milestone_assigned', 'na')
    else {
      const missing = d.items797.filter((r) => !has(r.milestone_window)).map((r) => label(r))
      set('797_milestone_assigned', missing.length ? 'no' : 'yes', summarize(missing, '797 task(s) missing a local milestone'))
    }
  }

  // 6.1 — 1098 completed items have dates + signatures
  {
    const completed = d.r1098Progress.filter((p) => has(p.last_completed))
    if (completed.length === 0) set('1098_dates_signed', 'na')
    else {
      const missing = completed.filter((p) => !(has(p.trainee_initials) && has(p.certifier_initials))).map((p) => String(p.catalog_id))
      set('1098_dates_signed', missing.length ? 'no' : 'yes', summarize(missing, 'completed 1098 item(s) missing signatures'))
    }
  }
  // 6.3 — every 1098 catalog item has a progress row
  {
    if (d.r1098Catalog.length === 0) set('1098_all_documented', 'na')
    else {
      const documented = new Set(d.r1098Progress.map((p) => String(p.catalog_id)))
      const missing = d.r1098Catalog.filter((c) => !documented.has(String(c.id))).map((c) => String(c.task ?? c.id))
      set('1098_all_documented', missing.length ? 'no' : 'yes', summarize(missing, '1098 requirement(s) with no record'))
    }
  }
  // 6.4 — 1098 catalog rows carry score/hours, type, frequency
  {
    if (d.r1098Catalog.length === 0) set('1098_catalog_fields', 'na')
    else {
      const missing = d.r1098Catalog.filter((c) => !(has(c.score_or_hours) && has(c.type) && has(c.frequency))).map((c) => String(c.task ?? c.id))
      set('1098_catalog_fields', missing.length ? 'no' : 'yes', summarize(missing, '1098 task(s) missing score/type/frequency'))
    }
  }

  // 8.1 — milestones have a target window (color-coding)
  {
    if (d.milestoneProgress.length === 0) set('milestone_window_set', 'na')
    else {
      const missing = d.milestoneProgress.filter((p) => !has(p.target_window)).map((p) => String(p.catalog_id))
      set('milestone_window_set', missing.length ? 'no' : 'yes', summarize(missing, 'milestone(s) missing a target window'))
    }
  }

  // 9.5 — JQS dated tasks have required signatures
  {
    const dated = d.jqsProgress.filter((p) => has(p.start_date) || has(p.complete_date))
    if (dated.length === 0) set('jqs_dates_signed', 'na')
    else {
      const catById = new Map(d.jqsCatalog.map((c) => [String(c.id), c]))
      const missing = dated.filter((p) => !(has(p.trainee_initials) && has(p.trainer_initials) && has(p.certifier_initials)))
        .map((p) => String(catById.get(String(p.catalog_id))?.number ?? p.catalog_id))
      set('jqs_dates_signed', missing.length ? 'no' : 'yes', summarize(missing, 'JQS task(s) with dates but missing signatures'))
    }
  }

  // 10 — RAT tasks have annotated dates
  {
    if (RAT_EXEMPT_STATUSES.has(String(m.status))) set('rat_dates', 'na')
    else if (d.ratProgress.length === 0) set('rat_dates', 'na')
    else {
      const missing = d.ratProgress.filter((p) => !(has(p.completed) || has(p.due))).map((p) => String(p.catalog_id))
      set('rat_dates', missing.length ? 'no' : 'yes', summarize(missing, 'RAT row(s) with no date'))
    }
  }

  return out
}
