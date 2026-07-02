'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, Plus, Search, Filter, Download } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { fetchHazards, createHazard, type SmsHazard, type SmsHazardSourceType, type SmsHazardStatus, BAND_COLORS } from '@/lib/supabase/sms'
import { BandChip } from '@/components/sms/risk-matrix'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /sms/hazards — Hazard Register
 *
 * Lists every hazard identified at this base with the current and
 * residual risk band chips. Quick-add modal mints a hazard with the
 * three required fields per the small-airport UX guardrails (title +
 * description + risk owner). Filters narrow by status + source +
 * band. CSV export hits the dedicated formatter in lib/sms-pdf.
 */
// Source types that can arrive via the prefill_source query param. Map
// arbitrary inbound values to a recognised SmsHazardSourceType (DB
// CHECK enforces the canonical set); 'whmp' is the live deep-link
// caller today via lib/supabase/whmp.ts buildSmsHazardPromoteUrl.
const PREFILL_SOURCE_WHITELIST: ReadonlyArray<SmsHazardSourceType> = [
  'whmp', 'discrepancy', 'inspection', 'wildlife_strike',
  'safety_report', 'audit', 'moc', 'reg_review', 'other',
]

export default function SmsHazardsPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<SmsHazard[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SmsHazardStatus>('all')
  const [bandFilter, setBandFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'unassessed'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', description: '' })
  const [prefillSource, setPrefillSource] = useState<{ source_type: SmsHazardSourceType; source_ref_id: string | null } | null>(null)
  const [saving, setSaving] = useState(false)

  const canWrite = has(PERM.SMS_WRITE)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    const data = await fetchHazards(installationId)
    setRows(data)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { reload() }, [reload])

  // Prefill-from-query-params handler. Callers like the WHMP "Promote
  // to SMS Hazard" deep-link (lib/supabase/whmp.ts buildSmsHazardPromoteUrl)
  // land here with prefill_title / prefill_description / prefill_source /
  // prefill_source_ref_id populated. Auto-open the Add modal, populate
  // the draft, remember the source for createHazard, then strip the
  // params so a refresh doesn't re-open the modal.
  useEffect(() => {
    const title = searchParams.get('prefill_title')
    if (!title) return
    if (!canWrite) {
      toast.error('You do not have permission to create SMS hazards')
      router.replace('/sms/hazards')
      return
    }
    const description = searchParams.get('prefill_description') ?? ''
    const rawSource = searchParams.get('prefill_source')
    const sourceRefId = searchParams.get('prefill_source_ref_id')
    const source_type: SmsHazardSourceType =
      rawSource && (PREFILL_SOURCE_WHITELIST as readonly string[]).includes(rawSource)
        ? (rawSource as SmsHazardSourceType)
        : 'other'
    setDraft({ title, description })
    setPrefillSource({ source_type, source_ref_id: sourceRefId || null })
    setAddOpen(true)
    router.replace('/sms/hazards')
  }, [searchParams, router, canWrite])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((h) => {
      if (statusFilter !== 'all' && h.status !== statusFilter) return false
      const band = h.residual_band || h.current_band
      if (bandFilter === 'unassessed') { if (band) return false }
      else if (bandFilter !== 'all') { if (band !== bandFilter) return false }
      if (q) {
        const hay = `${h.hazard_code} ${h.title} ${h.description ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, query, statusFilter, bandFilter])

  async function handleAdd() {
    if (!installationId) return
    if (!draft.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const r = await createHazard({
      base_id: installationId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      source_type: prefillSource?.source_type,
      source_ref_id: prefillSource?.source_ref_id ?? null,
    })
    setSaving(false)
    if (!r.ok || !r.hazard) { toast.error(r.error || 'Insert failed'); return }
    toast.success(`Hazard ${r.hazard.hazard_code} created`)
    setAddOpen(false)
    setDraft({ title: '', description: '' })
    setPrefillSource(null)
    reload()
  }

  function closeAdd() {
    setAddOpen(false)
    setPrefillSource(null)
    setDraft({ title: '', description: '' })
  }

  async function exportCsv() {
    if (rows.length === 0) { toast.info('Nothing to export'); return }
    const { hazardRegisterToCsv, downloadBlob } = await import('@/lib/sms-pdf')
    const csv = hazardRegisterToCsv(rows)
    downloadBlob(csv, 'hazard-register.csv', 'text/csv;charset=utf-8')
  }

  if (!loaded) return <LoadingState />

  const counts = {
    high: rows.filter(h => (h.residual_band || h.current_band) === 'high').length,
    medium: rows.filter(h => (h.residual_band || h.current_band) === 'medium').length,
    low: rows.filter(h => (h.residual_band || h.current_band) === 'low').length,
    unassessed: rows.filter(h => !(h.residual_band || h.current_band)).length,
  }

  return (
    <div className="space-y-4 p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/sms" className="inline-flex items-center gap-1.5 text-sm text-muted-dark hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> SMS Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-elevated border border-border-active text-foreground hover:bg-elevated"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          {canWrite && (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-amber-600/20 border border-amber-600/50 text-[color:var(--color-warning)] hover:bg-amber-600/30"
            >
              <Plus className="w-4 h-4" /> Add Hazard
            </button>
          )}
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-[color:var(--color-warning)]" /> Hazard Register
        </h1>
        <p className="text-sm text-muted-dark">
          AC 150/5200-37A §6.3 — every identified hazard, its current and residual risk position,
          and the mitigation plan tracking it to closure.
        </p>
      </header>

      {/* Band summary strip */}
      <div className="grid grid-cols-4 gap-2">
        <BandTile label="High Risk" count={counts.high} band="high" />
        <BandTile label="Medium"    count={counts.medium} band="medium" />
        <BandTile label="Low"       count={counts.low} band="low" />
        <BandTile label="Unassessed" count={counts.unassessed} band={null} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-darker" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hazards…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-card border border-border-active rounded text-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | SmsHazardStatus)}
          className="text-sm bg-card border border-border-active rounded px-2 py-1.5 text-foreground"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="controlled">Controlled</option>
          <option value="closed">Closed</option>
          <option value="duplicate">Duplicate</option>
        </select>
        <select
          value={bandFilter}
          onChange={(e) => setBandFilter(e.target.value as 'all' | 'low' | 'medium' | 'high' | 'unassessed')}
          className="text-sm bg-card border border-border-active rounded px-2 py-1.5 text-foreground"
        >
          <option value="all">All bands</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="unassessed">Unassessed</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          message={
            rows.length === 0
              ? 'No hazards recorded yet. Use Add Hazard to capture the first hazard, or promote one from a discrepancy or safety report.'
              : 'No hazards match your filters.'
          }
        />
      ) : (
        <div className="border border-border-active rounded-lg overflow-hidden">
          {filtered.map((h) => {
            const band = (h.residual_band || h.current_band) as 'low' | 'medium' | 'high' | null
            return (
              <Link
                key={h.id}
                href={`/sms/hazards/${h.id}`}
                className="block px-3 py-2.5 border-b border-border last:border-0 hover:bg-elevated transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-dark">{h.hazard_code}</span>
                      <span className="text-sm font-medium text-foreground truncate">{h.title}</span>
                      <BandChip band={band} />
                      <StatusPill status={h.status} />
                    </div>
                    {h.description && (
                      <p className="text-xs text-muted-dark mt-1 line-clamp-2">{h.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-darker uppercase tracking-wider">Identified</div>
                    <div className="text-xs text-secondary">{formatZuluDate(h.identified_at.slice(0, 10))}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Quick-add modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeAdd}>
          <div className="bg-card border border-border-active rounded-lg p-5 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">Add Hazard</h2>
              {prefillSource && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-sky-500/15 text-sky-700">
                  Pre-filled from {prefillSource.source_type === 'whmp' ? 'WHMP' : prefillSource.source_type.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-dark">
              Capture the hazard now; assess likelihood / severity and define mitigations on the
              detail page after.
            </p>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-dark">Title *</label>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Geese flocking near approach end of RWY 27"
                className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-dark">Description</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                placeholder="What's the hazard? Where? When does it surface?"
                className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeAdd} className="px-3 py-1.5 rounded text-sm bg-elevated hover:bg-elevated text-secondary">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 rounded text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-elevated text-white">
                {saving ? 'Adding…' : 'Add Hazard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BandTile({ label, count, band }: { label: string; count: number; band: 'low' | 'medium' | 'high' | null }) {
  if (band) {
    const p = BAND_COLORS[band]
    return (
      <div
        className="border rounded p-2.5"
        style={{ backgroundColor: p.bg, borderColor: p.border, color: p.text }}
      >
        <div className="text-[10px] uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-semibold">{count}</div>
      </div>
    )
  }
  return (
    <div className="border border-border-active rounded p-2.5 bg-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-dark">{label}</div>
      <div className="text-2xl font-semibold text-secondary">{count}</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, { bg: string; text: string; label: string }> = {
    open:         { bg: 'rgba(239,68,68,0.15)',  text: 'rgb(185,28,28)', label: 'Open' },
    under_review: { bg: 'rgba(245,158,11,0.15)', text: 'rgb(180,83,9)', label: 'Review' },
    controlled:   { bg: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', text: 'rgb(3,105,161)', label: 'Controlled' },
    closed:       { bg: 'rgba(34,197,94,0.15)',  text: 'rgb(21,128,61)', label: 'Closed' },
    duplicate:    { bg: 'rgba(100,116,139,0.18)', text: 'rgb(71,85,105)', label: 'Duplicate' },
  }
  const p = palette[status] ?? palette.open
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
      style={{ backgroundColor: p.bg, color: p.text }}
    >
      {p.label}
    </span>
  )
}
