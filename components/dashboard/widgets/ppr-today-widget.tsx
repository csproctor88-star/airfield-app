'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchPprEntriesForDate, isActivePpr, type PprEntry } from '@/lib/supabase/ppr'
import { Plane } from 'lucide-react'

export function PprTodayWidget() {
  const { installationId, currentInstallation } = useInstallation()
  const [rows, setRows] = useState<PprEntry[]>([])
  const [loading, setLoading] = useState(true)

  const tz = currentInstallation?.timezone || 'UTC'

  useEffect(() => {
    if (!installationId) return
    let today: string
    try {
      today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
    } catch {
      today = new Date().toISOString().slice(0, 10)
    }
    fetchPprEntriesForDate(installationId, today).then((data) => {
      setRows(data.filter((e) => isActivePpr(e.status)))
      setLoading(false)
    })
  }, [installationId, tz])

  const preview = rows.slice(0, 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Plane size={16} color="var(--color-accent)" strokeWidth={2.25} />
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Arrivals Today
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 'var(--fs-lg)', fontWeight: 800,
          color: rows.length > 0 ? 'var(--color-accent)' : 'var(--color-text-3)',
        }}>
          {loading ? '…' : rows.length}
        </span>
      </div>

      {/* PPR list */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {!loading && rows.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No PPRs today</div>
        )}
        {preview.map((r) => (
          <div key={r.id} style={{
            fontSize: 'var(--fs-sm)',
            borderBottom: '1px solid var(--color-border)',
            padding: '4px 0',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              fontFamily: 'var(--font-family-mono)', fontSize: 'var(--fs-2xs)',
              fontWeight: 700, color: 'var(--color-text-2)', flexShrink: 0,
            }}>
              {r.ppr_number}
            </span>
            <span style={{
              fontSize: 'var(--fs-2xs)',
              color: r.status === 'approved' ? 'var(--color-status-pass)'
                : r.status === 'denied' ? 'var(--color-danger)'
                : 'var(--color-warning)',
              fontWeight: 700, flexShrink: 0,
            }}>
              {r.status === 'approved' ? 'APVD'
                : r.status === 'pending_amops_triage' ? 'TRIAGE'
                : r.status === 'pending_coordination' ? 'COORD'
                : r.status === 'pending_amops_approval' ? 'PEND'
                : r.status.toUpperCase()}
            </span>
            {r.requester_name && (
              <span style={{
                color: 'var(--color-text-3)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontSize: 'var(--fs-2xs)',
              }}>
                {r.requester_name}
              </span>
            )}
          </div>
        ))}
        {rows.length > 4 && (
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', paddingTop: 4 }}>
            +{rows.length - 4} more
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
        <Link href="/ppr" style={{
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)',
          textDecoration: 'none',
        }}>
          PPR Log →
        </Link>
      </div>
    </div>
  )
}
