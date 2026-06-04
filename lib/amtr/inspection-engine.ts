// ─────────────────────────────────────────────────────────────
// AMTR Training Record Inspection — gap engine (pure, unit-tested).
//
// Reads a member's loaded AMTR datasets and, for each automatable
// checklist item (keyed by `auto_key`), returns a suggested Yes/No/
// N/A plus specific findings naming the offending rows. The inspect
// page pre-fills each checklist item from this and lets the inspector
// override. Items with no auto_key are answered manually.
// ─────────────────────────────────────────────────────────────

import { RAT_EXEMPT_STATUSES, dueStatus, parseDate, ratApplies } from './status'
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
  milestoneCatalog: Row[]
  formalCatalog: Row[]; formalProgress: Row[]
  qualCatalog: Row[]; qualProgress: Row[]
  /** Form-row ids that were brought in via bulk transcription (from the
   *  amtr_audit_log 'transcribe' action). Transcription clears the certifier
   *  column, so a transcribed row's missing certifier is expected, not a gap. */
  transcribedRowIds: string[]
  /** Today as YYYY-MM-DD (installation-local, supplied by the page). Used to tell
   *  whether a recurring item is currently due vs. not-due-yet. */
  today: string
}

const has = (v: unknown): boolean => v != null && String(v).trim() !== ''
const label = (r: Row): string => String(r.number ?? r.item_number ?? r.task ?? r.course ?? r.title ?? r.sts_item ?? r.id ?? '?')

/** Drop soft-deleted (retired) catalog rows so the scan doesn't grade a member
 *  against requirements the program has removed. `!retired` treats a missing
 *  flag as live, which is safe for catalogs predating the versioning columns. */
const live = (rows: Row[]): Row[] => rows.filter((r) => !r.retired)

/** JQS follows the CFETP caret convention used by the member record
 *  (components/amtr/jqs-tab.tsx): a separate certifier signature is required
 *  ONLY when the task's `core_cert` marking contains '^'. Plain markings
 *  ('5', '7', 'C') are trainer-certified — demanding a certifier there
 *  false-flags a qualified member. */
const jqsNeedsCertifier = (cat: Row | undefined): boolean => String(cat?.core_cert ?? '').includes('^')

/** Skill level (3/5/7/9) named by a `skill_level` qualification, e.g.
 *  "1C751 Skill Level" → 5 or "5-Skill Level" → 5. Non-level entries that
 *  share the `skill_level` category ("Trainer", "Certifier") return null. */
export function skillLevelFromName(name: unknown): number | null {
  const s = String(name ?? '')
  const dafsc = s.match(/1C7([3579])1/)
  if (dafsc) return Number(dafsc[1])
  const plain = s.match(/\b([3579])\s*-?\s*skill/i)
  return plain ? Number(plain[1]) : null
}

/** Highest skill level the member has marked attained in the Qualifications
 *  tab (`amtr_qual_catalog` category 'skill_level' + `amtr_qual_progress`).
 *  Returns null when none is determinable — callers then apply no level gate. */
export function highestSkillLevel(qualCatalog: Row[], qualProgress: Row[]): number | null {
  const attained = new Set(qualProgress.filter((p) => p.attained === true).map((p) => String(p.catalog_id)))
  let max: number | null = null
  for (const c of qualCatalog) {
    if (c.category !== 'skill_level' || !attained.has(String(c.id))) continue
    const lvl = skillLevelFromName(c.name)
    if (lvl != null && (max == null || lvl > max)) max = lvl
  }
  return max
}

/** Leading skill-level digit of a JQS `core_cert` marking ("7^" → 7), or null
 *  when it carries no level (e.g. "^"). */
const coreCertLevel = (v: unknown): number | null => {
  const m = String(v ?? '').match(/([3579])/)
  return m ? Number(m[1]) : null
}

