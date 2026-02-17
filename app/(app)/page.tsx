'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  AlertTriangle,
  ClipboardCheck,
  Megaphone,
} from 'lucide-react'
import { fetchDiscrepancyKPIs } from '@/lib/supabase/discrepancies'
import { createClient } from '@/lib/supabase/client'

// Home screen matching prototype: clock, weather, KPI tiles, quick actions, today's status, activity

// Placeholder data used as fallback when Supabase is not configured
const PLACEHOLDER_KPIS = { open: 4, critical: 2, notams: 3 }

const QUICK_ACTIONS = [
  { label: 'New Discrep', icon: Plus, color: '#EF4444', href: '/discrepancies/new' },
  { label: 'Airfield Check', icon: Search, color: '#FBBF24', href: '/checks' },
  { label: 'Check History', icon: ClipboardCheck, color: '#22D3EE', href: '/checks/history' },
  { label: 'Inspection', icon: ClipboardCheck, color: '#34D399', href: '/inspections/new' },
  { label: 'NOTAM', icon: Megaphone, color: '#A78BFA', href: '/notams/new' },
  { label: 'Obstructions', icon: AlertTriangle, color: '#F97316', href: '/obstructions' },
]

const PLACEHOLDER_ACTIVITY = [
  { time: '07:52', user: 'TSgt Nakamura', text: 'Updated D-2026-0041: parts ETA Monday', color: '#38BDF8' },
  { time: '07:45', user: 'You', text: 'Escalated D-2026-0042 to Critical', color: '#EF4444' },
  { time: '07:15', user: 'TSgt Williams', text: 'FOD check — 2 items found', color: '#FBBF24' },
  { time: '06:45', user: 'You', text: 'BASH check — LOW condition', color: '#A78BFA' },
]

export default function HomePage() {
  const [time, setTime] = useState('')
  const [kpis, setKpis] = useState(PLACEHOLDER_KPIS)

  useEffect(() => {
    const update = () => setTime(new Date().toTimeString().slice(0, 5))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function loadKpis() {
      const supabase = createClient()
      if (!supabase) return // keep placeholders

      const data = await fetchDiscrepancyKPIs()
      setKpis({ ...data, notams: PLACEHOLDER_KPIS.notams })
    }
    loadKpis()
  }, [])

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Clock + User */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>{time || '08:15'}</span>
        <span style={{ fontSize: 10, color: '#64748B' }}>MSgt Proctor &bull; Online</span>
      </div>

      {/* Weather Strip */}
      <div
        className="card"
        style={{
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(56,189,248,0.03)',
          border: '1px solid rgba(56,189,248,0.1)',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>☀️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>28°F &bull; Clear</div>
            <div style={{ fontSize: 10, color: '#64748B' }}>Wind 310/08 &bull; Vis 10SM &bull; Alt 30.12</div>
          </div>
        </div>
        <Badge label="ADVISORY" color="#FBBF24" />
      </div>

      {/* KPI Tiles — 3 across */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'OPEN', value: kpis.open, color: '#FBBF24', href: '/discrepancies' },
          { label: 'CRITICAL', value: kpis.critical, color: kpis.critical > 0 ? '#EF4444' : '#34D399', href: '/discrepancies' },
          { label: 'NOTAMS', value: kpis.notams, color: '#A78BFA', href: '/notams' },
        ].map((k) => (
          <Link
            key={k.label}
            href={k.href}
            style={{
              background: 'rgba(10,16,28,0.92)',
              border: '1px solid rgba(56,189,248,0.06)',
              borderRadius: 10,
              padding: '10px 6px',
              textAlign: 'center',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: 9, color: '#64748B', letterSpacing: '0.08em', fontWeight: 600 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
          </Link>
        ))}
      </div>

      {/* Quick Actions — 4x2 grid */}
      <span className="section-label">Quick Actions</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
        {QUICK_ACTIONS.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            style={{
              background: 'rgba(10,16,28,0.92)',
              border: '1px solid rgba(56,189,248,0.06)',
              borderRadius: 10,
              padding: '12px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: `${q.color}12`,
                border: `1px solid ${q.color}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <q.icon size={14} color={q.color} />
            </div>
            <span style={{ fontSize: 8, color: '#94A3B8', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
              {q.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Today's Status */}
      <span className="section-label">{"Today's Status"}</span>
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { icon: '📋', label: 'Inspection', value: 'Not Started', color: '#FBBF24', href: '/inspections' },
            { icon: '⚠️', label: 'FOD', value: '0715L (2 found)', color: '#FBBF24', href: '/checks' },
            { icon: '🦅', label: 'BASH', value: '0645L (LOW)', color: '#34D399', href: '/checks' },
            { icon: '📊', label: 'RCR', value: 'Yest (Mu 64)', color: '#FBBF24', href: '/checks' },
          ].map((s) => (
            <Link
              key={s.label}
              href={s.href}
              style={{
                padding: 8,
                background: 'rgba(4,7,12,0.5)',
                borderRadius: 8,
                cursor: 'pointer',
                border: '1px solid rgba(56,189,248,0.06)',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 11 }}>{s.icon}</span>
                <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.value}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <span className="section-label">Recent Activity</span>
      {PLACEHOLDER_ACTIVITY.map((a, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 8,
            padding: '6px 0',
            borderBottom: i < PLACEHOLDER_ACTIVITY.length - 1 ? '1px solid rgba(56,189,248,0.06)' : 'none',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: `${a.color}12`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              flexShrink: 0,
              color: a.color,
            }}
          >
            &bull;
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: a.user === 'You' ? '#22D3EE' : '#F1F5F9' }}>
                {a.user}
              </span>
              <span style={{ fontSize: 9, color: '#64748B' }}>{a.time}</span>
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{a.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
