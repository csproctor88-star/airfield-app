'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchAmtrRoleAssignments, addAmtrRole, removeAmtrRole, fetchAmtrMembers,
  fetchAmtrByBase, upsertAmtrRow, deleteAmtrRow, removeAmtrMemberFromRoster, deleteAmtrMember,
  syncAmtrRosterFromBase,
  type AmtrRoleAssignment, type AmtrRole, type AmtrMember,
} from '@/lib/supabase/amtr'
import { seedBaseCatalogs, SEED_COUNTS } from '@/lib/amtr/seed-data'
import { AMTR_ROLE_LABELS } from '@/lib/amtr/roles'
import { InspectionChecklistEditor } from '@/components/amtr/inspection-checklist-editor'
import { MilestoneCatalogEditor } from '@/components/amtr/milestone-catalog-editor'
import { Form803CatalogEditor } from '@/components/amtr/form803-catalog-editor'
import { SimpleCatalogEditor } from '@/components/amtr/simple-catalog-editor'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import { ArrowLeft, Download, ChevronRight, ChevronDown, BarChart3, Trash2 } from 'lucide-react'

type Row = Record<string, unknown>
const ROLES: AmtrRole[] = ['trainee', 'trainer', 'certifier', 'namt', 'afm']

export default function AmtrRolesPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const router = useRouter()
  const canManage = has(PERM.AMTR_MANAGE)

  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [assignments, setAssignments] = useState<AmtrRoleAssignment[]>([])
  const [members, setMembers] = useState<AmtrMember[]>([])
  const [search, setSearch] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [cat1098, setCat1098] = useState<Row[]>([])
  const [catRat, setCatRat] = useState<Row[]>([])
  const [catJqs, setCatJqs] = useState<Row[]>([])
  const [catInsp, setCatInsp] = useState<Row[]>([])
  const [catEntryTypes, setCatEntryTypes] = useState<Row[]>([])
  const [catMilestone, setCatMilestone] = useState<Row[]>([])
  const [cat803, setCat803] = useState<Row[]>([])

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    // Roster mirrors the base's assigned users — pull in any new ones.
    await syncAmtrRosterFromBase(installationId)
    const [a, mem, c1098, crat, cjqs, cinsp, cet, cmile, c803] = await Promise.all([
      fetchAmtrRoleAssignments(installationId),
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Row>('amtr_1098_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_rat_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_jqs_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_inspection_checklist', installationId),
      fetchAmtrByBase<Row>('amtr_623a_entry_types', installationId),
      fetchAmtrByBase<Row>('amtr_milestone_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_803_catalog', installationId),
    ])
    setAssignments(a); setMembers(mem); setCat1098(c1098); setCatRat(crat); setCatJqs(cjqs); setCatInsp(cinsp); setCatEntryTypes(cet); setCatMilestone(cmile); setCat803(c803)
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

  const removeFromRoster = async (m: AmtrMember) => {
    if (!installationId) return
    if (!window.confirm(`Remove ${m.full_name} from the training roster? Their training record will be deleted and they won't be auto-added again.`)) return
    const { error } = m.user_id
      ? await removeAmtrMemberFromRoster(installationId, m.user_id)
      : await deleteAmtrMember(m.id)
    if (error) { toast.error(error); return }
    toast.success('Removed from training roster'); load()
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
  const sortedMembers = [...members].sort((a, b) => a.full_name.localeCompare(b.full_name))
  const filteredMembers = search.trim()
    ? sortedMembers.filter((m) => m.full_name.toLowerCase().includes(search.trim().toLowerCase()))
    : sortedMembers
  const catalogsLoaded = catJqs.length > 0

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn variant="ghost" onClick={() => router.push('/amtr')}><ArrowLeft size={15} /> Roster</Btn>
        <Btn variant="secondary" onClick={() => router.push('/amtr/reports')}><BarChart3 size={15} /> Reports</Btn>
      </div>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>Admin</h1>

      {loading ? <LoadingState /> : (
        <>
          {/* Standard catalog adopt */}
          <CollapsibleCard title="Standard 1C7X1 Catalogs"
            actions={<Btn variant="primary" onClick={loadStandard} disabled={seeding}>
              <Download size={15} /> {seeding ? 'Loading…' : catalogsLoaded ? 'Re-check / load missing' : 'Load standard catalogs'}
            </Btn>}>
            <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
              Load the standard JQS-CFETP ({SEED_COUNTS.jqs}), DAF 1098 ({SEED_COUNTS.recurring1098}), formal ({SEED_COUNTS.formal}), RAT ({SEED_COUNTS.rat}), milestone ({SEED_COUNTS.milestones}), inspection checklist ({SEED_COUNTS.inspection}), and standard 803 ({SEED_COUNTS.std803}) catalogs for this base. Already-populated catalogs are skipped.
            </div>
          </CollapsibleCard>

          {/* Role assignments — matrix */}
          <CollapsibleCard title="Role Assignments"
            actions={<input className="input-dark" placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />}>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 0 }}>
              Check a box to assign a role; uncheck to remove it. The roster auto-populates from the base; use the trash icon to remove anyone who doesn&apos;t require a training record. Signing authority is hierarchical — a Certifier may sign the Trainee, Trainer, and Certifier blocks; NAMT signs all but AFM; AFM signs every block. On their own record a member may only sign the Trainee block. Each signature locks its own block.
            </p>
            {members.length === 0 ? <EmptyState message="No members on the roster yet — they populate automatically from the base's assigned users." /> : (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Member</th>
                      {ROLES.map((r) => <th key={r} style={{ ...thStyle, textAlign: 'center', width: 90 }}>{AMTR_ROLE_LABELS[r]}</th>)}
                      <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>Roster</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => {
                      const uid = m.user_id
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{m.full_name}</td>
                          {ROLES.map((r) => {
                            if (!uid) return <td key={r} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-3)' }} title="No linked account">—</td>
                            const key = `${uid}:${r}`
                            const existingId = assignByKey.get(key)
                            return (
                              <td key={r} style={{ ...tdStyle, textAlign: 'center' }}>
                                <input type="checkbox" checked={!!existingId} disabled={savingKey === key}
                                  onChange={() => toggleAssign(uid, r, existingId)}
                                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                              </td>
                            )
                          })}
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button onClick={() => removeFromRoster(m)} title="Remove from training roster"
                              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-3)' }}>
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {search.trim() && filteredMembers.length === 0 && (
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

          {/* Milestones */}
          <CollapsibleCard title="QTP / PCG Milestones" count={catMilestone.length}>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 0 }}>
              Upgrade milestones and their target windows, defined once here and shown the same on every record. Grouped by upgrade path.
            </p>
            <MilestoneCatalogEditor catalog={catMilestone} installationId={installationId!} onChange={load} />
          </CollapsibleCard>

          {/* 803 standard task evaluations */}
          <CollapsibleCard title="DAF 803 — Standard Task Evaluations" count={cat803.length}>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 0 }}>
              The standard required 803 task evaluations (STS items) per upgrade section. A member&apos;s 803 tab can one-click populate from this list. Edit, reorder, add, or remove items per section.
            </p>
            <Form803CatalogEditor catalog={cat803} installationId={installationId!} onChange={load} />
          </CollapsibleCard>

          {/* 623A entry types */}
          <CollapsibleCard title="623A Entry Types" count={catEntryTypes.length}>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 0 }}>
              The entry types offered in the DAF 623A “Entry Type” dropdown. Add, rename, reorder, or remove them here.
            </p>
            <SimpleCatalogEditor table="amtr_623a_entry_types" rows={catEntryTypes} installationId={installationId!}
              columns={[{ key: 'label', label: 'Entry Type', flex: true }]} defaults={{ label: 'New Entry Type' }}
              onDone={() => {}} onChange={load} />
          </CollapsibleCard>

          {/* Inspection checklist builder */}
          <CollapsibleCard title="Inspection Checklist" count={catInsp.filter((r) => r.kind === 'item').length}>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 0 }}>
              The checklist used for monthly training-record inspections. Add, edit, reorder, or remove sections and items. Items tagged <strong>auto</strong> are auto-detected from each member&apos;s record during an inspection.
            </p>
            <InspectionChecklistEditor rows={catInsp} installationId={installationId!} onChange={load} />
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
