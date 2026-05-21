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
import { Field, Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import { ArrowLeft, Download } from 'lucide-react'

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
  const [selUser, setSelUser] = useState('')
  const [selRoles, setSelRoles] = useState<Set<AmtrRole>>(new Set())
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

  const toggleRole = (r: AmtrRole) => {
    setSelRoles((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r); else next.add(r)
      return next
    })
  }
  const grant = async () => {
    if (!installationId || !selUser || selRoles.size === 0) return
    for (const r of Array.from(selRoles)) {
      const { error } = await addAmtrRole(installationId, selUser, r)
      if (error) { toast.error(error); return }
    }
    toast.success(`Granted ${selRoles.size} role${selRoles.size > 1 ? 's' : ''}`)
    setSelRoles(new Set()); setSelUser(''); load()
  }
  const revoke = async (id: string) => {
    const { error } = await removeAmtrRole(id)
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

  const labelFor = (uid: string) => profiles.find((p) => p.id === uid)?.label ?? uid
  const byUser = new Map<string, AmtrRoleAssignment[]>()
  for (const a of assignments) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, [])
    byUser.get(a.user_id)!.push(a)
  }
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
          <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 600 }}>Standard 1C7X1 Catalogs</div>
              <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
                Load the standard JQS-CFETP ({SEED_COUNTS.jqs}), DAF 1098 ({SEED_COUNTS.recurring1098}), formal ({SEED_COUNTS.formal}), RAT ({SEED_COUNTS.rat}), and milestone ({SEED_COUNTS.milestones}) catalogs for this base. Already-populated catalogs are skipped.
              </div>
            </div>
            <Btn variant="primary" onClick={loadStandard} disabled={seeding}>
              <Download size={15} /> {seeding ? 'Loading…' : catalogsLoaded ? 'Re-check / load missing' : 'Load standard catalogs'}
            </Btn>
          </div>

          {/* Role assignments */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Role Assignments</h3>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
              A user may hold multiple roles; the highest applies when viewing others&apos; records. On their own record they always act as Trainee. One signature per record (signing as one role blocks the others).
            </p>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
              <Field label="User" style={{ minWidth: 260 }}>
                <select className="input-dark" value={selUser} onChange={(e) => setSelUser(e.target.value)}>
                  <option value="">Select a user…</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Roles (select one or more)">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                  {ROLES.map((r) => {
                    const on = selRoles.has(r)
                    return (
                      <button key={r} type="button" onClick={() => toggleRole(r)}
                        style={{
                          padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 600,
                          border: `1.5px solid ${on ? 'var(--color-accent)' : 'var(--color-border-mid)'}`,
                          background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
                          color: on ? 'var(--color-accent)' : 'var(--color-text-2)',
                        }}>
                        {AMTR_ROLE_LABELS[r]}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Btn variant="primary" onClick={grant} disabled={!selUser || selRoles.size === 0}>Grant</Btn>
            </div>
            {byUser.size === 0 ? <EmptyState message="No AMTR roles assigned yet." /> : (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                {Array.from(byUser.entries()).map(([uid, list], i) => (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                    <span style={{ fontWeight: 600, minWidth: 220, flexShrink: 0 }}>{labelFor(uid)}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {list.map((a) => <RolePill key={a.id} label={AMTR_ROLE_LABELS[a.role]} onRemove={() => revoke(a.id)} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 1098 catalog */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }}>DAF 1098 — Recurring Training ({cat1098.length})</h3>
              <div style={{ marginLeft: 'auto' }}>
                <Btn variant="secondary" onClick={() => addTask('amtr_1098_catalog', 'task')}>+ Add task</Btn>
              </div>
            </div>
            <CatalogList rows={cat1098} field="task" onDelete={async (id) => { await deleteAmtrRow('amtr_1098_catalog', id); load() }} />
          </div>

          {/* RAT catalog */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Ready Airman Training ({catRat.length})</h3>
              <div style={{ marginLeft: 'auto' }}>
                <Btn variant="secondary" onClick={() => addTask('amtr_rat_catalog', 'course')}>+ Add course</Btn>
              </div>
            </div>
            <CatalogList rows={catRat} field="course" onDelete={async (id) => { await deleteAmtrRow('amtr_rat_catalog', id); load() }} />
          </div>
        </>
      )}
    </div>
  )
}

function RolePill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 4px 3px 10px',
      borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: 600,
      background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)', color: 'var(--color-accent)',
      border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
    }}>
      {label}
      <button onClick={onRemove} title="Revoke" style={{
        display: 'inline-flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
        borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, fontFamily: 'inherit',
        background: 'color-mix(in srgb, var(--color-accent) 24%, transparent)', color: 'var(--color-accent)',
      }}>×</button>
    </span>
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
