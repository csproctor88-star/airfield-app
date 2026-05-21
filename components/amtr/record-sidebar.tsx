'use client'

// Horizontal grouped tab bar for a member record. Tabs keep their logical
// grouping (separated by thin dividers) but lay out across the top so the
// record content gets the full screen width.

const GROUPS: string[][] = [
  ['cover'],
  ['qualifications', 'formal'],
  ['jqs', '797', '803', '623a'],
  ['milestones'],
  ['1098', 'rat'],
  ['references'],
  ['files', 'history'],
]

export function RecordSidebar({
  labels, active, onChange, hidden,
}: {
  labels: Record<string, string>
  active: string
  onChange: (k: string) => void
  hidden?: Set<string>
}) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
      padding: 5, borderRadius: 8, border: '1px solid var(--color-border)',
      background: 'var(--color-bg-inset)',
    }}>
      {GROUPS.map((group, gi) => {
        const visible = group.filter((k) => !hidden?.has(k))
        if (visible.length === 0) return null
        return (
          <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {gi > 0 && <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />}
            {visible.map((k) => {
              const on = active === k
              return (
                <button
                  key={k}
                  onClick={() => onChange(k)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
                    fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 600,
                    whiteSpace: 'nowrap',
                    background: on ? 'var(--color-accent)' : 'transparent',
                    color: on ? '#fff' : 'var(--color-text-2)',
                  }}
                >
                  {labels[k]}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
