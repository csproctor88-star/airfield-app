'use client'

import Link from 'next/link'
import { FileText, AlertTriangle } from 'lucide-react'

const REPORT_CARDS = [
  {
    title: 'Daily Operations Summary',
    description: 'Consolidated view of all airfield activity for a selected date — inspections, checks, discrepancies, runway status changes, and obstruction evaluations.',
    href: '/reports/daily',
    icon: FileText,
    color: '#0EA5E9',
  },
  {
    title: 'Open Discrepancies Report',
    description: 'Point-in-time snapshot of every open discrepancy — severity breakdown, aging analysis, and assigned shop summary.',
    href: '/reports/discrepancies',
    icon: AlertTriangle,
    color: '#FBBF24',
  },
]

export default function ReportsPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Reports</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {REPORT_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              className="card"
              style={{
                padding: 16,
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                cursor: 'pointer',
                border: `1px solid ${card.color}22`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: `${card.color}14`,
                  border: `1px solid ${card.color}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <card.icon size={22} color={card.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>
                  {card.description}
                </div>
              </div>
              <span style={{ color: '#475569', fontSize: 16, alignSelf: 'center' }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