/** Format a findings line listing every offending item. */
function summarize(missing: string[], noun: string): string[] {
  if (missing.length === 0) return []
  // List every offending item — the saved inspection PDF (and the on-screen
  // findings) must enumerate all annotated discrepancies, not a "+N more" cap.
  return [`${missing.length} ${noun}: ${missing.join(', ')}`]
}

export function runInspectionScan(d: InspectionScanData): Record<InspectionAutoKey, AutoResult> {
  const out = {} as Record<InspectionAutoKey, AutoResult>
  const set = (k: InspectionAutoKey, auto: AutoStatus, findings: string[] = []) => { out[k] = { auto, findings } }

  const m = d.member
  const userId = m.user_id ? String(m.user_id) : null
  const holdsRole = (role: string) => !!userId && d.roleAssignments.some((a) => a.user_id === userId && a.role === role)
  // Member's current skill level (from the Qualifications tab). Used to ignore
  // JQS core tasks that only become required at a higher level than the member
  // holds — e.g. a 7-level core task isn't expected signed for a 5-level member.
  const skill = highestSkillLevel(d.qualCatalog, d.qualProgress)
  // Rows brought in by transcription: the certifier column was deliberately
  // cleared, so a missing certifier on these is expected, not a gap.
  const transcribed = new Set(d.transcribedRowIds.map(String))
  const isTranscribed = (rowId: unknown): boolean => rowId != null && transcribed.has(String(rowId))

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

  // 4.1 — 623A entries signed by required members (trainee + trainer).
  // Only manual narrative entries are graded this way. Source-linked entries
  // (auto-created when a 1098/JQS/797 slot is signed — auto-623a-dialog.tsx) are
  // single-slot certification records, often trainee + namt with no trainer; the
  // underlying task is already graded by the 797/JQS/1098 checks, so skip them.
  {
    // Skip source-linked auto-entries and historical (transcribed) entries —
    // imported entries from a prior system are reference-only and aren't expected
    // to carry in-system initials/signatures.
    const manual = d.e623a.filter((e) => !has(e.source_table) && e.transcribed !== true)
    if (manual.length === 0) set('623a_signed', 'na')
    else {
      const missing = manual.filter((e) => !(has(e.trainee_initials) && has(e.trainer_initials)))
        .map((e) => String(e.entry_type ?? e.form_date ?? e.id))
      set('623a_signed', missing.length ? 'no' : 'yes', summarize(missing, 'entry/entries missing required initials'))
    }
  }

  // 4.8 / 9.2 — JQS core tasks fully signed (certifier only where caret-marked).
  // Core tasks that become required above the member's skill level are excluded
  // (not yet expected to be signed).
  {
    const core = live(d.jqsCatalog).filter((c) => {
      // Only tasks marked Required for this location count — a core task that
      // isn't required here shouldn't be flagged incomplete.
      if (c.kind === 'section' || !c.required || !has(c.core_cert)) return false
      const lvl = coreCertLevel(c.core_cert)
      return skill == null || lvl == null || lvl <= skill
    })
    if (core.length === 0) set('jqs_core_signed', 'na')
    else {
      const progByCat = new Map(d.jqsProgress.map((p) => [String(p.catalog_id), p]))
      const missing = core.filter((c) => {
        const p = progByCat.get(String(c.id))
        if (!p) return true
        const needCert = jqsNeedsCertifier(c) && !isTranscribed(p.id)
        return !(has(p.trainee_initials) && has(p.trainer_initials) && (!needCert || has(p.certifier_initials)))
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
        const needCert = !!r.requires_certifier && !isTranscribed(r.id)
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
    // Only flag items that are actually started, completed, AND currently due.
    // A recurring item that's been completed for its cycle and isn't due again
    // yet (next_due in the future) is current — not a missing-signature gap.
    const futureDue = (v: unknown): boolean => has(v) && String(v).slice(0, 10) > d.today
    const completed = d.r1098Progress.filter((p) => has(p.start_date) && has(p.last_completed) && !futureDue(p.next_due))
    if (completed.length === 0) set('1098_dates_signed', 'na')
    else {
      const r1098Name = new Map(d.r1098Catalog.map((c) => [String(c.id), String(c.task ?? c.id)]))
      const missing = completed.filter((p) => {
        const needCert = !isTranscribed(p.id)
        return !(has(p.trainee_initials) && (!needCert || has(p.certifier_initials)))
      }).map((p) => r1098Name.get(String(p.catalog_id)) ?? String(p.catalog_id))
      set('1098_dates_signed', missing.length ? 'no' : 'yes', summarize(missing, 'completed 1098 item(s) missing signatures'))
    }
  }
  // 6.3 — every 1098 catalog item has a progress row
  {
    const catalog = live(d.r1098Catalog)
    if (catalog.length === 0) set('1098_all_documented', 'na')
    else {
      const documented = new Set(d.r1098Progress.map((p) => String(p.catalog_id)))
      const missing = catalog.filter((c) => !documented.has(String(c.id))).map((c) => String(c.task ?? c.id))
      set('1098_all_documented', missing.length ? 'no' : 'yes', summarize(missing, '1098 requirement(s) with no record'))
    }
  }
  // 6.4 — 1098 catalog rows carry score/hours, type, frequency
  {
    const catalog = live(d.r1098Catalog)
    if (catalog.length === 0) set('1098_catalog_fields', 'na')
    else {
      const missing = catalog.filter((c) => !(has(c.score_or_hours) && has(c.type) && has(c.frequency))).map((c) => String(c.task ?? c.id))
      set('1098_catalog_fields', missing.length ? 'no' : 'yes', summarize(missing, '1098 task(s) missing score/type/frequency'))
    }
  }

  // 8.1 — milestones have a target window (color-coding); defined in the catalog
  {
    const catalog = live(d.milestoneCatalog)
    if (catalog.length === 0) set('milestone_window_set', 'na')
    else {
      const missing = catalog.filter((c) => !has(c.target_window)).map((c) => String(c.topic ?? c.id))
      set('milestone_window_set', missing.length ? 'no' : 'yes', summarize(missing, 'milestone(s) missing a target window'))
    }
  }

  // 9.5 — JQS dated tasks have required signatures (certifier only where caret-marked).
  // Only tasks marked Required for this location are evaluated.
  {
    const catById = new Map(d.jqsCatalog.map((c) => [String(c.id), c]))
    const dated = d.jqsProgress.filter((p) => (has(p.start_date) || has(p.complete_date)) && !!catById.get(String(p.catalog_id))?.required)
    if (dated.length === 0) set('jqs_dates_signed', 'na')
    else {
      const missing = dated.filter((p) => {
        const needCert = jqsNeedsCertifier(catById.get(String(p.catalog_id))) && !isTranscribed(p.id)
        return !(has(p.trainee_initials) && has(p.trainer_initials) && (!needCert || has(p.certifier_initials)))
      }).map((p) => String(catById.get(String(p.catalog_id))?.number ?? p.catalog_id))
      set('jqs_dates_signed', missing.length ? 'no' : 'yes', summarize(missing, 'JQS task(s) with dates but missing signatures'))
    }
  }

  // 10 — RAT tasks have annotated dates
  {
    if (RAT_EXEMPT_STATUSES.has(String(m.status))) set('rat_dates', 'na')
    else if (d.ratProgress.length === 0) set('rat_dates', 'na')
    else {
      const ratName = new Map(d.ratCatalog.map((c) => [String(c.id), String(c.course ?? c.id)]))
      const missing = d.ratProgress.filter((p) => !(has(p.completed) || has(p.due))).map((p) => ratName.get(String(p.catalog_id)) ?? String(p.catalog_id))
      set('rat_dates', missing.length ? 'no' : 'yes', summarize(missing, 'RAT row(s) with no date'))
    }
  }

  // 4.12 — a monthly training records inspection has been recorded (the
  // completed inspection drops a "Monthly Training Records Inspection" 623A entry).
  set('monthly_inspection_done', d.e623a.some((e) => String(e.entry_type ?? '').toLowerCase().includes('inspection')) ? 'yes' : 'no')

  // 5.2 / 6.2 / 7.2 / 9.1 — transcribed rows carry a completion date + initials.
  // Transcription stamps the completion date and the chosen non-certifier slot,
  // so a properly transcribed row has its date and at least the trainee/evaluator
  // initials. `na` when nothing on the form was transcribed.
  {
    const tr = d.items797.filter((r) => isTranscribed(r.id))
    if (tr.length === 0) set('797_transcribed', 'na')
    else {
      const missing = tr.filter((r) => !(has(r.complete_date) && has(r.trainee_initials))).map((r) => label(r))
      set('797_transcribed', missing.length ? 'no' : 'yes', summarize(missing, 'transcribed 797 task(s) missing a date or initials'))
    }
  }
  {
    const tr = d.r1098Progress.filter((p) => isTranscribed(p.id))
    if (tr.length === 0) set('1098_transcribed', 'na')
    else {
      const r1098Name = new Map(d.r1098Catalog.map((c) => [String(c.id), String(c.task ?? c.id)]))
      const missing = tr.filter((p) => !(has(p.last_completed) && has(p.trainee_initials))).map((p) => r1098Name.get(String(p.catalog_id)) ?? String(p.catalog_id))
      set('1098_transcribed', missing.length ? 'no' : 'yes', summarize(missing, 'transcribed 1098 item(s) missing a date or initials'))
    }
  }
  {
    const tr = d.items803.filter((r) => isTranscribed(r.id))
    if (tr.length === 0) set('803_transcribed', 'na')
    else {
      const missing = tr.filter((r) => !(has(r.eval_date) && has(r.evaluator_initials))).map((r) => label(r))
      set('803_transcribed', missing.length ? 'no' : 'yes', summarize(missing, 'transcribed 803 row(s) missing a date or initials'))
    }
  }
  {
    const catById = new Map(d.jqsCatalog.map((c) => [String(c.id), c]))
    const tr = d.jqsProgress.filter((p) => isTranscribed(p.id) && !!catById.get(String(p.catalog_id))?.required)
    if (tr.length === 0) set('jqs_transcribed', 'na')
    else {
      const missing = tr.filter((p) => !(has(p.complete_date) && has(p.trainee_initials))).map((p) => String(catById.get(String(p.catalog_id))?.number ?? p.catalog_id))
      set('jqs_transcribed', missing.length ? 'no' : 'yes', summarize(missing, 'transcribed JQS task(s) missing a date or initials'))
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────
// Reconcile inputs for the daily notification cron. Pure; co-located
// with the inspection scan so the signing rules can't drift from it.
// ─────────────────────────────────────────────────────────────

export type DueItem = { tab: '1098' | 'rat'; itemId: string; itemName: string; dueISO: string }
export type TraineeSigGap = { tab: 'jqs' | '1098' | '797' | '623a'; itemId: string; itemName: string }

/** Due-soon / overdue recurring items (1098 + RAT) for a member. Mirrors the
 *  reconcile in form1098-tab.tsx / rat-tab.tsx. RAT is skipped for exempt
 *  statuses (Civilian / Contractor / Separated). */
export function dueItemsForMember(d: InspectionScanData): DueItem[] {
  const out: DueItem[] = []
  const today = parseDate(d.today) ?? new Date()

  const name1098 = new Map(d.r1098Catalog.map((c) => [String(c.id), String(c.task ?? c.id)]))
  for (const p of d.r1098Progress) {
    const due = (p.next_due as string | null) ?? null
    if (!due) continue
    const s = dueStatus({ dueDate: due, completedDate: (p.last_completed as string) ?? '' }, today)
    if (s === 'due_soon' || s === 'overdue') {
      out.push({ tab: '1098', itemId: String(p.catalog_id), itemName: name1098.get(String(p.catalog_id)) ?? String(p.catalog_id), dueISO: String(due) })
    }
  }

  if (ratApplies(String(d.member.status ?? ''))) {
    const nameRat = new Map(d.ratCatalog.map((c) => [String(c.id), String(c.course ?? c.id)]))
    for (const p of d.ratProgress) {
      const due = (p.due as string | null) ?? null
      if (!due) continue
      const s = dueStatus({ dueDate: due, completedDate: (p.completed as string) ?? '' }, today)
      if (s === 'due_soon' || s === 'overdue') {
        out.push({ tab: 'rat', itemId: String(p.catalog_id), itemName: nameRat.get(String(p.catalog_id)) ?? String(p.catalog_id), dueISO: String(due) })
      }
    }
  }
  return out
}

/** Items awaiting the TRAINEE's initials across JQS / 1098 / 797 / 623A,
 *  honoring the same eligibility filters the inspection scan applies. The
 *  certifier transcribe-waiver does NOT apply here — the engine still requires
 *  trainee initials on transcribed rows; only 623A historical/source-linked
 *  entries are excluded entirely (as in scan rule 4.1). */
export function traineeSignatureGaps(d: InspectionScanData): TraineeSigGap[] {
  const out: TraineeSigGap[] = []
  const skill = highestSkillLevel(d.qualCatalog, d.qualProgress)
  const futureDue = (v: unknown): boolean => has(v) && String(v).slice(0, 10) > d.today
  const dated = (r: Row): boolean => has(r.start_date) || has(r.complete_date)

  // The trainee only owes a signature once the work is DONE: the supervising
  // party (trainer, or certifier on the 1098) has signed and the item is dated,
  // but the trainee hasn't countersigned. An item with no progress, or one the
  // trainer hasn't signed yet, is "not yet trained" — not the trainee's action.

  // JQS — required core tasks (at/below skill) the trainer signed + dated.
  const jqsProgByCat = new Map(d.jqsProgress.map((p) => [String(p.catalog_id), p]))
  for (const c of live(d.jqsCatalog)) {
    if (c.kind === 'section' || !c.required || !has(c.core_cert)) continue
    const lvl = coreCertLevel(c.core_cert)
    if (!(skill == null || lvl == null || lvl <= skill)) continue
    const p = jqsProgByCat.get(String(c.id))
    if (p && has(p.trainer_initials) && dated(p) && !has(p.trainee_initials)) {
      out.push({ tab: 'jqs', itemId: String(c.id), itemName: label(c) })
    }
  }

  // 1098 — completed & currently-due rows the certifier verified.
  const name1098 = new Map(d.r1098Catalog.map((c) => [String(c.id), String(c.task ?? c.id)]))
  for (const p of d.r1098Progress) {
    if (!(has(p.start_date) && has(p.last_completed) && !futureDue(p.next_due))) continue
    if (has(p.certifier_initials) && !has(p.trainee_initials)) {
      out.push({ tab: '1098', itemId: String(p.catalog_id), itemName: name1098.get(String(p.catalog_id)) ?? String(p.catalog_id) })
    }
  }

  // 797 — tasks the trainer signed + dated.
  for (const r of d.items797) {
    if (has(r.trainer_initials) && dated(r) && !has(r.trainee_initials)) {
      out.push({ tab: '797', itemId: String(r.id), itemName: label(r) })
    }
  }

  // 623A — manual, non-transcribed entries the trainer signed.
  for (const e of d.e623a) {
    if (has(e.source_table) || e.transcribed === true) continue
    if (has(e.trainer_initials) && !has(e.trainee_initials)) {
      out.push({ tab: '623a', itemId: String(e.id), itemName: String(e.entry_type ?? e.form_date ?? e.id) })
    }
  }

  return out
}
