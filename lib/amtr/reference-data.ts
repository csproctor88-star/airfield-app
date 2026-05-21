// ─────────────────────────────────────────────────────────────
// AMTR static reference data + default catalog seeds.
//   • TSC_TABLE / PROFICIENCY_KEY — read-only "Training References" tab
//     (DAFI 36-2670 / CFETP 1C7X1).
//   • DEFAULT_* seeds — starter catalogs a base can adopt so a fresh
//     installation isn't empty. The full 1C7X1 JQS task library is
//     intentionally not embedded — NAMT builds it or imports via Excel.
// ─────────────────────────────────────────────────────────────

export type TscEntry = { code: string; desc: string }

export const TSC_TABLE: TscEntry[] = [
  { code: 'A', desc: 'In upgrade training for the initial award of a 3-skill level AFSC.' },
  { code: 'B', desc: 'In upgrade training for the initial award of a 5-skill level AFSC.' },
  { code: 'C', desc: 'In upgrade training for the initial award of a 7-skill level AFSC (must be E-5 select or above).' },
  { code: 'D', desc: 'AFR member awaiting reassignment to the Inactive Ready Reserve (within 6 months of reassignment).' },
  { code: 'E', desc: 'Retraining and in upgrade training for subsequent award of a 3-skill level AFSC.' },
  { code: 'F', desc: 'Retraining and in upgrade training for subsequent award of a 5-skill level AFSC.' },
  { code: 'G', desc: 'Retraining and in upgrade training for subsequent award of a 7-skill level AFSC (E-5 select or above).' },
  { code: 'I', desc: 'Re-qualification training (returned to AFSC at highest skill level for grade; not performed in AFSC for past 6 months).' },
  { code: 'K', desc: 'Attending Basic Military Training or a skill-level awarding technical school (incl. follow-on training).' },
  { code: 'M', desc: 'Approved retraining via formal school; control AFSC changed to retraining AFSC, waiting to attend class.' },
  { code: 'P', desc: 'Cannot enter or continue upgrade training due to lack of training capability or duty status.' },
  { code: 'Q', desc: 'Not in upgrade training; received highest skill-level possible at current grade; in qualification training for a duty position.' },
  { code: 'R', desc: 'Fully qualified. Use when personnel complete upgrade training.' },
  { code: 'S', desc: 'Directly or indirectly changing to another AFSC at the same skill-level (AFPC updates only).' },
  { code: 'T', desc: 'Commander not recommending entry into training, or withdraws the member for failure to progress.' },
  { code: 'Y', desc: 'Applicable TSC not assigned, or gaining Personnel Flight has not processed the member.' },
]

export type ProficiencyEntry = { code: string; label?: string; desc: string }
export type ProficiencyKey = {
  performance: ProficiencyEntry[]
  knowledge: ProficiencyEntry[]
  subject: ProficiencyEntry[]
  marks: ProficiencyEntry[]
  notes: string[]
}

