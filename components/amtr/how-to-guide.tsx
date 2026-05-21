'use client'

// In-app "How it works" guide for the Airfield Management Training Record.
// Operational, plain-language overview shown on the AMTR landing page so
// trainees, trainers, and the training office understand the record.

type Section = { heading: string; body?: string; items?: [string, string][] }

const SECTIONS: Section[] = [
  {
    heading: 'What this is',
    body: 'The Airfield Management Training Record is the electronic 1C7X1 training record. It replaces the spreadsheet — every member has one record holding their qualifications, formal training, job-qualification tasks, recurring training, and evaluations, with real-time currency tracking and an audit trail.',
  },
  {
    heading: 'Roles',
    body: 'A person can hold more than one role. Roles are assigned in Training Admin and decide which signature blocks someone may sign.',
    items: [
      ['Trainee', 'The member the record belongs to. Signs their own Trainee blocks only.'],
      ['Trainer', 'Documents on-the-job training and signs the Trainer block.'],
      ['Certifier', 'Certifies task completion; may sign Trainee, Trainer, and Certifier blocks.'],
      ['NAMT', 'Runs the training program; may sign every block except AFM, and can reopen a signed block.'],
      ['Airfield Manager (AFM)', 'Final endorsement; may sign any block.'],
    ],
  },
  {
    heading: 'The record tabs',
    items: [
      ['Cover & Qualifications', 'Member identity, skill levels, SEIs, and qualifications.'],
      ['JQS-CFETP', 'The job qualification standard — core tasks and proficiency, signed as trained.'],
      ['DAF 623A', 'The narrative training log — entries acknowledged by trainee, trainer, NAMT, and AFM.'],
      ['DAF 797', 'Local qualification tasks with start/complete dates, initials, and milestones.'],
      ['DAF 803', 'Task performance evaluations (SAT/UNSAT) with evaluator initials and remarks.'],
      ['DAF 1098', 'Recurring and monthly proficiency training — score/hours, type, and frequency.'],
      ['Milestones / Formal / RAT', 'QTP-PCG upgrade windows, formal courses (PME), and Ready Airman Training.'],
    ],
  },
  {
    heading: 'Signing & locking',
    body: 'Signatures lock per block, not per record. Once you sign a block it is final and the rest of the record stays editable. A higher role can sign the lower blocks (a Certifier can sign Trainee/Trainer/Certifier). On your own record you may only sign the Trainee block. NAMT or AFM can reopen an individual signature if a correction is needed.',
  },
  {
    heading: 'Currency & notifications',
    body: 'Recurring 1098 and RAT items show Complete / Due Soon / Overdue automatically. When an item is due or overdue, the training team (the member, trainers, NAMT, and AFM) is notified. Click a notification to jump straight to the item.',
  },
  {
    heading: 'Monthly record inspections',
    body: 'Use "Inspect record" to open the monthly inspection alongside the live record. The checklist auto-detects what it can from the record (missing dates, unsigned tasks, undocumented requirements) and lists the specific gaps; you confirm or override each item. Marking the inspection complete adds a dated 623A entry documenting it.',
  },
  {
    heading: 'Getting started (training office)',
    body: 'In Training Admin: load the standard catalogs, assign roles to your people, and tailor the inspection checklist. Add members to the roster, then open a record to begin entering and signing training.',
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
