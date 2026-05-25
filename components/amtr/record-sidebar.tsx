'use client'

import { useState } from 'react'

// Horizontal tab bar for a member record — a clean segmented control that
// wraps across the top, giving the record content the full screen width.

const TAB_ORDER = [
  'cover', 'qualifications', 'formal', 'jqs', '797', '803', '623a',
  'milestones', '1098', 'rat', 'references', 'files', 'history',
]

export function RecordSidebar({
  labels, active, onChange, hidden,
}: {
  labels: Record<string, string>
  active: string
  onChange: (k: string) => void
  hidden?: Set<string>
}) {
  const [hover, setHover] = useState<string | null>(null)
  const tabs = TAB_ORDER.filter((k) => labels[k] && !hidden?.has(k))
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      padding: 6, borderRadius: 10, border: '1px solid var(--color-border)',
      background: 'var(--color-bg-inset)',
    }}>
      {tabs.map((k) => {
        const on = active === k
        const hovered = hover === k && !on
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            onMouseEnter={() => setHover(k)}
            onMouseLeave={() => setHover((h) => (h === k ? null : h))}
            style={{
              padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
              border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border-mid)'}`,
              fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 600,
              whiteSpace: 'nowrap',
              background: on ? 'var(--color-accent)' : hovered ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
              color: on ? '#fff' : 'var(--color-text-2)',
              boxShadow: on ? '0 1px 4px rgba(0,0,0,0.35)' : 'none',
              transition: 'background 120ms, color 120ms, border-color 120ms',
            }}
          >
            {labels[k]}
          </button>
        )
      })}
    </div>
  )
}
