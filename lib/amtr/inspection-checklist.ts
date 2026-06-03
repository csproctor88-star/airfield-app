// ─────────────────────────────────────────────────────────────
// AMTR Training Record Inspection — default checklist.
//
// Transcribed from the official "Training Record Inspection
// Checklist" (current as of 20 Aug 25), IAW DAFI 36-2670,
// DAFMAN 36-2689, and DAFMAN 13-204v2. Used to SEED the editable
// per-base `amtr_inspection_checklist` table — the NAMT/AFM can then
// add/edit/reorder/remove items in the Training Admin builder.
//
// Items carry an optional `auto_key`: a STABLE identifier the gap
// engine (inspection-engine.ts) keys off to pre-fill Yes/No/N/A and
// surface findings. Renumbering or rewording an item in the builder
// never breaks automation — only the auto_key matters. Items without
// an auto_key are manual toggles.
// ─────────────────────────────────────────────────────────────

export type InspectionAutoKey =
  | 'member_identity'
  | 'trainer_qualified'
  | 'certifier_qualified'
  | 'formal_pme_dates'
  | 'formal_continuation_dates'
  | '623a_signed'
  | 'jqs_core_signed'
  | '803_results_ugt'
  | '803_unsat_remarks'
  | '803_date_evaluator'
  | '797_dates_initials'
  | '797_milestone_assigned'
  | '1098_dates_signed'
  | '1098_all_documented'
  | '1098_catalog_fields'
  | 'milestone_window_set'
  | 'jqs_dates_signed'
  | 'rat_dates'
  | 'monthly_inspection_done'
  | '797_transcribed'
  | '1098_transcribed'
  | '803_transcribed'
  | 'jqs_transcribed'

export type ChecklistSeedRow = {
  kind: 'section' | 'item'
  item_number: string
  label: string
  auto_key?: InspectionAutoKey | null
}

const S = (item_number: string, label: string): ChecklistSeedRow => ({ kind: 'section', item_number, label })
const I = (item_number: string, label: string, auto_key: InspectionAutoKey | null = null): ChecklistSeedRow =>
  ({ kind: 'item', item_number, label, auto_key })

