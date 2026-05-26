'use client'

import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'

/** Phase 3a Cluster 2 stub for /training/topics — full build in Cluster 3. */
export default function TrainingTopicsPage() {
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
        <BookOpen size={20} color="var(--color-cyan)" />
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
          Training Topics
        </div>
      </div>
      <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
        13 §139.303(e) topics are seeded in the database. The catalog UI
        — system + base-custom topics, frequency editor, reference
        material link — lands in Cluster 3.
      </div>
    </div>
  )
}
