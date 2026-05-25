'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MessageSquareWarning, ArrowLeft, X, ShieldAlert, EyeOff, ExternalLink } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchSafetyReports, updateSafetyReportTriage, promoteSafetyReportToHazard,
  type SmsSafetyReport, type SmsSafetyReportTriageStatus,
} from '@/lib/supabase/sms'
import { formatZuluDateTime } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /sms/reports — Safety Report triage queue
 *
 * Public anonymous submissions land at triage_status='new'. Holders of
 * sms:triage_reports route them to:
 *   • reviewing — under analysis, not yet promoted/closed
 *   • promoted  — became an SMS hazard via the RPC
 *   • closed_no_action / duplicate — no further treatment needed
 *
 * Reporter contact (when provided) is visible only to triagers — RLS
 * already gates the table on sms:read so this is enforced server-side.
 */
export default function SmsReportsPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canTriage = has(PERM.SMS_TRIAGE_REPORTS) || has(PERM.SMS_WRITE)
  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<SmsSafetyReport[]>([])
  const [filter, setFilter] = useState<'all' | SmsSafetyReportTriageStatus>('all')
  const [editing, setEditing] = useState<SmsSafetyReport | null>(null)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    setRows(await fetchSafetyReports(installationId))
    setLoaded(true)
  }, [installationId])
  useEffect(() => { reload() }, [reload])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter(r => r.triage_status === filter)
  }, [rows, filter])

  const newCount = rows.filter(r => r.triage_status === 'new').length

  if (!loaded) return <LoadingState />

  return (
    <div className="space-y-5 p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/sms" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="w-4 h-4" /> SMS Dashboard
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2">
          <MessageSquareWarning className="w-6 h-6 text-amber-400" /> Safety Reports
          {newCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-600/20 border border-amber-600/50 text-amber-300">
              {newCount} new
            </span>
          )}
        </h1>
        <p className="text-sm text-zinc-400">
          Anonymous public submissions arrive here for triage. Per AC 150/5200-37A §6.5.2,
          non-retribution is critical — reporter contact details (when present) are visible
          only to SMS triagers and never to the public.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterPill label="All"          active={filter === 'all'}              onClick={() => setFilter('all')} />
        <FilterPill label="New"          active={filter === 'new'}              onClick={() => setFilter('new')} />
        <FilterPill label="Reviewing"    active={filter === 'reviewing'}        onClick={() => setFilter('reviewing')} />
        <FilterPill label="Promoted"     active={filter === 'promoted'}         onClick={() => setFilter('promoted')} />
        <FilterPill label="Closed"       active={filter === 'closed_no_action'} onClick={() => setFilter('closed_no_action')} />
        <FilterPill label="Duplicates"   active={filter === 'duplicate'}        onClick={() => setFilter('duplicate')} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={
            rows.length === 0
              ? 'No safety reports yet. Public submissions to /[icao]/sms-report will land here for triage.'
              : 'No reports match this filter.'
          }
        />
      ) : (
        <div className="border border-zinc-700 rounded-lg overflow-hidden">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setEditing(r)}
              className="w-full text-left px-3 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-zinc-400">{r.report_code}</span>
                    <CategoryChip cat={r.category} />
                    <TriagePill status={r.triage_status} />
                    {r.is_anonymous ? (
                      <span className="text-[10px] text-zinc-500 inline-flex items-center gap-0.5">
                        <EyeOff className="w-3 h-3" /> Anonymous
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400">From {r.reporter_name || r.reporter_email}</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-200 mt-1 line-clamp-2">{r.description}</p>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Submitted {formatZuluDateTime(r.submitted_at)}
                    {r.occurred_at && ` · Occurred ${formatZuluDateTime(r.occurred_at)}`}
                    {r.location_text && ` · ${r.location_text}`}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && installationId && (
        <ReportDetailModal
          report={editing}
          baseId={installationId}
          canTriage={canTriage}
          onClose={() => setEditing(null)}
          onChanged={() => { setEditing(null); reload() }}
        />
      )}
    </div>
  )
}

