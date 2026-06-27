'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import {
  fetchChecklistItems,
  fetchOrCreateTodayChecklist,
  fetchResponses,
  itemAppliesToday,
} from '@/lib/supabase/shift-checklist'
import { ListChecks } from 'lucide-react'

export function ShiftChecklistWidget() {
  const { installationId, currentInstallation } = useInstallation()
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const timezone = currentInstallation?.timezone || 'America/New_York'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resetTime = (currentInstallation as Record<string, any>)?.checklist_reset_time || '06:00'

  useEffect(() => {
    if (!installationId) return
    ;(async () => {
      const [items, { checklist }] = await Promise.all([
        fetchChecklistItems(installationId),
        fetchOrCreateTodayChecklist(installationId, timezone, resetTime),
      ])
      const applicable = items.filter(
        (i) => i.is_active && itemAppliesToday(i, timezone, resetTime),
      )
      setTotal(applicable.length)
      if (!checklist) {
        setDone(0)
        setLoading(false)
        return
      }
      const responses = await fetchResponses(checklist.id)
      const applicableIds = new Set(applicable.map((i) => i.id))
      const doneCount = responses.filter(
        (r) => applicableIds.has(r.item_id) && (r.completed || r.is_na),
      ).length
      setDone(doneCount)
      setLoading(false)
    })()
  // Intentionally omit timezone/resetTime from deps to avoid re-fetching on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId])

  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const barColor =
    pct === 100
      ? 'var(--color-status-pass)'
      : pct > 0
      ? 'var(--color-status-inwork)'
      : 'var(--color-text-4)'

  return (
    <Link href="/shift-checklist" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <ListChecks size={16} color="var(--color-accent-secondary)" strokeWidth={2.25} />
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Today
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 'var(--fs-lg)', fontWeight: 800,
          fontFamily: 'var(--font-family-mono)',
          color: pct === 100 ? 'var(--color-status-pass)' : 'var(--color-text-1)',
        }}>
          {loading ? '…' : `${done}/${total}`}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, borderRadius: 'var(--radius-sm)',
        background: 'var(--color-bg-inset)',
        overflow: 'hidden',
        marginBottom: 6,
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: barColor,
          borderRadius: 'var(--radius-sm)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
        {loading ? '' : pct === 100 ? 'All items complete' : `${pct}% complete`}
      </div>
    </Link>
  )
}
