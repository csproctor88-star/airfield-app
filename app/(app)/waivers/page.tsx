'use client'

import { FileText } from 'lucide-react'

export default function WaiversPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Waivers</div>
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
            background: 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FileText size={28} color="#38BDF8" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>
            Coming Soon
          </div>
          <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
            Waiver management will be available in a future update.
            This module will allow tracking and managing airfield waivers.
          </div>
        </div>
      </div>
    </div>
  )
}
