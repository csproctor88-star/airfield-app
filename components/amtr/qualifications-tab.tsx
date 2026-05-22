'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchAmtrByMember, upsertAmtrRow, deleteAmtrRow } from '@/lib/supabase/amtr'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

type Row = Record<string, unknown>

const STD_QTP = ['KMTC Local PCG', '5-Level QTP', 'AMOPS Supervisor/Shift Lead PCG', '7-Level QTP', 'Airfield Manager PCG']
const STD_QUALS = ['Trainer', 'Certifier', '1C731 Skill Level', '1C751 Skill Level', '1C771 Skill Level', '1C791 Skill Level', 'SEI 155', 'SEI 368', 'SEI 090', 'SEI 3LZ']

export function QualificationsTab(props: { installationId: string; memberId: string; canEnterData: boolean }) {
  const { installationId, memberId, canEnterData } = props
  const [qtps, setQtps] = useState<Row[]>([])
  const [quals, setQuals] = useState<Row[]>([])

  const load = useCallback(async () => {
    setQtps(await fetchAmtrByMember('amtr_qtp', memberId, 'sort_order'))
    setQuals(await fetchAmtrByMember('amtr_quals', memberId, 'sort_order'))
  }, [memberId])
  useEffect(() => { load() }, [load])

  const addQtp = async () => {
    const name = window.prompt('Qualification / package name:')?.trim(); if (!name) return
    await upsertAmtrRow('amtr_qtp', { base_id: installationId, member_id: memberId, name, sort_order: qtps.length }); load()
  }
  const seedStandard = async () => {
    await Promise.all([
      ...STD_QTP.map((name, i) => upsertAmtrRow('amtr_qtp', { base_id: installationId, member_id: memberId, name, sort_order: i })),
      ...STD_QUALS.map((name, i) => upsertAmtrRow('amtr_quals', { base_id: installationId, member_id: memberId, name, value: 'No', sort_order: i })),
    ]); load()
  }
  const setQtp = async (r: Row, field: string, v: unknown) => { await upsertAmtrRow('amtr_qtp', { ...r, [field]: v }); load() }
  const setQual = async (r: Row, v: string) => { await upsertAmtrRow('amtr_quals', { ...r, value: v }); load() }

  const empty = qtps.length === 0 && quals.length === 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {empty && canEnterData && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
            Load the standard QTP/PCG packages + skill-level &amp; SEI rows for this member.
          </div>
          <Btn variant="primary" onClick={seedStandard}>Load standard qualifications</Btn>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <strong>Qualification Training Packages</strong>
          {canEnterData && <span style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={addQtp}>+ Add</Btn></span>}
        </div>
        {qtps.length === 0 ? <div style={{ padding: 14, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>None.</div> : (
          <table style={{ width: 'auto', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thStyle}>Qualification</th><th style={thStyle}>Complete Date</th><th style={thStyle} /></tr></thead>
            <tbody>
              {qtps.map((r) => (
                <tr key={String(r.id)} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={tdStyle}>{String(r.name)}</td>
                  <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={r.complete_date ? String(r.complete_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setQtp(r, 'complete_date', e.target.value || null)} /></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{canEnterData && <Btn variant="ghost" onClick={async () => { await deleteAmtrRow('amtr_qtp', String(r.id)); load() }}>Remove</Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}><strong>Skill Levels &amp; Special Experience Identifiers</strong></div>
        {quals.length === 0 ? <div style={{ padding: 14, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>None.</div> : (
          <table style={{ width: 'auto', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thStyle}>Qualification</th><th style={thStyle}>Yes / No</th></tr></thead>
            <tbody>
              {quals.map((r) => (
                <tr key={String(r.id)} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={tdStyle}>{String(r.name)}</td>
                  <td style={tdStyle}>
                    <select className="input-dark" style={{ ...di, width: 90 }} disabled={!canEnterData} defaultValue={(r.value as string) ?? 'No'} onChange={(e) => setQual(r, e.target.value)}>
                      <option>No</option><option>Yes</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const di: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 150 }
