'use client'

import Link from 'next/link'
import { ArrowLeft, Siren } from 'lucide-react'

/**
 * AEP Drill program — triennial full-scale + annual tabletop / functional log.
 *
 * Phase 3b Cluster B stub. Real implementation (drill program status chips +
 * schedule/complete modals + AAR upload) lands in Cluster D.
 */
export default function AepDrillsPage() {
  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <Link href="/aep" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--color-text-3)', textDecoration: 'none',
        fontSize: 'var(--fs-sm)', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Airport Emergency Plan
      </Link>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 12, marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
      }}>
        <Siren size={22} color="var(--color-warning)" />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>AEP Drills</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            §139.325(h) triennial full-scale · §139.325(j) annual tabletop / functional
          </div>
        </div>
      </div>

      <div style={{
        padding: 14, borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--color-warning) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
        color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--color-text-1)' }}>Coming in Cluster D.</strong>{' '}
        Drill program status chips, schedule/complete modals, participating-agency multi-select, after-action upload. Completed full-scale drills feed the &quot;AEP Full-Scale Drill Overdue&quot; SMS SPI.
      </div>
    </div>
  )
}
