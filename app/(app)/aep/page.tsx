'use client'

import Link from 'next/link'
import { ShieldAlert, FileText, Users, Radio, Siren, ChevronRight } from 'lucide-react'

/**
 * Airport Emergency Plan landing — module overview + entry points.
 *
 * Phase 3b Cluster B stub: structural shell + links to the four
 * sub-pages. Dashboard cards (plan currency, drill due date,
 * comms-check streak, agency count) wire in Cluster D once
 * `lib/supabase/aep.ts` lands.
 */
export default function AepPage() {
  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 12,
        marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
      }}>
        <ShieldAlert size={22} color="var(--color-warning)" />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            Airport Emergency Plan
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            14 CFR §139.325 · AC 150/5200-31C
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        <EntryCard
          href="/aep/plan"
          icon={FileText}
          title="AEP Document"
          body="The current plan — version, effective date, FAA acceptance reference, and the AE annual review log."
        />
        <EntryCard
          href="/aep/agencies"
          icon={Users}
          title="Response Agencies"
          body="ARFF, mutual-aid fire, EMS, police, hospital, ATC, FAA, NTSB — the roster the AEP coordinates with."
        />
        <EntryCard
          href="/aep/comms-checks"
          icon={Radio}
          title="Comms Checks"
          body="Monthly verification of comms with each response agency per AC 150/5200-31C §2.3."
        />
        <EntryCard
          href="/aep/drills"
          icon={Siren}
          title="Drills"
          body="Triennial full-scale plus annual tabletop / functional exercises per §139.325(h) and (j)."
        />
      </div>

      <div style={{
        marginTop: 24,
        padding: 14,
        borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--color-warning) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
        color: 'var(--color-text-2)',
        fontSize: 'var(--fs-sm)',
        lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--color-text-1)' }}>Phase 3b build in progress.</strong>{' '}
        Plan management, response-agency roster, comms checks, and drill log arrive in subsequent
        Cluster commits. Schema + permissions are live in this branch already; drill completions
        feed two SMS Safety Performance Indicators on the next nightly cron run.
      </div>
    </div>
  )
}

function EntryCard({
  href, icon: Icon, title, body,
}: {
  href: string
  icon: typeof FileText
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
        background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-warning)',
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