export const DEFAULT_INSPECTION_CHECKLIST: ChecklistSeedRow[] = [
  S('1', 'All Records'),
  I('1.1', 'Is the correct training record template from the AFFSA SharePoint being utilized?'),

  S('2', 'Qualifications'),
  I('2.1', "Is the individual's name, rank, Current Duty Position, DAFSC or Civilian Job series, and Training Status Code annotated correctly?", 'member_identity'),
  I('2.2', 'Are all qualifications completed by the individual identified and annotated with a completion date?'),
  I('2.3', 'Has the individual attained their 3, 5, 7 or 9 skill-levels, if so, are all corresponding skill levels annotated?'),
  I('2.4', "Are all SEI's attained by the individual annotated?"),
  I('2.5', 'Is the individual trainer qualified, if so, is it annotated?', 'trainer_qualified'),
  I('2.6', 'Is the individual certifier qualified, if so, is it annotated?', 'certifier_qualified'),

  S('3', 'Formal Training'),
  I('3.1', 'Has all PME attended by the individual been annotated with start and completion dates? (i.e., BMT, NCOA, SNCOA, Airmanship 300-700)?', 'formal_pme_dates'),
  I('3.2', 'Has the individual completed any Optional Continuation Training, if so, has it been annotated with start and completion dates?', 'formal_continuation_dates'),
  I('3.3', 'If formal training information is missing, has the NAMT coordinated with the UTM to retrieve the missing information?'),

  S('4', 'DAF Form 623A'),
  I('4.1', 'Are all AF Form 623A (or electronic equivalent) entries signed/acknowledged (with or without comments) by the trainee, supervisor/trainer, NAMT and AFM, as required?', '623a_signed'),
  I('4.2', 'If the records were transcribed, is the reason documented?'),
  I('4.3', 'Is there an initial evaluation conducted and documented until the individual PCS or PCA?'),
  I('4.4', 'Has an evaluation of Apprentice Course Graduates been conducted and documented during the first 90 days following assignment?'),
  I('4.5', 'Are local training start and completions documented (e.g. short title and date)?'),
  I('4.6', 'Are QTP start and completions documented (e.g. short title and date)?'),
  I('4.7', 'Are PCG start and completions documented (e.g. short title and date)?'),
  I('4.8', 'Are all core task items trained before an individual is upgraded?', 'jqs_core_signed'),
  I('4.9', 'Are task evaluation results (sat/unsat) documented in the 623As and 803s? If an item is unsat, is the reason specified, and corrective actions required documented?', '803_unsat_remarks'),
  I('4.10', "Was a Newcomer's Indoctrination Guide issued to the trainee and completed in the allotted amount of time?"),
  I('4.11', 'Are monthly upgrade training evaluation results documented, acknowledged and signed by all required members?'),
  I('4.12', 'Have monthly training records inspections been conducted along with a signed entry by all required members?', 'monthly_inspection_done'),
  I('4.13', 'Have upgrade training progression reports, and start and completion dates been tracked and signed?'),
  I('4.14', 'Has the NAMT ensured a 623A entry was completed for all reviewed AFFSA messages by the individual?'),

  S('5', 'DAF Form 797'),
  I('5.1', 'Has the individual started or completed all local training? If so, does the record have annotated dates and required initials?', '797_dates_initials'),
  I('5.2', 'If the records were transcribed, do all transcriptions have annotated dates and initials?', '797_transcribed'),
  I('5.3', 'Are local milestones assigned to all training items?', '797_milestone_assigned'),
  I('5.4', 'Have CBRN TQT items been accomplished? If so, do all items have trainee and trainer initials to include Go/No-Go status?'),

  S('6', 'DAF Form 1098'),
  I('6.1', 'Has the individual started and/or completed monthly proficiency training? If so, are dates and signatures annotated?', '1098_dates_signed'),
  I('6.2', 'If the records were transcribed, do all transcriptions have annotated dates and initials?', '1098_transcribed'),
  I('6.3', 'Are all recurring training requirements documented?', '1098_all_documented'),
  I('6.4', 'Do the 1098 feature score/hours, type and frequency of training?', '1098_catalog_fields'),

  S('7', 'DAF Form 803'),
  I('7.1', 'Are task evaluation results (sat/unsat) documented for required items to include UGT status?', '803_results_ugt'),
  I('7.2', 'If the records were transcribed, do all transcriptions have annotated dates and initials?', '803_transcribed'),
  I('7.3', 'If an item is unsat, is the reason specified in the remarks along with corrective actions?', '803_unsat_remarks'),
  I('7.4', "Do all 803s have dates and the evaluator's initials?", '803_date_evaluator'),

  S('8', 'Milestones'),
  I('8.1', 'Do all milestones have associated color-coding to identify local time requirements?', 'milestone_window_set'),
  I('8.2', 'Have all milestones been started according to HAF guidelines?'),

  S('9', 'JQS-CFETP'),
  I('9.1', 'If the records were transcribed, do all transcriptions have annotated dates and initials?', 'jqs_transcribed'),
  I('9.2', 'Are all core task items trained before an individual recommended for upgrade?', 'jqs_core_signed'),
  I('9.3', 'Are all current changes to the CFETP posted?'),
  I('9.4', 'Are all required JQS tasks that apply to the current installation highlighted in yellow?'),
  I('9.5', 'Does the record have annotated training dates and required signatures for all started and/or completed training tasks?', 'jqs_dates_signed'),

  S('10', 'Ready Airman Training'),
  I('10.1', 'Does the record have annotated training dates for all started and/or completed training tasks?', 'rat_dates'),
]

/** Seed rows for a base, with sort_order assigned in declaration order. */
export function inspectionChecklistSeedRows(baseId: string): Record<string, unknown>[] {
  return DEFAULT_INSPECTION_CHECKLIST.map((r, i) => ({
    base_id: baseId, kind: r.kind, label: r.label, item_number: r.item_number,
    auto_key: r.auto_key ?? null, sort_order: i,
  }))
}
