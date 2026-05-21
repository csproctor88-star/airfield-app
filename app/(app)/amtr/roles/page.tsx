'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchAmtrRoleAssignments, addAmtrRole, removeAmtrRole,
  fetchAmtrByBase, upsertAmtrRow, deleteAmtrRow,
  type AmtrRoleAssignment, type AmtrRole,
} from '@/lib/supabase/amtr'
import { seedBaseCatalogs, SEED_COUNTS } from '@/lib/amtr/seed-data'
import { AMTR_ROLE_LABELS } from '@/lib/amtr/roles'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import { ArrowLeft, Download, ChevronRight, ChevronDown } from 'lucide-react'

type Row = Record<string, unknown>
type Profile = { id: string; label: string; sortKey: string }
const ROLES: AmtrRole[] = ['trainee', 'trainer', 'certifier', 'namt', 'afm']

export default function AmtrRolesPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const router = useRouter()
  const canManage = has(PERM.AMTR_MANAGE)

  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [assignments, setAssignments] = useState<AmtrRoleAssignment[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [cat1098, setCat1098] = useState<Row[]>([])
  const [catRat, setCatRat] = useState<Row[]>([])
  const [catJqs, setCatJqs] = useState<Row[]>([])

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const supabase = createClient()
    const [a, c1098, crat, cjqs] = await Promise.all([
      fetchAmtrRoleAssignments(installationId),
      fetchAmtrByBase<Row>('amtr_1098_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_rat_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_jqs_catalog', installationId),
    ])
    setAssignments(a); setCat1098(c1098); setCatRat(crat); setCatJqs(cjqs)
    if (supabase) {
      try {
        // Only personnel assigned to THIS base (base_members), not all Glidepath users.
        const { data: bm } = await supabase.from('base_members').select('user_id').eq('base_id', installationId)
        const ids = ((bm ?? []) as unknown as { user_id: string }[]).map((m) => m.user_id).filter(Boolean)
        let pq = supabase.from('profiles').select('*')
        if (ids.length) pq = pq.in('id', ids)
        const { data } = await pq
        const rows = (data ?? []) as unknown as {
          id: string; rank?: string | null; first_name?: string | null
          last_name?: string | null; name?: string | null; email?: string | null
        }[]
        const mapped = rows.map((r) => {
          const last = (r.last_name || '').trim()
          const first = (r.first_name || '').trim()
          const rank = (r.rank || '').trim()
          let label: string
          if (last || first) {
            label = `${rank ? rank + ' ' : ''}${last}${last && first ? ', ' : ''}${first}`.trim()
          } else {
            label = r.name || r.email || r.id
          }
          return { id: r.id, label, sortKey: (last || r.name || r.email || '').toLowerCase() }
        })
        mapped.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        setProfiles(mapped)
      } catch { /* RLS may block; manual entry still possible */ }
    }
    setLoading(false)
  }, [installationId])

  useEffect(() => { load() }, [load])

  const loadStandard = async () => {
    if (!installationId) return
    setSeeding(true)
    const results = await seedBaseCatalogs(installationId)
    setSeeding(false)
    const err = results.find((r) => r.error)
    if (err) { toast.error(err.error!); return }
    const inserted = results.reduce((n, r) => n + r.inserted, 0)
    toast.success(inserted > 0 ? `Loaded standard catalogs (${inserted} rows)` : 'Standard catalogs already present')
    load()
  }

  // Matrix toggle: assignment present → revoke; absent → grant. Saves instantly.
  const toggleAssign = async (uid: string, role: AmtrRole, existingId: string | undefined) => {
    if (!installationId) return
    const key = `${uid}:${role}`
    setSavingKey(key)
    const { error } = existingId
      ? await removeAmtrRole(existingId)
      : await addAmtrRole(installationId, uid, role)
    setSavingKey(null)
    if (error) { toast.error(error); return }
    load()
  }
  const addTask = async (table: 'amtr_1098_catalog' | 'amtr_rat_catalog', field: 'task' | 'course') => {
    if (!installationId) return
    const value = window.prompt('Name:')?.trim()
    if (!value) return
    await upsertAmtrRow(table, { base_id: installationId, [field]: value, frequency: 'Annual' })
    load()
  }

  if (!canManage) return <div style={{ padding: 24 }}><EmptyState message="Requires the Manage Training Records permission." /></div>

  // (user_id:role) → assignment id, for the matrix checkboxes.
  const assignByKey = new Map<string, string>()
  for (const a of assignments) assignByKey.set(`${a.user_id}:${a.role}`, a.id)
  const filteredProfiles = search.trim()
    ? profiles.filter((p) => p.label.toLowerCase().includes(search.trim().toLowerCase()))
    : profiles
  const catalogsLoaded = catJqs.length > 0

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Btn variant="ghost" onClick={() => router.push('/amtr')}><ArrowLeft size={15} /> Roster</Btn>
      </div>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>AMTR Roles &amp; Catalogs</h1>

      {loading ? <LoadingState /> : (
        <>
          {/* Standard catalog adopt */}
          <CollapsibleCard title="Standard 1C7X1 Catalogs"
            actions={<Btn variant="primary" onClick={loadStandard} disabled={seeding}>
              <Download size={15} /> {seeding ? 'Loading…' : catalogsLoaded ? 'Re-check / load missing' : 'Load standard catalogs'}
            </Btn>}>
            <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
              Load the standard JQS-CFETP ({SEED_COUNTS.jqs}), DAF 1098 ({SEED_COUNTS.recurring1098}), formal ({SEED_COUNTS.formal}), RAT ({SEED_COUNTS.rat}), and milestone ({SEED_COUNTS.milestones}) catalogs for this base. Already-populated catalogs are skipped.
            </div>
          </CollapsibleCard>

          {/* Role assignments — matrix */}
          <CollapsibleCard title="Role Assignments"
            actions={<input className="input-dark" placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />}>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 0 }}>
              Check a box to assign a role; uncheck to remove it. Signing authority is hierarchical — a Certifier may sign the Trainee, Trainer, and Certifier blocks; NAMT signs all but AFM; AFM signs every block. On their own record a member may only sign the Trainee block. Each signature locks its own block.
            </p>
            {profiles.length === 0 ? <EmptyState message="No personnel found for this base." /> : (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Member</th>
                      {ROLES.map((r) => <th key={r} style={{ ...thStyle, textAlign: 'center', width: 90 }}>{AMTR_ROLE_LABELS[r]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{p.label}</td>
                        {ROLES.map((r) => {
                          const key = `${p.id}:${r}`
                          const existingId = assignByKey.get(key)
                          return (
                            <td key={r} style={{ ...tdStyle, textAlign: 'center' }}>
                              <input type="checkbox" checked={!!existingId} disabled={savingKey === key}
                                onChange={() => toggleAssign(p.id, r, existingId)}
                                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {search.trim() && filteredProfiles.length === 0 && (
              <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 8 }}>No members match “{search}”.</div>
            )}
          </CollapsibleCard>

          {/* 1098 catalog */}
          <CollapsibleCard title="DAF 1098 — Recurring Training" count={cat1098.length}
            actions={<Btn variant="secondary" onClick={() => addTask('amtr_1098_catalog', 'task')}>+ Add task</Btn>}>
            <CatalogList rows={cat1098} field="task" onDelete={async (id) => { await deleteAmtrRow('amtr_1098_catalog', id); load() }} />
          </CollapsibleCard>

          {/* RAT catalog */}
          <CollapsibleCard title="Ready Airman Training" count={catRat.length}
            actions={<Btn variant="secondary" onClick={() => addTask('amtr_rat_catalog', 'course')}>+ Add course</Btn>}>
            <CatalogList rows={catRat} field="course" onDelete={async (id) => { await deleteAmtrRow('amtr_rat_catalog', id); load() }} />
          </CollapsibleCard>
        </>
      )}
    </div>
  )
}

// Collapsible section card — collapsed by default; actions show only when open.
function CollapsibleCard({ title, count, actions, children }: {
  title: string; count?: number; actions?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-1)', padding: 0 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <strong style={{ fontSize: 16 }}>{title}</strong>
          {count != null && <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 400 }}>({count})</span>}
        </button>
        {actions && open && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
      </div>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function CatalogList({ rows, field, onDelete }: { rows: Row[]; field: string; onDelete: (id: string) => void }) {
  if (rows.length === 0) return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 8 }}>No items — use “Load standard catalogs” above or add manually.</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
      <thead><tr><th style={thStyle}>Task</th><th style={thStyle}>Frequency</th><th style={thStyle} /></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r.id)} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={tdStyle}>{String(r[field] ?? '')}</td>
            <td style={tdStyle}>{String(r.frequency ?? '')}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>
              <Btn variant="ghost" onClick={() => onDelete(String(r.id))}>Remove</Btn>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