export const PROFICIENCY_KEY: ProficiencyKey = {
  performance: [
    { code: '1', label: 'Extremely Limited', desc: 'Can do simple parts of the task. Needs to be told or shown how to do most of the task.' },
    { code: '2', label: 'Partially Proficient', desc: 'Can do most parts of the task. Needs only help on hardest parts.' },
    { code: '3', label: 'Competent', desc: 'Can do all parts of the task. Needs only a spot check of completed work.' },
    { code: '4', label: 'Highly Proficient', desc: 'Can do the complete task quickly and accurately. Can tell or show others how to do the task.' },
  ],
  knowledge: [
    { code: 'a', label: 'Nomenclature', desc: 'Can name parts, tools, and simple facts about the task.' },
    { code: 'b', label: 'Procedures', desc: 'Can determine step by step procedures for doing the task.' },
    { code: 'c', label: 'Operating Principles', desc: 'Can identify why and when the task must be done and why each step is needed.' },
    { code: 'd', label: 'Advanced Theory', desc: 'Can predict, isolate, and resolve problems about the task.' },
  ],
  subject: [
    { code: 'A', label: 'Facts', desc: 'Can identify basic facts and terms about the subject.' },
    { code: 'B', label: 'Principles', desc: 'Can identify relationship of basic facts and state general principles about the subject.' },
    { code: 'C', label: 'Analysis', desc: 'Can analyze facts and principles and draw conclusions about the subject.' },
    { code: 'D', label: 'Evaluation', desc: 'Can evaluate conditions and make proper decisions about the subject.' },
  ],
  marks: [
    { code: '*', desc: 'Item identified for CBRN TQT as directed by Unit Commander.' },
    { code: '-', desc: 'Used alone instead of a scale value to show no proficiency training is provided in the course. OJT provided at unit/base level.' },
    { code: '^', desc: 'Item requires third party certification.' },
    { code: '+', desc: 'Required prior to award of SEI 155; can only be performed upon completion of the AMOS/AMSL PCG.' },
  ],
  notes: [
    'All tasks and knowledge items shown with a proficiency code are trained during wartime.',
    'Unit level tasks are trained and qualified to the 3c level.',
    'At a minimum, all core tasks must be trained to the knowledge base level.',
  ],
}

// ── Default catalog seeds (adoptable per base) ─────────────

export const DEFAULT_RAT_CATALOG = [
  { course: 'Self-Aid Buddy Care', category: 'Readiness', method: 'Hands-on', frequency: 'Annual' },
  { course: 'CBRN Defense Survival Skills', category: 'Readiness', method: 'CBT', frequency: 'Triennial' },
  { course: 'Cyber Awareness Challenge', category: 'Cyber', method: 'CBT', frequency: 'Annual' },
  { course: 'Information Assurance', category: 'Cyber', method: 'CBT', frequency: 'Annual' },
  { course: 'Suicide Awareness / SAPR / Resiliency', category: 'Resiliency', method: 'Read', frequency: 'Annual' },
] as const

export const DEFAULT_1098_CATALOG = [
  { task: 'AF Form 55 Safety Brief', type: 'Safety', frequency: 'Annual' },
  { task: 'Bird/Wildlife Aircraft Strike Hazard (BASH) Brief', type: 'Recurring', frequency: 'Annual' },
  { task: 'BASH Quarterly Walk', type: 'Recurring', frequency: 'Quarterly' },
  { task: 'Confined Space Entry Brief', type: 'Safety', frequency: 'Annual' },
  { task: 'Aircraft Mishap Response', type: 'Recurring', frequency: 'Annual' },
  { task: 'Airfield Driving Recurrency', type: 'Recurring', frequency: 'Annual' },
] as const

export const FORMAL_SECTIONS = [
  { key: 'haf', label: 'HAF — Career Progression Courses' },
  { key: 'initial', label: 'Initial Training (CBTs / required prerequisites)' },
  { key: 'continuation', label: 'Optional Continuation Training' },
] as const

export const MILESTONE_PATHS = [
  { key: 'fiveLevelQtp', label: '5-Level QTP' },
  { key: 'amosAmslPcg', label: 'AMOS/AMSL PCG' },
  { key: 'sevenLevelQtp', label: '7-Level QTP' },
  { key: 'afmPcg', label: 'AFM PCG' },
] as const

export const DAF803_SECTIONS = [
  { key: 'apprenticeGrad', label: 'Apprentice Grad' },
  { key: 'amslAmos', label: 'AMSL/AMOS' },
  { key: 'fiveLevel', label: '5-Level' },
  { key: 'sevenLevel', label: '7-Level' },
  { key: 'afm', label: 'AFM' },
] as const

export const AMTR_MEMBER_STATUSES = [
  'Active', 'Reserve', 'Guard', 'Civilian', 'Contractor', 'Separated',
] as const

export const AMTR_TAB_KEYS = [
  'cover', 'qualifications', 'formal', '623a', '797', '803',
  'milestones', '1098', 'jqs', 'rat', 'files', 'references',
] as const
