'use client'

import { useState } from 'react'
import { MILESTONE_PATHS } from '@/lib/amtr/reference-data'
import { thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

type Row = Record<string, unknown>

const PATH_NOTES: Record<string, string> = {
  fiveLevelQtp: 'Start within 60 days of date entered 5-skill level upgrade training. Minimum 180 days to complete.',
  amosAmslPcg: 'Completed prior to assuming Airfield Management Operations Supervisor / Lead duties.',
  sevenLevelQtp: 'Start within 60 days of date entered 7-skill level upgrade training. Minimum 180 days to complete.',
  afmPcg: 'Completed prior to assuming Airfield Manager duties.',
}

// Read-only display of the base-shared milestone catalog. Milestones (and their
// target windows) are defined once in Training Admin and shown the same on every
// record — they identify WHEN each topic should be completed during upgrade
// training. There is no per-member milestone data.
export function MilestonesTab(props: {
  catalog: Row[]; installationId: string; memberId: string
  // accepted for call-site compatibility; milestones are catalog-only now
  progress?: Row[]; canEnterData?: boolean; onChange?: () => void
}) {
  const { catalog } = props
  const [path, setPath] = useState<string>('fiveLevelQtp')
  const items = catalog.filter((c) => c.path === path)
  const hafGuidance = items.find((c) => c.haf_milestone)?.haf_milestone as string | undefined

  if (catalog.length === 0) return <div className="card" style={{ color: 'var(--color-text-3)' }}>Milestone catalog is empty — load it from Training Admin.</div>

  return (
    <div>
      <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>QTP / PCG Milestones</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {MILESTONE_PATHS.map((p) => (
          <button key={p.key} onClick={() => setPath(p.key)}
            style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: path === p.key ? 700 : 600, background: path === p.key ? 'var(--color-accent)' : 'var(--color-bg-inset)', color: path === p.key ? '#fff' : 'var(--color-text-2)' }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ padding: '10px 12px', marginBottom: 12, borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', borderLeft: '3px solid var(--color-accent)', background: 'var(--color-bg-inset)' }}>
        <strong>{MILESTONE_PATHS.find((p) => p.key === path)?.label} Milestones.</strong> {PATH_NOTES[path]} These windows identify <em>when</em> each topic should be completed during upgrade training.
      </div>
      {hafGuidance && <div className="card" style={{ marginBottom: 12, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}><strong>HAF Milestone:</strong> {hafGuidance}</div>}
      {items.length === 0 ? <EmptyState message="No milestones in this path." /> : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 160 }}>STS Items</th>
                <th style={thStyle}>Topic</th>
                <th style={{ ...thStyle, width: 200 }}>Target Window</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={String(c.id)} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{c.sts_items ? String(c.sts_items) : '—'}</td>
                  <td style={tdStyle}>{String(c.topic)}</td>
                  <td style={tdStyle}>{c.target_window ? String(c.target_window) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
