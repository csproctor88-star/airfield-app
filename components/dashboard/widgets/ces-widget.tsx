'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'

type Row = Pick<DiscrepancyRow, 'id' | 'title' | 'current_status' | 'assigned_shop' | 'created_at'>

const CES_STATUSES = new Set([
  'submitted_to_ces',
  'awaiting_action_by_ces',
  'waiting_for_project',
  'work_completed_awaiting_verification',
])

function statusLabel(s: string | null | undefined): string {
  if (s === 'submitted_to_ces') return 'Submitted'
  if (s === 'awaiting_action_by_ces') return 'In Work'
  if (s === 'waiting_for_project') return 'Project'
  if (s === 'work_completed_awaiting_verification') return 'Verify'
  return s ?? '—'
}

function statusColor(s: string | null | undefined): string {
  if (s === 'submitted_to_ces') return 'var(--color-orange)'
  if (s === 'awaiting_action_by_ces') return 'var(--color-warning)'
  if (s === 'waiting_for_project') return 'var(--color-purple, #9b59b6)'
  if (s === 'work_completed_awaiting_verification') return 'var(--color-status-pass)'
  return 'var(--color-text-3)'
}

function ageDays(iso: string): string {
  return `${Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)}d`
}

export function CesWidget() {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchDiscrepancies(installationId).then((all) => {
      setRows(
        all.filter(
          (d) => d.status === 'open' && CES_STATUSES.has(d.current_status ?? '')
        )
      )
      setLoading(false)
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Open CES Items
        </span>
        <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: rows.length > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)' }}>
          {loading ? '…' : rows.length}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && rows.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' }}>No open CES work orders.</div>
        )}
        {rows.map((r) => (
          <Link key={r.id} href={`/discrepancies/${r.id}`} style={{
            display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0',
            borderBottom: '1px solid var(--color-border)', textDecoration: 'none',
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
          }}>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontFamily: 'var(--font-family-mono)' }}>
                {r.assigned_shop ?? '—'} · {ageDays(r.created_at)}
              </div>
            </div>
            <span style={{
              flexShrink: 0, fontSize: 'var(--fs-2xs)', fontWeight: 700,
              color: statusColor(r.current_status), textTransform: 'uppercase', alignSelf: 'center',
            }}>
              {statusLabel(r.current_status)}
            </span>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/ces" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
      </div>
    </div>
  )
}
