'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PprFieldInput } from '@/components/ppr/ppr-field-input'
import type { PprColumnType } from '@/lib/supabase/ppr'

type PublicCol = {
  id: string
  name: string
  type: PprColumnType
  is_required: boolean
  sort_order: number
  info_text: string | null
}

type PublicConfig = {
  baseName: string
  moduleEnabled: boolean
  columns: PublicCol[]
}

const COOLDOWN_KEY_PREFIX = 'ppr_request_cooldown_'
const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Public PPR request form. Routed two ways:
 *   /ppr-request/[baseId]  — legacy UUID-based URL (backwards compat
 *                            for QR codes already in print)
 *   /[icao]/ppr-request    — short, base-aware URL (preferred)
 *
 * The route shell passes `lookup` describing how to resolve the
 * config + base UUID. Submission always goes through the existing
 * `submit_public_ppr_request(p_base_id UUID)` RPC; the ICAO path
 * resolves to a UUID via `get_public_ppr_config_by_icao` and reuses
 * the same submission flow.
 */
export type RequestFormLookup =
  | { kind: 'baseId'; value: string }
  | { kind: 'icao'; value: string }

export function PublicPprRequestForm({ lookup }: { lookup: RequestFormLookup }) {
  // After resolving, we keep the UUID for use in submission and the
  // cooldown key so per-base rate limits work even when the visitor
  // arrives via the ICAO URL.
  const [resolvedBaseId, setResolvedBaseId] = useState<string | null>(
    lookup.kind === 'baseId' ? lookup.value : null,
  )

  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [baseFound, setBaseFound] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [rateLimited, setRateLimited] = useState(false)

  // Form state
  const today = new Date().toISOString().slice(0, 10)
  const [requesterName, setRequesterName] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [arrivalDate, setArrivalDate] = useState(today)
  const [values, setValues] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!lookup.value) return

    const supabase = createClient()
    if (!supabase) {
      setBaseFound(false)
      setLoading(false)
      return
    }

    ;(async () => {
      // Both RPCs are SECURITY DEFINER; anon can call. The ICAO path
      // additionally returns the resolved base_id which we stash for
      // submission + the cooldown key.
      const rpcName = lookup.kind === 'icao' ? 'get_public_ppr_config_by_icao' : 'get_public_ppr_config'
      const args = lookup.kind === 'icao' ? { p_icao: lookup.value } : { p_base_id: lookup.value }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcErr } = await (supabase as any).rpc(rpcName, args)
      if (rpcErr) {
        console.error(`${rpcName}:`, rpcErr.message)
        setBaseFound(false)
        setLoading(false)
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row || !row.base_name) {
        setBaseFound(false)
        setLoading(false)
        return
      }

      // ICAO path returns base_id; UUID path doesn't (we already have it).
      const baseId = (row.base_id as string) || (lookup.kind === 'baseId' ? lookup.value : null)
      if (!baseId) {
        console.error('[ppr-request] Resolved no base_id from RPC', { lookup, row })
        setBaseFound(false)
        setLoading(false)
        return
      }
      // eslint-disable-next-line no-console
      console.info('[ppr-request] Resolved base', { lookup, baseId, baseName: row.base_name })
      setResolvedBaseId(baseId)

      // Cooldown is keyed on the resolved UUID so the same visitor
      // hitting both URLs is rate-limited consistently.
      const lastSubmit = localStorage.getItem(COOLDOWN_KEY_PREFIX + baseId)
      if (lastSubmit && Date.now() - parseInt(lastSubmit) < COOLDOWN_MS) {
        setRateLimited(true)
      }

      setConfig({
        baseName: row.base_name as string,
        moduleEnabled: Boolean(row.module_enabled),
        columns: ((row.columns as PublicCol[]) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
      })
      setLoading(false)
    })()
  }, [lookup.kind, lookup.value])

  const handleSubmit = async () => {
    if (!resolvedBaseId || !config || submitting) return
    setError('')

    if (!requesterName.trim()) {
      setError('Please enter your name')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(requesterEmail.trim())) {
      setError('Please enter a valid email address')
      return
    }
    if (!arrivalDate) {
      setError('Please select an arrival date')
      return
    }
    for (const c of config.columns) {
      // info_only fields take no input — never enforce required on them
      // even if the admin somehow toggled it on.
      if (c.type === 'info_only') continue
      if (c.is_required && !(values[c.id] || '').trim()) {
        setError(`"${c.name}" is required`)
        return
      }
    }

    setSubmitting(true)

    const supabase = createClient()
    if (!supabase) {
      setError('Service unavailable')
      setSubmitting(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any).rpc('submit_public_ppr_request', {
      p_base_id: resolvedBaseId,
      p_requester_name: requesterName.trim(),
      p_requester_email: requesterEmail.trim(),
      p_arrival_date: arrivalDate,
      p_column_values: values,
      p_notes: notes.trim() || null,
    })

    if (rpcErr) {
      setError(rpcErr.message || 'Submission failed')
      setSubmitting(false)
      return
    }

    // Best-effort confirmation email — failures don't block the success state,
    // since the entry is in already and AMOPS will see it on triage.
    try {
      const res = await fetch('/api/send-ppr-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseId: resolvedBaseId,
          requesterEmail: requesterEmail.trim(),
          requesterName: requesterName.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error('[ppr-request] Confirmation email API non-2xx', res.status, body)
      }
    } catch (e) {
      console.error('[ppr-request] Confirmation email fetch threw:', e)
    }

    localStorage.setItem(COOLDOWN_KEY_PREFIX + resolvedBaseId, String(Date.now()))
    setSubmitted(true)
    setSubmitting(false)
  }

  // ── Visual: shared dark inputs (mirror /feedback) ───────
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #334155', background: '#0F172A', color: '#E2E8F0',
    fontSize: 16, fontFamily: 'inherit', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 14, fontWeight: 600, color: '#94A3B8', marginBottom: 4,
  }

  if (loading) {
    return (
      <div style={shellStyle('center')}>
        <div style={{ color: '#94A3B8', fontSize: 16 }}>Loading...</div>
      </div>
    )
  }

  if (!baseFound || !config || !config.moduleEnabled) {
    const heading = !baseFound
      ? 'PPR Request Form Not Found'
      : config && !config.moduleEnabled
        ? `${config.baseName} is not accepting public PPR requests`
        : 'PPR Request Form Closed'
    const body = !baseFound
      ? 'This link does not match an active base. Check the QR code and try again.'
      : 'Please contact airfield management directly to request a Prior Permission slot.'
    return (
      <div style={shellStyle('center')}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', marginBottom: 10 }}>{heading}</div>
          <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.5 }}>{body}</div>
        </div>
      </div>
    )
  }

  if (rateLimited) {
    return (
      <div style={shellStyle('center')}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', marginBottom: 8 }}>Thanks</div>
          <div style={{ fontSize: 14, color: '#64748B' }}>
            You recently submitted a PPR request. Please wait a few minutes before submitting another, or
            contact AMOPS directly if you need to update an existing request.
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={shellStyle('center')}>
        <div style={{ textAlign: 'center', maxWidth: 460, padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: '#22C55E' }}>&#10003;</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E', marginBottom: 10 }}>Request Submitted</div>
          <div style={{ fontSize: 16, color: '#E2E8F0', lineHeight: 1.5 }}>
            {config.baseName} AMOPS has received your request and will review it.
            You will receive a separate email with your assigned PPR number once it is approved.
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: '#64748B' }}>
            A confirmation has been sent to {requesterEmail}.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', padding: '24px 16px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#E2E8F0', marginBottom: 4 }}>
            {config.baseName}
          </div>
          <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.5 }}>
            Prior Permission Required (PPR) Request
          </div>
        </div>

        <div style={{
          background: '#1E293B', border: '1px solid #334155', borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Fixed: requester name */}
          <div>
            <label style={labelStyle}>Name <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder="First Last"
              style={inputStyle}
            />
          </div>

          {/* Fixed: requester email */}
          <div>
            <label style={labelStyle}>Email <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="your.email@example.com"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              We&apos;ll send your PPR number here once AMOPS approves the request.
            </div>
          </div>

          {/* Fixed: arrival date */}
          <div>
            <label style={labelStyle}>Requested Arrival Date <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Dynamic public columns */}
          {config.columns.length > 0 && (
            <div style={{
              borderTop: '1px solid #334155', paddingTop: 12,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {config.columns.map((col) => (
                <PprFieldInput
                  key={col.id}
                  columnId={col.id}
                  columnName={col.name}
                  columnType={col.type}
                  isRequired={col.is_required}
                  value={values[col.id] || ''}
                  onChange={(v) => setValues((prev) => ({ ...prev, [col.id]: v }))}
                  infoText={col.info_text}
                  inputBackground="#0F172A"
                  inputColor="#E2E8F0"
                  inputBorder="1px solid #334155"
                />
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={labelStyle}>Additional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything AMOPS should know about your request"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '12px 0', borderRadius: 8, border: 'none',
              background: submitting ? '#334155' : 'linear-gradient(135deg, #0369A1, #22D3EE)',
              color: '#FFF', fontSize: 16, fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit PPR Request'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#475569' }}>
          Powered by Glidepath
        </div>
      </div>
    </div>
  )
}

function shellStyle(align: 'center' | 'top'): React.CSSProperties {
  return {
    minHeight: '100vh',
    background: '#0B1120',
    display: 'flex',
    alignItems: align === 'center' ? 'center' : 'flex-start',
    justifyContent: 'center',
  }
}
