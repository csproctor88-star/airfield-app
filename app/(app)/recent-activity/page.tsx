'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { fetchDashboardActivity, type ActivityEntry } from '@/lib/supabase/activity-queries'
import { formatZuluDate } from '@/lib/utils'

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

function formatAction(action: string, entityType: string, displayId?: string, metadata?: Record<string, unknown> | null): string {
  if (entityType === 'manual' && metadata?.template_label) return metadata.template_label as string
  if (entityType === 'manual' && metadata?.template_category) return TEMPLATE_CATEGORY_LABELS[metadata.template_category as string] || 'Logged Entry'
  if (entityType === 'manual' && metadata?.details) {
    const inferred = inferActionFromText(metadata.details as string)
    if (inferred) return inferred
  }
  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy', check: 'Check', airfield_check: 'Check', inspection: 'Inspection',
    obstruction_evaluation: 'Obstruction Eval', navaid_status: 'NAVAID', airfield_status: 'Runway',
    weather_info: 'Weather Info', arff_status: 'ARFF', contractor: 'Personnel', qrc: 'QRC',
    wildlife_sighting: 'Wildlife Sighting', wildlife_strike: 'Wildlife Strike', manual: 'Logged Entry',
    parking_plan: 'Parking Plan', acsi_inspection: 'ACSI Inspection', waiver: 'Waiver', waiver_review: 'Waiver Review',
  }
  const entity = typeLabel[entityType] || entityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const id = displayId ? ` ${displayId}` : ''
  const actionLabel: Record<string, string> = {
    created: 'Created', updated: 'Updated', deleted: 'Deleted', completed: 'Completed',
    opened: 'Opened', closed: 'Closed', status_updated: 'Status changed on',
    saved: 'Saved', filed: 'Filed', resumed: 'Resumed', reviewed: 'Reviewed',
    noted: 'Logged', logged_personnel: 'Logged', personnel_off_airfield: 'Personnel Off Airfield',
    cancelled: 'Cancelled',
  }
  const label = actionLabel[action] || (action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' '))
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
  if (entityType === 'qrc') return '#C084FC'
  if (entityType === 'wildlife_sighting' || entityType === 'wildlife_strike') return '#F97316'
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

export default function RecentActivityPage() {
  const router = useRouter()
  const { installationId } = useInstallation()
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadActivity = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const data = await fetchDashboardActivity(installationId, 100)
    setActivity(data)
    setLoading(false)
  }, [installationId])

  useEffect(() => { loadActivity() }, [loadActivity])

  // Group by date
  const grouped = activity.reduce<Record<string, ActivityEntry[]>>((acc, a) => {
    const date = a.created_at.slice(0, 10)
    if (!acc[date]) acc[date] = []
    acc[date].push(a)
    return acc
  }, {})

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, margin: 0 }}>Recent Activity</h2>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
            All activity across the installation — last 7 days
          </div>
        </div>
        <button
          onClick={() => router.back()}
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
            border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
            color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Back</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
      ) : activity.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)' }}>No recent activity</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date}>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {formatZuluDate(new Date(date + 'T00:00:00Z'))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entries.map(a => {
                  const time = new Date(a.created_at).toISOString().slice(11, 16)
                  const link = getEntityLink(a.entity_type, a.entity_id)
                  let details = ''
                  if (a.metadata?.details && typeof a.metadata.details === 'string') {
                    details = a.metadata.details.toUpperCase()
                  }
                  const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name

                  return (
                    <div
                      key={a.id}
                      onClick={link ? () => router.push(link) : undefined}
                      style={{
                        display: 'flex', gap: 10, padding: '8px 10px',
                        background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        cursor: link ? 'pointer' : 'default',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'monospace', color: 'var(--color-text-3)', flexShrink: 0, paddingTop: 2 }}>
                        {time}Z
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: getActionColor(a.action, a.entity_type) }}>
                            {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined, a.metadata)}
                          </span>
                          {a.user_operating_initials && (
                            <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-cyan)', letterSpacing: '0.04em' }}>
                              {a.user_operating_initials}
                            </span>
                          )}
                        </div>
                        {details && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {details}
                          </div>
                        )}
                        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', marginTop: 2 }}>
                          {userName}
                        </div>
                      </div>
                      {link && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', flexShrink: 0, paddingTop: 2 }}>&rarr;</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
