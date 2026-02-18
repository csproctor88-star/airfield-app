'use client'

import { Plane, Camera, Ruler, Weight, Gauge } from 'lucide-react'

const features = [
  { icon: Ruler, label: 'Wingspan, length & height dimensions' },
  { icon: Weight, label: 'Max takeoff weight & ACN/PCN data' },
  { icon: Gauge, label: 'Approach speeds & engine type' },
  { icon: Camera, label: 'High-res aircraft images & silhouettes' },
]

export default function AircraftPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Aircraft Database</div>
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: '36px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
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
          <Plane size={28} color="#38BDF8" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>
            Coming Soon
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.6, maxWidth: 280 }}>
            A comprehensive aircraft database with full characteristics for every airframe
            that operates on your airfield, complete with reference images.
          </div>
        </div>

        <div style={{ width: '100%', marginTop: 8 }}>
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: 'rgba(4,7,12,0.5)',
                borderRadius: 8,
                marginBottom: 6,
                border: '1px solid rgba(56,189,248,0.06)',
              }}
            >
              <Icon size={16} color="#38BDF8" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#CBD5E1', textAlign: 'left' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
