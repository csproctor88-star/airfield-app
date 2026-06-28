'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchWaivers, type WaiverRow } from '@/lib/supabase/waivers'
import { formatZuluDate } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

const ACTIVE_STATUSES = new Set(['active', 'approved'])
const EXPIRING_SOON_DAYS = 90

function daysUntilExpiry(iso: string | null): number | null {
  if (!iso) return null
  const d = Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000)
  return d
}

function statusColor(status: string): string {
  if (status === 'active' || status === 'approved') return 'var(--color-status-pass)'
  if (status === 'draft') return 'var(--color-text-3)'
  if (status === 'pending') return 'var(--color-warning)'
  if (status === 'expired' || status === 'cancelled') return 'var(--color-danger)'
  return 'var(--color-text-2)'
}

export function WaiversWidget() {
  const { installationId } = useInstallation()
  const [waivers, setWaivers] = useState<WaiverRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchWaivers(installationId).then((data) => {
      setWaivers(data)
      setLoading(false)
    })
  }, [installationId])

  const active = waivers.filter((w) => ACTIVE_STATUSES.has(w.status))
  const expiringSoon = active.filter((w) => {
    const d = daysUntilExpiry(w.expiration_date)
    return d !== null && d >= 0 && d <= EXPIRING_SOON_DAYS
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Count header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Active
        </span>
        {expiringSoon.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-warning)' }}>
            <AlertCircle size={12} strokeWidth={2.5} />
            {expiringSoon.length} expiring
          </span>
        )}
        <span style={{
          marginLeft: 'auto',
          fontSize: 'var(--fs-lg)', fontWeight: 800,
          color: active.length > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)',
        }}>
          {loading ? '…' : active.length}
        </span>
      </div>

      {/* Waiver list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && waivers.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No waivers on file.</div>
        )}
        {waivers.map((w) => {
          const days = daysUntilExpiry(w.expiration_date)
          const expiringSoonRow = days !== null && days >= 0 && days <= EXPIRING_SOON_DAYS
          return (
            <Link key={w.id} href={`/waivers/${w.id}`} style={{
              display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0',
              borderBottom: '1px solid var(--color-border)', textDecoration: 'none',
              fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
            }}>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.waiver_number}
                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginLeft: 6 }}>
                    {w.classification}
                  </span>
                </div>
                {w.expiration_date && (
                  <div style={{ fontSize: 'var(--fs-2xs)', color: expiringSoonRow ? 'var(--color-warning)' : 'var(--color-text-3)' }}>
                    Exp: {formatZuluDate(w.expiration_date)}
                    {expiringSoonRow && days !== null && ` (${days}d)`}
                  </div>
                )}
              </div>
              <span style={{
                flexShrink: 0, fontSize: 'var(--fs-2xs)', fontWeight: 700,
                color: statusColor(w.status), textTransform: 'uppercase', alignSelf: 'center',
              }}>
                {w.status}
              </span>
            </Link>
          )
        })}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/waivers/new" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>+ New</Link>
        <Link href="/waivers" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
      </div>
    </div>
  )
}
