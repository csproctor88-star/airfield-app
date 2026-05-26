'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Users, Plus, Pencil, Check, X as XIcon, ChevronUp, ChevronDown } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchResponseAgencies,
  createResponseAgency,
  updateResponseAgency,
  deleteResponseAgency,
  reorderResponseAgencies,
  AEP_AGENCY_ROLE_LABELS,
  AEP_AGENCY_ROLE_ORDER,
  type AepResponseAgency,
  type AepAgencyRole,
} from '@/lib/supabase/aep'
import { LoadingState } from '@/components/ui/loading-state'

/**
 * /aep/agencies — Response-agency roster, grouped by agency_role.
 *
 * Mirrors the SCN-agency editor pattern but expanded: each row carries
 * primary + backup contact (name / phone / radio), plus notes. Inactive
 * agencies stay in the DB so historical comms checks and drills retain
 * a readable name reference.
 */
export default function AepAgenciesPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [agencies, setAgencies] = useState<AepResponseAgency[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditableFields>(emptyDraft())
  const [adding, setAdding] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const canWrite = has(PERM.AEP_WRITE)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    const rows = await fetchResponseAgencies(installationId)
    setAgencies(rows)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { reload() }, [reload])

  const grouped = useMemo(() => groupByRole(agencies, showInactive), [agencies, showInactive])
  const inactiveCount = agencies.filter(a => !a.is_active).length

  function startAdd() {
    setAdding(true)
    setDraft({ ...emptyDraft(), agency_role: 'arff' })
  }

  function startEdit(a: AepResponseAgency) {
    setEditing(a.id)
    setDraft({
      agency_name: a.agency_name,
      agency_role: a.agency_role,
      primary_contact_name: a.primary_contact_name ?? '',
      primary_contact_phone: a.primary_contact_phone ?? '',
      primary_contact_radio: a.primary_contact_radio ?? '',
      backup_contact_name: a.backup_contact_name ?? '',
      backup_contact_phone: a.backup_contact_phone ?? '',
      notes: a.notes ?? '',
    })
  }

  function cancelEdit() {
    setEditing(null)
    setAdding(false)
    setDraft(emptyDraft())
  }

  async function saveAdd() {
    if (!installationId) return
    if (!draft.agency_name.trim()) {
      toast.error('Agency name is required')
      return
    }
    const res = await createResponseAgency(installationId, {
      agency_name: draft.agency_name,
      agency_role: draft.agency_role,
      primary_contact_name: nilIfBlank(draft.primary_contact_name),
      primary_contact_phone: nilIfBlank(draft.primary_contact_phone),
      primary_contact_radio: nilIfBlank(draft.primary_contact_radio),
      backup_contact_name: nilIfBlank(draft.backup_contact_name),
      backup_contact_phone: nilIfBlank(draft.backup_contact_phone),
      notes: nilIfBlank(draft.notes),
    })
    if (!res.ok) { toast.error(res.error || 'Add failed'); return }
    toast.success(`Added "${res.agency!.agency_name}"`)
    cancelEdit()
    reload()
  }

  async function saveEdit(id: string) {
    if (!installationId) return
    if (!draft.agency_name.trim()) {
      toast.error('Agency name is required')
      return
    }
    const res = await updateResponseAgency(id, installationId, {
      agency_name: draft.agency_name.trim(),
      agency_role: draft.agency_role,
      primary_contact_name: nilIfBlank(draft.primary_contact_name),
      primary_contact_phone: nilIfBlank(draft.primary_contact_phone),
      primary_contact_radio: nilIfBlank(draft.primary_contact_radio),
      backup_contact_name: nilIfBlank(draft.backup_contact_name),
      backup_contact_phone: nilIfBlank(draft.backup_contact_phone),
      notes: nilIfBlank(draft.notes),
    })
    if (!res.ok) { toast.error(res.error || 'Save failed'); return }
    toast.success('Agency updated')
    cancelEdit()
    reload()
  }

  async function handleDelete(a: AepResponseAgency) {
    if (!installationId) return
    if (!confirm(`Delete "${a.agency_name}"? Historical comms checks keep the name snapshot.`)) return
    const res = await deleteResponseAgency(a.id, installationId)
    if (!res.ok) { toast.error(res.error || 'Delete failed'); return }
    toast.success(`Deleted "${a.agency_name}"`)
    reload()
  }

  async function toggleActive(a: AepResponseAgency) {
    if (!installationId) return
    const res = await updateResponseAgency(a.id, installationId, { is_active: !a.is_active })
    if (!res.ok) { toast.error(res.error || 'Toggle failed'); return }
    reload()
  }

  async function moveWithinRole(role: AepAgencyRole, currentId: string, direction: -1 | 1) {
    if (!installationId) return
    const inRole = agencies.filter(a => a.agency_role === role && a.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
    const idx = inRole.findIndex(a => a.id === currentId)
    if (idx < 0) return
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= inRole.length) return
    const swapped = [...inRole]
    const [m] = swapped.splice(idx, 1)
    swapped.splice(swapIdx, 0, m)
    const ordered = swapped.map((a, i) => ({ id: a.id, sort_order: i * 10 + 10 }))
    const res = await reorderResponseAgencies(installationId, ordered)
    if (!res.ok) { toast.error(res.error || 'Reorder failed'); return }
    reload()
  }

  if (!loaded) return <LoadingState />

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <Link href="/aep" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--color-text-3)', textDecoration: 'none',
        fontSize: 'var(--fs-sm)', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Airport Emergency Plan
      </Link>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, paddingBottom: 12, marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={22} color="var(--color-warning)" />
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>Response Agencies</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              AC 150/5200-31C App. 1 — roster used by comms checks and drills
            </div>
          </div>
        </div>
        {canWrite && !adding && (
          <button onClick={startAdd} style={primaryBtnStyle}>
            <Plus size={14} style={{ marginRight: 4 }} /> Add Agency
          </button>
        )}
      </div>

      {adding && (
        <div style={editFrameStyle}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-warning)', marginBottom: 10 }}>
            New Response Agency
          </div>
          <AgencyForm draft={draft} onChange={setDraft} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveAdd} style={primaryBtnStyle}>
              <Check size={14} style={{ marginRight: 4 }} /> Add Agency
            </button>
            <button onClick={cancelEdit} style={cancelBtnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {agencies.length === 0 && !adding && (
        <div style={{
          padding: 18,
          borderRadius: 'var(--radius-md)',
          background: 'color-mix(in srgb, var(--color-warning) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
          color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5,
        }}>
          No response agencies configured yet. Add the ARFF unit, mutual-aid fire department, EMS provider, and any other agencies the AEP coordinates with.
        </div>
      )}

      {AEP_AGENCY_ROLE_ORDER.map(role => {
        const rows = grouped[role]
        if (!rows || rows.length === 0) return null
        return (
          <section key={role} style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              marginBottom: 8, paddingBottom: 4,
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700,
                color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{AEP_AGENCY_ROLE_LABELS[role]}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
                {rows.length}
              </span>
            </div>
            {rows.map((a, i) => editing === a.id ? (
              <div key={a.id} style={editFrameStyle}>
                <AgencyForm draft={draft} onChange={setDraft} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => saveEdit(a.id)} style={primaryBtnStyle}>
                    <Check size={14} style={{ marginRight: 4 }} /> Save
                  </button>
                  <button onClick={cancelEdit} style={cancelBtnStyle}>Cancel</button>
                </div>
              </div>
            ) : (
              <AgencyRow
                key={a.id}
                a={a}
                isFirst={i === 0}
                isLast={i === rows.length - 1}
                canWrite={canWrite}
                onEdit={() => startEdit(a)}
                onDelete={() => handleDelete(a)}
                onToggle={() => toggleActive(a)}
                onMoveUp={() => moveWithinRole(role, a.id, -1)}
                onMoveDown={() => moveWithinRole(role, a.id, 1)}
              />
            ))}
          </section>
        )
      })}

      {inactiveCount > 0 && (
        <div style={{ marginTop: 12, fontSize: 'var(--fs-xs)' }}>
          <button
            onClick={() => setShowInactive(s => !s)}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {showInactive ? `Hide ${inactiveCount} inactive` : `Show ${inactiveCount} inactive`}
          </button>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Agency row + form
// ────────────────────────────────────────────────────────────────

function AgencyRow({
  a, isFirst, isLast, canWrite,
  onEdit, onDelete, onToggle, onMoveUp, onMoveDown,
}: {
  a: AepResponseAgency
  isFirst: boolean
  isLast: boolean
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: 10,
      padding: '10px 12px',
      marginBottom: 6,
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)',
      background: a.is_active ? 'var(--color-bg-surface)' : 'color-mix(in srgb, var(--color-border) 30%, transparent)',
      opacity: a.is_active ? 1 : 0.6,
    }}>
      {canWrite ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <button onClick={onMoveUp} disabled={isFirst} style={moveBtnStyle(isFirst)} aria-label="Move up">
            <ChevronUp size={12} />
          </button>
          <button onClick={onMoveDown} disabled={isLast} style={moveBtnStyle(isLast)} aria-label="Move down">
            <ChevronDown size={12} />
          </button>
        </div>
      ) : <div />}

      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{a.agency_name}</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
          {[a.primary_contact_name, a.primary_contact_phone, a.primary_contact_radio].filter(Boolean).join(' · ') || <span style={{ color: 'var(--color-text-4)' }}>No primary contact recorded</span>}
        </div>
        {(a.backup_contact_name || a.backup_contact_phone) && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            <span style={{ color: 'var(--color-text-4)' }}>Backup: </span>
            {[a.backup_contact_name, a.backup_contact_phone].filter(Boolean).join(' · ')}
          </div>
        )}
        {a.notes && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 4, fontStyle: 'italic' }}>
            {a.notes}
          </div>
        )}
      </div>

      {canWrite ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          <button onClick={onToggle} style={smallBtnStyle} title={a.is_active ? 'Deactivate (kept in history)' : 'Reactivate'}>
            {a.is_active ? 'Active' : 'Inactive'}
          </button>
          <button onClick={onEdit} style={smallBtnStyle} aria-label="Edit"><Pencil size={12} /></button>
          <button onClick={onDelete} style={{ ...smallBtnStyle, color: 'var(--color-danger)' }} aria-label="Delete"><XIcon size={12} /></button>
        </div>
      ) : <div />}
    </div>
  )
}

