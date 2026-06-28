'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchActiveContractors, type ContractorRow } from '@/lib/supabase/contractors'
import { HardHat } from 'lucide-react'

export function PersonnelWidget() {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ContractorRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchActiveContractors(installationId).then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Count header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <HardHat size={16} color="var(--color-warning)" strokeWidth={2.25} />
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Active
        </span>
        <span style={{
          fontSize: 'var(--fs-lg)', fontWeight: 800,
          color: rows.length > 0 ? 'var(--color-warning)' : 'var(--color-text-3)',
          marginLeft: 'auto',
        }}>
          {loading ? '…' : rows.length}
        </span>
      </div>

      {/* Row list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && rows.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No active personnel</div>
        )}
        {rows.map((r) => (
          <div key={r.id} style={{
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
            borderBottom: '1px solid var(--color-border)',
            padding: '4px 0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontWeight: 600 }}>{r.company_name}</span>
            {r.location && (
              <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-2xs)', marginLeft: 6 }}>
                {r.location}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer link */}
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
        <Link href="/contractors" style={{
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)',
          textDecoration: 'none',
        }}>
          View all →
        </Link>
      </div>
    </div>
  )
}
