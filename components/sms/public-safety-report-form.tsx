'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, ShieldAlert, Lock } from 'lucide-react'

/**
 * Public anonymous safety reporting form, routed at /[icao]/sms-report.
 *
 * Mirrors the public PPR form pattern (resolve config via SECURITY
 * DEFINER RPC by ICAO, submit via SECURITY DEFINER RPC). No auth
 * required. Anonymous by default — reporter contact fields are
 * optional and surfaced only to SMS triagers via RLS.
 *
 * Per AC 150/5200-37A §6.5.2 non-retribution is the operating
 * principle; the form copy says so explicitly.
 */

const CATEGORIES = [
  { value: 'wildlife',          label: 'Wildlife' },
  { value: 'runway_incursion',  label: 'Runway Incursion' },
  { value: 'ground_vehicle',    label: 'Ground Vehicle' },
  { value: 'aircraft',          label: 'Aircraft' },
  { value: 'fuel',              label: 'Fuel' },
  { value: 'arff',              label: 'ARFF' },
  { value: 'weather',           label: 'Weather' },
  { value: 'equipment',         label: 'Equipment' },
  { value: 'procedure',         label: 'Procedure' },
  { value: 'other',             label: 'Other' },
] as const

type Category = typeof CATEGORIES[number]['value']

type PublicConfig = {
  baseId: string
  baseName: string
  airportType: string
  moduleEnabled: boolean
}

