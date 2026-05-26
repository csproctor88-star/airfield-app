'use client'

import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'

/**
 * AEP Response Agencies roster — CRUD + reorder + active toggle.
 *
 * Phase 3b Cluster B stub. Real implementation (grouped by agency_role,
 * inline edit, drag reorder) lands in Cluster C alongside `lib/supabase/aep.ts`.
 */
export default function AepAgenciesPage() {
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
        <Users size={22} color="var(--color-warning)" />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>Response Agencies</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            AC 150/5200-31C App. 1 — roster used by comms checks and drills
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
        CRUD roster grouped by role (ARFF, mutual-aid fire, EMS, police, hospital, ATC, FAA, NTSB, FBI, public works, utility, other). Mirrors the SCN-agency editor pattern.
      </div>
    </div>
  )
}
