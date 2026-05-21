'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchAmtrAudit, type AmtrAuditEntry } from '@/lib/supabase/amtr'
import { formatZuluDateTime } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { thStyle, tdStyle } from '@/components/amtr/ui'
import { Badge } from '@/components/ui/badge'

const ACTION_COLOR: Record<string, string> = {
  sign: 'var(--color-success)',
  lock: 'var(--color-text-3)',
  reopen: 'var(--color-warning)',
}

const FORM_LABEL: Record<string, string> = {
  amtr_623a: '623A', amtr_797: 'DAF 797', amtr_803: 'DAF 803',
  amtr_jqs_progress: 'JQS-CFETP', amtr_1098_progress: 'DAF 1098', amtr_milestone_progress: 'Milestone',
}

export function HistoryTab({ memberId, userLabels }: { memberId: string; userLabels: Record<string, string> }) {
  const [rows, setRows] = useState<AmtrAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setRows(await fetchAmtrAudit(memberId))
    setLoading(false)
  }, [memberId])
  useEffect(() => { load() }, [load])

  if (loading) return null
  if (rows.length === 0) return <EmptyState message="No signature or amendment history yet." />

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th style={thStyle}>When</th><th style={thStyle}>Who</th><th style={thStyle}>Action</th><th style={thStyle}>Form</th><th style={thStyle}>Detail</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={tdStyle}>{formatZuluDateTime(r.created_at)}</td>
              <td style={tdStyle}>{r.actor_user_id ? (userLabels[r.actor_user_id] ?? 'User') : '—'}</td>
              <td style={tdStyle}><Badge label={r.action} color={ACTION_COLOR[r.action] ?? '#94A3B8'} /></td>
              <td style={tdStyle}>{r.table_name ? (FORM_LABEL[r.table_name] ?? r.table_name) : '—'}</td>
              <td style={tdStyle}>{r.detail ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
