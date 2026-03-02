'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const INSPECTION_TYPES = [
  {
    label: 'Daily Airfield',
    icon: '✈️',
    color: '#10B981',
    description: 'DAFI 13-213 daily airfield & lighting inspections',
    href: '/inspections',
    actionLabel: 'Start Inspection',
    historyHref: '/inspections',
  },
  {
    label: 'ACSI',
    icon: '🛡️',
    color: '#8B5CF6',
    description: 'DAFMAN 13-204v2, Para 5.4.3 annual compliance inspection',
    href: '/acsi/new',
    actionLabel: 'Start ACSI',
    historyHref: '/acsi',
  },
  {
    label: 'Pre/Post Construction',
    icon: '🏗️',
    color: '#F59E0B',
    description: 'Construction zone safety coordination inspections',
    href: '/inspections',
    actionLabel: 'Start Inspection',
    historyHref: '/inspections',
  },
  {
    label: 'Joint Monthly',
    icon: '🤝',
    color: '#3B82F6',
    description: 'Monthly joint airfield inspection with CE & Safety',
    href: '/inspections',
    actionLabel: 'Start Inspection',
    historyHref: '/inspections',
  },
]

export default function AllInspectionsPage() {
  return (
    <div className="page-container">
      {/* Header */}
      <Link href="/more" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Back to More
      </Link>

      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 4 }}>
        All Inspections
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 20 }}>
        Start a new inspection or view history
      </div>

      {/* Inspection type cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {INSPECTION_TYPES.map((type) => (
          <div
            key={type.label}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Card header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div
                className="kpi-badge"
                style={{
                  width: 48, height: 48, minWidth: 48,
                  borderRadius: 10,
                  background: `${type.color}14`,
                  border: `1px solid ${type.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--fs-2xl)',
                  padding: 0, margin: 0,
                }}
              >
                {type.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: type.color }}>
                  {type.label}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.4 }}>
                  {type.description}
                </div>
              </div>
            </div>

            {/* Actions row */}
            <div style={{
              display: 'flex', gap: 8, padding: '10px 16px',
            }}>
              <Link
                href={type.href}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  textAlign: 'center',
                  background: `${type.color}18`,
                  border: `1px solid ${type.color}33`,
                  color: type.color,
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                + {type.actionLabel}
              </Link>
              <Link
                href={type.historyHref}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  textAlign: 'center',
                  background: 'var(--color-bg-sunken)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                History
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
