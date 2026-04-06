'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLog } from '@/lib/supabase/activity-queries'
import { fetchInspections } from '@/lib/supabase/inspections'
import { logManualEntry, updateActivityEntry, deleteActivityEntry } from '@/lib/supabase/activity'
import { toast } from 'sonner'
import { formatZuluTime, formatZuluDate, formatZuluDateTime, formatZuluDateShort } from '@/lib/utils'
import { TemplatePicker } from '@/components/ui/template-picker'
import { CHECK_TYPE_CONFIG } from '@/lib/constants'
import { fetchLightingSystems, fetchAllComponentsForBase } from '@/lib/supabase/lighting-systems'
import { fetchInfrastructureFeatures } from '@/lib/supabase/infrastructure-features'
import { calculateAllSystemHealth, getAlertTier, getHealthSummary, ALERT_TIER_CONFIG, type SystemHealth, type AlertTier } from '@/lib/outage-rules'
import { subscribeWithErrorHandling } from '@/lib/realtime-subscribe'

// --- Quick Actions (KPI badges) ---
const QUICK_ACTIONS = [
  { label: 'Airfield Checks', icon: '\uD83D\uDEE1\uFE0F', color: 'var(--color-warning)', href: '/checks' },
  { label: 'New Discrepancy', icon: '\uD83D\uDEA8', color: 'var(--color-danger)', href: '/discrepancies/new' },
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
const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  'Inspections/Checks': 'Logged Inspection/Check',
  'AMOPS Reporting': 'Logged AMOPS Report',
  'Tower Reporting': 'Logged Tower Report',
  'Shift Changes': 'Logged Shift Change',
  'Daily Tasks': 'Logged Daily Task',
  'QRC': 'Logged QRC Entry',
  'PCAS/SCN Tests & Activations': 'Logged PCAS/SCN',
  'Personnel on Airfield': 'Logged Personnel',
  'NOTAMs': 'Logged NOTAM',
  'ARFF': 'Logged ARFF',
  'IFE/GE': 'Logged IFE/GE',
  'CMA Violations': 'Logged CMA Violation',
  'BWC Declarations': 'Logged BWC Change',
  'Miscellaneous': 'Logged Entry',
}

/** Infer action label from free-typed manual entry text */
function inferActionFromText(details: string): string | null {
  const d = (details || '').toUpperCase()
  if (d.includes('SHIFT CHANGE')) return 'Shift Change'
  if (d.includes('AMOPS OPEN')) return 'AMOPS Open'
  if (d.includes('AMOPS CLOSED') || d.includes('AMOPS CLSD')) return 'AMOPS Closed'
  if (d.includes('NOTAM CANCEL') || d.includes('NOTAMC')) return 'NOTAM Canceled'
  if (d.includes('NOTAM ISSUED') || d.includes('NOTAMN')) return 'NOTAM Issued'
  if (d.includes('NOTAM REPLACED') || d.includes('NOTAMR')) return 'NOTAM Replaced'
  if (d.includes('NOTAM EXTENDED')) return 'NOTAM Extended'
  if (d.includes('SCN CHECK')) return 'SCN Check Complete'
  if (d.includes('SCN ACTIVATED')) return 'SCN Activated'
  if (d.includes('PCAS TESTED') || d.includes('PCAS TEST')) return 'PCAS Tested'
  if (d.includes('PCAS ACTIVATED')) return 'PCAS Activated'
  if (d.includes('PTD CK') || d.includes('PTD CHECK')) return 'PTD Check'
  if (d.includes('TOWER IS NOW OPEN') || d.includes('TOWER OPEN')) return 'Tower Open'
  if (d.includes('TOWER CLOSED') || d.includes('TOWER CLSD')) return 'Tower Closed'
  if (d.includes('BWC CHANGE') || d.includes('BWC/')) return 'BWC Change'
  if (d.includes('ARFF') && d.includes('STATUS')) return 'ARFF Status'
  if (d.includes('RUNWAY') && d.includes('IN USE')) return 'Runway In Use'
  if (d.includes('OPS RESUMED')) return 'Ops Resumed'
  if (d.includes('CHECKLIST COMPLETE') || d.includes('CHECKLIST CMPLT')) return 'Checklist Complete'
  if (d.includes('UNAUTHORIZED VEHICLE') || d.includes('CMAV')) return 'CMA Violation'
  return null
}

