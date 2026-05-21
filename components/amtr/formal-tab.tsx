'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { upsertAmtrRow } from '@/lib/supabase/amtr'
import { FORMAL_SECTIONS } from '@/lib/amtr/reference-data'
import { SimpleCatalogEditor } from '@/components/amtr/simple-catalog-editor'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'

type Row = Record<string, unknown>

export function FormalTab(props: {
  catalog: Row[]; progress: Row[]; canEnterData: boolean; canManage: boolean; installationId: string; memberId: string; onChange: () => void
}) {
  const { catalog, progress, canEnterData, canManage, installationId, memberId, onChange } = props
  const [editMode, setEditMode] = useState(false)
  const progByCat = new Map(progress.map((p) => [String(p.catalog_id), p]))

  if (editMode) {
    return (
      <SimpleCatalogEditor table="amtr_formal_catalog" rows={catalog} installationId={installationId}
        columns={[{ key: 'course', label: 'Course', flex: true }, { key: 'section', label: 'Section', type: 'select', options: FORMAL_SECTIONS.map((s) => s.key), width: 130 }]}
        defaults={{ course: 'New Course', section: 'initial' }} onDone={() => setEditMode(false)} onChange={onChange} />
    )
  }

  if (catalog.length === 0) return <div className="card" style={{ color: 'var(--color-text-3)' }}>Formal training catalog is empty — load it from Roles &amp; Catalogs.</div>

  const setField = async (catId: string, field: string, value: string) => {
    const p = progByCat.get(catId)
    await upsertAmtrRow('amtr_formal_progress', { ...(p ?? {}), base_id: installationId, member_id: memberId, catalog_id: catId, [field]: value || null })
    onChange()
  }

  return (
    <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Formal Training</h2>
      {canManage && <div style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={() => setEditMode(true)}><Pencil size={14} /> Edit catalog</Btn></div>}
    </div>
    <div style={{ display: 'grid', gap: 16 }}>
      {FORMAL_SECTIONS.map((sec) => {
        const courses = catalog.filter((c) => c.section === sec.key)
        if (courses.length === 0) return null
        return (
          <div key={sec.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}><strong>{sec.label}</strong></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>Course</th><th style={thStyle}>Start</th><th style={thStyle}>Complete</th></tr></thead>
              <tbody>
                {courses.map((c) => {
                  const catId = String(c.id)
                  const p = progByCat.get(catId)
                  return (
                    <tr key={catId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}>{String(c.course)}</td>
                      <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={p?.start_date ? String(p.start_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(catId, 'start_date', e.target.value)} /></td>
                      <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={p?.complete_date ? String(p.complete_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(catId, 'complete_date', e.target.value)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
    </div>
  )
}

const di: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 150 }
