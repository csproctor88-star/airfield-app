'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, type AmtrMember } from '@/lib/supabase/amtr'

const STATUS_ORDER: Record<string, number> = {
  Active: 0, Reserve: 1, Guard: 2, Civilian: 3, Contractor: 4, Separated: 5,
}

export function AmtrWidget() {
  const { installationId } = useInstallation()
  const [members, setMembers] = useState<AmtrMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchAmtrMembers(installationId).then((data) => {
      setMembers(data)
      setLoading(false)
    })
  }, [installationId])

  const active = members.filter((m) => m.status !== 'Separated')

  // Count by status among active members
  const statusGroups: Record<string, number> = {}
  for (const m of active) {
    statusGroups[m.status] = (statusGroups[m.status] ?? 0) + 1
  }
  const statusEntries = Object.entries(statusGroups).sort(
    ([a], [b]) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AMTR Members
        </span>
        <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: active.length > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)' }}>
          {loading ? '…' : active.length}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && members.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' }}>No training records on file.</div>
        )}
        {statusEntries.map(([status, count]) => (
          <div key={status} style={{
            display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
          }}>
            <span>{status}</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700, color: 'var(--color-text-2)' }}>{count}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/amtr" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View roster →</Link>
      </div>
    </div>
  )
}
