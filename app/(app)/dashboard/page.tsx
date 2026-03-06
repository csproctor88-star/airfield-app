'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLog } from '@/lib/supabase/activity-queries'
import { logManualEntry, updateActivityEntry, deleteActivityEntry } from '@/lib/supabase/activity'
import { toast } from 'sonner'
import { TemplatePicker } from '@/components/ui/template-picker'

// --- Quick Actions (KPI badges) ---
const QUICK_ACTIONS = [
  { label: 'Airfield Inspections', icon: '📋', color: 'var(--color-success)', href: '/inspections?action=begin' },
  { label: 'Airfield Checks', icon: '🛡️', color: 'var(--color-warning)', href: '/checks' },
  { label: 'New Discrepancy', icon: '🚨', color: 'var(--color-danger)', href: '/discrepancies/new' },
]

// --- Activity action formatting ---
function formatAction(action: string, entityType: string, displayId?: string): string {
  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy',
    check: 'Check',
    inspection: 'Inspection',
    obstruction_evaluation: 'Obstruction Eval',
    navaid_status: 'NAVAID',
    airfield_status: 'Runway',
    arff_status: 'ARFF',
    contractor: 'Personnel on Airfield',
    manual: 'Manual Entry',
  }
  const entity = typeLabel[entityType] || entityType
  const id = displayId ? ` ${displayId}` : ''
  const actionLabel: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    completed: 'Completed',
    status_updated: 'Status changed on',
    saved: 'Saved',
    filed: 'Filed',
    resumed: 'Resumed',
    reviewed: 'Reviewed',
    noted: 'Logged',
    logged_personnel: 'Logged',
    personnel_off_airfield: 'Personnel Off Airfield',
    cancelled: 'Cancelled',
    waiver_review_deleted: 'Deleted review for',
  }
  const label = actionLabel[action] || (action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' '))
  if (action === 'personnel_off_airfield') return `${label}${id}`
  return `${label} ${entity}${id}`
}

type ActivityEntry = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_display_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_name: string
  user_rank: string | null
}

function getEntityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null
  switch (entityType) {
    case 'discrepancy': return `/discrepancies/${entityId}`
    case 'check': return `/checks/${entityId}`
    case 'inspection': return `/inspections/${entityId}`
    case 'obstruction_evaluation': return `/obstructions`
    default: return null
  }
}

