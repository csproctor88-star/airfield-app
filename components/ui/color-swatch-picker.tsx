'use client'
import { Circle } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { WIDGET_COLORS, widgetTint } from '@/lib/dashboard/widget-colors'

/**
 * Color-coding swatch: a small round trigger showing the current tint and a
 * 7-dot popover (default + 6 hues). Extracted from the dashboard's widget
 * frame so the status-board layout editor shares the exact same picker.
 */
export function ColorSwatchPicker({ color, onSetColor, ariaLabel }: {
  color?: string
  onSetColor: (key: string) => void
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close popover on outside mousedown
  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  const tint = widgetTint(color)
  const activeKey = color || 'default'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        aria-label={ariaLabel}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent',
          cursor: 'pointer', padding: 2,
        }}
      >
        {tint ? (
          <span style={{
            display: 'block', width: 12, height: 12, borderRadius: '50%',
            background: tint.swatch,
            border: `1.5px solid ${tint.borderColor}`,
            flexShrink: 0,
          }} />
        ) : (
          <Circle size={12} strokeWidth={2} color="var(--color-text-3)" />
        )}
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            zIndex: 9999,
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            display: 'flex', gap: 6, flexWrap: 'nowrap',
          }}
        >
          {WIDGET_COLORS.map(wc => {
            const isActive = wc.key === activeKey
            const itemTint = wc.hue ? widgetTint(wc.key) : null
            return (
              <button
                key={wc.key}
                onClick={(e) => {
                  e.stopPropagation()
                  onSetColor(wc.key)
                  setOpen(false)
                }}
                aria-label={wc.label}
                title={wc.label}
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: isActive
                    ? `2px solid var(--color-text-1)`
                    : `1.5px solid var(--color-border)`,
                  background: itemTint
                    ? itemTint.swatch
                    : 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  outline: 'none',
                  // For the default 'no color' swatch show a diagonal slash via gradient
                  ...(wc.key === 'default' ? {
                    background: 'linear-gradient(135deg, var(--color-bg-surface) 45%, var(--color-border) 45%, var(--color-border) 55%, var(--color-bg-surface) 55%)',
                  } : {}),
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
