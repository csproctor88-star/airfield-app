'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Activity, Clock, AlertTriangle, Tag, Eye, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PERM } from '@/lib/permissions'
import { getPermissionsFor } from '@/lib/permissions-server'
import { loadEngagementSummary, type EngagementSummary } from '@/lib/admin/engagement'
import { formatRelativeTime } from '@/lib/utils'

export default function UserAnalyticsPage() {
  const router = useRouter()
  const [initialized, setInitialized] = useState(false)
  const [summary, setSummary] = useState<EngagementSummary | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      if (!supabase) { setInitialized(true); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, primary_base_id')
        .eq('id', user.id)
        .single<{ role: string; primary_base_id: string | null }>()

      const perms = await getPermissionsFor(supabase, user.id)
      if (!profile || !perms.has(PERM.USERS_VIEW)) {
        setDenied(true)
        setInitialized(true)
        return
      }

      // Sys admins see all installations; other admins are scoped to theirs.
      const scopeBaseId = profile.role === 'sys_admin' ? null : profile.primary_base_id
      const result = await loadEngagementSummary(scopeBaseId, Date.now())
      setSummary(result)
      setInitialized(true)
    }
    init().catch(() => setInitialized(true))
  }, [router])

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => router.push('/users')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 'var(--fs-sm)', padding: 0, fontFamily: 'inherit' }}
        >
          <ArrowLeft size={14} /> Users
        </button>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
          User Activity
        </div>
      </div>

      {!initialized ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} className="card" style={{ height: 90, background: 'var(--color-bg-elevated)' }} />)}
        </div>
      ) : denied ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-3)' }}>
          You don&apos;t have access to user analytics.
        </div>
      ) : !summary ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-3)' }}>
          Analytics unavailable.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {summary.scope === 'base' && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              Showing your installation only. (System admins see all installations.)
            </div>
          )}

          {/* Population + activity stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
            <StatCard icon={<Users size={13} />} label="Total" value={summary.totalUsers} />
            <StatCard icon={<Clock size={13} />} label="Active 24h" value={summary.dau} accent="var(--color-success)" />
            <StatCard icon={<Activity size={13} />} label="Active 7d" value={summary.wau} accent="var(--color-cyan)" />
            <StatCard icon={<Activity size={13} />} label="Active 30d" value={summary.mau} accent="var(--color-cyan)" />
            <StatCard icon={<AlertTriangle size={13} />} label="Pending" value={summary.pending} accent={summary.pending > 0 ? 'var(--color-warning)' : undefined} />
            <StatCard icon={<AlertTriangle size={13} />} label="Stale 30d" value={summary.stale.length} accent={summary.stale.length > 0 ? 'var(--color-warning)' : undefined} />
            <StatCard label="New (30d)" value={summary.newAccounts30d} />
            <StatCard label="Deactivated" value={summary.deactivated} />
          </div>

          {summary.truncated && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)' }}>
              Showing the most recent 10,000 events — older activity this period is not included in the breakdowns below.
            </div>
          )}

          {/* Adoption by module */}
          <Section title="Adoption by module (30d actions)" icon={<Tag size={12} />}>
            <BarList items={summary.modules.map((m) => ({ label: m.label, count: m.count }))} empty="No actions recorded in the last 30 days." />
          </Section>

          {/* Most-visited pages */}
          <Section title="Most-visited pages (30d)" icon={<Eye size={12} />}>
            <BarList items={summary.pages.map((p) => ({ label: p.route, count: p.count, mono: true }))} empty="No page views recorded yet." />
          </Section>

          {/* Version adoption */}
          <Section title="App version adoption" icon={<Tag size={12} />}>
            <BarList items={summary.versions.map((v) => ({ label: v.version, count: v.count, mono: true }))} empty="No version data." />
          </Section>

          {/* Adoption by base (sys admin / all installations) */}
          {summary.scope === 'all' && summary.bases.length > 0 && (
            <Section title="Adoption by installation (30d)" icon={<Building2 size={12} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {summary.bases.map((b) => (
                  <div key={b.baseId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 600 }}>
                      {b.name} <span style={{ color: 'var(--color-text-4)', fontWeight: 400 }}>{b.icao}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexShrink: 0, fontSize: 'var(--fs-xs)' }}>
                      <span style={{ color: 'var(--color-text-3)' }}><b style={{ color: 'var(--color-cyan)', fontVariantNumeric: 'tabular-nums' }}>{b.activeUsers}</b> active</span>
                      <span style={{ color: 'var(--color-text-3)' }}><b style={{ color: 'var(--color-text-1)', fontVariantNumeric: 'tabular-nums' }}>{b.actions}</b> actions</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Stale accounts */}
          <Section title="Stale accounts (no activity 30d)" icon={<AlertTriangle size={12} />}>
            {summary.stale.length === 0 ? (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>No stale accounts — everyone&apos;s been active.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {summary.stale.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[u.rank, u.name].filter(Boolean).join(' ')}
                    </span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', flexShrink: 0 }}>
                      {u.lastSeenAt ? `seen ${formatRelativeTime(u.lastSeenAt)}` : 'never signed in'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginTop: 2, color: accent || 'var(--color-text-1)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 10 }}>
        {icon}{title}
      </div>
      {children}
    </div>
  )
}

function BarList({ items, empty }: { items: { label: string; count: number; mono?: boolean }[]; empty: string }) {
  const max = items.reduce((m, i) => Math.max(m, i.count), 0) || 1
  if (items.length === 0) return <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>{empty}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-xs)', fontFamily: it.mono ? 'monospace' : 'inherit', color: 'var(--color-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={it.label}
          >
            {it.label}
          </div>
          <div style={{ width: '40%', height: 6, background: 'var(--color-bg-elevated)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${Math.round((it.count / max) * 100)}%`, height: '100%', background: 'var(--color-cyan)', borderRadius: 3 }} />
          </div>
          <div style={{ width: 40, textAlign: 'right', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-1)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {it.count}
          </div>
        </div>
      ))}
    </div>
  )
}
