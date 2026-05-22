'use client'

import { useState, useEffect, useCallback } from 'react'
import { BookOpen, ExternalLink, Plus, Trash2, X } from 'lucide-react'
import { fetchAmtrByBase, upsertAmtrRow, updateAmtrRow, deleteAmtrRow } from '@/lib/supabase/amtr'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>

// Per-1098-task training resources. Base-shared (keyed by catalog_id), so edits
// apply to every member's record. Self-fetching so it can be opened from the
// member 1098 tab or the Admin catalog builder.
export function ResourceDialog({ catalogId, taskLabel, installationId, canManage, onClose, onChanged }: {
  catalogId: string; taskLabel: string; installationId: string; canManage: boolean
  onClose: () => void; onChanged?: () => void
}) {
  const [resources, setResources] = useState<Row[]>([])
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  const load = useCallback(async () => {
    const all = await fetchAmtrByBase<Row>('amtr_1098_resources', installationId)
    setResources(all.filter((r) => String(r.catalog_id) === catalogId))
  }, [installationId, catalogId])
  useEffect(() => { load() }, [load])

  const refresh = () => { load(); onChanged?.() }
  const add = async () => {
    if (!label.trim()) return
    await upsertAmtrRow('amtr_1098_resources', { base_id: installationId, catalog_id: catalogId, label: label.trim(), url: url.trim() || null, sort_order: resources.length })
    setLabel(''); setUrl(''); refresh()
  }
  const remove = async (id: string) => { await deleteAmtrRow('amtr_1098_resources', id); refresh() }
  const edit = async (id: string, field: 'label' | 'url', value: string) => { await updateAmtrRow('amtr_1098_resources', id, { [field]: value || null }); refresh() }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 560, maxWidth: '100%', maxHeight: '80vh', overflow: 'auto', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <BookOpen size={16} style={{ color: 'var(--color-accent)' }} />
          <strong style={{ fontSize: 15 }}>{taskLabel}</strong>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 10 }}>Training resources for this task (shown on every member&apos;s record).</div>
          {resources.length === 0 && <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginBottom: 10 }}>No resources added yet.</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            {resources.map((r) => {
              const id = String(r.id); const link = (r.url as string) ?? ''
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {canManage ? (
                    <>
                      <input className="input-dark" style={{ width: 180, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} defaultValue={(r.label as string) ?? ''} placeholder="Label" onBlur={(e) => edit(id, 'label', e.target.value)} />
                      <input className="input-dark" style={{ flex: 1, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} defaultValue={link} placeholder="https://…" onBlur={(e) => edit(id, 'url', e.target.value)} />
                      <button onClick={() => remove(id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                    </>
                  ) : (
                    link
                      ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}>{String(r.label)} <ExternalLink size={13} /></a>
                      : <span style={{ fontSize: 'var(--fs-sm)' }}>{String(r.label)}</span>
                  )}
                </div>
              )
            })}
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="input-dark" style={{ width: 180, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Airfield Driving SOP)" />
              <input className="input-dark" style={{ flex: 1, minWidth: 160, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              <Btn variant="secondary" onClick={add} disabled={!label.trim()}><Plus size={14} /> Add</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
