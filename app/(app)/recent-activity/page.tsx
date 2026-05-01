'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLog, type ActivityEntry } from '@/lib/supabase/activity-queries'
import { Download, ChevronRight } from 'lucide-react'

// Group-header date format — mirrors the daily-reviews pattern.
// "today" here is Zulu today (the audit log groups by Zulu date),
// not base-local — matches the existing groupBy at created_at[0:10].
function formatGroupDate(iso: string, todayIso: string): { primary: string; secondary: string | null } {
  const date = new Date(`${iso}T12:00:00Z`)
  const longLabel = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  const today = new Date(`${todayIso}T12:00:00Z`)
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return { primary: 'Today', secondary: longLabel }
  if (diffDays === 1) return { primary: 'Yesterday', secondary: longLabel }
  return { primary: longLabel, secondary: null }
}

// Row attribution — rank + last name keeps the audit-relevant rank
// without burning the row width on full first names. The OI badge
// stays as a separate chip per the existing pattern.
function formatRowAttribution(rank: string | null, fullName: string): string {
  const last = (fullName || '').trim().split(/\s+/).slice(-1)[0] || fullName || 'Unknown'
  return rank ? `${rank} ${last}` : last
}

type PeriodPreset = 'today' | '7d' | '30d' | '90d' | 'custom'

const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  'Inspections/Checks': 'Logged Inspection/Check', 'AMOPS Reporting': 'Logged AMOPS Report',
  'Tower Reporting': 'Logged Tower Report', 'Shift Changes': 'Logged Shift Change',
  'Daily Tasks': 'Logged Daily Task', 'QRC': 'Logged QRC Entry',
  'PCAS/SCN Tests & Activations': 'Logged PCAS/SCN', 'Personnel on Airfield': 'Logged Personnel',
  'NOTAMs': 'Logged NOTAM', 'ARFF': 'Logged ARFF', 'IFE/GE': 'Logged IFE/GE',
  'CMA Violations': 'Logged CMA Violation', 'BWC Declarations': 'Logged BWC Change',
  'Miscellaneous': 'Logged Entry',
}

function inferActionFromText(details: string): string | null {
  const d = (details || '').toUpperCase()
  if (d.includes('SHIFT CHANGE')) return 'Shift Change'
  if (d.includes('AMOPS OPEN')) return 'AMOPS Open'
  if (d.includes('AMOPS CLOSED') || d.includes('AMOPS CLSD')) return 'AMOPS Closed'
  if (d.includes('NOTAM CANCEL') || d.includes('NOTAMC')) return 'NOTAM Canceled'
  if (d.includes('NOTAM ISSUED') || d.includes('NOTAMN')) return 'NOTAM Issued'
  if (d.includes('SCN CHECK')) return 'SCN Check Complete'
  if (d.includes('TOWER OPEN')) return 'Tower Open'
  if (d.includes('TOWER CLOSED') || d.includes('TOWER CLSD')) return 'Tower Closed'
  if (d.includes('BWC CHANGE') || d.includes('BWC/')) return 'BWC Change'
  if (d.includes('ON AIRFIELD FOR') || d.includes('ON THE AFLD FOR')) return 'On Airfield'
  if (d.includes('OPS RESUMED')) return 'Ops Resumed'
  return null
}

const ENTITY_LABELS: Record<string, string> = {
  discrepancy: 'Discrepancy', check: 'Check', airfield_check: 'Check', inspection: 'Inspection',
  obstruction_evaluation: 'Obstruction Eval', navaid_status: 'NAVAID', airfield_status: 'Runway',
  weather_info: 'Weather Info', arff_status: 'ARFF', contractor: 'Personnel', qrc: 'QRC',
  wildlife_sighting: 'Wildlife Sighting', wildlife_strike: 'Wildlife Strike', manual: 'Manual Entry',
  parking_plan: 'Parking Plan', ppr_entry: 'PPR', acsi_inspection: 'ACSI Inspection',
  waiver: 'Waiver', waiver_review: 'Waiver Review', scn: 'SCN', scn_backup: 'Monthly Back-up SCN',
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Created', updated: 'Updated', deleted: 'Deleted', completed: 'Completed',
  opened: 'Opened', closed: 'Closed', status_updated: 'Status changed on',
  saved: 'Saved', filed: 'Filed', resumed: 'Resumed', reviewed: 'Reviewed',
  noted: 'Logged', logged_personnel: 'Logged', personnel_off_airfield: 'Personnel Off Airfield',
  cancelled: 'Cancelled',
}

function formatAction(action: string, entityType: string, displayId?: string, metadata?: Record<string, unknown> | null): string {
  if (entityType === 'manual' && metadata?.template_label) return metadata.template_label as string
  if (entityType === 'manual' && metadata?.template_category) return TEMPLATE_CATEGORY_LABELS[metadata.template_category as string] || 'Logged Entry'
  if (entityType === 'manual' && metadata?.details) {
    const inferred = inferActionFromText(metadata.details as string)
    if (inferred) return inferred
  }
  const entity = ENTITY_LABELS[entityType] || entityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const id = displayId ? ` ${displayId}` : ''
  const label = ACTION_LABELS[action] || (action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' '))
  if (action === 'personnel_off_airfield') return `${label}${id}`
  if (entityType === 'manual') return entity
  return `${label} ${entity}${id}`
}