function formatAction(action: string, entityType: string, displayId?: string, metadata?: Record<string, unknown> | null): string {
  // Template-based manual entries — use template label for specific action
  if (entityType === 'manual' && metadata?.template_label) {
    return metadata.template_label as string
  }
  if (entityType === 'manual' && metadata?.template_category) {
    return TEMPLATE_CATEGORY_LABELS[metadata.template_category as string] || 'Logged Entry'
  }
  // Infer action from free-typed text when no template metadata exists
  if (entityType === 'manual' && metadata?.details) {
    const inferred = inferActionFromText(metadata.details as string)
    if (inferred) return inferred
  }

  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy',
    check: 'Check',
    airfield_check: 'Check',
    inspection: 'Inspection',
    acsi_inspection: 'ACSI Inspection',
    obstruction_evaluation: 'Obstruction Eval',
    navaid_status: 'NAVAID',
    airfield_status: 'Runway',
    weather_info: 'Weather Info',
    arff_status: 'ARFF',
    contractor: 'Personnel',
    qrc: 'QRC',
    wildlife_sighting: 'Wildlife Sighting',
    wildlife_strike: 'Wildlife Strike',
    manual: 'Logged Entry',
    parking_plan: 'Parking Plan',
    waiver: 'Waiver',
    waiver_review: 'Waiver Review',
  }
  const entity = typeLabel[entityType] || entityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const id = displayId ? ` ${displayId}` : ''
  const actionLabel: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    completed: 'Completed',
    opened: 'Opened',
    closed: 'Closed',
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
  if (entityType === 'manual') return entity
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
  user_operating_initials: string | null
}

function getActionColor(action: string, entityType: string): string {
  if (entityType === 'manual') return 'var(--color-text-2)'
  if (action === 'completed' || action === 'filed') return 'var(--color-green)'
  if (action === 'deleted' || action === 'cancelled') return 'var(--color-red)'
  switch (entityType) {
    case 'check': case 'airfield_check': return 'var(--color-cyan)'
    case 'inspection': case 'acsi_inspection': return 'var(--color-cyan)'
    case 'discrepancy': return 'var(--color-warning)'
    case 'qrc': return 'var(--color-purple)'
    case 'wildlife_sighting': case 'wildlife_strike': return 'var(--color-orange)'
    case 'airfield_status': case 'navaid_status': return 'var(--color-blue)'
    case 'contractor': return 'var(--color-text-2)'
    default: return 'var(--color-text-2)'
  }
}

function getEntityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null
  switch (entityType) {
    case 'discrepancy': return `/discrepancies/${entityId}`
    case 'check': return `/checks/${entityId}`
    case 'airfield_check': return `/checks/${entityId}`
    case 'inspection': return `/inspections/${entityId}`
    case 'obstruction_evaluation': return `/obstructions`
    case 'qrc': return `/qrc?exec=${entityId}`
    default: return null
  }
}

