'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Monitor } from 'lucide-react'
import { toast } from 'sonner'

export function KioskUrlChip({
  installationId,
  baseIcao,
  kioskTokenSet,
  onTokenChanged,
}: {
  installationId: string | null
  baseIcao: string | null
  kioskTokenSet: boolean
  onTokenChanged: () => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reveal, setReveal] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (ref.current.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const generate = async () => {
    if (!installationId || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/kiosk-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseId: installationId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error || 'Failed to generate kiosk URL')
        return
      }
      setReveal(json.token as string)
      await onTokenChanged()
      toast.success('Kiosk URL generated — copy it now')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!installationId || busy) return
    if (!confirm('Disable the kiosk URL for this base? Any bookmarked kiosk URLs will stop working.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/kiosk-token?baseId=${encodeURIComponent(installationId)}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error || 'Failed to disable kiosk URL')
        return
      }
      setReveal(null)
      await onTokenChanged()
      toast.success('Kiosk URL disabled')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!reveal || !baseIcao) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/kiosk/${baseIcao.toUpperCase()}?token=${reveal}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Kiosk URL copied to clipboard')
    } catch {
      toast.error('Copy failed — select and copy manually')
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} data-tour="kiosk-chip">
      <button
        onClick={() => setOpen(prev => !prev)}
        title={kioskTokenSet ? 'Kiosk URL is active' : 'Generate kiosk URL'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 999,
          border: `1px solid ${kioskTokenSet ? 'color-mix(in srgb, var(--color-success) 50%, transparent)' : 'var(--color-border)'}`,
          background: kioskTokenSet
            ? 'color-mix(in srgb, var(--color-success) 10%, transparent)'
            : 'var(--color-bg-inset)',
          color: kioskTokenSet ? 'var(--color-success)' : 'var(--color-text-3)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Monitor size={12} />
        Kiosk
        {kioskTokenSet && <span style={{ marginLeft: 2, fontWeight: 800 }}>●</span>}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          zIndex: 200,
          width: 320,
          padding: 12,
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
            Kiosk Display URL
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10, lineHeight: 1.5 }}>
            Auto-login URL for a read-only status board. Bookmark on a lobby display or kiosk — no credentials needed.
            {!baseIcao && (
              <>
                <br />
                <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Set the base ICAO first.</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {kioskTokenSet ? (
              <>
                <button
                  onClick={generate}
                  disabled={busy || !baseIcao}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--color-cyan)',
                    background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
                    color: 'var(--color-cyan)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >Regenerate</button>
                <button
                  onClick={disable}
                  disabled={busy}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
                    background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                    color: 'var(--color-danger)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >Disable</button>
              </>
            ) : (
              <button
                onClick={generate}
                disabled={busy || !baseIcao}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--color-cyan)',
                  background: 'var(--color-cyan)',
                  color: 'var(--color-cyan-btn-text, var(--color-bg-surface-solid))',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  cursor: busy || !baseIcao ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: !baseIcao ? 0.5 : 1,
                }}
              >Generate Kiosk URL</button>
            )}
          </div>

          {reveal && baseIcao && (
            <div style={{
              marginTop: 10,
              padding: 8,
              background: 'var(--color-bg-inset)',
              border: '1px dashed var(--color-cyan)',
              borderRadius: 6,
            }}>
              <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-cyan)', marginBottom: 4 }}>
                COPY THIS URL NOW — it won&apos;t be shown again
              </div>
              <code style={{
                display: 'block',
                padding: '4px 6px',
                background: 'var(--color-bg-surface-solid)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                fontSize: 'var(--fs-2xs)',
                color: 'var(--color-text-1)',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                marginBottom: 6,
              }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}/kiosk/{baseIcao.toUpperCase()}?token={reveal}
              </code>
              <button
                onClick={copy}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--color-cyan)',
                  background: 'var(--color-cyan)',
                  color: 'var(--color-cyan-btn-text, var(--color-bg-surface-solid))',
                  fontSize: 'var(--fs-2xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >Copy URL</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