type EditableFields = {
  agency_name: string
  agency_role: AepAgencyRole
  primary_contact_name: string
  primary_contact_phone: string
  primary_contact_radio: string
  backup_contact_name: string
  backup_contact_phone: string
  notes: string
}

function emptyDraft(): EditableFields {
  return {
    agency_name: '',
    agency_role: 'arff',
    primary_contact_name: '',
    primary_contact_phone: '',
    primary_contact_radio: '',
    backup_contact_name: '',
    backup_contact_phone: '',
    notes: '',
  }
}

function AgencyForm({ draft, onChange }: { draft: EditableFields; onChange: (d: EditableFields) => void }) {
  const set = (patch: Partial<EditableFields>) => onChange({ ...draft, ...patch })
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10, marginBottom: 10 }}>
        <Field label="Agency Name *">
          <input value={draft.agency_name} onChange={e => set({ agency_name: e.target.value })}
                 placeholder="e.g. Engine 7, Springfield Fire Dept" style={inputStyle} />
        </Field>
        <Field label="Role *">
          <select value={draft.agency_role} onChange={e => set({ agency_role: e.target.value as AepAgencyRole })} style={inputStyle}>
            {AEP_AGENCY_ROLE_ORDER.map(r => (
              <option key={r} value={r}>{AEP_AGENCY_ROLE_LABELS[r]}</option>
            ))}
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
        <Field label="Primary Contact">
          <input value={draft.primary_contact_name} onChange={e => set({ primary_contact_name: e.target.value })}
                 placeholder="Dispatch / Duty Officer" style={inputStyle} />
        </Field>
        <Field label="Primary Phone">
          <input value={draft.primary_contact_phone} onChange={e => set({ primary_contact_phone: e.target.value })}
                 placeholder="555-555-5555" style={inputStyle} />
        </Field>
        <Field label="Primary Radio">
          <input value={draft.primary_contact_radio} onChange={e => set({ primary_contact_radio: e.target.value })}
                 placeholder="VHF 154.220 / Ch. 3" style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Field label="Backup Contact">
          <input value={draft.backup_contact_name} onChange={e => set({ backup_contact_name: e.target.value })}
                 placeholder="Alternate POC" style={inputStyle} />
        </Field>
        <Field label="Backup Phone">
          <input value={draft.backup_contact_phone} onChange={e => set({ backup_contact_phone: e.target.value })}
                 placeholder="555-555-5556" style={inputStyle} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea value={draft.notes} onChange={e => set({ notes: e.target.value })}
                  rows={2}
                  placeholder="Activate via 911 dispatch; reference 'Airport ARFF assist'."
                  style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-3)', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────