function getActionColor(action: string, entityType: string): string {
  if (entityType === 'manual') return 'var(--color-text-2)'
  if (action === 'completed' || action === 'filed') return 'var(--color-success)'
  if (action === 'created') return 'var(--color-cyan)'
  if (action === 'deleted' || action === 'cancelled') return 'var(--color-danger)'
  if (action === 'updated' || action === 'status_updated') return 'var(--color-warning)'
  if (entityType === 'qrc') return 'var(--color-purple)'
  if (entityType === 'wildlife_sighting' || entityType === 'wildlife_strike') return 'var(--color-orange)'
  return 'var(--color-text-2)'
}

function getEntityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null
  if (entityType === 'discrepancy') return `/discrepancies/${entityId}`
  if (entityType === 'check' || entityType === 'airfield_check') return `/checks/${entityId}`
  if (entityType === 'inspection') return `/inspections/${entityId}`
  if (entityType === 'waiver') return `/waivers/${entityId}`
  return null
}

const FETCH_LIMIT = 1000

export default function RecentActivityPage() {
  const router = useRouter()
  const { installationId, currentInstallation } = useInstallation()
  const [allEntries, setAllEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [reachedLimit, setReachedLimit] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)

  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [userQuery, setUserQuery] = useState<string>('')
  const [detailsQuery, setDetailsQuery] = useState<string>('')

  const getDateRange = useCallback((): { start: string; end: string } => {
    const now = new Date()
    const endISO = new Date(`${today}T23:59:59.999`).toISOString()
    if (period === 'today') return { start: new Date(`${today}T00:00:00`).toISOString(), end: endISO }
    if (period === '7d') {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      return { start: d.toISOString(), end: endISO }
    }
    if (period === '30d') {
      const d = new Date(now); d.setDate(d.getDate() - 30)
      return { start: d.toISOString(), end: endISO }
    }
    if (period === '90d') {
      const d = new Date(now); d.setDate(d.getDate() - 90)
      return { start: d.toISOString(), end: endISO }
    }
    return {
      start: new Date(`${customStart}T00:00:00`).toISOString(),
      end: new Date(`${customEnd}T23:59:59.999`).toISOString(),
    }
  }, [period, today, customStart, customEnd])

  const loadEntries = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const { start, end } = getDateRange()
    const { data } = await fetchActivityLog({ baseId: installationId, startDate: start, endDate: end, limit: FETCH_LIMIT })
    setAllEntries(data)
    setReachedLimit(data.length >= FETCH_LIMIT)
    setLoading(false)
  }, [installationId, getDateRange])

  useEffect(() => { loadEntries() }, [loadEntries])

  const entityTypes = useMemo(() => {
    const s = new Set<string>()
    for (const e of allEntries) s.add(e.entity_type)
    return Array.from(s).sort()
  }, [allEntries])

  const actionTypes = useMemo(() => {
    const s = new Set<string>()
    for (const e of allEntries) s.add(e.action)
    return Array.from(s).sort()
  }, [allEntries])

  const visibleEntries = useMemo(() => {
    let out = allEntries
    if (entityFilter !== 'all') out = out.filter(e => e.entity_type === entityFilter)
    if (actionFilter !== 'all') out = out.filter(e => e.action === actionFilter)
    if (userQuery.trim()) {
      const q = userQuery.toLowerCase()
      out = out.filter(e =>
        e.user_name.toLowerCase().includes(q) ||
        (e.user_operating_initials || '').toLowerCase().includes(q) ||
        (e.user_rank || '').toLowerCase().includes(q),
      )
    }
    if (detailsQuery.trim()) {
      const q = detailsQuery.toLowerCase()
      out = out.filter(e => {
        const d = typeof e.metadata?.details === 'string' ? (e.metadata.details as string).toLowerCase() : ''
        return d.includes(q) || (e.entity_display_id || '').toLowerCase().includes(q)
      })
    }
    return out
  }, [allEntries, entityFilter, actionFilter, userQuery, detailsQuery])

  const grouped = useMemo(() => {
    return visibleEntries.reduce<Record<string, ActivityEntry[]>>((acc, a) => {
      const date = a.created_at.slice(0, 10)
      if (!acc[date]) acc[date] = []
      acc[date].push(a)
      return acc
    }, {})
  }, [visibleEntries])

  const resetFilters = () => {
    setEntityFilter('all')
    setActionFilter('all')
    setUserQuery('')
    setDetailsQuery('')
  }

  const filtersActive =
    entityFilter !== 'all' || actionFilter !== 'all' || userQuery.trim() !== '' || detailsQuery.trim() !== ''

  const exportCsv = () => {
    const headers = ['Timestamp (Zulu)', 'Action', 'Entity Type', 'Entity ID', 'Details', 'User', 'Rank', 'Role', 'OI']
    const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [headers.map(csvEscape).join(',')]
    for (const e of visibleEntries) {
      const details = typeof e.metadata?.details === 'string' ? e.metadata.details : ''
      lines.push([
        e.created_at,
        e.action,
        e.entity_type,
        e.entity_display_id ?? '',
        details,
        e.user_name,
        e.user_rank ?? '',
        e.user_role ?? '',
        e.user_operating_initials ?? '',
      ].map(csvEscape).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const baseSlug = (currentInstallation?.name || 'base').replace(/\s+/g, '-').toLowerCase()
    a.href = url
    a.download = `activity-log-${baseSlug}-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const PRESETS: { value: PeriodPreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, margin: 0 }}>Activity Log</h2>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
            Every recorded action across the installation — admin audit view
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportCsv}
            disabled={visibleEntries.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
              color: visibleEntries.length === 0 ? 'var(--color-text-4)' : 'var(--color-text-2)',
              cursor: visibleEntries.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          ><Download size={14} /> Export CSV</button>
          <button
            onClick={() => router.back()}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
              color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Back</button>
        </div>
      </div>

      {/* Period presets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              border: `1px solid ${period === p.value ? 'var(--color-cyan)' : 'var(--color-border)'}`,
              background: period === p.value ? 'var(--color-cyan-btn-bg)' : 'transparent',
              color: period === p.value ? 'var(--color-cyan-btn-text)' : 'var(--color-text-2)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{p.label}</button>
        ))}
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input
            type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontFamily: 'inherit' }}
          />
          <span style={{ alignSelf: 'center', color: 'var(--color-text-3)' }}>→</span>
          <input
            type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontFamily: 'inherit' }}
          />
        </div>
      )}

      {/* Field filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 10 }}>
        <select
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontFamily: 'inherit' }}
        >
          <option value="all">All entities</option>
          {entityTypes.map(t => (
            <option key={t} value={t}>{ENTITY_LABELS[t] || t}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontFamily: 'inherit' }}
        >
          <option value="all">All actions</option>
          {actionTypes.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
        <input
          type="text" placeholder="Filter by user (name, OI, rank)" value={userQuery}
          onChange={e => setUserQuery(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontFamily: 'inherit' }}
        />
        <input
          type="text" placeholder="Search details / display ID" value={detailsQuery}
          onChange={e => setDetailsQuery(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          {loading ? 'Loading…' : `${visibleEntries.length.toLocaleString()} of ${allEntries.length.toLocaleString()} entries`}
          {reachedLimit && !loading && (
            <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>
              · capped at {FETCH_LIMIT.toLocaleString()} — narrow the date range for the full set
            </span>
          )}
        </div>
        {filtersActive && (
          <button
            onClick={resetFilters}
            style={{
              padding: '4px 10px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-xs)', fontWeight: 600,
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Reset filters</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
      ) : visibleEntries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)' }}>
            {allEntries.length === 0 ? 'No activity in the selected date range' : 'No entries match the current filters'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {Object.entries(grouped).map(([date, entries]) => {
            const dateLabel = formatGroupDate(date, today)
            return (
            <div key={date}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8,
                paddingBottom: 4, borderBottom: '1px solid var(--color-border)',
              }}>
                <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                  {dateLabel.primary}
                </span>
                {dateLabel.secondary && (
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 500 }}>
                    {dateLabel.secondary}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', fontWeight: 500 }}>
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entries.map(a => {
                  const time = new Date(a.created_at).toISOString().slice(11, 16)
                  const link = getEntityLink(a.entity_type, a.entity_id)
                  const rawDetails = a.metadata?.details && typeof a.metadata.details === 'string' ? a.metadata.details : ''
                  const userAttribution = formatRowAttribution(a.user_rank ?? null, a.user_name)
                  const railColor = getActionColor(a.action, a.entity_type)

                  return (
                    <div
                      key={a.id}
                      onClick={link ? () => router.push(link) : undefined}
                      style={{
                        display: 'flex', gap: 10, padding: '8px 10px 8px 12px',
                        background: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        borderLeft: `3px solid ${railColor}`,
                        cursor: link ? 'pointer' : 'default',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'monospace', color: 'var(--color-text-3)', flexShrink: 0, paddingTop: 2, whiteSpace: 'nowrap' }}>
                        {time}Z
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 2 }}>
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: railColor }}>
                            {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined, a.metadata)}
                          </span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                            {userAttribution}
                          </span>
                          {a.user_operating_initials && (
                            <span style={{
                              fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-cyan)',
                              letterSpacing: '0.04em',
                              padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                              background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
                            }}>
                              {a.user_operating_initials}
                            </span>
                          )}
                        </div>
                        {rawDetails && (
                          <div style={{
                            fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)',
                            marginTop: 4, lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {rawDetails}
                          </div>
                        )}
                      </div>
                      {link && (
                        <ChevronRight
                          size={14}
                          style={{ color: 'var(--color-text-4)', flexShrink: 0, marginTop: 4 }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
