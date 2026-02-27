'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  onUpload: () => void
  onCapture: () => void
  disabled?: boolean
  /** 'full' = full-width block button, 'compact' = smaller inline button */
  variant?: 'full' | 'compact'
  label?: string
}

export function PhotoPickerButton({ onUpload, onCapture, disabled, variant = 'full', label }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isCompact = variant === 'compact'

  return (
    <div ref={ref} style={{ position: 'relative', display: isCompact ? 'inline-block' : 'block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        style={isCompact ? {
          padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)',
          color: 'var(--color-accent-secondary)', cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: disabled ? 0.7 : 1,
          display: 'flex', alignItems: 'center', gap: 4,
        } : {
          width: '100%', padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--color-border-active)', background: 'var(--color-border)',
          color: 'var(--color-accent)', cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: disabled ? 0.7 : 1, minHeight: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <svg width={isCompact ? 14 : 16} height={isCompact ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        {label || (disabled ? 'Uploading...' : 'Add Photo')}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: isCompact ? 'auto' : 0,
          marginBottom: 4, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-active)',
          borderRadius: 8, overflow: 'hidden', zIndex: 50, minWidth: 180,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <button
            type="button"
            onClick={() => { setOpen(false); onUpload() }}
            style={{
              width: '100%', padding: '12px 14px', border: 'none', background: 'transparent',
              color: 'var(--color-text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            Upload from Gallery
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onCapture() }}
            style={{
              width: '100%', padding: '12px 14px', border: 'none', background: 'transparent',
              color: 'var(--color-text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Capture with Camera
          </button>
        </div>
      )}
    </div>
  )
}
