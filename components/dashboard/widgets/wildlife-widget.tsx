'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchSightings, fetchStrikes, type WildlifeSightingRow, type WildlifeStrikeRow } from '@/lib/supabase/wildlife'
import { formatZuluDate } from '@/lib/utils'
import { Bird } from 'lucide-react'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function WildlifeWidget() {
  const { installationId } = useInstallation()
  const [sightings, setSightings] = useState<WildlifeSightingRow[]>([])
  const [strikes, setStrikes] = useState<WildlifeStrikeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    const start = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
    Promise.all([
      fetchSightings(installationId, { startDate: start }),
      fetchStrikes(installationId, { startDate: start }),
    ]).then(([sr, sk]) => {
      setSightings(sr.data)
      setStrikes(sk.data)
      setLoading(false)
    })
  }, [installationId])

  // Most recent 5 sightings for the quick list
  const recentSightings = sightings.slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Bird size={16} color="var(--color-orange)" strokeWidth={2.25} />
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Last 30 days
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: sightings.length > 0 ? 'var(--color-orange)' : 'var(--color-text-3)' }}>
            {loading ? '…' : sightings.length}
          </div>
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sightings</div>
        </div>
        <div style={{ width: 1, background: 'var(--color-border)' }} />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: strikes.length > 0 ? 'var(--color-danger)' : 'var(--color-text-3)' }}>
            {loading ? '…' : strikes.length}
          </div>
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Strikes</div>
        </div>
      </div>

      {/* Recent sightings list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && sightings.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No sightings in last 30 days.</div>
        )}
        {recentSightings.map((s) => (
          <div key={s.id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.species_common}
              {s.count_observed > 1 && (
                <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-2xs)', marginLeft: 4 }}>×{s.count_observed}</span>
              )}
            </span>
            <span style={{ flexShrink: 0, color: 'var(--color-text-3)', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--fs-2xs)' }}>
              {formatZuluDate(s.observed_at)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
        <Link href="/wildlife" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
          View all →
        </Link>
      </div>
    </div>
  )
}
