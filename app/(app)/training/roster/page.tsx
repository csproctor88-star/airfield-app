'use client'

import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'

/** Phase 3a Cluster 2 stub for /training/roster — full build in Cluster 4. */
export default function TrainingRosterPage() {
  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <Link href="/training" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
        textDecoration: 'none', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Training Overview
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Users size={20} color="var(--color-cyan)" />
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
          Training Roster
        </div>
      </div>
      <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
        Roster view — users by role with current / expiring / overdue
        counts — lands in Cluster 4.
      </div>
    </div>
  )
}
