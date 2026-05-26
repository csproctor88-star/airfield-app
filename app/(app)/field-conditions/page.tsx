'use client'

import Link from 'next/link'
import { ArrowLeft, CloudSnow } from 'lucide-react'

/**
 * /field-conditions stub — Phase 3d Cluster B navigation landing.
 *
 * Real implementation (active-report cards, history, New Report 3-step
 * modal walking per-third RwyCC assessment + treatments + live FICON
 * preview) lands in Cluster C once the CRUD + engine layer is verified.
 */
export default function FieldConditionsPage() {
  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <Link href="/more" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--color-text-3)', textDecoration: 'none',
        fontSize: 'var(--fs-sm)', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Back
      </Link>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 12, marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
      }}>
        <CloudSnow size={22} color="var(--color-cyan)" />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            Field Conditions / TALPA
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            14 CFR §139.313 · AC 150/5200-30D — per-third RwyCC + FICON NOTAM text
          </div>
        </div>
      </div>

      <div style={{
        padding: 14,
        borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--color-cyan) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
        color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--color-text-1)' }}>Phase 3d Cluster B in place.</strong>{' '}
        Schema + RwyCC engine + CRUD + FICON NOTAM text generator are live.
        The active-report cards, 30-day history, and New Report modal land
        in Cluster C.
      </div>
    </div>
  )
}
