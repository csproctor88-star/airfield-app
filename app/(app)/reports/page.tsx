'use client'

import Link from 'next/link'
import { FileText, AlertTriangle, TrendingUp, Clock, Lightbulb } from 'lucide-react'

const REPORT_CARDS = [
  {
    title: 'Daily Operations Summary',
    description: 'Consolidated view of all airfield activity for a selected date — inspections, checks, discrepancies, runway status changes, and obstruction evaluations.',
    href: '/reports/daily',
    icon: FileText,
    color: '#0EA5E9',
  },
  {
    title: 'Generate Discrepancy Report',
    description: 'Point-in-time snapshot of every open discrepancy — aging analysis and assigned shop summary.',
    href: '/reports/discrepancies',
    icon: AlertTriangle,
    color: '#FBBF24',
  },
  {
    title: 'Discrepancy Trends',
    description: 'Opened vs closed over time — track whether the backlog is growing or shrinking, with top areas and types.',
    href: '/reports/trends',
    icon: TrendingUp,
    color: '#8B5CF6',
  },
  {
    title: 'Aging Discrepancies',
    description: 'Open discrepancies grouped by aging tier — 0-7, 8-14, 15-30, 31-60, 61-90, and 90+ days with shop breakdown.',
    href: '/reports/aging',
    icon: Clock,
    color: '#EF4444',
  },
  {
    title: 'Airfield Lighting Report',
    description: 'Overview of airfield lighting system health — feature counts, outage status, and DAFMAN compliance by system.',
    href: '/reports/lighting',
    icon: Lightbulb,
    color: '#22C55E',
  },
]

export default function ReportsPage() {
  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>Reports</div>

      <div className="card-list">
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
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
                  {card.description}
                </div>
              </div>
              <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-2xl)', alignSelf: 'center' }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
