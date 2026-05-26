'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ShieldAlert, FileSignature, AlertTriangle, TrendingUp,
  GitBranch, MessageSquareWarning, ClipboardCheck, Download,
  CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchAeSummary, fetchHazards, fetchSpis, fetchLatestMeasurements,
  fetchActivePolicy, fetchMocs, fetchSafetyReports, fetchAudits,
  fetchAssessments, fetchMitigations,
  BAND_COLORS,
  type SmsAeSummary,
} from '@/lib/supabase/sms'
import { LoadingState } from '@/components/ui/loading-state'
import { buildSmsManualPdf } from '@/lib/sms-pdf'
import { formatZuluDate } from '@/lib/utils'

/**
 * /sms — Accountable Executive dashboard
 *
 * Four cards — one Glance per AC 150/5200-37A pillar:
 *   1. Safety Policy   — current Y/N + effective + review due
 *   2. Hazards by band — high / medium / low / unassessed
 *   3. SPIs in alert   — count + warning + total
 *   4. Open MOCs       — count + pending approval
 *
 * Plus a one-click export of the full SMS Manual PDF for FAA Cert
 * Inspector visits.
 */
export default function SmsDashboardPage() {
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [summary, setSummary] = useState<SmsAeSummary | null>(null)
  const [exporting, setExporting] = useState(false)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    setSummary(await fetchAeSummary(installationId))
    setLoaded(true)
  }, [installationId])
  useEffect(() => { reload() }, [reload])

  async function exportManual() {
    if (!installationId) return
    setExporting(true)
    try {
      const [policy, hazards, spis, latestMeasurements, audits, mocs, reports] = await Promise.all([
        fetchActivePolicy(installationId),
        fetchHazards(installationId),
        fetchSpis(installationId),
        fetchLatestMeasurements(installationId),
        fetchAudits(installationId),
        fetchMocs(installationId),
        fetchSafetyReports(installationId),
      ])
      // Latest assessment + open mitigations across all hazards
      const assessments = (await Promise.all(hazards.map(h => fetchAssessments(h.id)))).flat()
      const mitigations = (await Promise.all(hazards.map(h => fetchMitigations(h.id)))).flat()

      const { doc, filename } = buildSmsManualPdf({
        baseName: currentInstallation?.name,
        baseIcao: currentInstallation?.icao,
        policy, hazards, assessments, mitigations,
        spis, latestMeasurements,
        audits, mocs, reports,
      })
      doc.save(filename)
      toast.success('SMS Manual exported')
    } catch (e) {
      console.error(e)
      toast.error('PDF export failed')
    }
    setExporting(false)
  }

  if (!loaded || !summary) return <LoadingState />

  return (
    <div className="space-y-5 p-4 max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-[color:var(--color-success)]" /> Safety Management System
          </h1>
          <p className="text-sm text-muted-dark mt-0.5">
            Accountable Executive overview — 14 CFR §139.401 / AC 150/5200-37A
          </p>
        </div>
        <button
          onClick={exportManual}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-elevated border border-border-active text-foreground hover:bg-elevated disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Generating…' : 'SMS Manual PDF'}
        </button>
      </header>

      {/* Four AE cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <PolicyCard summary={summary} />
        <HazardsCard summary={summary} />
        <SpisCard summary={summary} />
        <MocsCard summary={summary} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <QuickLink href="/sms/policy"   icon={FileSignature}        label="Policy" />
        <QuickLink href="/sms/hazards"  icon={AlertTriangle}        label="Hazards" />
        <QuickLink href="/sms/spis"     icon={TrendingUp}           label="SPIs" />
        <QuickLink href="/sms/reports"  icon={MessageSquareWarning} label="Reports" />
        <QuickLink href="/sms/audits"   icon={ClipboardCheck}       label="Audits" />
        <QuickLink href="/sms/moc"      icon={GitBranch}            label="MoC" />
      </div>

      {/* Public reporting hint */}
      <div
        className="border rounded-lg p-3 text-xs"
        style={{
          background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--color-success) 35%, transparent)',
        }}
      >
        <div className="font-medium mb-1" style={{ color: 'var(--color-success)' }}>
          Public Safety Reporting
        </div>
        <p className="leading-relaxed text-secondary">
          Anonymous safety reports may be submitted by anyone at{' '}
          <code className="px-1 py-0.5 rounded bg-card text-foreground">
            {typeof window !== 'undefined' ? window.location.origin : ''}/{currentInstallation?.icao?.toLowerCase() ?? 'icao'}/sms-report
          </code>{' '}
          — share this QR-friendly URL on terminal walls, ramp entrances, and AEP briefings.
        </p>
      </div>
    </div>
  )
}

function PolicyCard({ summary }: { summary: SmsAeSummary }) {
  const ok = summary.policyCurrent
  return (
    <Card
      icon={FileSignature}
      label="Safety Policy"
      tone={ok ? 'good' : 'alert'}
      href="/sms/policy"
    >
      <div className="text-3xl font-semibold flex items-center gap-2">
        {ok ? (
          <>
            <CheckCircle2 className="w-7 h-7 text-[color:var(--color-success)]" />
            <span className="text-[color:var(--color-success)]">Current</span>
          </>
        ) : (
          <>
            <XCircle className="w-7 h-7 text-[color:var(--color-danger)]" />
            <span className="text-[color:var(--color-danger)]">Missing</span>
          </>
        )}
      </div>
      {summary.policyEffectiveDate && (
        <div className="text-xs text-muted-darker mt-2">
          Effective {formatZuluDate(summary.policyEffectiveDate)}
        </div>
      )}
      {summary.policyReviewDueDate && (
        <div className="text-xs text-muted-darker">
          Review due {formatZuluDate(summary.policyReviewDueDate)}
        </div>
      )}
    </Card>
  )
}

