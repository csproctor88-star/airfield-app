'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchAmtrByBase, fetchAmtrByMember, upsertAmtrRow } from '@/lib/supabase/amtr'
import { thStyle, tdStyle } from '@/components/amtr/ui'

type Row = Record<string, unknown>

const GROUPS: { category: string; title: string; mode: 'date' | 'yesno' }[] = [
  { category: 'qtp', title: 'Qualification Training Packages', mode: 'date' },
  { category: 'skill_level', title: 'Skill Levels', mode: 'yesno' },
  { category: 'sei', title: 'Special Experience Identifiers (SEI)', mode: 'yesno' },
]

// Qualifications, skill levels, and SEIs are defined once per base (Training
// Admin) and shown the same on every record. The record only tracks attained /
// completion date per item.
export function QualificationsTab(props: { installationId: string; memberId: string; canEnterData: boolean }) {
  const { installationId, memberId, canEnterData } = props
  const [catalog, setCatalog] = useState<Row[]>([])
  const [progress, setProgress] = useState<Row[]>([])

  const load = useCallback(async () => {
    setCatalog(await fetchAmtrByBase('amtr_qual_catalog', installationId))
    setProgress(await fetchAmtrByMember('amtr_qual_progress', memberId))
  }, [installationId, memberId])
  useEffect(() => { load() }, [load])

  const progByCat = new Map(progress.map((p) => [String(p.catalog_id), p]))
  const setField = async (catId: string, field: 'attained' | 'complete_date', value: unknown) => {
    const p = progByCat.get(catId)
    await upsertAmtrRow('amtr_qual_progress', { ...(p ?? {}), base_id: installationId, member_id: memberId, catalog_id: catId, [field]: value })
    load()
  }

  if (catalog.length === 0) {
    return <div className="card" style={{ color: 'var(--color-text-3)' }}>No qualifications configured — load them from the Admin page (Qualifications, Skill Levels &amp; SEIs).</div>
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {GROUPS.map((g) => {
        const items = catalog.filter((c) => c.category === g.category && !c.retired)
        if (items.length === 0) return null
        return (
          <div key={g.category} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}><strong>{g.title}</strong></div>
            <table style={{ width: 'auto', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Qualification</th>
                  <th style={{ ...thStyle, width: 160 }}>{g.mode === 'date' ? 'Complete Date' : 'Attained'}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const catId = String(c.id)
                  const p = progByCat.get(catId)
                  return (
                    <tr key={catId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}>{String(c.name)}</td>
                      <td style={tdStyle}>
                        {g.mode === 'date'
                          ? <input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={p?.complete_date ? String(p.complete_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(catId, 'complete_date', e.target.value || null)} />
                          : (
                            <select className="input-dark" style={{ ...di, width: 90 }} disabled={!canEnterData} defaultValue={p?.attained ? 'Yes' : 'No'} onChange={(e) => setField(catId, 'attained', e.target.value === 'Yes')}>
                              <option>No</option><option>Yes</option>
                            </select>
                          )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

const di: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 150 }