function ReportDetailModal({ report, baseId, canTriage, onClose, onChanged }: {
  report: SmsSafetyReport
  baseId: string
  canTriage: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [triageNotes, setTriageNotes] = useState(report.triage_notes ?? '')
  const [busy, setBusy] = useState(false)

  async function setStatus(next: SmsSafetyReportTriageStatus) {
    setBusy(true)
    const r = await updateSafetyReportTriage({
      reportId: report.id, baseId,
      triage_status: next, triage_notes: triageNotes.trim() || null,
    })
    setBusy(false)
    if (!r.ok) { toast.error(r.error || 'Update failed'); return }
    toast.success(`Status → ${next.replace('_', ' ')}`)
    onChanged()
  }

  async function promote() {
    setBusy(true)
    const r = await promoteSafetyReportToHazard({
      reportId: report.id, baseId,
      title: report.description.slice(0, 80),
      description: report.description,
      triageNotes: triageNotes.trim() || null,
    })
    setBusy(false)
    if (!r.ok || !r.hazardId) { toast.error(r.error || 'Promote failed'); return }
    toast.success('Promoted to hazard')
    window.location.href = `/sms/hazards/${r.hazardId}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 max-w-2xl w-full space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between sticky top-0 bg-zinc-900 pb-2 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{report.report_code}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <CategoryChip cat={report.category} />
              <TriagePill status={report.triage_status} />
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-zinc-400 hover:text-zinc-200" /></button>
        </div>

        <div className="space-y-3 text-sm">
          <Field label="Description"><p className="text-zinc-200 whitespace-pre-wrap">{report.description}</p></Field>
          {report.immediate_action && <Field label="Immediate Action Taken"><p className="text-zinc-200 whitespace-pre-wrap">{report.immediate_action}</p></Field>}

          <div className="grid grid-cols-2 gap-3">
            {report.occurred_at && <Field label="Occurred"><span className="text-zinc-200">{formatZuluDateTime(report.occurred_at)}</span></Field>}
            <Field label="Submitted"><span className="text-zinc-200">{formatZuluDateTime(report.submitted_at)}</span></Field>
            {report.location_text && <Field label="Location"><span className="text-zinc-200">{report.location_text}</span></Field>}
            <Field label="Source"><span className="text-zinc-200">{report.source.replace('_', ' ')}</span></Field>
          </div>

          {!report.is_anonymous && (
            <div className="border-l-2 border-amber-600/50 pl-3 py-1 bg-amber-950/10">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Reporter (confidential — visible to triagers only)</div>
              <div className="text-zinc-200">
                {report.reporter_name && <div>{report.reporter_name}</div>}
                {report.reporter_role && <div className="text-zinc-400">{report.reporter_role}</div>}
                {report.reporter_email && <div className="text-xs text-zinc-400">{report.reporter_email}</div>}
                {report.reporter_phone && <div className="text-xs text-zinc-400">{report.reporter_phone}</div>}
              </div>
            </div>
          )}
        </div>

        {canTriage && (
          <>
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-400">Triage Notes</label>
              <textarea
                value={triageNotes}
                onChange={(e) => setTriageNotes(e.target.value)}
                rows={3}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
              {report.triage_status === 'new' && (
                <button onClick={() => setStatus('reviewing')} disabled={busy} className="px-3 py-1.5 rounded text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200">
                  Mark Reviewing
                </button>
              )}
              {report.triage_status !== 'promoted' && (
                <button onClick={promote} disabled={busy} className="px-3 py-1.5 rounded text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white inline-flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Promote to Hazard
                </button>
              )}
              <button onClick={() => setStatus('closed_no_action')} disabled={busy} className="px-3 py-1.5 rounded text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300">Close — No Action</button>
              <button onClick={() => setStatus('duplicate')} disabled={busy} className="px-3 py-1.5 rounded text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300">Duplicate</button>
            </div>
          </>
        )}

        {report.promoted_hazard_id && (
          <Link href={`/sms/hazards/${report.promoted_hazard_id}`} className="text-sm text-sky-400 hover:text-sky-300 inline-flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> View linked hazard
          </Link>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">{label}</div>
      {children}
    </div>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs uppercase tracking-wider border ${active ? 'bg-zinc-700 border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
    >
      {label}
    </button>
  )
}

function CategoryChip({ cat }: { cat: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider bg-zinc-700/40 text-zinc-300">
      {cat.replace('_', ' ')}
    </span>
  )
}

function TriagePill({ status }: { status: string }) {
  const palette: Record<string, { bg: string; text: string; label: string }> = {
    new:              { bg: 'rgba(245,158,11,0.15)', text: 'rgb(252,211,77)', label: 'New' },
    reviewing:        { bg: 'rgba(56,189,248,0.15)', text: 'rgb(125,211,252)', label: 'Reviewing' },
    promoted:         { bg: 'rgba(168,85,247,0.15)', text: 'rgb(216,180,254)', label: 'Promoted' },
    closed_no_action: { bg: 'rgba(100,116,139,0.18)', text: 'rgb(148,163,184)', label: 'Closed' },
    duplicate:        { bg: 'rgba(100,116,139,0.18)', text: 'rgb(148,163,184)', label: 'Duplicate' },
  }
  const p = palette[status] ?? palette.new
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
          style={{ backgroundColor: p.bg, color: p.text }}>
      {p.label}
    </span>
  )
}
