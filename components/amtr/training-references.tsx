'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { TSC_TABLE, PROFICIENCY_KEY } from '@/lib/amtr/reference-data'
import { fetchAmtrByBase, upsertAmtrRow, updateAmtrRow, deleteAmtrRow } from '@/lib/supabase/amtr'
import { TabBar, Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

type Row = Record<string, unknown>

const PROF_GROUPS: { key: 'performance' | 'knowledge' | 'subject' | 'marks'; title: string; note: string }[] = [
  { key: 'performance', title: 'Task Performance Levels', note: 'What the trainee can do unaided.' },
  { key: 'knowledge', title: 'Task Knowledge Levels', note: 'What the trainee knows about the task (paired with a performance level, e.g. "3c").' },
  { key: 'subject', title: 'Subject Knowledge Levels', note: 'What the trainee knows about a subject area, broader than a single task.' },
  { key: 'marks', title: 'Marks', note: '' },
]

export function TrainingReferences({ installationId, canManage }: { installationId: string | null; canManage: boolean }) {
  const [tab, setTab] = useState<'tsc' | 'prof' | 'index'>('tsc')

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <TabBar
          tabs={[
            { key: 'tsc', label: 'Training Status Codes' },
            { key: 'prof', label: 'Proficiency Code Key' },
            { key: 'index', label: 'Master Training Reference Index' },
          ]}
          active={tab} onChange={(k) => setTab(k as typeof tab)} />
      </div>

      {tab === 'tsc' && (
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Training Status Codes</h3>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>DAFI 36-2670 — code recorded on the member cover sheet.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {TSC_TABLE.map((t) => (
              <div key={t.code} className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 4 }}>TSC {t.code}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'prof' && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Proficiency Code Key</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            {PROF_GROUPS.map((grp) => (
              <div key={grp.key} className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{grp.title}</div>
                {grp.note && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10 }}>{grp.note}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {PROFICIENCY_KEY[grp.key].map((e) => (
                    <div key={e.code} style={{ borderLeft: '3px solid var(--color-accent)', paddingLeft: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                        <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{e.code}</span>{e.label ? ` — ${e.label}` : ''}
                      </div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{e.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Notes</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                {PROFICIENCY_KEY.notes.map((n, i) => <li key={i} style={{ marginBottom: 4 }}>{n}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === 'index' && <ReferenceIndex installationId={installationId} canManage={canManage} />}
    </div>
  )
}

function ReferenceIndex({ installationId, canManage }: { installationId: string | null; canManage: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!installationId) { setLoading(false); return }
    setLoading(true)
    setRows(await fetchAmtrByBase('amtr_reference_index', installationId))
    setLoading(false)
  }, [installationId])
  useEffect(() => { load() }, [load])

  const addRow = async () => {
    if (!installationId) return
    const { error } = await upsertAmtrRow('amtr_reference_index', { base_id: installationId, sort_order: rows.length })
    if (error) { toast.error(error); return }
    load()
  }
  const setField = async (id: string, field: 'publication' | 'link', value: string) => {
    const { error } = await updateAmtrRow('amtr_reference_index', id, { [field]: value || null })
    if (error) { toast.error(error); return }
    load()
  }
  const remove = async (id: string) => {
    const { error } = await deleteAmtrRow('amtr_reference_index', id)
    if (error) { toast.error(error); return }
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Master Training Reference Index</h3>
        {canManage && <div style={{ marginLeft: 'auto' }}><Btn variant="primary" onClick={addRow}><Plus size={14} /> Add publication</Btn></div>}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Governing publications for the 1C7X1 training program. The training manager maintains this list as references are added or rescinded.
      </div>
      {loading ? null : rows.length === 0 ? (
        <EmptyState message={canManage ? 'No publications yet — add the first reference.' : 'No publications have been added yet.'} />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Publication</th>
                <th style={thStyle}>Link</th>
                {canManage && <th style={{ ...thStyle, width: 40 }} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = String(r.id)
                const link = (r.link as string) ?? ''
                return (
                  <tr key={id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={tdStyle}>
                      {canManage
                        ? <input className="input-dark" defaultValue={(r.publication as string) ?? ''} placeholder="e.g. DAFMAN 13-204 Vol 1" onBlur={(e) => setField(id, 'publication', e.target.value)} />
                        : (r.publication ? String(r.publication) : '—')}
                    </td>
                    <td style={tdStyle}>
                      {canManage
                        ? <input className="input-dark" defaultValue={link} placeholder="https://…" onBlur={(e) => setField(id, 'link', e.target.value)} />
                        : link
                          ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-accent)' }}>Open <ExternalLink size={13} /></a>
                          : '—'}
                    </td>
                    {canManage && (
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button onClick={() => remove(id)} title="Delete" style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer' }}><Trash2 size={15} /></button>
                      </td>
                    )}
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
