'use client'

import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'

/**
 * AEP Plan page — versioned PDF artifact + AE annual sign-off.
 *
 * Phase 3b Cluster B stub. Real implementation (upload + sign + supersede
 * + history) lands in Cluster C alongside `lib/supabase/aep.ts`.
 */
export default function AepPlanPage() {
  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
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
        <FileText size={22} color="var(--color-warning)" />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>AEP Document</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            14 CFR §139.325(a-d) — versioned plan with FAA acceptance + AE annual review
          </div>
        </div>
      </div>

      <div style={{
        padding: 14, borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--color-warning) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
        color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--color-text-1)' }}>Coming in Cluster C.</strong>{' '}
        Upload a versioned PDF, capture FAA acceptance metadata, AE sign-off, and the annual review log.
      </div>
    </div>
  )
}
