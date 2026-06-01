'use client'

import Link from 'next/link'
import { GraduationCap, BookOpen, Users, ClipboardCheck, ChevronRight } from 'lucide-react'

/**
 * §139.303 Training landing page — module overview + entry points.
 *
 * Phase 3a Cluster 2 stub: structural shell + links to the three
 * sub-pages. Quick-stat cards (topics seeded / users / % current)
 * are wired in Cluster 3 once `lib/supabase/training-part139.ts`
 * lands.
 */
export default function TrainingPage() {
  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 12,
        marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
      }}>
        <GraduationCap size={22} color="var(--color-cyan)" />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            §139.303 Training
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            Personnel training currency per 14 CFR Part 139 §139.303(e)
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        <EntryCard
          href="/training/topics"
          icon={BookOpen}
          title="Training Topics"
          body="The 13 §139.303(e) topics, plus any base-specific custom topics. Edit frequency, attach reference material."
        />
        <EntryCard
          href="/training/roster"
          icon={Users}
          title="Training Roster"
          body="Per-user view: who's current, who's expiring, who's overdue. Click a row to log or renew training."
        />
        <EntryCard
          href="/training/compliance"
          icon={ClipboardCheck}
          title="Compliance Matrix"
          body="Users × topics grid for an at-a-glance audit-ready picture. Export CSV or PDF roster for FAA inspections."
        />
      </div>
    </div>
  )
}

function EntryCard({
  href, icon: Icon, title, body,
}: {
  href: string
  icon: typeof BookOpen
  title: string
  body: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        gap: 12,
        padding: 14,
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        textDecoration: 'none',
        color: 'inherit',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        minWidth: 36,
        borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-cyan)',
        flexShrink: 0,
      }}>
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
          {title}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.4 }}>
          {body}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--color-text-4)', flexShrink: 0, marginTop: 10 }} />
    </Link>
  )
}
