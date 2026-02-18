'use client'

import { BookOpen, Search, FolderTree, FileCheck, Bell } from 'lucide-react'

const features = [
  { icon: Search, label: 'Full-text search across all regulations' },
  { icon: FolderTree, label: 'Organized by AFI, UFC, ETL & local policy' },
  { icon: FileCheck, label: 'Quick-reference checklists & key excerpts' },
  { icon: Bell, label: 'Notifications when regulations are updated' },
]

export default function RegulationsPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Regulations</div>
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
          <BookOpen size={28} color="#38BDF8" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>
            Coming Soon
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.6, maxWidth: 280 }}>
            All consolidated regulations for managing an airfield in a single,
            searchable database — AFIs, UFCs, ETLs, and local policies at your fingertips.
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