function HazardsCard({ summary }: { summary: SmsAeSummary }) {
  const { high, medium, low, unassessed } = summary.hazardsByBand
  const tone = high > 0 ? 'alert' : medium > 0 ? 'warning' : 'good'
  return (
    <Card icon={AlertTriangle} label={`Hazards (${summary.hazardsTotal})`} tone={tone} href="/sms/hazards">
      <div className="space-y-1.5 mt-1">
        <BandRow label="High"        count={high}   band="high" />
        <BandRow label="Medium"      count={medium} band="medium" />
        <BandRow label="Low"         count={low}    band="low" />
        <BandRow label="Unassessed"  count={unassessed} band={null} />
      </div>
    </Card>
  )
}

function SpisCard({ summary }: { summary: SmsAeSummary }) {
  const tone = summary.spisInAlert > 0 ? 'alert' : summary.spisInWarning > 0 ? 'warning' : 'good'
  return (
    <Card icon={TrendingUp} label={`SPIs (${summary.spisTotal})`} tone={tone} href="/sms/spis">
      <div className="space-y-1.5 mt-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-dark inline-flex items-center gap-1"><AlertCircle className="w-3 h-3 text-[color:var(--color-danger)]" /> Alert</span>
          <span className="text-lg font-semibold text-[color:var(--color-danger)]">{summary.spisInAlert}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-dark inline-flex items-center gap-1"><AlertCircle className="w-3 h-3 text-[color:var(--color-warning)]" /> Warning</span>
          <span className="text-lg font-semibold text-[color:var(--color-warning)]">{summary.spisInWarning}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-dark inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[color:var(--color-success)]" /> On target</span>
          <span className="text-lg font-semibold text-[color:var(--color-success)]">{summary.spisTotal - summary.spisInAlert - summary.spisInWarning}</span>
        </div>
      </div>
    </Card>
  )
}

function MocsCard({ summary }: { summary: SmsAeSummary }) {
  const tone = summary.pendingMocApproval > 0 ? 'warning' : 'good'
  return (
    <Card icon={GitBranch} label="Management of Change" tone={tone} href="/sms/moc">
      <div className="space-y-1.5 mt-1">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-dark">Open MoCs</span>
          <span className="text-2xl font-semibold text-foreground">{summary.openMocs}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-dark">Awaiting your approval</span>
          <span className={`text-lg font-semibold ${summary.pendingMocApproval > 0 ? 'text-[color:var(--color-warning)]' : 'text-muted-dark'}`}>
            {summary.pendingMocApproval}
          </span>
        </div>
        {summary.openSafetyReports > 0 && (
          <div className="pt-2 mt-2 border-t border-border flex justify-between items-baseline">
            <span className="text-xs text-muted-dark">Reports to triage</span>
            <span className="text-lg font-semibold text-[color:var(--color-warning)]">{summary.openSafetyReports}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function Card({ icon: Icon, label, tone, href, children }: {
  icon: typeof FileSignature
  label: string
  tone: 'good' | 'warning' | 'alert'
  href: string
  children: React.ReactNode
}) {
  const palette = {
    good:    { border: 'rgba(34,197,94,0.40)',  bg: 'rgba(34,197,94,0.05)' },
    warning: { border: 'rgba(245,158,11,0.45)', bg: 'rgba(245,158,11,0.05)' },
    alert:   { border: 'rgba(239,68,68,0.50)',  bg: 'rgba(239,68,68,0.06)' },
  }[tone]
  return (
    <Link
      href={href}
      className="block rounded-lg p-4 transition-colors hover:bg-elevated/30"
      style={{ border: `1px solid ${palette.border}`, background: palette.bg }}
    >
      <div className="text-xs uppercase tracking-wider font-medium text-muted-dark inline-flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      {children}
    </Link>
  )
}

function BandRow({ label, count, band }: { label: string; count: number; band: 'low' | 'medium' | 'high' | null }) {
  const palette = band ? BAND_COLORS[band] : null
  return (
    <div className="flex justify-between items-center">
      <span
        className="text-xs flex items-center gap-1.5"
        style={{ color: palette?.text ?? 'rgb(148,163,184)' }}
      >
        <span className="inline-block w-2 h-2 rounded-sm" style={{ background: palette?.text ?? 'rgb(148,163,184)' }} />
        {label}
      </span>
      <span className="text-lg font-semibold" style={{ color: palette?.text ?? 'rgb(212,212,216)' }}>{count}</span>
    </div>
  )
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof FileSignature; label: string }) {
  return (
    <Link
      href={href}
      className="border border-border rounded-lg p-3 flex flex-col items-center text-center gap-1.5 hover:bg-elevated transition-colors"
    >
      <Icon className="w-5 h-5 text-secondary" />
      <span className="text-xs text-secondary">{label}</span>
    </Link>
  )
}
