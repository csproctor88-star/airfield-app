'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { TrendingUp, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Activity } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchSpis,
  fetchLatestMeasurements,
  fetchSpiMeasurements,
  recomputeSpisNow,
  type SmsSpi,
  type SmsSpiMeasurement,
} from '@/lib/supabase/sms'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /sms/spis — Safety Performance Indicators
 *
 * Per AC 150/5200-37A §6.4: each SPI is paired with a target (SPT) and
 * an alert threshold. Trend sparkline shows the last 12 months of
 * monthly measurements; status is colour-coded (alert / warning /
 * on-target). Nightly Supabase pg_cron writes new measurements at
 * 02:30 UTC via _sms_compute_spi_measurements.
 */
export default function SmsSpisPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [spis, setSpis] = useState<SmsSpi[]>([])
  const [latest, setLatest] = useState<Map<string, SmsSpiMeasurement>>(new Map())
  const [series, setSeries] = useState<Map<string, SmsSpiMeasurement[]>>(new Map())
  const [recomputing, setRecomputing] = useState(false)

  const canWrite = has(PERM.SMS_WRITE)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    const [s, m] = await Promise.all([
      fetchSpis(installationId),
      fetchLatestMeasurements(installationId),
    ])
    setSpis(s)
    setLatest(m)
    const seriesMap = new Map<string, SmsSpiMeasurement[]>()
    await Promise.all(s.map(async (spi) => {
      const ser = await fetchSpiMeasurements(spi.id, { months: 12 })
      seriesMap.set(spi.id, ser)
    }))
    setSeries(seriesMap)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { reload() }, [reload])

  async function handleRecompute() {
    setRecomputing(true)
    const r = await recomputeSpisNow(installationId!)
    setRecomputing(false)
    if (!r.ok) { toast.error(r.error || 'Recompute failed'); return }
    toast.success(`Wrote ${r.computed ?? 0} measurement(s)`)
    reload()
  }

  if (!loaded) return <LoadingState />

  return (
    <div className="space-y-5 p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/sms" className="inline-flex items-center gap-1.5 text-sm text-muted-dark hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> SMS Dashboard
        </Link>
        {canWrite && (
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-elevated border border-border-active text-foreground hover:bg-elevated disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${recomputing ? 'animate-spin' : ''}`} />
            {recomputing ? 'Computing…' : 'Recompute Now'}
          </button>
        )}
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[color:var(--color-accent)]" /> Safety Performance Indicators
        </h1>
        <p className="text-sm text-muted-dark">
          AC 150/5200-37A §6.4 — measurable indicators of safety performance with targets and
          alert thresholds. Nightly Supabase cron writes monthly measurements; the four seeded
          indicators draw on existing module data.
        </p>
      </header>

      {spis.length === 0 ? (
        <EmptyState message="No SPIs configured. The four default indicators should appear automatically — try Recompute Now if not." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {spis.map((spi) => (
            <SpiCard
              key={spi.id}
              spi={spi}
              latest={latest.get(spi.id) ?? null}
              series={series.get(spi.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SpiCard({ spi, latest, series }: { spi: SmsSpi; latest: SmsSpiMeasurement | null; series: SmsSpiMeasurement[] }) {
  const status = latest?.status ?? 'no_data'
  const palette = STATUS_PALETTE[status]
  return (
    <div className="border rounded-lg p-4 bg-card" style={{ borderColor: palette.border }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono" style={{ color: palette.text }}>
            {spi.code}
          </div>
          <h3 className="text-sm font-semibold text-foreground">{spi.title}</h3>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-baseline gap-2 mt-3">
        <div className="text-3xl font-semibold text-foreground">
          {latest ? formatValue(latest.value, spi.unit) : '—'}
        </div>
        <div className="text-xs text-muted-darker">
          {spi.unit === 'percent' ? '%' : spi.unit === 'rate' ? '/1k ops' : ''}
        </div>
      </div>

      <div className="text-xs text-muted-darker mt-1">
        Target: {spi.target_direction === 'lower' ? '≤' : '≥'} {spi.target_value ?? '—'}{spi.unit === 'percent' ? '%' : ''}
        {spi.alert_threshold != null && (
          <> · Alert at {spi.target_direction === 'lower' ? '≥' : '≤'} {spi.alert_threshold}{spi.unit === 'percent' ? '%' : ''}</>
        )}
      </div>

      {series.length > 0 && <Sparkline data={series} target={spi.target_value} direction={spi.target_direction} />}

      {spi.description && (
        <p className="text-xs text-muted-dark mt-3 leading-relaxed">{spi.description}</p>
      )}

      {latest && (
        <p className="text-[10px] text-muted-darker mt-2">
          Last measurement: {formatZuluDate(latest.period_start)} → {formatZuluDate(latest.period_end)} · {latest.computed_by}
        </p>
      )}
    </div>
  )
}

const STATUS_PALETTE: Record<string, { text: string; border: string; bg: string; label: string }> = {
  on_target: { text: 'rgb(74,222,128)',  border: 'rgba(34,197,94,0.55)',  bg: 'rgba(34,197,94,0.10)',  label: 'On target' },
  warning:   { text: 'rgb(252,211,77)',  border: 'rgba(245,158,11,0.55)', bg: 'rgba(245,158,11,0.10)', label: 'Warning' },
  alert:     { text: 'rgb(252,165,165)', border: 'rgba(239,68,68,0.65)',  bg: 'rgba(239,68,68,0.10)',  label: 'Alert' },
  no_data:   { text: 'rgb(148,163,184)', border: 'rgba(100,116,139,0.45)', bg: 'rgba(100,116,139,0.10)', label: 'No data' },
}

function StatusBadge({ status }: { status: string }) {
  const p = STATUS_PALETTE[status] ?? STATUS_PALETTE.no_data
  const Icon = status === 'alert' ? AlertCircle : status === 'on_target' ? CheckCircle2 : Activity
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider inline-flex items-center gap-1"
      style={{ backgroundColor: p.bg, color: p.text, borderColor: p.border, border: '1px solid' }}
    >
      <Icon className="w-3 h-3" /> {p.label}
    </span>
  )
}

function formatValue(v: number, unit: string): string {
  if (unit === 'percent') return v.toFixed(1)
  if (unit === 'rate') return v.toFixed(2)
  return v.toLocaleString()
}

/**
 * Lightweight SVG sparkline. No Chart.js dependency — the AE
 * dashboard renders a row of these and the per-card variant is
 * also used here. Bar shading colours each bar by status so the
 * timeline reads at a glance.
 */
function Sparkline({ data, target, direction }: { data: SmsSpiMeasurement[]; target: number | null; direction: 'lower' | 'higher' }) {
  if (data.length === 0) return null
  const w = 280
  const h = 48
  const padding = 4
  const values = data.map(d => d.value)
  const max = Math.max(...values, target ?? 0)
  const min = Math.min(...values, target ?? 0, 0)
  const range = max - min || 1
  const barW = (w - padding * 2) / data.length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12 mt-3" preserveAspectRatio="none">
      {target != null && (
        <line
          x1={padding}
          x2={w - padding}
          y1={padding + (1 - (target - min) / range) * (h - padding * 2)}
          y2={padding + (1 - (target - min) / range) * (h - padding * 2)}
          stroke="rgba(148,163,184,0.5)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      {data.map((d, i) => {
        const x = padding + i * barW
        const y = padding + (1 - (d.value - min) / range) * (h - padding * 2)
        const palette = STATUS_PALETTE[d.status] ?? STATUS_PALETTE.no_data
        return (
          <rect
            key={d.id}
            x={x + 1}
            y={y}
            width={Math.max(barW - 2, 1)}
            height={h - padding - y}
            fill={palette.text}
            opacity={0.65}
          />
        )
      })}
    </svg>
  )
}
