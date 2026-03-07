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

function maskEdipi(edipi: string): string {
  if (edipi.length <= 4) return '*'.repeat(edipi.length)
  return '*'.repeat(edipi.length - 4) + edipi.slice(-4)
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  airfield_manager: 'Airfield Manager',
  inspector: 'Inspector',
  viewer: 'Viewer',
  operator: 'Operator',
}

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
  user_role: string | null
  user_edipi: string | null
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
  const { installationId, currentInstallation } = useInstallation()
  const baseTimezone = currentInstallation?.timezone || 'America/New_York'
  const baseResetTime = (currentInstallation as Record<string, any>)?.checklist_reset_time || '06:00'
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [manualText, setManualText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showContractorForm, setShowContractorForm] = useState(false)
  const [showShiftChecklist, setShowShiftChecklist] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [showEditTemplatePicker, setShowEditTemplatePicker] = useState(false)
  const [userPopover, setUserPopover] = useState<{ id: string; x: number; y: number; name: string; role: string | null; edipi: string | null } | null>(null)
  const [lastCheckType, setLastCheckType] = useState<string | null>(null)
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null)

  // --- Load Activity Feed ---
  const loadActivity = useCallback(async () => {
    const { data } = await fetchActivityLog({ baseId: installationId, limit: 20 })
    setActivity(data as ActivityEntry[])
  }, [installationId])

  useEffect(() => { loadActivity() }, [loadActivity])

  // --- Load Last Check Completed ---
  const loadLastCheck = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return
    let query = supabase
      .from('airfield_checks')
      .select('check_type, completed_at')
      .order('completed_at', { ascending: false })
      .limit(1)
    if (installationId) query = query.eq('base_id', installationId)
    const { data } = await query
    setLastCheckType(data?.[0]?.check_type?.toUpperCase() || null)
    setLastCheckTime(data?.[0]?.completed_at
      ? new Date(data[0].completed_at).toTimeString().slice(0, 5)
      : null)
  }, [installationId])

  useEffect(() => { loadLastCheck() }, [loadLastCheck])

  // Realtime: auto-refresh activity feed on new entries
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    const channel = supabase
      .channel(`am_dashboard_activity:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `base_id=eq.${installationId}` },
        () => { loadActivity(); loadLastCheck() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [installationId, loadActivity, loadLastCheck])

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
    // Build the current details text to pre-populate
    let currentDetails = ''
    if (a.metadata) {
      if (typeof a.metadata.details === 'string') {
        currentDetails = a.metadata.details
      } else {
        const acronyms = new Set(['fod','ife','rsc','rcr','bwc','bash','qrc','notam','notams','arff','pcas','scn','lmr','tacan','vor','ils','dme','ndb','papi','vasi','malsr','gps','rnav','rwy','twy','amops','na','id'])
        const capWord = (w: string) => acronyms.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)
        const capVal = (s: string) => {
          if (!s) return s
          if (s === s.toUpperCase() && s.length <= 6) return s
          if (acronyms.has(s.toLowerCase())) return s.toUpperCase()
          return s.replace(/_/g, ' ').split(' ').map(capWord).join(' ')
        }
        const parts: string[] = []
        for (const [k, v] of Object.entries(a.metadata)) {
          if (v == null || v === '' || k === 'fields' || k === 'field') continue
          const label = k.replace(/_/g, ' ').split(' ').map(capWord).join(' ')
          const val = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? v.map(i => typeof i === 'string' ? capVal(i) : String(i)).join(', ') : capVal(String(v))
          parts.push(val)
        }
        currentDetails = parts.join(' | ')
      }
    }
    const d = new Date(a.created_at)
    setEditingId(a.id)
    setEditText(currentDetails)
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
    if (!confirm('Delete this events log entry? This cannot be undone.')) return
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

      {/* ===== Last Check Completed ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 12, background: 'var(--color-bg-inset)', borderRadius: 10, border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>Last Check Completed</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--color-cyan)' }}>
            {lastCheckType && lastCheckTime
              ? `${lastCheckType} @ ${lastCheckTime}`
              : 'No Data'}
          </div>
        </div>
      </div>

      {/* ===== Quick Actions ===== */}
      <span className="section-label">Quick Actions</span>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
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
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 'var(--fs-5xl)' }}>🏗️</span>
          <span style={{ fontSize: 'var(--fs-xl)', color: 'var(--color-cyan)', letterSpacing: '0.04em', fontWeight: 700 }}>
            Personnel on Airfield
          </span>
        </button>
        <button
          onClick={() => setShowShiftChecklist(true)}
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
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 'var(--fs-5xl)' }}>☑️</span>
          <span style={{ fontSize: 'var(--fs-xl)', color: 'var(--color-cyan)', letterSpacing: '0.04em', fontWeight: 700 }}>
            Shift Checklist
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

      {/* ===== Shift Checklist Dialog ===== */}
      {showShiftChecklist && (
        <ShiftChecklistDialog
          installationId={installationId}
          timezone={baseTimezone}
          resetTime={baseResetTime}
          onClose={() => setShowShiftChecklist(false)}
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
          View Entire Events Log →
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
                let detailsText = ''
                if (a.metadata) {
                  // If metadata was replaced by a user edit, show the flat string
                  if (typeof a.metadata.details === 'string') {
                    detailsText = a.metadata.details
                  } else {
                    const acronyms = new Set(['fod','ife','rsc','rcr','bwc','bash','qrc','notam','notams','arff','pcas','scn','lmr','tacan','vor','ils','dme','ndb','papi','vasi','malsr','gps','rnav','rwy','twy','amops','na','id'])
                    const capWord = (w: string) => acronyms.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)
                    const capVal = (s: string) => {
                      if (!s) return s
                      if (s === s.toUpperCase() && s.length <= 6) return s
                      if (acronyms.has(s.toLowerCase())) return s.toUpperCase()
                      return s.replace(/_/g, ' ').split(' ').map(capWord).join(' ')
                    }
                    const detailParts: string[] = []
                    for (const [k, v] of Object.entries(a.metadata)) {
                      if (v == null || v === '' || k === 'fields' || k === 'field') continue
                      const label = k.replace(/_/g, ' ').split(' ').map(capWord).join(' ')
                      const val = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? v.map(i => typeof i === 'string' ? capVal(i) : String(i)).join(', ') : capVal(String(v))
                      detailParts.push(val)
                    }
                    detailsText = detailParts.join(' | ')
                  }
                }

                return (
                  <tr key={a.id}>
                    <td style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {timeStr}
                    </td>
                    <td
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setUserPopover({ id: a.id, x: rect.left, y: rect.bottom + 4, name: userName, role: a.user_role, edipi: a.user_edipi })
                      }}
                      style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}
                    >
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

      {/* User Info Popover */}
      {userPopover && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 150 }}
          onClick={() => setUserPopover(null)}
        >
          <div
            style={{
              position: 'fixed',
              left: Math.min(userPopover.x, typeof window !== 'undefined' ? window.innerWidth - 240 : 400),
              top: userPopover.y,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '12px 16px',
              minWidth: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 151,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
              {userPopover.name}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-2)' }}>Role:</span>{' '}
              {ROLE_LABELS[userPopover.role || ''] || userPopover.role || 'N/A'}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-2)' }}>EDIPI:</span>{' '}
              <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {userPopover.edipi ? maskEdipi(userPopover.edipi) : 'Not on file'}
              </span>
            </div>
          </div>
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

            {/* Details */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="section-label" style={{ marginBottom: 0 }}>Details</span>
                <button
                  onClick={() => setShowEditTemplatePicker(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  Use Template
                </button>
              </div>
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

      {/* Edit Template Picker — populates editText instead of submitting */}
      {showEditTemplatePicker && (
        <TemplatePicker
          onSubmit={async (text) => {
            setEditText(text)
            setShowEditTemplatePicker(false)
          }}
          onClose={() => setShowEditTemplatePicker(false)}
        />
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

// ===== Shift Checklist Dialog =====

function ShiftChecklistDialog({ installationId, timezone, resetTime, onClose }: { installationId: string | null; timezone: string; resetTime: string; onClose: () => void }) {
  const [items, setItems] = useState<import('@/lib/supabase/shift-checklist').ShiftChecklistItem[]>([])
  const [checklist, setChecklist] = useState<import('@/lib/supabase/shift-checklist').ShiftChecklist | null>(null)
  const [responses, setResponses] = useState<import('@/lib/supabase/shift-checklist').ShiftChecklistResponse[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const {
      fetchChecklistItems,
      fetchOrCreateTodayChecklist,
      fetchResponses,
      itemAppliesToday,
    } = await import('@/lib/supabase/shift-checklist')

    if (!installationId) return
    const [allItems, { checklist: cl }] = await Promise.all([
      fetchChecklistItems(installationId),
      fetchOrCreateTodayChecklist(installationId, timezone, resetTime),
    ])
    const todayItems = allItems.filter(i => itemAppliesToday(i, timezone, resetTime))
    setItems(todayItems)
    setChecklist(cl)

    if (cl) {
      const resp = await fetchResponses(cl.id)
      setResponses(resp)
      const userIds = new Set<string>()
      resp.forEach(r => { if (r.completed_by) userIds.add(r.completed_by) })
      if (cl.completed_by) userIds.add(cl.completed_by)
      if (userIds.size > 0) {
        const supabase = createClient()
        if (supabase) {
          const { data } = await supabase.from('profiles').select('id, name, rank').in('id', Array.from(userIds))
          if (data) {
            const map: Record<string, string> = {}
            data.forEach((p: { id: string; name: string; rank: string | null }) => {
              map[p.id] = p.rank ? `${p.rank} ${p.name}` : p.name
            })
            setProfiles(map)
          }
        }
      }
    }
    setLoaded(true)
  }, [installationId, timezone, resetTime])

  useEffect(() => { load() }, [load])

  const responseMap = new Map(responses.map(r => [r.item_id, r]))
  const dayItems = items.filter(i => i.shift === 'day')
  const midItems = items.filter(i => i.shift === 'mid')
  const swingItems = items.filter(i => i.shift === 'swing')
  const totalCount = items.length
  const completedCount = items.filter(i => responseMap.get(i.id)?.completed).length
  const allComplete = totalCount > 0 && completedCount === totalCount
  const isCompleted = checklist?.status === 'completed'

  async function handleToggle(itemId: string, currentlyCompleted: boolean) {
    if (!checklist || isCompleted) return
    setSaving(itemId)
    const { upsertResponse } = await import('@/lib/supabase/shift-checklist')
    const { error } = await upsertResponse({
      checklist_id: checklist.id,
      item_id: itemId,
      completed: !currentlyCompleted,
    })
    if (error) toast.error(error)
    else await load()
    setSaving(null)
  }

  async function handleComplete() {
    if (!checklist || !allComplete) return
    if (!confirm('File this checklist as complete for today?')) return
    setCompleting(true)
    const { completeChecklist } = await import('@/lib/supabase/shift-checklist')
    const { error } = await completeChecklist(checklist.id)
    if (error) toast.error(error)
    else { toast.success('Shift checklist filed'); await load() }
    setCompleting(false)
  }

  async function handleReopen() {
    if (!checklist) return
    if (!confirm('Reopen this checklist?')) return
    const { reopenChecklist } = await import('@/lib/supabase/shift-checklist')
    const { error } = await reopenChecklist(checklist.id)
    if (error) toast.error(error)
    else await load()
  }

  const FREQ_COLORS: Record<string, string> = { daily: '#22D3EE', weekly: '#A78BFA', monthly: '#F59E0B' }

  function renderItem(item: import('@/lib/supabase/shift-checklist').ShiftChecklistItem) {
    const resp = responseMap.get(item.id)
    const checked = resp?.completed ?? false
    const isSaving = saving === item.id

    return (
      <div key={item.id} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <button
          disabled={isCompleted || isSaving}
          onClick={() => handleToggle(item.id, checked)}
          style={{
            width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            border: checked ? 'none' : '2px solid var(--color-border-mid)',
            background: checked ? '#22C55E' : 'transparent',
            cursor: isCompleted ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>&#10003;</span>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--fs-base)', fontWeight: 600,
            color: checked ? 'var(--color-text-3)' : 'var(--color-text-1)',
            textDecoration: checked ? 'line-through' : 'none',
          }}>{item.label}</div>
          {checked && resp?.completed_by && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginTop: 1 }}>
              {profiles[resp.completed_by] || 'Unknown'}
              {resp.completed_at && ` \u00b7 ${new Date(resp.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          )}
        </div>
        {item.frequency !== 'daily' && (
          <span style={{
            fontSize: 'var(--fs-xs)', fontWeight: 700, color: FREQ_COLORS[item.frequency],
            background: `${FREQ_COLORS[item.frequency]}15`, padding: '2px 8px', borderRadius: 8,
          }}>{item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}</span>
        )}
      </div>
    )
  }

  function renderSection(label: string, sectionItems: import('@/lib/supabase/shift-checklist').ShiftChecklistItem[]) {
    if (sectionItems.length === 0) return null
    const done = sectionItems.filter(i => responseMap.get(i.id)?.completed).length
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: done === sectionItems.length ? '#22C55E' : 'var(--color-text-3)' }}>{done}/{sectionItems.length}</div>
        </div>
        {sectionItems.map(renderItem)}
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

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
        style={{ width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>Shift Checklist</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>{today} &middot; {completedCount}/{totalCount} complete</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                background: isCompleted ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                color: isCompleted ? '#22C55E' : '#EAB308',
              }}>{isCompleted ? 'FILED' : 'IN PROGRESS'}</span>
              <Link href="/shift-checklist" onClick={onClose} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', fontWeight: 600, textDecoration: 'none' }}>
                Full Page →
              </Link>
            </div>
          </div>
          {/* Progress bar */}
          {totalCount > 0 && (
            <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(completedCount / totalCount) * 100}%`, background: allComplete ? '#22C55E' : 'var(--color-cyan)', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {!loaded ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
          ) : totalCount === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
              No checklist items configured. Set them up in Settings → Base Configuration.
            </div>
          ) : (
            <>
              {renderSection('Day Shift', dayItems)}
              {renderSection('Swing Shift', swingItems)}
              {midItems.length > 0 && renderSection('Mid Shift', midItems)}
            </>
          )}
        </div>

        {/* Footer */}
        {totalCount > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            {isCompleted ? (
              <button onClick={handleReopen} style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                border: '1px solid var(--color-border-mid)', background: 'transparent',
                color: 'var(--color-text-2)', fontWeight: 700, fontSize: 'var(--fs-base)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Reopen Checklist</button>
            ) : (
              <button disabled={!allComplete || completing} onClick={handleComplete} style={{
                width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                background: allComplete ? '#22C55E' : 'var(--color-border)',
                color: allComplete ? '#fff' : 'var(--color-text-3)',
                fontWeight: 700, fontSize: 'var(--fs-base)',
                cursor: allComplete ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              }}>{completing ? 'Filing...' : allComplete ? 'File Checklist' : `${totalCount - completedCount} items remaining`}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
