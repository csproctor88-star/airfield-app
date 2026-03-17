'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLog, fetchEntityDetails, type ActivityEntry, type EntityDetails } from '@/lib/supabase/activity-queries'
import { logManualEntry, updateActivityEntry, deleteActivityEntry } from '@/lib/supabase/activity'
import { createClient } from '@/lib/supabase/client'
import { TemplatePicker } from '@/components/ui/template-picker'
import { formatZuluDate } from '@/lib/utils'

type PeriodPreset = 'today' | '7d' | '30d' | 'custom'

function formatAction(action: string, entityType: string, displayId?: string): string {
  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy',
    check: 'Check',
    inspection: 'Inspection',
    obstruction_evaluation: 'Obstruction Eval',
    navaid_status: 'NAVAID',
    airfield_status: 'Runway',
    contractor: 'Personnel on Airfield',
    qrc: 'QRC',
    wildlife_sighting: 'Wildlife Sighting',
    wildlife_strike: 'Wildlife Strike',
    manual: 'Manual Entry',
    parking_plan: 'Parking Plan',
  }
  const entity = typeLabel[entityType] || entityType
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
    waiver_review_deleted: 'Deleted review for',
    noted: 'Logged',
    logged_personnel: 'Logged',
    personnel_off_airfield: 'Personnel Off Airfield',
    cancelled: 'Cancelled',
  }
  const label = actionLabel[action] || (action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' '))
  // Some actions are self-contained labels (don't append entity)
  if (action === 'personnel_off_airfield') return `${label}${id}`
  return `${label} ${entity}${id}`
}

function getEntityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null
  switch (entityType) {
    case 'discrepancy': return `/discrepancies/${entityId}`
    case 'check': return `/checks/${entityId}`
    case 'inspection': return `/inspections/${entityId}`
    case 'obstruction_evaluation': return `/obstructions`
    case 'qrc': return `/qrc?exec=${entityId}`
    case 'wildlife_sighting': return `/wildlife`
    case 'wildlife_strike': return `/wildlife`
    case 'parking_plan': return `/parking`
    default: return null
  }
}

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

// Known acronyms/abbreviations that should be uppercase
const ACRONYMS = new Set([
  'fod', 'ife', 'rsc', 'rcr', 'bwc', 'bash', 'qrc', 'notam', 'notams',
  'arff', 'pcas', 'scn', 'lmr', 'tacan', 'vor', 'ils', 'dme', 'ndb',
  'papi', 'vasi', 'malsr', 'gps', 'rnav', 'rwy', 'twy', 'amops',
  'na', 'id',
])

function capitalizeValue(str: string): string {
  if (!str) return str
  // If it looks like an all-caps abbreviation already, keep it
  if (str === str.toUpperCase() && str.length <= 6) return str
  // Check if the whole string is a known acronym
  if (ACRONYMS.has(str.toLowerCase())) return str.toUpperCase()
  // Title case each word, respecting known acronyms
  return str
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatMetadataValue(val: unknown): string {
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? capitalizeValue(v) : String(v)).join(', ')
  const str = String(val)
  return capitalizeValue(str)
}

function snakeToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Keys to skip in generic metadata formatting (internal/redundant)
const SKIP_META_KEYS = new Set(['fields', 'field'])

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return ''
  // If metadata has a pre-formatted details string, return it uppercased
  if (typeof metadata.details === 'string') return metadata.details.toUpperCase()
  const parts: string[] = []
  for (const [key, val] of Object.entries(metadata)) {
    if (val == null || val === '' || SKIP_META_KEYS.has(key)) continue
    parts.push(formatMetadataValue(val))
  }
  return parts.join(' | ').toUpperCase()
}

function buildDetailsString(a: ActivityEntry, detailsMap: Map<string, EntityDetails>): string {
  const parts: string[] = []

  // Add metadata-derived details
  const metaStr = formatMetadata(a.metadata)
  if (metaStr) parts.push(metaStr)

  // Add DB-fetched entity details — skip if metadata already has a formatted details string
  // to avoid duplicating title/description that's already in the metadata
  const hasFormattedMeta = a.metadata && typeof (a.metadata as Record<string, unknown>).details === 'string'
  if (!hasFormattedMeta && a.entity_id && detailsMap.has(a.entity_id)) {
    const ed = detailsMap.get(a.entity_id)!
    const dbParts: string[] = []
    if (ed.title) dbParts.push(ed.title)
    if (ed.description) dbParts.push(ed.description)
    if (ed.notes) dbParts.push(ed.notes)
    if (ed.extra) dbParts.push(ed.extra)
    if (dbParts.length) parts.push(dbParts.join(' | '))
  }

  return parts.join(' | ')
}

