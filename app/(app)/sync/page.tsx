'use client'

import { RefreshCw } from 'lucide-react'

export default function SyncDataPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Sync & Data</div>
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
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RefreshCw size={28} color="#22D3EE" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>
            Coming Soon
          </div>
          <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
            Sync & Data will be available in a future update.
            This module will allow managing data synchronization and exports.
          </div>
        </div>
      </div>
    </div>
  )
}