function groupByRole(rows: AepResponseAgency[], includeInactive: boolean): Partial<Record<AepAgencyRole, AepResponseAgency[]>> {
  const out: Partial<Record<AepAgencyRole, AepResponseAgency[]>> = {}
  const filtered = includeInactive ? rows : rows.filter(r => r.is_active)
  for (const row of filtered) {
    const arr = out[row.agency_role] ?? []
    arr.push(row)
    out[row.agency_role] = arr
  }
  // Sort each role group by sort_order
  for (const role of Object.keys(out) as AepAgencyRole[]) {
    out[role]!.sort((a, b) => a.sort_order - b.sort_order)
  }
  return out
}

function nilIfBlank(s: string): string | null {
  const t = s.trim()
  return t.length === 0 ? null : t
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-1)',
  fontSize: 'var(--fs-sm)',
  fontFamily: 'inherit',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid color-mix(in srgb, var(--color-warning) 50%, transparent)',
  background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)',
  color: 'rgb(180,83,9)',
  fontSize: 'var(--fs-sm)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-3)',
  fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text-2)',
  fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center',
}

const editFrameStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 'var(--radius-md)',
  background: 'color-mix(in srgb, var(--color-warning) 6%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
  marginBottom: 18,
}

const moveBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 22, height: 16,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: disabled ? 'transparent' : 'var(--color-bg-elevated)',
  color: disabled ? 'var(--color-text-4)' : 'var(--color-text-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 3, cursor: disabled ? 'default' : 'pointer',
  padding: 0,
})