export default function ActivityPage() {
  const router = useRouter()
  const { installationId, userRole } = useInstallation()
  const isAdmin = ['airfield_manager', 'sys_admin', 'base_admin', 'namo'].includes(userRole || '')
  const [customTemplates, setCustomTemplates] = useState<import('@/lib/activity-templates').TemplateCategory[] | null>(null)

  useEffect(() => {
    if (!installationId) return
    import('@/lib/supabase/activity-templates').then(({ loadCustomActivityTemplates }) =>
      loadCustomActivityTemplates(installationId).then(setCustomTemplates)
    )
  }, [installationId])
  const today = new Date().toISOString().split('T')[0]

  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [detailsMap, setDetailsMap] = useState<Map<string, EntityDetails>>(new Map())
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [manualText, setManualText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [showEditTemplatePicker, setShowEditTemplatePicker] = useState(false)
  const [userPopover, setUserPopover] = useState<{ id: string; x: number; y: number; name: string; role: string | null; edipi: string | null } | null>(null)
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDetails, setFilterDetails] = useState('')

  const getDateRange = useCallback((): { start: string; end: string } => {
    const now = new Date()
    const endISO = new Date(`${today}T23:59:59.999`).toISOString()

    if (period === 'today') {
      return { start: new Date(`${today}T00:00:00`).toISOString(), end: endISO }
    }
    if (period === '7d') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return { start: d.toISOString(), end: endISO }
    }
    if (period === '30d') {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return { start: d.toISOString(), end: endISO }
    }
    return {
      start: new Date(`${customStart}T00:00:00`).toISOString(),
      end: new Date(`${customEnd}T23:59:59.999`).toISOString(),
    }
  }, [period, today, customStart, customEnd])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange()
    const { data } = await fetchActivityLog({ baseId: installationId, startDate: start, endDate: end, limit: 500 })
    setEntries(data)
    const details = await fetchEntityDetails(data)
    setDetailsMap(details)
    setLoading(false)
  }, [installationId, getDateRange])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // Filter entries by search terms
  const fu = filterUser.toLowerCase()
  const fa = filterAction.toLowerCase()
  const fd = filterDetails.toLowerCase()
  const filtered = entries.filter((a) => {
    if (fu) {
      const userName = (a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name).toLowerCase()
      const oi = (a.user_operating_initials || '').toLowerCase()
      if (!userName.includes(fu) && !oi.includes(fu)) return false
    }
    if (fa) {
      const actionStr = formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined).toLowerCase()
      if (!actionStr.includes(fa)) return false
    }
    if (fd) {
      const detailsStr = buildDetailsString(a, detailsMap).toLowerCase()
      if (!detailsStr.includes(fd)) return false
    }
    return true
  })

  // Group filtered entries by date
  const grouped: { date: string; label: string; items: ActivityEntry[] }[] = []
  for (const entry of filtered) {
    const d = new Date(entry.created_at)
    const dateKey = d.toISOString().split('T')[0]
    const dateLabel = formatZuluDate(d)
    const existing = grouped.find((g) => g.date === dateKey)
    if (existing) {
      existing.items.push(entry)
    } else {
      grouped.push({ date: dateKey, label: dateLabel, items: [entry] })
    }
  }

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
      await loadEntries()
    }
    setSubmitting(false)
  }

  const handleEdit = (a: ActivityEntry) => {
    const currentDetails = buildDetailsString(a, detailsMap)
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
      await loadEntries()
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
      await loadEntries()
    }
  }

  const handleExport = async () => {
    if (entries.length === 0) return
    setExporting(true)
    try {
      const { createStyledWorkbook, addStyledSheet, saveWorkbook } = await import('@/lib/excel-export')

      const columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Time (Z)', key: 'time', width: 10 },
        { header: 'Action', key: 'action', width: 40 },
        { header: 'Details', key: 'details', width: 60 },
        { header: 'OI', key: 'oi', width: 8 },
        { header: 'User', key: 'user', width: 24 },
      ]
      const rows = entries.map((a) => {
        const d = new Date(a.created_at)
        const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
        return {
          date: formatZuluDate(d),
          time: d.toISOString().slice(11, 16),
          action: formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined),
          details: buildDetailsString(a, detailsMap),
          oi: a.user_operating_initials || '',
          user: userName,
        }
      })
      const wb = await createStyledWorkbook()
      addStyledSheet(wb, 'Events Log', columns, rows)
      const { start, end } = getDateRange()
      const startLabel = start.split('T')[0]
      const endLabel = end.split('T')[0]
      await saveWorkbook(wb, `Events_Log_${startLabel}_to_${endLabel}.xlsx`)
    } catch (e) {
      console.error('Export failed:', e)
    }
    setExporting(false)
  }

  const PRESETS: { value: PeriodPreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'custom', label: 'Custom' },
  ]

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    color: 'var(--color-text-3)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid var(--color-border)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 'var(--fs-sm)',
    color: 'var(--color-text-2)',
    verticalAlign: 'top',
    borderBottom: '1px solid var(--color-border)',
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <button
          onClick={handleExport}
          disabled={exporting || entries.length === 0}
          style={{
            background: '#A78BFA14', border: '1px solid #A78BFA33', borderRadius: 8,
            padding: '6px 12px', color: '#A78BFA', fontSize: 'var(--fs-base)', fontWeight: 600,
            cursor: exporting || entries.length === 0 ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: exporting || entries.length === 0 ? 0.5 : 1,
          }}
        >
          {exporting ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 12 }}>Events Log</div>

      {/* Manual Entry Section */}
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
              background: manualText.trim() ? 'var(--color-cyan-btn-bg)' : 'var(--color-bg-elevated)',
              color: manualText.trim() ? 'var(--color-cyan-btn-text)' : 'var(--color-text-4)',
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
              await loadEntries()
            }
          }}
          onClose={() => setShowTemplatePicker(false)}
          isAdmin={isAdmin}
          installationId={installationId}
          customTemplates={customTemplates}
          onTemplatesSaved={setCustomTemplates}
        />
      )}

      {/* Period Presets */}
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-text-4)', marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', fontSize: 'var(--fs-base)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              background: period === p.value ? 'var(--color-cyan-btn-bg)' : 'transparent',
              color: period === p.value ? 'var(--color-cyan-btn-text)' : 'var(--color-text-2)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {period === 'custom' && (
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <span className="section-label">Start</span>
            <input type="date" className="input-dark" value={customStart} max={today} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <span className="section-label">End</span>
            <input type="date" className="input-dark" value={customEnd} max={today} min={customStart} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Loading activity...</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>No activity found for this date range</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 8 }}>
            {filtered.length === entries.length
              ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
              : `${filtered.length} of ${entries.length} entries`}
          </div>

          {/* Columnar Table */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 52 }}>Time (Z)</th>
                  <th style={{ ...thStyle, width: 140 }}>Action</th>
                  <th style={thStyle}>Details</th>
                  <th style={{ ...thStyle, width: 50 }}>OI</th>
                  <th style={{ ...thStyle, width: 60, textAlign: 'right' }}></th>
                </tr>
                <tr>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}></th>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder="Search actions..."
                      value={filterAction}
                      onChange={(e) => setFilterAction(e.target.value)}
                      style={{ width: '100%', fontSize: 'var(--fs-2xs)', padding: '3px 6px' }}
                    />
                  </th>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder="Search details..."
                      value={filterDetails}
                      onChange={(e) => setFilterDetails(e.target.value)}
                      style={{ width: '100%', fontSize: 'var(--fs-2xs)', padding: '3px 6px' }}
                    />
                  </th>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder="Search..."
                      value={filterUser}
                      onChange={(e) => setFilterUser(e.target.value)}
                      style={{ width: '100%', fontSize: 'var(--fs-2xs)', padding: '3px 6px' }}
                    />
                  </th>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <>
                    {/* Date header row */}
                    <tr key={`date-${group.date}`}>
                      <td
                        colSpan={5}
                        style={{
                          padding: '10px 8px 4px',
                          fontSize: 'var(--fs-sm)',
                          fontWeight: 700,
                          color: 'var(--color-text-3)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          borderBottom: '1px solid var(--color-border)',
                          background: 'var(--color-bg-inset)',
                        }}
                      >
                        {group.label}
                      </td>
                    </tr>
                    {/* Entry rows */}
                    {group.items.map((a) => {
                      const d = new Date(a.created_at)
                      const timeStr = d.toISOString().slice(11, 16)
                      const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
                      const detailsText = buildDetailsString(a, detailsMap)
                      const link = getEntityLink(a.entity_type, a.entity_id)

                      const initials = a.user_operating_initials || null

                      return (
                        <tr key={a.id}>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                            {timeStr}
                          </td>
                          <td
                            onClick={link ? () => router.push(link) : undefined}
                            style={{ ...tdStyle, color: link ? 'var(--color-cyan)' : 'var(--color-text-2)', whiteSpace: 'nowrap', cursor: link ? 'pointer' : 'default' }}
                          >
                            {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined)}
                            {link && <span style={{ marginLeft: 4, fontSize: 'var(--fs-2xs)', opacity: 0.6 }}>&rarr;</span>}
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--color-text-3)', maxWidth: 300 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                              {detailsText || '\u2014'}
                            </span>
                          </td>
                          <td
                            onClick={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setUserPopover({ id: a.id, x: rect.left, y: rect.bottom + 4, name: userName, role: a.user_role, edipi: a.user_edipi })
                            }}
                            style={{ ...tdStyle, fontWeight: 700, color: 'var(--color-cyan)', whiteSpace: 'nowrap', cursor: 'pointer', textAlign: 'center', fontSize: 'var(--fs-xs)', letterSpacing: '0.04em' }}
                            title={userName}
                          >
                            {initials || '—'}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
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
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
              left: Math.min(userPopover.x, window.innerWidth - 240),
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

      {/* Edit Entry Modal */}
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
                const entry = entries.find((e) => e.id === editingId)
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
          isAdmin={isAdmin}
          installationId={installationId}
          customTemplates={customTemplates}
          onTemplatesSaved={setCustomTemplates}
        />
      )}
    </div>
  )
}