export default function AMDashboardPage() {
  const router = useRouter()
  const { installationId } = useInstallation()
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [manualText, setManualText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showContractorForm, setShowContractorForm] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [saving, setSaving] = useState(false)

  // --- Load Activity Feed ---
  const loadActivity = useCallback(async () => {
    const { data } = await fetchActivityLog({ baseId: installationId, limit: 20 })
    setActivity(data as ActivityEntry[])
  }, [installationId])

  useEffect(() => { loadActivity() }, [loadActivity])

  // Realtime: auto-refresh activity feed on new entries
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    const channel = supabase
      .channel(`am_dashboard_activity:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `base_id=eq.${installationId}` },
        () => { loadActivity() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [installationId, loadActivity])

  // --- Manual Entry ---
  const handleManualSubmit = async () => {
    if (!manualText.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    if (!supabase) {
      toast.success('Entry logged (demo mode)')
      setManualText('')
      setSubmitting(false)
      return
    }
    const { error } = await logManualEntry(manualText.trim(), installationId)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry logged')
      setManualText('')
      await loadActivity()
    }
    setSubmitting(false)
  }

  // --- Edit / Delete handlers ---
  const handleEdit = (a: ActivityEntry) => {
    const editVal = a.metadata?.edit ? String(a.metadata.edit) : (a.metadata?.notes ? String(a.metadata.notes) : '')
    const d = new Date(a.created_at)
    setEditingId(a.id)
    setEditText(editVal)
    setEditDate(d.toISOString().slice(0, 10))
    setEditTime(d.toISOString().slice(11, 16))
  }

  const handleEditSave = async () => {
    if (!editingId) return
    setSaving(true)
    const supabase = createClient()
    if (!supabase) {
      toast.success('Entry updated (demo mode)')
      setEditingId(null)
      setSaving(false)
      return
    }
    const newTimestamp = editDate && editTime ? `${editDate}T${editTime}:00.000Z` : undefined
    const { error } = await updateActivityEntry(editingId, editText.trim(), newTimestamp)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry updated')
      setEditingId(null)
      await loadActivity()
    }
    setSaving(false)
  }

  const handleDelete = async (a: ActivityEntry) => {
    const supabase = createClient()
    if (!supabase) {
      toast.success('Entry deleted (demo mode)')
      return
    }
    if (!confirm('Delete this activity log entry? This cannot be undone.')) return
    const { error } = await deleteActivityEntry(a.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry deleted')
      await loadActivity()
    }
  }

  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 16 }}>Dashboard</div>

      {/* ===== Quick Actions ===== */}
      <span className="section-label">Quick Actions</span>
      <div className="actions-row" style={{ marginBottom: 20 }}>
        {QUICK_ACTIONS.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '14px 16px',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 'var(--fs-5xl)' }}>{q.icon}</span>
            <span style={{ fontSize: 'var(--fs-xl)', color: q.color, letterSpacing: '0.04em', fontWeight: 700 }}>
              {q.label}
            </span>
          </Link>
        ))}
        {/* Contractors on Airfield badge */}
        <button
          onClick={() => setShowContractorForm(true)}
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '14px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 'var(--fs-5xl)' }}>🏗️</span>
          <span style={{ fontSize: 'var(--fs-xl)', color: 'var(--color-cyan)', letterSpacing: '0.04em', fontWeight: 700 }}>
            Personnel on Airfield
          </span>
        </button>
      </div>

      {/* ===== Contractor Form Dialog ===== */}
      {showContractorForm && (
        <PersonnelFormDialog
          installationId={installationId}
          onClose={() => setShowContractorForm(false)}
          onSaved={loadActivity}
        />
      )}

      {/* ===== Manual Entry ===== */}
      <div className="card" style={{ marginBottom: 16, padding: '14px', border: '1px solid rgba(34,211,238,0.2)', background: 'rgba(34,211,238,0.04)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-cyan)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
          New Log Entry
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', lineHeight: 1.4 }}>
            Record notes, observations, or events not captured automatically by the system.
          </div>
          <button
            onClick={() => setShowTemplatePicker(true)}
            style={{
              background: 'none', border: '1px solid var(--color-cyan)', borderRadius: 8,
              padding: '4px 12px', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Use Template
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            className="input-dark"
            placeholder="What happened? e.g. FOD walk completed, runway sweep performed, VIP arrival coordination..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleManualSubmit()
              }
            }}
            rows={2}
            style={{ flex: 1, resize: 'vertical', fontSize: 'var(--fs-base)' }}
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualText.trim() || submitting}
            style={{
              padding: '0 20px', borderRadius: 8, border: 'none', alignSelf: 'flex-end', height: 40,
              background: manualText.trim() ? 'var(--color-cyan)' : 'var(--color-bg-elevated)',
              color: manualText.trim() ? 'var(--color-bg-surface-solid)' : 'var(--color-text-4)',
              fontSize: 'var(--fs-md)', fontWeight: 700, cursor: manualText.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {submitting ? '...' : 'Log'}
          </button>
        </div>
      </div>

      {showTemplatePicker && (
        <TemplatePicker
          onSubmit={async (text) => {
            const supabase = createClient()
            if (!supabase) {
              toast.success('Entry logged (demo mode)')
              setShowTemplatePicker(false)
              return
            }
            const { error } = await logManualEntry(text, installationId)
            if (error) {
              toast.error(error)
            } else {
              toast.success('Entry logged')
              setShowTemplatePicker(false)
              await loadActivity()
            }
          }}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {/* ===== Recent Activity ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="section-label" style={{ marginBottom: 0 }}>Recent Activity</span>
        <button
          onClick={() => router.push('/activity')}
          style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          View All History →
        </button>
      </div>
      {activity.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>No activity recorded yet</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', width: 52 }}>Time (Z)</th>
                <th style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', width: 140 }}>User</th>
                <th style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', width: 140 }}>Action</th>
                <th style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>Details</th>
                <th style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'right', borderBottom: '2px solid var(--color-border)', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {activity.slice(0, 10).map((a) => {
                const d = new Date(a.created_at)
                const timeStr = d.toISOString().slice(11, 16)
                const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
                const link = getEntityLink(a.entity_type, a.entity_id)
                const detailParts: string[] = []
                if (a.metadata) {
                  const acronyms = new Set(['fod','ife','rsc','rcr','bwc','bash','qrc','notam','notams','arff','pcas','scn','lmr','tacan','vor','ils','dme','ndb','papi','vasi','malsr','gps','rnav','rwy','twy','amops','na','id'])
                  const capWord = (w: string) => acronyms.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)
                  const capVal = (s: string) => {
                    if (!s) return s
                    if (s === s.toUpperCase() && s.length <= 6) return s
                    if (acronyms.has(s.toLowerCase())) return s.toUpperCase()
                    return s.replace(/_/g, ' ').split(' ').map(capWord).join(' ')
                  }
                  for (const [k, v] of Object.entries(a.metadata)) {
                    if (v == null || v === '' || k === 'fields' || k === 'field' || k === 'edit') continue
                    const label = k.replace(/_/g, ' ').split(' ').map(capWord).join(' ')
                    const val = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? v.map(i => typeof i === 'string' ? capVal(i) : String(i)).join(', ') : capVal(String(v))
                    detailParts.push(`${label}: ${val}`)
                  }
                  // Append user edit note at the end
                  if (a.metadata.edit) {
                    detailParts.push(`Edit: ${capVal(String(a.metadata.edit))}`)
                  }
                }
                const detailsText = detailParts.join(' | ')

                return (
                  <tr key={a.id}>
                    <td style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {timeStr}
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {userName}
                    </td>
                    <td
                      onClick={link ? () => router.push(link) : undefined}
                      style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: link ? 'var(--color-cyan)' : 'var(--color-text-2)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', cursor: link ? 'pointer' : 'default' }}
                    >
                      {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined)}
                      {link && <span style={{ marginLeft: 4, fontSize: 'var(--fs-2xs)', opacity: 0.6 }}>&rarr;</span>}
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', maxWidth: 300 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                        {detailsText || '\u2014'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(a) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', fontWeight: 600, color: '#3B82F6' }}
                        title="Edit entry"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(a) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', fontWeight: 600, color: '#EF4444', marginLeft: 2 }}
                        title="Delete entry"
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Edit Entry Modal ===== */}
      {editingId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, background: 'rgba(0,0,0,0.6)',
          }}
          onClick={() => setEditingId(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 420, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 16 }}>
              Edit Entry
            </div>

            {/* Date & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <span className="section-label">Date (Z)</span>
                <input
                  type="date"
                  className="input-dark"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="section-label">Time (Z)</span>
                <input
                  type="text"
                  className="input-dark"
                  value={editTime}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9:]/g, '')
                    if (v.length <= 5) setEditTime(v)
                  }}
                  onBlur={() => {
                    let v = editTime.replace(/[^0-9]/g, '')
                    if (v.length <= 2) v = v.padStart(2, '0') + '00'
                    else if (v.length === 3) v = '0' + v
                    const hh = Math.min(23, parseInt(v.slice(0, 2))).toString().padStart(2, '0')
                    const mm = Math.min(59, parseInt(v.slice(2, 4))).toString().padStart(2, '0')
                    setEditTime(`${hh}:${mm}`)
                  }}
                  placeholder="HH:MM"
                  maxLength={5}
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            {/* Edit note */}
            <div style={{ marginBottom: 16 }}>
              <span className="section-label">Edit</span>
              <textarea
                className="input-dark"
                rows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave() }
                }}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-base)', resize: 'vertical' }}
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                onClick={handleEditSave}
                disabled={saving}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: saving ? 'rgba(6,182,212,0.5)' : '#06B6D4',
                  color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingId(null)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
            <button
              onClick={() => {
                const entry = activity.find((e) => e.id === editingId)
                if (entry) { setEditingId(null); handleDelete(entry) }
              }}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                color: '#EF4444', fontSize: 'var(--fs-sm)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Delete Entry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Contractor Form Dialog ---
function PersonnelFormDialog({ installationId, onClose, onSaved }: { installationId: string | null; onClose: () => void; onSaved?: () => void }) {
  const [saving, setSaving] = useState(false)
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [radioNumber, setRadioNumber] = useState('')
  const [flagNumber, setFlagNumber] = useState('')
  const [callsign, setCallsign] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-base)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    color: 'var(--color-text-2)',
    marginBottom: 4,
  }

  async function handleSubmit() {
    if (!company.trim() || !location.trim() || !description.trim()) {
      toast.error('Company name, location, and work description are required')
      return
    }
    setSaving(true)
    const { createContractor } = await import('@/lib/supabase/contractors')
    const { error } = await createContractor({
      company_name: company.trim(),
      contact_name: contact.trim() || undefined,
      location: location.trim(),
      work_description: description.trim(),
      start_date: startDate,
      notes: notes.trim() || undefined,
      radio_number: radioNumber.trim() || undefined,
      flag_number: flagNumber.trim() || undefined,
      callsign: callsign.trim() || undefined,
      base_id: installationId,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Personnel added')
    onSaved?.()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 520, padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            Add Personnel on Airfield
          </div>
          <Link
            href="/contractors"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', fontWeight: 600, textDecoration: 'none' }}
          >
            View All Personnel →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Company Name *</div>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Kiewit Infrastructure" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Contact Name</div>
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Location *</div>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. TWY A/B Intersection" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Start Date</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Radio Number</div>
            <input value={radioNumber} onChange={e => setRadioNumber(e.target.value)} placeholder="e.g. R-14" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Flag Number</div>
            <input value={flagNumber} onChange={e => setFlagNumber(e.target.value)} placeholder="e.g. F-3 (if escorting)" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Callsign</div>
            <input value={callsign} onChange={e => setCallsign(e.target.value)} placeholder="e.g. KIEWIT 1" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Work Description *</div>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Joint sealing and pavement repair" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: saving ? 'rgba(6,182,212,0.5)' : '#06B6D4',
              color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving...' : 'Add Personnel'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
