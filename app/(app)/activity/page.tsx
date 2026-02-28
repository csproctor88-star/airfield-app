'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLog, type ActivityEntry } from '@/lib/supabase/activity-queries'

type PeriodPreset = 'today' | '7d' | '30d' | 'custom'

function formatAction(action: string, entityType: string, displayId?: string): string {
  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy',
    check: 'Check',
    inspection: 'Inspection',
    obstruction_evaluation: 'Obstruction Eval',
    navaid_status: 'NAVAID',
    airfield_status: 'Runway',
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
    waiver_review_deleted: 'Deleted review for',
  }
  const label = actionLabel[action] || (action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' '))
  return `${label} ${entity}${id}`
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

const STATUS_HEX: Record<string, string> = {
  green: '#34D399',
  yellow: '#FBBF24',
  red: '#EF4444',
}

export default function ActivityPage() {
  const router = useRouter()
  const { installationId } = useInstallation()
  const today = new Date().toISOString().split('T')[0]

  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

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
    // custom
    return {
      start: new Date(`${customStart}T00:00:00`).toISOString(),
      end: new Date(`${customEnd}T23:59:59.999`).toISOString(),
    }
  }, [period, today, customStart, customEnd])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { start, end } = getDateRange()
      const { data } = await fetchActivityLog({ baseId: installationId, startDate: start, endDate: end, limit: 500 })
      setEntries(data)
      setLoading(false)
    }
    load()
  }, [installationId, period, customStart, customEnd, getDateRange])

  // Group entries by date
  const grouped: { date: string; label: string; items: ActivityEntry[] }[] = []
  for (const entry of entries) {
    const d = new Date(entry.created_at)
    const dateKey = d.toISOString().split('T')[0]
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    const existing = grouped.find((g) => g.date === dateKey)
    if (existing) {
      existing.items.push(entry)
    } else {
      grouped.push({ date: dateKey, label: dateLabel, items: [entry] })
    }
  }

  const handleExport = async () => {
    if (entries.length === 0) return
    setExporting(true)
    try {
      const { createStyledWorkbook, addStyledSheet, saveWorkbook, titleCase } = await import('@/lib/excel-export')
      const columns = [
        { header: 'Date/Time', key: 'datetime', width: 22 },
        { header: 'User', key: 'user', width: 22 },
        { header: 'Action', key: 'action', width: 40 },
        { header: 'Entity Type', key: 'entity_type', width: 18 },
        { header: 'Reference ID', key: 'ref_id', width: 14 },
        { header: 'Notes', key: 'notes', width: 40 },
      ]
      const rows = entries.map((a) => {
        const d = new Date(a.created_at)
        const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
        const notes = a.metadata?.notes ? String(a.metadata.notes) : ''
        return {
          datetime: d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          user: userName,
          action: formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined),
          entity_type: titleCase(a.entity_type),
          ref_id: a.entity_display_id || '',
          notes,
        }
      })
      const wb = await createStyledWorkbook()
      addStyledSheet(wb, 'Activity Log', columns, rows)
      const { start, end } = getDateRange()
      const startLabel = start.split('T')[0]
      const endLabel = end.split('T')[0]
      await saveWorkbook(wb, `Activity_Log_${startLabel}_to_${endLabel}.xlsx`)
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

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          ← Back
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

      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 12 }}>Activity Log</div>

      {/* Period Presets */}
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-text-4)', marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', fontSize: 'var(--fs-base)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              background: period === p.value ? 'var(--color-cyan)' : 'transparent',
              color: period === p.value ? '#0F172A' : 'var(--color-text-2)',
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
            <input
              type="date"
              className="input-dark"
              value={customStart}
              max={today}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span className="section-label">End</span>
            <input
              type="date"
              className="input-dark"
              value={customEnd}
              max={today}
              min={customStart}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
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
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </div>
          {grouped.map((group) => (
            <div key={group.date} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {group.label}
              </div>
              <div className="card" style={{ padding: '4px 12px' }}>
                {group.items.map((a, i, arr) => {
                  const actionColor: Record<string, string> = {
                    created: 'var(--color-success)',
                    completed: 'var(--color-cyan)',
                    updated: 'var(--color-warning)',
                    status_updated: 'var(--color-purple)',
                    deleted: 'var(--color-danger)',
                  }
                  const actionDotBg: Record<string, string> = {
                    created: 'rgba(52,211,153,0.07)',
                    completed: 'rgba(34,211,238,0.07)',
                    updated: 'rgba(251,191,36,0.07)',
                    status_updated: 'rgba(167,139,250,0.07)',
                    deleted: 'rgba(239,68,68,0.07)',
                  }
                  const color = actionColor[a.action] || 'var(--color-text-3)'
                  const dotBg = actionDotBg[a.action] || 'rgba(100,116,139,0.07)'
                  const date = new Date(a.created_at)
                  const timeStr = date.toTimeString().slice(0, 5)
                  const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
                  const navaidNoteText = a.entity_type === 'navaid_status' && a.metadata?.notes ? String(a.metadata.notes) : null
                  const navaidStatusVal = a.entity_type === 'navaid_status' && a.metadata?.status ? String(a.metadata.status) : null
                  const link = getEntityLink(a.entity_type, a.entity_id)

                  return (
                    <div
                      key={a.id}
                      onClick={link ? () => router.push(link) : undefined}
                      style={{
                        display: 'flex',
                        gap: 8,
                        padding: '8px 0',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                        cursor: link ? 'pointer' : 'default',
                      }}
                    >
                      <div
                        style={{
                          width: 24, height: 24, borderRadius: 6, background: dotBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--fs-sm)', flexShrink: 0, color,
                        }}
                      >
                        &bull;
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-cyan)' }}>
                            {userName}
                          </span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{timeStr}</span>
                        </div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: link ? 'var(--color-cyan)' : 'var(--color-text-2)' }}>
                          {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined)}
                          {link && (
                            <span style={{ marginLeft: 4, fontSize: 'var(--fs-2xs)', opacity: 0.6 }}>→</span>
                          )}
                          {navaidStatusVal && (
                            <span style={{ marginLeft: 6, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: STATUS_HEX[navaidStatusVal] || '#64748B' }} />
                          )}
                        </div>
                        {navaidNoteText && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic', marginTop: 2 }}>
                            &ldquo;{navaidNoteText}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
