'use client'

import { useState, useRef, useEffect } from 'react'

interface ExpandableTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  style?: React.CSSProperties
  label?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  style,
  label,
  onKeyDown,
}: ExpandableTextareaProps) {
  const [expanded, setExpanded] = useState(false)
  const expandedRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (expanded && expandedRef.current) {
      expandedRef.current.focus()
      // Place cursor at end
      const len = expandedRef.current.value.length
      expandedRef.current.setSelectionRange(len, len)
    }
  }, [expanded])

  return (
    <>
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={className}
          onKeyDown={onKeyDown}
          style={{
            ...style,
            paddingRight: 36,
          }}
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Expand editor"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            zIndex: 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      {/* Fullscreen overlay */}
      {expanded && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'var(--color-bg)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 'var(--fs-md)',
              fontWeight: 700,
              color: 'var(--color-text-1)',
            }}>
              {label || placeholder || 'Edit Text'}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Done
            </button>
          </div>

          {/* Full-screen textarea */}
          <textarea
            ref={expandedRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1,
              width: '100%',
              padding: '16px',
              border: 'none',
              background: 'var(--color-bg-inset)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--fs-lg)',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}
    </>
  )
}
