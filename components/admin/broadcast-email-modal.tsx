'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { USER_ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'
import { renderSafeMarkdown } from '@/lib/email/safe-markdown'
import { BROADCAST_SENDERS, DEFAULT_SENDER } from '@/lib/email/broadcast-senders'

interface Props {
  onClose: () => void
  bases: Array<{ id: string; name: string }>
  callerName: string
}

const API = '/api/admin/broadcast-email'

export function BroadcastEmailModal({ onClose, bases, callerName }: Props) {
  const [from, setFrom] = useState(DEFAULT_SENDER.email)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [baseIds, setBaseIds] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  const filters = useMemo(
    () => ({ baseIds: baseIds.length ? baseIds : undefined, roles: roles.length ? roles : undefined }),
    [baseIds, roles],
  )

  // Live recipient count (debounced) whenever filters change.
  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'count', filters }),
        })
        const json = await res.json()
        if (alive && res.ok) setCount(json.recipientCount)
      } catch {
        /* ignore count errors */
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [filters])

  const previewHtml = useMemo(() => renderSafeMarkdown(body), [body])

  function insert(token: string, wrap = false) {
    const el = msgRef.current
    if (!el) {
      setBody((b) => b + token)
      return
    }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const sel = body.slice(start, end)
    const next = wrap
      ? body.slice(0, start) + token + sel + token + body.slice(end)
      : body.slice(0, start) + token + body.slice(start)
    setBody(next)
    requestAnimationFrame(() => el.focus())
  }

  const roleOptions = Object.entries(USER_ROLES).map(([key, cfg]) => ({
    value: key as UserRole,
    label: (cfg as { label: string }).label,
  }))

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function post(mode: 'test' | 'send') {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and message are required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, filters, subject, body, from }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Send failed')
        return
      }
      if (mode === 'test') {
        toast.success('Test sent to your inbox.')
      } else {
        toast.success(`Sent to ${json.sent} user${json.sent === 1 ? '' : 's'}${json.failed ? ` · ${json.failed} failed` : ''}.`)
        onClose()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 4 }}>Email all users</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 16 }}>
          {count === null ? 'Counting recipients…' : `This will email ${count} active user${count === 1 ? '' : 's'}.`}
        </div>

        <label className="section-label" htmlFor="bc-from">From</label>
        <select id="bc-from" className="input-dark" style={{ width: '100%', marginBottom: 12 }} value={from} onChange={(e) => setFrom(e.target.value)}>
          {BROADCAST_SENDERS.map((s) => (
            <option key={s.email} value={s.email}>{s.name} — {s.email}</option>
          ))}
        </select>
        <label className="section-label" htmlFor="bc-subject">Subject</label>
        <input id="bc-subject" className="input-dark" style={{ width: '100%', marginBottom: 12 }} value={subject} onChange={(e) => setSubject(e.target.value)} />

        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => insert('## ')} className="chip">Header</button>
          <button type="button" onClick={() => insert('**', true)} className="chip">Bold</button>
          <button type="button" onClick={() => insert('*', true)} className="chip">Italic</button>
          <button type="button" onClick={() => insert('- ')} className="chip" aria-label="Bullet list">Bullet</button>
          <button type="button" onClick={() => insert('1. ')} className="chip" aria-label="Numbered list">Numbered</button>
        </div>
        <label className="section-label" htmlFor="bc-body">Message</label>
        <textarea id="bc-body" ref={msgRef} className="input-dark" style={{ width: '100%', minHeight: 160, marginBottom: 12, fontFamily: 'inherit' }} value={body} onChange={(e) => setBody(e.target.value)} />

        <div style={{ marginBottom: 12 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Preview</div>
          <div data-testid="broadcast-preview" style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, background: '#ffffff', color: '#0f172a' }} dangerouslySetInnerHTML={{ __html: `<p>Hello ${callerName || 'there'},</p>` + previewHtml }} />
        </div>

        <button type="button" className="chip" onClick={() => setShowFilters((v) => !v)} style={{ marginBottom: 8 }}>
          {showFilters ? 'Hide filters' : 'Filter recipients (optional)'}
        </button>
        {showFilters && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div className="section-label">Bases</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {bases.map((b) => (
                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)' }}>
                  <input type="checkbox" checked={baseIds.includes(b.id)} onChange={() => toggle(baseIds, setBaseIds, b.id)} /> {b.name}
                </label>
              ))}
            </div>
            <div className="section-label">Roles</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roleOptions.map((r) => (
                <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)' }}>
                  <input type="checkbox" checked={roles.includes(r.value)} onChange={() => toggle(roles, setRoles, r.value)} /> {r.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={onClose} className="chip" disabled={busy}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => post('test')} className="chip" disabled={busy}>Send test to myself</button>
            <button type="button" onClick={() => setConfirming(true)} className="btn-primary" disabled={busy || !count}>
              Send to {count ?? 0}
            </button>
          </div>
        </div>

        {confirming && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 401, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="card" style={{ maxWidth: 380, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Send to {count} users?</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 16 }}>“{subject}” — this cannot be undone.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="chip" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
                <button type="button" className="btn-primary" onClick={() => post('send')} disabled={busy}>Confirm send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
