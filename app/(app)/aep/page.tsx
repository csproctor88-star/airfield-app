'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ShieldAlert, FileText, Users, Radio, Siren,
  CheckCircle2, AlertTriangle, ChevronRight, Plus,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import {
  fetchActivePlan,
  fetchLatestFullScale,
  fetchCurrentMonthCheck,
  fetchResponseAgencies,
  nextAnnualReviewDue,
  nextFullScaleDue,
  type AepPlan,
  type AepDrill,
  type AepCommsCheckWithResults,
  type AepResponseAgency,
} from '@/lib/supabase/aep'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'

/**
 * /aep — Accountable Executive dashboard for the Airport Emergency Plan.
 *
 * Four cards summarize the program at a glance:
 *   1. Plan status — version + annual review countdown
 *   2. Full-scale drill — next due date / overdue status
 *   3. This month's comms check — done / pending
 *   4. Response agencies — active count + quick link
 *
 * PDF exports (plan / drills / monthly comms) land alongside in
 * Cluster E once `lib/aep-pdf.ts` ships.
 */
export default function AepDashboardPage() {
  const { installationId } = useInstallation()
  const [loaded, setLoaded] = useState(false)
  const [plan, setPlan] = useState<AepPlan | null>(null)
  const [latestFs, setLatestFs] = useState<AepDrill | null>(null)
  const [thisMonth, setThisMonth] = useState<AepCommsCheckWithResults | null>(null)
  const [agencies, setAgencies] = useState<AepResponseAgency[]>([])

  const load = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    const [p, fs, tm, ags] = await Promise.all([
      fetchActivePlan(installationId),
      fetchLatestFullScale(installationId),
      fetchCurrentMonthCheck(installationId),
      fetchResponseAgencies(installationId, true),
    ])
    setPlan(p)
    setLatestFs(fs)
    setThisMonth(tm)
    setAgencies(ags)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  if (!loaded) return <LoadingState />

  const review = nextAnnualReviewDue(plan)
  const fsDue = nextFullScaleDue(latestFs)

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 12, marginBottom: 18,
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

      {/* 4-card AE summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        <PlanStatusCard plan={plan} review={review} />
        <FullScaleCard latest={latestFs} due={fsDue} />
        <CommsCheckCard check={thisMonth} agencyCount={agencies.length} />
        <AgencyCountCard count={agencies.length} />
      </div>

      {/* Quick links */}
      <div style={{ marginBottom: 16, fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
        Quick Actions
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 10,
      }}>
        <QuickLink href="/aep/plan" icon={FileText} title="Manage Plan" />
        <QuickLink href="/aep/agencies" icon={Users} title="Manage Agencies" />
        <QuickLink href="/aep/comms-checks" icon={Radio} title="Comms Checks" />
        <QuickLink href="/aep/drills" icon={Siren} title="Drills" />
      </div>

      <div style={{
        marginTop: 24,
        padding: 14,
        borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--color-cyan) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
        color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--color-text-1)' }}>SMS feed:</strong>{' '}
        Completed full-scale drills and completed comms checks feed the{' '}
        <Link href="/sms/spis" style={{ color: 'var(--color-accent)' }}>SMS Safety Performance Indicators</Link>{' '}
        on the next nightly recompute (02:30 UTC).
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Cards
// ────────────────────────────────────────────────────────────────

function PlanStatusCard({ plan, review }: {
  plan: AepPlan | null
  review: ReturnType<typeof nextAnnualReviewDue>
}) {
  if (!plan) {
    return (
      <Card accent="var(--color-warning)" label="Plan Status">
        <Headline color="var(--color-warning)" icon={AlertTriangle}>No plan on file</Headline>
        <SubText>Upload your first AEP document.</SubText>
        <CardAction href="/aep/plan" label="Create Plan" />
      </Card>
    )
  }
  const color =
    review.status === 'overdue' ? 'var(--color-danger)' :
    review.status === 'due_soon' ? 'var(--color-warning)' :
    'var(--color-success)'
  const headline = review.status === 'overdue'
    ? `Review overdue by ${Math.abs(review.daysOut!)} days`
    : review.status === 'due_soon'
      ? `Review due in ${review.daysOut} days`
      : 'Plan current'
  return (
    <Card accent={color} label="Plan Status">
      <Headline color={color} icon={review.status === 'current' ? CheckCircle2 : AlertTriangle}>{headline}</Headline>
      <SubText>v{plan.version} · effective {formatZuluDate(plan.effective_date)}</SubText>
      {review.date && (
        <SubText>Next review: {formatZuluDate(review.date.toISOString().slice(0, 10))}</SubText>
      )}
      <CardAction href="/aep/plan" label="Manage Plan" />
    </Card>
  )
}

function FullScaleCard({ latest, due }: {
  latest: AepDrill | null
  due: ReturnType<typeof nextFullScaleDue>
}) {
  const color =
    due.status === 'overdue' ? 'var(--color-danger)' :
    due.status === 'due_soon' ? 'var(--color-warning)' :
    due.status === 'never' ? 'var(--color-warning)' :
    'var(--color-success)'
  const headline =
    due.status === 'never' ? 'Never recorded' :
    due.status === 'overdue' ? `Overdue by ${Math.abs(due.daysOut!)} days` :
    due.status === 'due_soon' ? `Due in ${due.daysOut} days` :
    `Due in ${Math.round(due.daysOut! / 30)} months`
  return (
    <Card accent={color} label="Full-Scale Exercise">
      <Headline color={color} icon={due.status === 'current' ? CheckCircle2 : AlertTriangle}>{headline}</Headline>
      <SubText>{latest ? `Last: ${formatZuluDate(latest.drill_date)}` : '§139.325(h) — every 36 months'}</SubText>
      {due.date && (
        <SubText>Target: {formatZuluDate(due.date.toISOString().slice(0, 10))}</SubText>
      )}
      <CardAction href="/aep/drills" label="Schedule Drill" />
    </Card>
  )
}

function CommsCheckCard({ check, agencyCount }: { check: AepCommsCheckWithResults | null; agencyCount: number }) {
  const done = !!check?.completed_at
  const color = done ? 'var(--color-success)' : (agencyCount === 0 ? 'var(--color-text-4)' : 'var(--color-warning)')
  const exceptions = check ? check.results.filter(r => r.status !== 'loud_clear').length : 0
  return (
    <Card accent={color} label="Comms Check (This Month)">
      <Headline color={color} icon={done ? CheckCircle2 : AlertTriangle}>
        {done ? `Complete — ${exceptions === 0 ? 'all clear' : `${exceptions} exception${exceptions === 1 ? '' : 's'}`}` : 'Pending'}
      </Headline>
      <SubText>
        {done && check ? `Logged ${formatZuluDate(check.completed_at!.slice(0, 10))}` : `${agencyCount} agencies on roster`}
      </SubText>
      <CardAction href="/aep/comms-checks" label={done ? 'View Check' : 'Run Check'} />
    </Card>
  )
}

function AgencyCountCard({ count }: { count: number }) {
  const color = count > 0 ? 'var(--color-success)' : 'var(--color-warning)'
  return (
    <Card accent={color} label="Response Agencies">
      <Headline color={color} icon={count > 0 ? CheckCircle2 : Plus}>
        {count === 0 ? 'Not configured' : `${count} active`}
      </Headline>
      <SubText>{count === 0 ? 'Add the agencies the AEP coordinates with.' : 'Edit roster, add backup contacts, mark inactive.'}</SubText>
      <CardAction href="/aep/agencies" label="Manage Roster" />
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────

function Card({ accent, label, children }: {
  accent: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${accent}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        fontSize: 'var(--fs-xs)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--color-text-3)', marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  )
}

function Headline({ color, icon: Icon, children }: { color: string; icon: typeof CheckCircle2; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 'var(--fs-md)', fontWeight: 700, color,
    }}>
      <Icon size={14} /> {children}
    </div>
  )
}

function SubText({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{children}</div>
  )
}

function CardAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{
      marginTop: 6,
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 'var(--fs-xs)', fontWeight: 600,
      color: 'var(--color-accent)', textDecoration: 'none',
    }}>
      {label} <ChevronRight size={12} />
    </Link>
  )
}

function QuickLink({ href, icon: Icon, title }: { href: string; icon: typeof FileText; title: string }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: 12, borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      textDecoration: 'none', color: 'var(--color-text-1)',
      fontSize: 'var(--fs-sm)', fontWeight: 600,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
        background: 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-warning)',
      }}>
        <Icon size={14} />
      </div>
      {title}
      <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--color-text-4)' }} />
    </Link>
  )
}
