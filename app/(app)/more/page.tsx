'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

// "More" menu matching prototype: full module list

const modules = [
  { name: 'Waivers', icon: '📄', color: '#A78BFA', badge: null, href: '/waivers' },
  { name: 'Reports', icon: '📊', color: '#22D3EE', badge: null, href: '/reports' },
  { name: 'NOTAMs', icon: '📡', color: '#A78BFA', badge: '3 active', href: '/notams' },
]

export default function MorePage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>All Modules</div>
      {modules.map((m) => (
        <Link
          key={m.name}
          href={m.href}
          className="card"
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${m.color}10`,
              border: `1px solid ${m.color}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {m.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
          </div>
          {m.badge && <Badge label={m.badge} color={m.color} />}
          <span style={{ color: '#334155', fontSize: 16 }}>›</span>
        </Link>
      ))}
      <div
        className="card"
        style={{ marginTop: 8, textAlign: 'center', padding: 16 }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
          Airfield OPS Management Suite
        </div>
        <div style={{ fontSize: 10, color: '#64748B' }}>
          v1.0.0 &bull; Phases 1–8 &bull; 127th Wing
        </div>
      </div>
    </div>
  )
}
