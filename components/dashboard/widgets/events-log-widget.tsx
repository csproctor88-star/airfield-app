'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLogPage, type ActivityEntry } from '@/lib/supabase/activity-queries'
import { formatZuluTime } from '@/lib/utils'
import { formatAction, buildDetailsString } from '@/lib/activity-format'

const EXCLUDE_TYPES = ['ppr_coordination', 'ppr_agency']

export function EventsLogWidget() {
  const { installationId } = useInstallation()
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchActivityLogPage({
      baseId: installationId,
      limit: 30,
      excludeEntityTypes: EXCLUDE_TYPES,
    }).then(({ data }) => {
      setEntries(data)
      setLoading(false)
    })
  }, [installationId])

  const emptyDetails = new Map<string, { title?: string; description?: string; notes?: string; extra?: string }>()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Recent
        </span>
        <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: loading ? 'var(--color-text-3)' : 'var(--color-text-1)' }}>
          {loading ? '…' : entries.length}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && entries.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '8px 0' }}>No recent events.</div>
        )}
        {entries.map((e) => {
          const details = buildDetailsString(e, emptyDetails)
          const label = details || formatAction(e.action, e.entity_type, e.entity_display_id ?? undefined, e.metadata)
          const ts = formatZuluTime(e.created_at)
          const oi = e.user_operating_initials || null
          return (
            <div key={e.id} style={{
              display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {label}
              </span>
              <span style={{ flexShrink: 0, color: 'var(--color-text-3)', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--fs-2xs)', whiteSpace: 'nowrap' }}>
                {oi ? `${oi} · ` : ''}{ts}Z
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
        <Link href="/activity" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
          View all →
        </Link>
      </div>
    </div>
  )
}
