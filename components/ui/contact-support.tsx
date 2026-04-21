'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { toast } from 'sonner'

const SUPPORT_EMAIL = 'info@glidepathops.com'
const SUPPORT_SUBJECT = 'Glidepath Support Request'

interface ContactSupportProps {
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export default function ContactSupport({ className, style, children }: ContactSupportProps) {
  const [open, setOpen] = useState(false)

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(SUPPORT_SUBJECT)}`
  const outlook = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(SUPPORT_EMAIL)}&subject=${encodeURIComponent(SUPPORT_SUBJECT)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      toast.success('Email address copied')
    } catch {
      toast.error('Copy failed — please select the address manually')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={{ cursor: 'pointer', fontFamily: 'inherit', ...style }}
      >
        {children}
      </button>

      {open && (
        <div
          className="modal-overlay"
          style={{ zIndex: 'var(--z-modal)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div style={{
            background: 'var(--color-bg-surface-solid, #1a1a2e)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 420,
            border: '1px solid var(--color-border-mid, #333)',
            padding: 18,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>Contact Support</div>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
              Email us and we&apos;ll get back to you within one business day.
            </div>

            <div style={{
              padding: '10px 12px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SUPPORT_EMAIL}</span>
              <button
                onClick={copy}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-cyan)', color: '#000',
                  border: 'none', fontWeight: 700, fontSize: 'var(--fs-xs)',
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}
              >Copy</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a
                href={mailto}
                onClick={() => setOpen(false)}
                style={linkStyle}
              >Open in mail app</a>
              <a
                href={gmail}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                style={linkStyle}
              >Open in Gmail</a>
              <a
                href={outlook}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                style={linkStyle}
              >Open in Outlook Web</a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const linkStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  background: 'transparent',
  border: '1px solid var(--color-border-mid)',
  color: 'var(--color-text-1)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'center',
}
