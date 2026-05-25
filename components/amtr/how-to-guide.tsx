'use client'

// In-app "How it works" guide for the Airfield Management Training Record.
// Operational, plain-language overview shown on the AMTR landing page so
// trainees, trainers, and the training office understand the record.

type Section = { heading: string; body?: string; items?: [string, string][] }

const SECTIONS: Section[] = [
  {
    heading: 'What this is',
    body: 'This is the electronic Airfield Management (1C7X1) training record. It replaces the paper folder and shared spreadsheet that a unit historically kept on every Airman. Each member has one record holding their qualifications, formal training, job-qualification tasks, recurring/proficiency training, evaluations, and a running narrative log — with automatic currency tracking and a full signature audit trail. The intent is the same as the paper system the AFI/DAFMAN describes, just enforced and time-stamped: you can see at a glance who is qualified, what is coming due, and who signed what, when.',
  },
  {
    heading: 'How training actually flows',
    body: 'A member trains and upgrades through skill levels over an assignment. The record is the evidence of that progression. In practice the cycle looks like this:',
    items: [
      ['1. Newcomer in-processing', 'The training office (NAMT) opens the record, fills the cover, links the member to the roster, and sets the upgrade path. Required qualifications, JQS tasks, and recurring items are pulled from the base catalog so the record starts complete.'],
      ['2. On-the-job training (OJT)', 'A trainer takes the member through each task on the job, then documents it. The member performs the task to standard; the trainer signs the Trainer block; a certifier certifies competency. Tasks accumulate on the JQS-CFETP and DAF 797 as they are trained and certified.'],
      ['3. Skill-level upgrade', 'Apprentice (3) → Journeyman (5) → Craftsman (7). Upgrade requires completing the CDCs/career-development course, the JQS/CFETP core tasks, required formal training, and time-in-training. Milestones track the QTP/PCG upgrade windows so the office sees whether a member is on glidepath to upgrade on time.'],
      ['4. Recurring & proficiency training', 'Once qualified, currency is maintained. DAF 1098 items recur (monthly, quarterly, annually) and must be re-accomplished before they lapse. RAT (Ready Airman Training) and other proficiency items follow the same due/overdue logic.'],
      ['5. Evaluation & review', 'Performance is verified by DAF 803 task evaluations (SAT/UNSAT) and recorded in the running DAF 623A log. The office reviews each record periodically and during the monthly record inspection.'],
    ],
  },
  {
    heading: 'Roles — who does what',
    body: 'A person can hold more than one role; roles are assigned in Admin and decide which signature blocks someone may sign. Signing authority is hierarchical and mirrors how a real unit works: the person doing the training documents it, and progressively senior people certify and endorse it.',
    items: [
      ['Trainee', 'The member the record belongs to. Self-initials their own Trainee blocks to acknowledge training was received — nothing else. A member can never certify their own training.'],
      ['Trainer', 'The journeyman/craftsman conducting OJT. Documents what was trained and signs the Trainer block.'],
      ['Certifier', 'Certifies a task was performed to standard. May sign the Trainee, Trainer, and Certifier blocks (it can stand in for the lower two when the same person both trained and certified).'],
      ['NAMT', 'The unit training manager who runs the program day to day. May sign every block except AFM, and is the only role (with AFM) that can reopen a signed block to fix an error.'],
      ['Airfield Manager (AFM)', 'Owns the program and provides the final endorsement. May sign any block.'],
    ],
  },
  {
    heading: 'Who can see and edit a record',
    body: 'Opening the module is one thing; what you can do inside depends on your assigned role. A member with no training-management role assigned sees only their own record and self-initials their own Trainee blocks. A Trainer, Certifier, NAMT, or AFM sees the whole roster and can enter dates and sign per their authority. The Airfield Manager, NAMT, and Base Administrator (program managers) always have full access so the program can be bootstrapped and managed.',
  },
  {
    heading: 'The record tabs',
    items: [
      ['Cover & Qualifications', 'Member identity, duty position, supervisor/UTM/commander, skill levels, SEIs, and qualification packages.'],
      ['JQS-CFETP', 'The job qualification standard / career field education & training plan — the core task list, trained and certified by section.'],
      ['DAF 623A', 'The narrative training record — the running log of training events, counseling, and notes, acknowledged by trainee, trainer, NAMT, and AFM. This is the story of the member’s training.'],
      ['DAF 797', 'Job qualification standard continuation / local task list with start and complete dates, initials, and milestones.'],
      ['DAF 803', 'Report of task evaluations — performance checks scored SAT/UNSAT with the evaluator’s initials and remarks.'],
      ['DAF 1098', 'Special task certification & recurring training — score/hours, type, and frequency, with automatic next-due calculation.'],
      ['Milestones / Formal / RAT', 'QTP/PCG upgrade windows, formal courses (CDCs, ALS/PME, technical school), and Ready Airman Training.'],
    ],
  },
  {
    heading: 'Signing & locking',
    body: 'Signatures lock per block, not per record. Once you sign a block it is final and the rest of the record stays editable — so a trainer signing one task does not freeze the others. A higher role can sign the lower blocks (a Certifier can sign Trainee/Trainer/Certifier). On your own record you may only sign the Trainee block. If a correction is needed, NAMT or AFM can reopen an individual signature; the reopen is logged in the record’s History.',
  },
  {
    heading: 'Currency & notifications',
    body: 'Recurring 1098 and RAT items compute Complete / Due Soon / Overdue automatically from the last-completed date and frequency — you do not track due dates by hand. When an item is due or overdue, the training team (the member, trainers, NAMT, and AFM) is notified, and completing a recurring task automatically seeds next year’s record so currency rolls forward. Click any notification to jump straight to the item.',
  },
  {
    heading: 'Monthly record inspections',
    body: 'The training office inspects each record on a recurring basis to confirm it is accurate and complete. Use “Inspect record” to open the monthly inspection alongside the live record. The checklist auto-detects what it can — missing dates, unsigned tasks, undocumented requirements — and lists the specific gaps so the inspector is not re-reading the whole record from scratch. You confirm or override each item; marking the inspection complete drops a dated 623A entry documenting that the inspection occurred and what was found.',
  },
  {
    heading: 'Getting started (training office)',
    body: 'In Admin: load the standard 1C7X1 catalogs, assign roles to your people in the matrix, and tailor the inspection checklist and resource links to your unit. The roster auto-populates from the base’s assigned users. Open a record to begin entering and signing training. When an updated HAF training-record workbook is released, use “Update standard catalogs” — existing member records are preserved and only the standard items are merged.',
  },
]

export function HowToGuide() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={{ margin: 0, color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }}>
        A quick orientation to how the training record works.
      </p>
      {SECTIONS.map((s) => (
        <div key={s.heading}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{s.heading}</h3>
          {s.body && <p style={{ margin: '0 0 8px', color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>{s.body}</p>}
          {s.items && (
            <div style={{ display: 'grid', gap: 6 }}>
              {s.items.map(([term, desc]) => (
                <div key={term} style={{ display: 'flex', gap: 10, fontSize: 'var(--fs-sm)', lineHeight: 1.45 }}>
                  <span style={{ minWidth: 168, fontWeight: 600, color: 'var(--color-text-1)' }}>{term}</span>
                  <span style={{ flex: 1, color: 'var(--color-text-2)' }}>{desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
