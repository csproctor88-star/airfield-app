'use client'

import { Users } from 'lucide-react'

export default function UsersSecurityPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Users & Security</div>
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'rgba(100,116,139,0.08)',
            border: '1px solid rgba(100,116,139,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Users size={28} color="#64748B" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>
            Coming Soon
          </div>
          <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>
            Users & Security will be available in a future update.
            This module will allow managing user accounts and security settings.
          </div>
        </div>
      </div>
    </div>
  )
}