export function PublicSafetyReportForm({ icao }: { icao: string }) {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [baseFound, setBaseFound] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ code: string } | null>(null)
  const [error, setError] = useState('')

  const [category, setCategory] = useState<Category>('other')
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [locationText, setLocationText] = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [includeContact, setIncludeContact] = useState(false)
  const [reporterName, setReporterName] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [reporterRole, setReporterRole] = useState('')

  useEffect(() => {
    if (!icao) return
    const supabase = createClient()
    if (!supabase) { setBaseFound(false); setLoading(false); return }
    ;(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcErr } = await (supabase as any).rpc(
        'get_public_safety_report_config_by_icao',
        { p_icao: icao },
      )
      if (rpcErr) {
        console.error('get_public_safety_report_config_by_icao:', rpcErr.message)
        setBaseFound(false)
        setLoading(false)
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row?.base_id) { setBaseFound(false); setLoading(false); return }
      setConfig({
        baseId: row.base_id,
        baseName: row.base_name,
        airportType: row.airport_type,
        moduleEnabled: row.module_enabled,
      })
      setLoading(false)
    })()
  }, [icao])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!config) return
    if (!description.trim()) { setError('Please describe the safety concern.'); return }
    setSubmitting(true)

    // Submit through the server route so the request is IP + base rate-limited
    // before it reaches the submit_safety_report_public RPC (the browser has no
    // server hop of its own to throttle at).
    const res = await fetch('/api/public/safety-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_id:          config.baseId,
        category,
        description:      description.trim(),
        occurred_at:      occurredAt || null,
        location_text:    locationText.trim() || null,
        immediate_action: immediateAction.trim() || null,
        reporter_name:    includeContact ? (reporterName.trim() || null) : null,
        reporter_email:   includeContact ? (reporterEmail.trim() || null) : null,
        reporter_phone:   includeContact ? (reporterPhone.trim() || null) : null,
        reporter_role:    includeContact ? (reporterRole.trim() || null) : null,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string; report_code?: string | null }
    setSubmitting(false)

    if (!res.ok) {
      setError(json.error || 'Submission failed')
      return
    }
    const code = json.report_code ?? '—'
    setSubmitted({ code })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-inset flex items-center justify-center p-4">
        <div className="text-muted-dark text-sm">Loading…</div>
      </div>
    )
  }

  if (!baseFound) {
    return (
      <div className="min-h-screen bg-inset flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">Airport not found</h1>
          <p className="text-sm text-muted-dark">
            We couldn&apos;t find an airport with ICAO <code className="font-mono">{icao}</code>.
            Verify the address and try again.
          </p>
        </div>
      </div>
    )
  }

  if (config && !config.moduleEnabled) {
    return (
      <div className="min-h-screen bg-inset flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">Reporting unavailable</h1>
          <p className="text-sm text-muted-dark">
            The Safety Management System module is not enabled at {config.baseName}. Contact
            airport operations directly for safety concerns.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-inset flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-[color:var(--color-success)] mx-auto" />
          <h1 className="text-2xl font-semibold text-foreground">Report submitted</h1>
          <p className="text-sm text-secondary">
            Your safety report has been recorded as <span className="font-mono text-[color:var(--color-success)]">{submitted.code}</span>.
            {config && <> Airport operations at {config.baseName} will review it.</>}
          </p>
          <p className="text-xs text-muted-darker">
            Per 14 CFR §139.401(c)(2), reports submitted in good faith will not result in
            disciplinary action. Thank you for helping keep the airport safe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-inset text-foreground">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-[color:var(--color-success)] mb-1">
            <ShieldAlert className="w-6 h-6" />
            <span className="text-xs uppercase tracking-wider font-medium">Safety Management System</span>
          </div>
          <h1 className="text-2xl font-semibold">Submit a Safety Report</h1>
          {config && <p className="text-sm text-muted-dark mt-0.5">{config.baseName} ({icao.toUpperCase()})</p>}
        </header>

        <div
          className="border rounded-lg p-3 mb-5 text-xs text-secondary"
          style={{
            background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
            borderColor: 'color-mix(in srgb, var(--color-success) 40%, transparent)',
          }}
        >
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-success)' }} />
            <div>
              <strong style={{ color: 'var(--color-success)' }}>Anonymous by default.</strong>{' '}
              You don&apos;t need to identify yourself. Per 14 CFR §139.401(c)(2),
              reports submitted in good faith are protected — no disciplinary action,
              no retribution. Provide contact only if you&apos;d like a follow-up.
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full mt-1 bg-card border border-border-active rounded px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">
              Description <span className="text-[color:var(--color-danger)]">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
              placeholder="What happened? Be as specific as you can — when, where, who was affected, what could go wrong next time."
              className="w-full mt-1 bg-card border border-border-active rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-dark">When did it happen?</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full mt-1 bg-card border border-border-active rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-dark">Where?</label>
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g. Taxiway A, GA ramp, hangar 3"
                className="w-full mt-1 bg-card border border-border-active rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Immediate action taken (if any)</label>
            <textarea
              value={immediateAction}
              onChange={(e) => setImmediateAction(e.target.value)}
              rows={2}
              className="w-full mt-1 bg-card border border-border-active rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeContact}
                onChange={(e) => setIncludeContact(e.target.checked)}
                className="accent-emerald-500"
              />
              <span>Include my contact info so operations can follow up</span>
            </label>
            <p className="text-xs text-muted-darker mt-1 ml-6">
              Only SMS triagers see this. It&apos;s not shared internally beyond the safety team.
            </p>
            {includeContact && (
              <div className="mt-3 space-y-3 pl-6 border-l-2 border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="Name"
                    className="w-full bg-card border border-border-active rounded px-3 py-2 text-sm"
                  />
                  <input
                    value={reporterRole}
                    onChange={(e) => setReporterRole(e.target.value)}
                    placeholder="Role / company"
                    className="w-full bg-card border border-border-active rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full bg-card border border-border-active rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="tel"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                    placeholder="Phone"
                    className="w-full bg-card border border-border-active rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div
              className="text-sm rounded p-2.5 border"
              style={{
                color: 'var(--color-danger)',
                background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-danger) 40%, transparent)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-elevated disabled:text-muted-darker text-white font-medium"
          >
            {submitting ? 'Submitting…' : 'Submit Safety Report'}
          </button>

          <p className="text-[11px] text-muted-darker text-center pt-1">
            Reports are reviewed under 14 CFR §139.401. False reports submitted in bad faith may
            result in disciplinary action. Reports submitted in good faith are protected from
            retribution.
          </p>
        </form>
      </div>
    </div>
  )
}
