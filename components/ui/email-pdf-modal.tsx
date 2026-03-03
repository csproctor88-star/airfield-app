'use client'

import { useState, useEffect, useRef } from 'react'

interface EmailPdfModalProps {
  open: boolean
  onClose: () => void
  onSend: (email: string) => Promise<void>
  sending: boolean
  filename?: string
  defaultEmail?: string | null
}

export default function EmailPdfModal({ open, onClose, onSend, sending, filename, defaultEmail }: EmailPdfModalProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const prevOpen = useRef(false)

  // Pre-fill with default email when modal opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      setEmail(defaultEmail || '')
      setError('')
    }
    prevOpen.current = open
  }, [open, defaultEmail])

  if (!open) return null

  const handleSend = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address')
      return
    }
    setError('')
    await onSend(email.trim())
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose() }}
    >
      <div
        style={{
          background: 'var(--color-bg-surface-solid, #1a1a2e)',
          borderRadius: 16, width: '100%', maxWidth: 400,
          padding: 24, border: '1px solid var(--color-border-mid, #333)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 'var(--fs-xl, 18px)', fontWeight: 800, color: 'var(--color-text-1, #fff)' }}>
            Email PDF
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            style={{
              background: 'none', border: 'none', color: 'var(--color-text-3, #888)',
              fontSize: 'var(--fs-3xl, 28px)', cursor: sending ? 'default' : 'pointer',
              padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {filename && (
          <p style={{ color: 'var(--color-text-3, #888)', fontSize: 'var(--fs-sm, 13px)', margin: '0 0 16px' }}>
            {filename}
          </p>
        )}

        <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--fs-sm, 13px)', color: 'var(--color-text-2, #ccc)', fontWeight: 600 }}>
          Recipient Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError('') }}
          placeholder="name@example.com"
          disabled={sending}
          onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSend() }}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            background: 'var(--color-bg-surface, #fff)',
            border: error ? '1px solid #ef4444' : '1px solid var(--color-border, #444)',
            color: 'var(--color-text-1, #000)', fontSize: 'var(--fs-md, 15px)',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {error && (
          <p style={{ color: '#ef4444', fontSize: 'var(--fs-xs, 11px)', margin: '4px 0 0' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            style={{
              flex: 1, padding: '10px', borderRadius: 10, textAlign: 'center',
              background: 'transparent', border: '1px solid var(--color-border, #444)',
              color: 'var(--color-text-2, #ccc)', fontSize: 'var(--fs-md, 15px)',
              fontWeight: 600, fontFamily: 'inherit', cursor: sending ? 'default' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !email.trim()}
            style={{
              flex: 1, padding: '10px', borderRadius: 10, textAlign: 'center',
              background: sending || !email.trim() ? '#A78BFA33' : '#A78BFA',
              border: '1px solid #A78BFA55',
              color: '#fff', fontSize: 'var(--fs-md, 15px)', fontWeight: 700,
              fontFamily: 'inherit', cursor: sending || !email.trim() ? 'default' : 'pointer',
            }}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
