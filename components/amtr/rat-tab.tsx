'use client'

import { useState, useEffect, useRef } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, type AmtrMember } from '@/lib/supabase/amtr'
import { buildTrainingDue, fireToTrainingTeam } from '@/lib/amtr/notifications'
import { dueStatus } from '@/lib/amtr/status'
import { StatusPill } from '@/components/amtr/status-pill'
import { SimpleCatalogEditor } from '@/components/amtr/simple-catalog-editor'
import { Btn } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

const FREQ_OPTIONS = ['', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'Triennial', 'As Required']
type Row = Record<string, unknown>

export function RatTab(props: {
  catalog: Row[]; progress: Row[]; canWrite: boolean; canManage: boolean; memberId: string; installationId: string
  member: AmtrMember; onChange: () => void; highlightItem: string | null
}) {
  const { catalog, progress, canWrite, canManage, memberId, installationId, member, onChange, highlightItem } = props
  const [editMode, setEditMode] = useState(false)
  const progByCat = new Map(progress.map((p) => [String(p.catalog_id), p]))

  // Reconcile due/overdue RAT items → notify the whole training team (trainee
  // + trainers + NAMT + AFM). Idempotent (dedupe upsert); once per mount.
  const reconciledFor = useRef<string | null>(null)
  useEffect(() => {
    if (catalog.length === 0 || reconciledFor.current === memberId) return
    reconciledFor.current = memberId
    const byCat = new Map(progress.map((p) => [String(p.catalog_id), p]))
    for (const c of catalog) {
      if (c.retired) continue
      const p = byCat.get(String(c.id))
      const due = (p?.due as string) ?? null
      if (!due) continue
      const s = dueStatus({ dueDate: due, completedDate: (p?.completed as string) ?? '' })
      if (s === 'due_soon' || s === 'overdue') {
        void fireToTrainingTeam(installationId, memberId, member.user_id, buildTrainingDue(String(c.course), due, String(c.id), 'rat'))
      }
    }
  }, [memberId, catalog, progress, installationId, member.user_id])

  if (editMode) {
    return (
      <SimpleCatalogEditor table="amtr_rat_catalog" rows={catalog} installationId={installationId}
        columns={[{ key: 'course', label: 'Course', flex: true }, { key: 'method', label: 'Method', width: 120 }, { key: 'frequency', label: 'Frequency', type: 'select', options: FREQ_OPTIONS, width: 130 }]}
        defaults={{ course: 'New Course', frequency: 'Annual' }} onDone={() => setEditMode(false)} onChange={onChange} />
    )
  }

  const setRow = async (catId: string, field: 'completed' | 'due', value: string) => {
    const { error } = await upsertAmtrRow(
      'amtr_rat_progress',
      { base_id: installationId, member_id: memberId, catalog_id: catId, [field]: value || null },
      { onConflict: 'member_id,catalog_id' },
    )
    if (error) { toast.error(error); return }
    onChange()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Ready Airman Training</h2>
        {canManage && <div style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={() => setEditMode(true)}><Pencil size={14} /> Edit catalog</Btn></div>}
      </div>
      {catalog.filter((c) => !c.retired).length === 0 ? (
        <EmptyState message="RAT catalog is empty — use Edit catalog to add courses (or load standard catalogs under Roles & Catalogs)." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-3)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '8px 12px' }}>Course</th><th>Method</th><th>Completed</th><th>Due</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {catalog.filter((c) => !c.retired).map((c) => {
                const p = progByCat.get(String(c.id))
                const completed = (p?.completed as string) ?? ''
                const due = (p?.due as string) ?? ''
                const status = dueStatus({ dueDate: due, completedDate: completed })
                const hi = highlightItem && String(c.id) === highlightItem
                return (
                  <tr key={String(c.id)} data-amtr-item={String(c.id)} style={{ borderBottom: '1px solid var(--color-border)', background: hi ? 'var(--color-accent-glow)' : undefined }}>
                    <td style={{ padding: '8px 12px' }}>{String(c.course)}</td>
                    <td>{String(c.method ?? '')}</td>
                    <td><input type="date" className="input-dark" disabled={!canWrite} defaultValue={completed ? completed.slice(0, 10) : ''} onBlur={(e) => setRow(String(c.id), 'completed', e.target.value)} /></td>
                    <td><input type="date" className="input-dark" disabled={!canWrite} defaultValue={due ? due.slice(0, 10) : ''} onBlur={(e) => setRow(String(c.id), 'due', e.target.value)} /></td>
                    <td><StatusPill status={status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
