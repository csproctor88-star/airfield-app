'use client'

import Link from 'next/link'
import { ArrowLeft, Radio } from 'lucide-react'

/**
 * AEP Comms Checks — monthly verification log per AC 150/5200-31C §2.3.
 *
 * Phase 3b Cluster B stub. Real implementation (this month's card + history
 * + status modal, forked from `app/(app)/scn/page.tsx`) lands in Cluster D.
 */
export default function AepCommsChecksPage() {
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
        <Radio size={22} color="var(--color-warning)" />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>AEP Comms Checks</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            Monthly response-agency comms verification — AC 150/5200-31C §2.3
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
        This month&apos;s check + 12-month history + per-agency status modal. Each completed check feeds the &quot;AEP Comms Checks (last 90 days)&quot; SMS SPI.
      </div>
    </div>
  )
}
