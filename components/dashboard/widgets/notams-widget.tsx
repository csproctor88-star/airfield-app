'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { Radio, AlertCircle } from 'lucide-react'

interface NotamRow {
  id: string
  notam_number: string
  source: 'faa' | 'local'
  status: 'active' | 'expired'
  title: string
  effective_end: string
}

/** Returns true if NOTAM expires within 24 hours */
function expiresSoon(end: string): boolean {
  if (!end || end.toUpperCase() === 'PERM') return false
  const match = end.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})(\d{2})$/)
  const parsed = match
    ? new Date(Date.UTC(+match[3], +match[1] - 1, +match[2], +match[4], +match[5]))
    : new Date(end)
  if (isNaN(parsed.getTime())) return false
  const diff = parsed.getTime() - Date.now()
  return diff > 0 && diff <= 24 * 60 * 60 * 1000
}

export function NotamsWidget() {
  const { currentInstallation } = useInstallation()
  const [notams, setNotams] = useState<NotamRow[]>([])
  const [loading, setLoading] = useState(true)
  const icao = currentInstallation?.icao || ''

  const load = useCallback(async () => {
    const supabase = createClient()
    if (!icao || !supabase) { setLoading(false); return }
    try {
      const res = await fetch(`/api/notams/sync?icao=${encodeURIComponent(icao)}`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      const active: NotamRow[] = (data.notams || []).filter((n: NotamRow) => n.status === 'active')
      setNotams(active)
    } catch { /* silently fail */ }
    setLoading(false)
  }, [icao])

  useEffect(() => { load() }, [load])

  const soon = notams.filter((n) => expiresSoon(n.effective_end))
  const preview = notams.slice(0, 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Radio size={16} color="var(--color-cyan)" strokeWidth={2.25} />
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Active
        </span>
        {soon.length > 0 && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 'var(--fs-2xs)', fontWeight: 700,
            color: 'var(--color-warning)',
          }}>
            <AlertCircle size={12} strokeWidth={2.5} />
            {soon.length} expiring
          </span>
        )}
        <span style={{
          marginLeft: 'auto',
          fontSize: 'var(--fs-lg)', fontWeight: 800,
          color: notams.length > 0 ? 'var(--color-cyan)' : 'var(--color-text-3)',
        }}>
          {loading ? '…' : notams.length}
        </span>
      </div>

      {/* NOTAM list */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {!loading && notams.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No active NOTAMs</div>
        )}
        {preview.map((n) => (
          <div key={n.id} style={{
            fontSize: 'var(--fs-sm)',
            borderBottom: '1px solid var(--color-border)',
            padding: '4px 0',
            display: 'flex', alignItems: 'center', gap: 6,
            overflow: 'hidden',
          }}>
            {expiresSoon(n.effective_end) && (
              <AlertCircle size={12} color="var(--color-warning)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
            )}
            <span style={{
              fontFamily: 'var(--font-family-mono)', fontSize: 'var(--fs-2xs)',
              color: n.source === 'faa' ? 'var(--color-cyan)' : 'var(--color-purple)',
              fontWeight: 700, flexShrink: 0,
            }}>
              {n.notam_number}
            </span>
            <span style={{
              color: 'var(--color-text-2)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {n.title}
            </span>
          </div>
        ))}
        {notams.length > 4 && (
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', paddingTop: 4 }}>
            +{notams.length - 4} more
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
        <Link href="/notams" style={{
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)',
          textDecoration: 'none',
        }}>
          View all →
        </Link>
      </div>
    </div>
  )
}
