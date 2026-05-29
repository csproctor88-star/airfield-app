'use client'

import { useEffect, useState } from 'react'
import { Activity, Clock, Tag, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUserPageViews } from '@/lib/supabase/page-views'
import { moduleLabel } from '@/lib/activity-labels'
import { formatRelativeTime, formatZuluDate } from '@/lib/utils'

interface UserEngagementPanelProps {
  userId: string
  lastSeenAt: string | null
  createdAt: string
}

interface Aggregates {
  total: number
  last30: number
  last7: number
  modules: { label: string; count: number }[]
  pages: { route: string; count: number }[]
  version: string | null
}

function daysAgoIso(days: number): string {
  // Stable date string (YYYY-MM-DD) N days back for the page-view filter.
  const ms = Date.now() - days * 86400_000
  return new Date(ms).toISOString().slice(0, 10)
}

export function UserEngagementPanel({ userId, lastSeenAt, createdAt }: UserEngagementPanelProps) {
  const [loading, setLoading] = useState(true)
  const [agg, setAgg] = useState<Aggregates | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    if (!supabase) { setLoading(false); return }

    ;(async () => {
      const now = Date.now()
      const cut30 = now - 30 * 86400_000
      const cut7 = now - 7 * 86400_000

      const [{ data: acts }, { data: profile }, pageViews] = await Promise.all([
        supabase
          .from('activity_log')
          .select('created_at, entity_type')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('profiles')
          .select('last_seen_release_version')
          .eq('id', userId)
          .single(),
        getUserPageViews(userId, daysAgoIso(30)),
      ])

      if (cancelled) return

      const rows = (acts as unknown as { created_at: string; entity_type: string }[] | null) ?? []
      let last30 = 0
      let last7 = 0
      const moduleCounts = new Map<string, number>()
      for (const r of rows) {
        const t = new Date(r.created_at).getTime()
        if (t >= cut30) last30++
        if (t >= cut7) last7++
        moduleCounts.set(r.entity_type, (moduleCounts.get(r.entity_type) ?? 0) + 1)
      }
      const modules = Array.from(moduleCounts.entries())
        .map(([k, count]) => ({ label: moduleLabel(k), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

      const pageCounts = new Map<string, number>()
      for (const pv of pageViews) {
        pageCounts.set(pv.route, (pageCounts.get(pv.route) ?? 0) + pv.count)
      }
      const pages = Array.from(pageCounts.entries())
        .map(([route, count]) => ({ route, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

      setAgg({
        total: rows.length,
        last30,
        last7,
        modules,
        pages,
        version: (profile as unknown as { last_seen_release_version: string | null } | null)?.last_seen_release_version ?? null,
      })
      setLoading(false)
    })().catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [userId])

  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 8,
        }}
      >
        <Activity size={12} /> Activity &amp; Engagement
      </div>

      {loading ? (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-4)', padding: '8px 0' }}>
          Loading activity…
        </div>
      ) : !agg ? (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-4)', padding: '8px 0' }}>
          Activity unavailable.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Top stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Stat icon={<Clock size={12} />} label="Last Active" value={lastSeenAt ? formatRelativeTime(lastSeenAt) : 'Never'} />
            <Stat icon={<Tag size={12} />} label="App Version" value={agg.version || '—'} />
            <Stat label="Joined" value={formatZuluDate(createdAt)} />
          </div>

          {/* Action volume */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Stat label="Actions (7d)" value={String(agg.last7)} accent />
            <Stat label="Actions (30d)" value={String(agg.last30)} accent />
            <Stat label="Actions (all)" value={String(agg.total)} accent />
          </div>

          {/* Top modules by recorded actions */}
          <BarList
            title="Top modules (by actions)"
            empty="No recorded actions yet"
            items={agg.modules.map((m) => ({ label: m.label, count: m.count }))}
          />

          {/* Pages visited (last 30 days) */}
          <BarList
            title="Pages visited (30d)"
            empty="No page views recorded yet"
            icon={<Eye size={11} />}
            items={agg.pages.map((p) => ({ label: p.route, count: p.count, mono: true }))}
          />
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 10px',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {icon}{label}
      </div>
      <div
        style={{
          fontSize: accent ? 'var(--fs-lg)' : 'var(--fs-sm)',
          fontWeight: accent ? 800 : 600,
          color: accent ? 'var(--color-cyan)' : 'var(--color-text-1)',
          marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function BarList({
  title, items, empty, icon,
}: {
  title: string
  items: { label: string; count: number; mono?: boolean }[]
  empty: string
  icon?: React.ReactNode
}) {
  const max = items.reduce((m, i) => Math.max(m, i.count), 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>
        {icon}{title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((it) => (
            <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  flex: 1, minWidth: 0,
                  fontSize: 'var(--fs-xs)',
                  fontFamily: it.mono ? 'monospace' : 'inherit',
                  color: 'var(--color-text-2)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                title={it.label}
              >
                {it.label}
              </div>
              <div style={{ width: '38%', height: 6, background: 'var(--color-bg-elevated)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${Math.round((it.count / max) * 100)}%`, height: '100%', background: 'var(--color-cyan)', borderRadius: 3 }} />
              </div>
              <div style={{ width: 32, textAlign: 'right', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-1)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {it.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
