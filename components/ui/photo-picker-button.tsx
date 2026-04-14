'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  onUpload: () => void
  onCapture?: () => void
  disabled?: boolean
  /** 'full' = full-width block button, 'compact' = smaller inline button */
  variant?: 'full' | 'compact'
  label?: string
}

export function PhotoPickerButton({ onUpload, onCapture, disabled, variant = 'full', label }: Props) {
  const isCompact = variant === 'compact'
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menuOpen])

  const handleClick = () => {
    if (onCapture) {
      setMenuOpen((v) => !v)
    } else {
      onUpload()
    }
  }

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      style={isCompact ? {
        padding: '5px 10px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 600,
        border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)',
        color: 'var(--color-accent-secondary)', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.7 : 1,
        display: 'flex', alignItems: 'center', gap: 4,
      } : {
        width: '100%', padding: 10, borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 600,
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
  )

  if (!onCapture) return button

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: isCompact ? 'auto' : '100%' }}>
      {button}
      {menuOpen && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: isCompact ? 'auto' : 0,
            zIndex: 50, minWidth: isCompact ? 180 : undefined,
            background: 'var(--color-bg-surface-solid, #1a1a2e)',
            border: '1px solid var(--color-border-mid, #333)',
            borderRadius: 10, padding: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}
        >
          <MenuItem
            label="Take Photo"
            iconPath="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
            onClick={() => { setMenuOpen(false); onCapture() }}
          />
          <MenuItem
            label="Upload from Library"
            iconPath="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
            onClick={() => { setMenuOpen(false); onUpload() }}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, iconPath, onClick }: { label: string; iconPath: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '10px 12px', borderRadius: 6,
        background: 'transparent', border: 'none',
        color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-inset)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
      {label}
    </button>
  )
}