export default function AMDashboardPage() {
  const router = useRouter()
  const { installationId, currentInstallation, userRole } = useInstallation()
  const isAdmin = ['airfield_manager', 'sys_admin', 'base_admin', 'namo'].includes(userRole || '')
  const [customTemplates, setCustomTemplates] = useState<import('@/lib/activity-templates').TemplateCategory[] | null>(null)

  useEffect(() => {
    if (!installationId) return
    import('@/lib/supabase/activity-templates').then(({ loadCustomActivityTemplates }) =>
      loadCustomActivityTemplates(installationId).then(setCustomTemplates)
    )
  }, [installationId])
  const baseTimezone = currentInstallation?.timezone || 'America/New_York'
  const baseResetTime = (currentInstallation as Record<string, any>)?.checklist_reset_time || '06:00'
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [manualText, setManualText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showContractorForm, setShowContractorForm] = useState(false)
  const [showShiftChecklist, setShowShiftChecklist] = useState(false)
  const [showQrc, setShowQrc] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [logEntryExpanded, setLogEntryExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [showEditTemplatePicker, setShowEditTemplatePicker] = useState(false)
  const [userPopover, setUserPopover] = useState<{ id: string; x: number; y: number; name: string; role: string | null; edipi: string | null } | null>(null)
  const [lastCheckType, setLastCheckType] = useState<string | null>(null)
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null)

  // ── Today's inspection status ──
  const [todayAirfieldStatus, setTodayAirfieldStatus] = useState<{ status: 'none' | 'in_progress' | 'completed'; inspector?: string }>({ status: 'none' })
  const [todayLightingStatus, setTodayLightingStatus] = useState<{ status: 'none' | 'in_progress' | 'completed'; inspector?: string }>({ status: 'none' })

  // ── Lighting system health summary ──
  const [lightingHealthSummary, setLightingHealthSummary] = useState<{
    worstTier: AlertTier
    total: number
    exceeded: number
    inoperative: number
    degraded: number
  } | null>(null)

  useEffect(() => {
    if (!installationId) return
    async function loadHealth() {
      const [systems, components, features] = await Promise.all([
        fetchLightingSystems(installationId!),
        fetchAllComponentsForBase(installationId!),
        fetchInfrastructureFeatures(installationId!),
      ])
      if (systems.length === 0) return
      const compMap = new Map<string, typeof components>()
      for (const c of components) {
        if (!compMap.has(c.system_id)) compMap.set(c.system_id, [])
        compMap.get(c.system_id)!.push(c)
      }
      const healths = calculateAllSystemHealth(systems, compMap, features)
      const summary = getHealthSummary(healths)
      setLightingHealthSummary(summary)
    }
    loadHealth()
  }, [installationId])

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
    const rawType = data?.[0]?.check_type || null
    setLastCheckType(rawType ? (CHECK_TYPE_CONFIG[rawType as keyof typeof CHECK_TYPE_CONFIG]?.label?.toUpperCase() || rawType.replace(/_/g, ' ').toUpperCase()) : null)
    setLastCheckTime(data?.[0]?.completed_at
      ? formatZuluTime(new Date(data[0].completed_at)) + 'Z'
      : null)
  }, [installationId])

  useEffect(() => { loadLastCheck() }, [loadLastCheck])

  // --- Load Today's Inspection Status (0600L reset) ---
  useEffect(() => {
    if (!installationId) return
    const tz = currentInstallation?.timezone || 'America/New_York'
    const localNow = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
    if (localNow.getHours() < 6) localNow.setDate(localNow.getDate() - 1)
    const todayStr = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`

    fetchInspections(installationId).then((inspections) => {
      const todayAF = inspections.find(i => i.inspection_type === 'airfield' && i.inspection_date === todayStr)
      const todayLT = inspections.find(i => i.inspection_type === 'lighting' && i.inspection_date === todayStr)
      setTodayAirfieldStatus(todayAF
        ? { status: todayAF.status as 'in_progress' | 'completed', inspector: todayAF.inspector_name || undefined }
        : { status: 'none' })
      setTodayLightingStatus(todayLT
        ? { status: todayLT.status as 'in_progress' | 'completed', inspector: todayLT.inspector_name || undefined }
        : { status: 'none' })
    })
  }, [installationId, currentInstallation?.timezone])

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
    subscribeWithErrorHandling(channel)

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
    const { error } = await logManualEntry(manualText.trim().toUpperCase(), installationId)
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
        currentDetails = a.metadata.details.toUpperCase()
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
      {/* ===== Dashboard Header ===== */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: lastCheckType ? 8 : 0 }}>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>Dashboard</h2>
        </div>
        {lastCheckType && lastCheckTime && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 500 }}>Last Check Completed</span>
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-cyan)' }}>{lastCheckType} @ {lastCheckTime}</span>
          </div>
        )}
      </div>

      {/* ===== Inspection Status Strip ===== */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <Link href="/inspections" style={{
          flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 'var(--radius-md)', textDecoration: 'none',
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderLeft: todayAirfieldStatus.status === 'completed' ? '3px solid var(--color-status-pass)'
            : todayAirfieldStatus.status === 'in_progress' ? '3px solid var(--color-status-inwork)'
            : '3px solid var(--color-text-4)',
        }}>
          <span style={{ fontSize: 'var(--fs-lg)' }}>
            {todayAirfieldStatus.status === 'completed' ? '\u2705' : todayAirfieldStatus.status === 'in_progress' ? '\uD83D\uDCDD' : '\u2600\uFE0F'}
          </span>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Airfield Inspection</div>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: todayAirfieldStatus.status === 'completed' ? 'var(--color-status-pass)' : todayAirfieldStatus.status === 'in_progress' ? 'var(--color-status-inwork)' : 'var(--color-text-3)' }}>
              {todayAirfieldStatus.status === 'completed' ? 'Complete' : todayAirfieldStatus.status === 'in_progress' ? `In Progress${todayAirfieldStatus.inspector ? ` — ${todayAirfieldStatus.inspector}` : ''}` : 'Not Started'}
            </div>
          </div>
        </Link>
        <Link href="/inspections" style={{
          flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 'var(--radius-md)', textDecoration: 'none',
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderLeft: todayLightingStatus.status === 'completed' ? '3px solid var(--color-status-pass)'
            : todayLightingStatus.status === 'in_progress' ? '3px solid var(--color-status-inwork)'
            : '3px solid var(--color-text-4)',
        }}>
          <span style={{ fontSize: 'var(--fs-lg)' }}>
            {todayLightingStatus.status === 'completed' ? '\u2705' : todayLightingStatus.status === 'in_progress' ? '\uD83D\uDCDD' : '\uD83C\uDF19'}
          </span>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Lighting Inspection</div>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: todayLightingStatus.status === 'completed' ? 'var(--color-status-pass)' : todayLightingStatus.status === 'in_progress' ? 'var(--color-status-inwork)' : 'var(--color-text-3)' }}>
              {todayLightingStatus.status === 'completed' ? 'Complete' : todayLightingStatus.status === 'in_progress' ? `In Progress${todayLightingStatus.inspector ? ` — ${todayLightingStatus.inspector}` : ''}` : 'Not Started'}
            </div>
          </div>
        </Link>
      </div>

      {/* ===== Quick Actions — touch-friendly pill strip ===== */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Checks', icon: '\uD83D\uDEE1\uFE0F', href: '/checks' },
          { label: 'Discrepancy', icon: '\uD83D\uDEA8', href: '/discrepancies/new' },
        ].map(q => (
          <Link key={q.label} href={q.href} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 'var(--radius-md)', minHeight: 44,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)',
          }}>
            <span style={{ fontSize: 'var(--fs-lg)' }}>{q.icon}</span> {q.label}
          </Link>
        ))}
        <button onClick={() => setShowContractorForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 18px', borderRadius: 'var(--radius-md)', minHeight: 44,
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <span style={{ fontSize: 'var(--fs-lg)' }}>🏗️</span> Personnel
        </button>
        <button onClick={() => setShowShiftChecklist(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 18px', borderRadius: 'var(--radius-md)', minHeight: 44,
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <span style={{ fontSize: 'var(--fs-lg)' }}>☑️</span> Checklist
        </button>
        <button onClick={() => setShowQrc(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 18px', borderRadius: 'var(--radius-md)', minHeight: 44,
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <span style={{ fontSize: 'var(--fs-lg)' }}>⚡</span> QRC
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

      {/* ===== QRC Dialog ===== */}
      {showQrc && (
        <QrcDialog
          installationId={installationId}
          onClose={() => setShowQrc(false)}
          onActivity={loadActivity}
        />
      )}

      {/* ===== Manual Entry — collapsed by default ===== */}
      {!logEntryExpanded ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setLogEntryExpanded(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 'var(--radius-md)', minHeight: 44,
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-cyan)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + New Entry
          </button>
          <button
            onClick={() => setShowTemplatePicker(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 'var(--radius-md)', minHeight: 44,
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-2)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Use Template
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 12, padding: '12px', border: '1px solid var(--color-border-active)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              className="input-dark"
              placeholder="What happened? e.g. FOD walk completed, runway sweep performed..."
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
              autoFocus
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={handleManualSubmit}
                disabled={!manualText.trim() || submitting}
                style={{
                  padding: '0 16px', borderRadius: 'var(--radius-md)', border: 'none', height: 32,
                  background: manualText.trim() ? 'var(--color-cyan-btn-bg)' : 'var(--color-bg-elevated)',
                  color: manualText.trim() ? 'var(--color-cyan-btn-text)' : 'var(--color-text-4)',
                  fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: manualText.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                {submitting ? '...' : 'Log'}
              </button>
              <button
                onClick={() => { setLogEntryExpanded(false); setManualText('') }}
                style={{
                  padding: '0 16px', borderRadius: 'var(--radius-md)', border: 'none', height: 32,
                  background: 'transparent', color: 'var(--color-text-3)',
                  fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplatePicker && (
        <TemplatePicker
          onSubmit={async (text, category, templateLabel) => {
            const supabase = createClient()
            if (!supabase) {
              toast.success('Entry logged (demo mode)')
              setShowTemplatePicker(false)
              return
            }
            const { error } = await logManualEntry(text, installationId, category, templateLabel)
            if (error) {
              toast.error(error)
            } else {
              toast.success('Entry logged')
              setShowTemplatePicker(false)
              await loadActivity()
            }
          }}
          onClose={() => setShowTemplatePicker(false)}
          isAdmin={isAdmin}
          installationId={installationId}
          customTemplates={customTemplates}
          onTemplatesSaved={setCustomTemplates}
          icao={currentInstallation?.icao}
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
                <th style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', width: 140 }}>Action</th>
                <th style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>Details</th>
                <th style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '2px solid var(--color-border)', width: 50 }}>OI</th>
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
                    detailsText = a.metadata.details.toUpperCase()
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

                const initials = a.user_operating_initials || null

                return (
                  <tr key={a.id}>
                    <td style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {timeStr}
                    </td>
                    <td
                      onClick={link ? () => router.push(link) : undefined}
                      style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: link ? getActionColor(a.action, a.entity_type) : getActionColor(a.action, a.entity_type), fontWeight: 600, verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', cursor: link ? 'pointer' : 'default' }}
                    >
                      {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined, a.metadata)}
                      {link && <span style={{ marginLeft: 4, fontSize: 'var(--fs-2xs)', opacity: 0.6 }}>&rarr;</span>}
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', maxWidth: 300 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                        {detailsText || '\u2014'}
                      </span>
                    </td>
                    <td
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setUserPopover({ id: a.id, x: rect.left, y: rect.bottom + 4, name: userName, role: a.user_role, edipi: a.user_edipi })
                      }}
                      style={{ padding: '6px 8px', fontSize: 'var(--fs-xs)', color: 'var(--color-cyan)', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', textAlign: 'center', letterSpacing: '0.04em' }}
                      title={userName}
                    >
                      {initials || '—'}
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(a) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', fontWeight: 600, color: 'var(--color-status-inwork)' }}
                        title="Edit entry"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(a) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', fontWeight: 600, color: 'var(--color-danger)', marginLeft: 2 }}
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
          style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' }}
          onClick={() => setUserPopover(null)}
        >
          <div
            style={{
              position: 'fixed',
              left: Math.min(userPopover.x, typeof window !== 'undefined' ? window.innerWidth - 240 : 400),
              top: userPopover.y,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              minWidth: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 'var(--z-modal)',
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
          className="modal-overlay"
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
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
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
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)',
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
                width: '100%', padding: '8px 0', borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                color: 'var(--color-danger)', fontSize: 'var(--fs-sm)', fontWeight: 600,
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
          isAdmin={isAdmin}
          installationId={installationId}
          customTemplates={customTemplates}
          onTemplatesSaved={setCustomTemplates}
          icao={currentInstallation?.icao}
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
    borderRadius: 'var(--radius-md)',
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
      className="modal-overlay"
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
              flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
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
              flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)',
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
  const doneCount = items.filter(i => {
    const r = responseMap.get(i.id)
    return r?.completed || r?.is_na
  }).length
  const allComplete = totalCount > 0 && doneCount === totalCount
  const isCompleted = checklist?.status === 'completed'

  async function handleToggle(itemId: string) {
    if (!checklist || isCompleted) return
    const resp = responseMap.get(itemId)
    const currentCompleted = resp?.completed ?? false
    const currentNa = resp?.is_na ?? false

    let nextCompleted = false
    let nextNa = false
    if (!currentCompleted && !currentNa) {
      nextCompleted = true
    } else if (currentCompleted && !currentNa) {
      nextNa = true
    }

    setSaving(itemId)
    const { upsertResponse } = await import('@/lib/supabase/shift-checklist')
    const { error } = await upsertResponse({
      checklist_id: checklist.id,
      item_id: itemId,
      completed: nextCompleted,
      is_na: nextNa,
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
    const isNa = resp?.is_na ?? false
    const isDone = checked || isNa
    const isSaving = saving === item.id

    return (
      <div key={item.id} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <button
          disabled={isCompleted || isSaving}
          onClick={() => handleToggle(item.id)}
          style={{
            width: 22, height: 22, borderRadius: 'var(--radius-xs)', flexShrink: 0,
            border: isDone ? 'none' : '2px solid var(--color-border-mid)',
            background: checked ? 'var(--color-status-pass)' : isNa ? 'var(--color-text-3)' : 'transparent',
            cursor: isCompleted ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>&#10003;</span>}
          {isNa && <span style={{ color: '#fff', fontSize: 8, fontWeight: 800 }}>N/A</span>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--fs-base)', fontWeight: 600,
            color: isDone ? 'var(--color-text-3)' : 'var(--color-text-1)',
            textDecoration: isDone ? 'line-through' : 'none',
            fontStyle: isNa ? 'italic' : 'normal',
          }}>{item.label}</div>
          {isDone && resp?.completed_by && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginTop: 1 }}>
              {profiles[resp.completed_by] || 'Unknown'}{isNa ? ' \u00b7 N/A' : ''}
              {resp.completed_at && ` \u00b7 ${formatZuluTime(new Date(resp.completed_at))}Z`}
            </div>
          )}
        </div>
        {item.frequency !== 'daily' && (
          <span style={{
            fontSize: 'var(--fs-xs)', fontWeight: 700, color: FREQ_COLORS[item.frequency],
            background: `${FREQ_COLORS[item.frequency]}15`, padding: '2px 8px', borderRadius: 'var(--radius-md)',
          }}>{item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}</span>
        )}
      </div>
    )
  }

  function renderSection(label: string, sectionItems: import('@/lib/supabase/shift-checklist').ShiftChecklistItem[]) {
    if (sectionItems.length === 0) return null
    const done = sectionItems.filter(i => { const r = responseMap.get(i.id); return r?.completed || r?.is_na }).length
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: done === sectionItems.length ? 'var(--color-status-pass)' : 'var(--color-text-3)' }}>{done}/{sectionItems.length}</div>
        </div>
        {sectionItems.map(renderItem)}
      </div>
    )
  }

  const today = formatZuluDateShort(new Date())

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>Shift Checklist</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>{today} &middot; {doneCount}/{totalCount} complete</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-md)',
                background: isCompleted ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                color: isCompleted ? 'var(--color-status-pass)' : 'var(--color-bwc-mod)',
              }}>{isCompleted ? 'FILED' : 'IN PROGRESS'}</span>
              <Link href="/shift-checklist" onClick={onClose} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', fontWeight: 600, textDecoration: 'none' }}>
                Full Page →
              </Link>
            </div>
          </div>
          {/* Progress bar */}
          {totalCount > 0 && (
            <div style={{ marginTop: 10, height: 4, borderRadius: 'var(--radius-xs)', background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(doneCount / totalCount) * 100}%`, background: allComplete ? 'var(--color-status-pass)' : 'var(--color-cyan)', borderRadius: 'var(--radius-xs)', transition: 'width 0.3s' }} />
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
                width: '100%', padding: '10px 0', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-mid)', background: 'transparent',
                color: 'var(--color-text-2)', fontWeight: 700, fontSize: 'var(--fs-base)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Reopen Checklist</button>
            ) : (
              <button disabled={!allComplete || completing} onClick={handleComplete} style={{
                width: '100%', padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
                background: allComplete ? 'var(--color-status-pass)' : 'var(--color-border)',
                color: allComplete ? '#fff' : 'var(--color-text-3)',
                fontWeight: 700, fontSize: 'var(--fs-base)',
                cursor: allComplete ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              }}>{completing ? 'Filing...' : allComplete ? 'File Checklist' : `${totalCount - doneCount} items remaining`}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== QRC Dialog =====

function QrcDialog({ installationId, onClose, onActivity }: { installationId: string | null; onClose: () => void; onActivity: () => Promise<void> }) {
  type QrcStep = import('@/lib/supabase/types').QrcStep
  type QrcStepResponse = import('@/lib/supabase/types').QrcStepResponse
  type QrcTemplate = import('@/lib/supabase/types').QrcTemplate
  type QrcExecution = import('@/lib/supabase/types').QrcExecution

  const [templates, setTemplates] = useState<QrcTemplate[]>([])
  const [openExecs, setOpenExecs] = useState<QrcExecution[]>([])
  const [loaded, setLoaded] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [activeExecId, setActiveExecId] = useState<string | null>(null)
  const [responses, setResponses] = useState<Record<string, QrcStepResponse>>({})
  const [scnData, setScnDataLocal] = useState<Record<string, unknown>>({})
  const [closing, setClosing] = useState(false)
  const [closeInitials, setCloseInitials] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const load = useCallback(async () => {
    const { fetchQrcTemplates, fetchOpenExecutions } = await import('@/lib/supabase/qrc')
    const [t, o] = await Promise.all([
      fetchQrcTemplates(installationId),
      fetchOpenExecutions(installationId),
    ])
    setTemplates(t)
    setOpenExecs(o)
    // Don't auto-select — let user pick from the list
    setLoaded(true)
  }, [installationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Sync responses/scn when execution changes
  useEffect(() => {
    const exec = openExecs.find(e => e.id === activeExecId)
    if (exec) {
      setResponses((exec.step_responses || {}) as Record<string, QrcStepResponse>)
      setScnDataLocal((exec.scn_data || {}) as Record<string, unknown>)
    }
  }, [activeExecId, openExecs])

  async function handleStart(tmpl: QrcTemplate) {
    if (!installationId) return
    setStarting(tmpl.id)
    const { startQrcExecution } = await import('@/lib/supabase/qrc')
    const { data, error } = await startQrcExecution({
      base_id: installationId, template_id: tmpl.id,
      qrc_number: tmpl.qrc_number, title: tmpl.title,
    })
    if (error) { toast.error(error); setStarting(null); return }
    if (data) {
      toast.success(`QRC-${tmpl.qrc_number} opened`)
      setActiveExecId(data.id)
      await load()
      await onActivity()
    }
    setStarting(null)
  }

  async function handleStepToggle(stepId: string) {
    if (!activeExecId) return
    const { updateStepResponse } = await import('@/lib/supabase/qrc')
    const current = responses[stepId] || {}
    const newResp: QrcStepResponse = {
      ...current, completed: !current.completed,
      completed_at: !current.completed ? new Date().toISOString() : undefined,
    }
    setResponses(prev => ({ ...prev, [stepId]: newResp }))
    await updateStepResponse(activeExecId, stepId, newResp)
  }

  async function handleFieldChange(stepId: string, value: string) {
    if (!activeExecId) return
    const { updateStepResponse } = await import('@/lib/supabase/qrc')
    const current = responses[stepId] || {}
    const newResp: QrcStepResponse = { ...current, value, completed: !!value }
    setResponses(prev => ({ ...prev, [stepId]: newResp }))
    await updateStepResponse(activeExecId, stepId, newResp)
  }

  async function handleAgencyToggle(stepId: string, agency: string) {
    if (!activeExecId) return
    const { updateStepResponse } = await import('@/lib/supabase/qrc')
    const current = responses[stepId] || {}
    const checked = current.agencies_checked || []
    const next = checked.includes(agency) ? checked.filter((a: string) => a !== agency) : [...checked, agency]
    const newResp: QrcStepResponse = { ...current, agencies_checked: next, completed: next.length > 0 }
    setResponses(prev => ({ ...prev, [stepId]: newResp }))
    await updateStepResponse(activeExecId, stepId, newResp)
  }

  async function handleNotes(stepId: string, notes: string) {
    if (!activeExecId) return
    const { updateStepResponse } = await import('@/lib/supabase/qrc')
    const current = responses[stepId] || {}
    const newResp: QrcStepResponse = { ...current, notes }
    setResponses(prev => ({ ...prev, [stepId]: newResp }))
    await updateStepResponse(activeExecId, stepId, newResp)
  }

  async function handleScnField(key: string, value: string) {
    if (!activeExecId) return
    const { updateScnData } = await import('@/lib/supabase/qrc')
    const updated = { ...scnData, [key]: value }
    setScnDataLocal(updated)
    await updateScnData(activeExecId, updated)
  }

  async function handleClose() {
    if (!activeExecId) return
    setClosing(true)
    const { closeQrcExecution } = await import('@/lib/supabase/qrc')
    const exec = openExecs.find(e => e.id === activeExecId)
    const { error } = await closeQrcExecution(activeExecId, closeInitials, installationId)
    if (error) toast.error(error)
    else {
      toast.success(`QRC-${exec?.qrc_number} closed`)
      setActiveExecId(null)
      setShowCloseConfirm(false)
      setCloseInitials('')
      await load()
      await onActivity()
    }
    setClosing(false)
  }

  async function handleCancel() {
    if (!activeExecId) return
    if (!confirm('Cancel this QRC? This will permanently remove all data for this execution.')) return
    const { cancelQrcExecution } = await import('@/lib/supabase/qrc')
    const exec = openExecs.find(e => e.id === activeExecId)
    const { error } = await cancelQrcExecution(activeExecId, installationId)
    if (error) toast.error(error)
    else {
      toast.success(`QRC-${exec?.qrc_number} cancelled`)
      await onActivity()
      onClose()
    }
  }

  function zuluNow(): string {
    return new Date().toISOString().slice(11, 16).replace(':', '')
  }

  const activeExec = openExecs.find(e => e.id === activeExecId)
  const activeTemplate = activeExec ? templates.find(t => t.id === activeExec.template_id) : null
  const steps = activeTemplate?.steps || []

  function renderStep(step: QrcStep) {
    const resp = responses[step.id] || {}
    const checked = resp.completed ?? false

    if (step.type === 'conditional') {
      return (
        <div key={step.id} style={{
          padding: '8px 10px', marginBottom: 4, fontSize: 'var(--fs-base)',
          fontWeight: 600, color: 'var(--color-warning)', fontStyle: 'italic',
        }}>{step.id}. {step.label}</div>
      )
    }

    return (
      <div key={step.id} style={{
        padding: '8px 10px', marginBottom: 6, borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: checked ? 'rgba(34,197,94,0.04)' : 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--color-text-3)', minWidth: 28, paddingTop: 2 }}>{step.id}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Checkbox / checkbox_with_note */}
            {(step.type === 'checkbox' || step.type === 'checkbox_with_note') && (
              <div>
                <button onClick={() => handleStepToggle(step.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left', width: '100%',
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 'var(--radius-xs)', flexShrink: 0,
                    border: checked ? 'none' : '2px solid var(--color-border-mid)',
                    background: checked ? 'var(--color-status-pass)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>&#10003;</span>}</span>
                  <span style={{
                    fontSize: 'var(--fs-base)', fontWeight: 600,
                    color: checked ? 'var(--color-text-3)' : 'var(--color-text-1)',
                    textDecoration: checked ? 'line-through' : 'none',
                  }}>{step.label}</span>
                </button>
                {step.note && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 3, marginLeft: 26, fontStyle: 'italic' }}>
                    {step.note}
                  </div>
                )}
              </div>
            )}

            {/* Notify agencies */}
            {step.type === 'notify_agencies' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>{step.label}</div>
                {(step.agencies || []).map(agency => {
                  const agencyChecked = (resp.agencies_checked || []).includes(agency)
                  return (
                    <button key={agency} onClick={() => handleAgencyToggle(step.id, agency)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                      cursor: 'pointer', padding: '3px 0', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                    }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 'var(--radius-xs)', flexShrink: 0,
                        border: agencyChecked ? 'none' : '2px solid var(--color-border-mid)',
                        background: agencyChecked ? 'var(--color-status-pass)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{agencyChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>&#10003;</span>}</span>
                      <span style={{ fontSize: 'var(--fs-sm)', color: agencyChecked ? 'var(--color-text-3)' : 'var(--color-text-1)', textDecoration: agencyChecked ? 'line-through' : 'none' }}>{agency}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Fill field */}
            {step.type === 'fill_field' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>{step.label}</div>
                <input className="input-dark" placeholder={step.field_label || 'Enter value'}
                  value={resp.value || ''} onChange={e => handleFieldChange(step.id, e.target.value)}
                  style={{ width: '100%', fontSize: 'var(--fs-sm)' }} />
              </div>
            )}

            {/* Time field */}
            {step.type === 'time_field' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>{step.label}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="input-dark" placeholder={step.field_label || 'HHmm'}
                    value={resp.value || ''} onChange={e => handleFieldChange(step.id, e.target.value)}
                    style={{ width: 100, fontSize: 'var(--fs-sm)', textAlign: 'center' }} />
                  <button onClick={() => handleFieldChange(step.id, zuluNow())} style={{
                    background: 'rgba(34,211,238,0.1)', border: '1px solid var(--color-cyan)',
                    borderRadius: 'var(--radius-sm)', padding: '4px 10px', color: 'var(--color-cyan)',
                    fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Now (Z)</button>
                </div>
              </div>
            )}

          </div>
          {/* Timestamp */}
          {checked && resp.completed_at && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {new Date(resp.completed_at).toISOString().slice(11, 16)}Z
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeExecId && (
                <button onClick={() => { setActiveExecId(null); setShowCloseConfirm(false) }} style={{
                  background: 'none', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0,
                }}>&larr;</button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeExec && (
                  <span style={{
                    fontSize: 'var(--fs-base)', fontWeight: 800, color: '#0F172A',
                    background: '#67E8F9', padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                  }}>QRC-{activeExec.qrc_number}</span>
                )}
                <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                  {activeExec ? activeExec.title : 'Quick Reaction Checklists'}
                </span>
              </div>
            </div>
            <Link href={activeExec ? `/qrc?exec=${activeExec.id}` : '/qrc'} onClick={onClose} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 8 }}>
              Full Page &rarr;
            </Link>
          </div>
          {activeExec && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
              Opened {new Date(activeExec.opened_at).toISOString().slice(11, 16)}Z
              {activeExec.open_initials && ` by ${activeExec.open_initials}`}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {!loaded ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
          ) : activeExec && activeTemplate ? (
            <div>
              {/* Warning note */}
              {activeTemplate.notes && (
                <div style={{
                  padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 10,
                  background: 'rgba(239,68,68,0.08)', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-danger)',
                }}>{activeTemplate.notes}</div>
              )}

              {/* References */}
              {activeTemplate.references && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginBottom: 10 }}>
                  Ref: {activeTemplate.references}
                </div>
              )}

              {/* SCN Form — data entry at top for quick capture */}
              {activeTemplate.has_scn_form && activeTemplate.scn_fields && (
                <div style={{
                  padding: 14, borderRadius: 'var(--radius-md)', marginBottom: 12,
                  background: 'var(--color-bg-surface)', border: '1px solid rgba(34,211,238,0.2)',
                }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-cyan)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Secondary Crash Net (SCN) Form
                  </div>
                  {((activeTemplate.scn_fields as { fields?: { key: string; label: string; type: string }[] }).fields || []).map(
                    (field: { key: string; label: string; type: string }) => (
                      <div key={field.key} style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>
                          {field.label}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea className="input-dark" value={(scnData[field.key] as string) || ''}
                            onChange={e => handleScnField(field.key, e.target.value)} rows={2}
                            style={{ width: '100%', fontSize: 'var(--fs-sm)', resize: 'vertical' }} />
                        ) : (
                          <input className="input-dark" value={(scnData[field.key] as string) || ''}
                            onChange={e => handleScnField(field.key, e.target.value)}
                            style={{ width: '100%', fontSize: 'var(--fs-sm)' }} />
                        )}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Steps */}
              {steps.map(step => renderStep(step))}
            </div>
          ) : (
            /* Template picker grid */
            <>
              {openExecs.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-bwc-mod)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Active</div>
                  {openExecs.map(ex => (
                    <button key={ex.id} onClick={() => setActiveExecId(ex.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)',
                      borderRadius: 'var(--radius-md)', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', marginBottom: 4,
                    }}>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#0F172A', background: '#67E8F9', padding: '2px 8px', borderRadius: 'var(--radius-xs)' }}>QRC-{ex.qrc_number}</span>
                      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', flex: 1 }}>{ex.title}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Start New</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {templates.filter(t => t.is_active).map(tmpl => (
                  <button key={tmpl.id} onClick={() => handleStart(tmpl)} disabled={starting === tmpl.id}
                    style={{
                      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)', padding: '8px 10px', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                    }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#0F172A', background: '#67E8F9', padding: '2px 8px', borderRadius: 'var(--radius-xs)' }}>
                      {tmpl.qrc_number}
                    </span>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', marginTop: 4, lineHeight: 1.3 }}>
                      {tmpl.title}
                    </div>
                  </button>
                ))}
              </div>
              {templates.filter(t => t.is_active).length === 0 && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
                  No QRC templates configured. Set them up in Settings.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {activeExec && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            {showCloseConfirm ? (
              <div>
                <input className="input-dark" placeholder="Closing initials (optional)"
                  value={closeInitials} onChange={e => setCloseInitials(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, fontSize: 'var(--fs-sm)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleClose} disabled={closing} style={{
                    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
                    background: 'var(--color-status-pass)', color: '#fff', fontWeight: 700,
                    fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>{closing ? 'Closing...' : 'Confirm Close'}</button>
                  <button onClick={() => setShowCloseConfirm(false)} style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
                    fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCloseConfirm(true)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--color-status-pass)', color: '#fff', fontWeight: 700,
                  fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                }}>Close QRC</button>
                <button onClick={handleCancel} style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)',
                  color: 'var(--color-danger)', fontWeight: 700, fontSize: 'var(--fs-base)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
