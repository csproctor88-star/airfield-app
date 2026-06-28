'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { Users } from 'lucide-react'

type StatusCounts = {
  total: number
  active: number
  pending: number
}

export function UsersWidget() {
  const { installationId } = useInstallation()
  const [counts, setCounts] = useState<StatusCounts>({ total: 0, active: 0, pending: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) { setLoading(false); return }

    supabase
      .from('profiles')
      .select('status')
      .eq('primary_base_id', installationId)
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        const rows = data as { status: string | null }[]
        const total = rows.length
        const active = rows.filter((r) => r.status === 'active' || (!r.status || r.status === '')).length
        const pending = rows.filter((r) => r.status === 'pending').length
        setCounts({ total, active, pending })
        setLoading(false)
      })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Users size={16} color="var(--color-cyan)" strokeWidth={2.25} />
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          This base
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
          {loading ? '…' : counts.total}
        </span>
      </div>

      {/* Breakdown */}
      <div style={{ flex: 1 }}>
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
              <span>Active</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700, color: 'var(--color-status-pass)' }}>{counts.active}</span>
            </div>
            {counts.pending > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                <span>Pending approval</span>
                <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700, color: 'var(--color-warning)' }}>{counts.pending}</span>
              </div>
            )}
            {counts.total === 0 && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No users at this base.</div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
        <Link href="/users" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
          Manage users →
        </Link>
      </div>
    </div>
  )
}
