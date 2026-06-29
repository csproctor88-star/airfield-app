'use client'
import { Settings2, X, Circle, Copy } from 'lucide-react'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { WIDGET_COLORS, widgetTint } from '@/lib/dashboard/widget-colors'

export function WidgetFrame({
  title, editing, onRemove, onConfigure, color, onSetColor, copyTargets, onCopyTo, children,
}: {
  title: string
  editing: boolean
  onRemove?: () => void
  onConfigure?: () => void
  color?: string
  onSetColor?: (color: string) => void
  copyTargets?: { id: string; name: string }[]
  onCopyTo?: (target: string) => void
  children: ReactNode
}) {
  const [swatchOpen, setSwatchOpen] = useState(false)
  const swatchRef = useRef<HTMLDivElement>(null)

  // Close popover on outside mousedown
  useEffect(() => {
    if (!swatchOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (swatchRef.current && !swatchRef.current.contains(e.target as Node)) {
        setSwatchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [swatchOpen])

  const [copyOpen, setCopyOpen] = useState(false)
  const copyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!copyOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (copyRef.current && !copyRef.current.contains(e.target as Node)) setCopyOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [copyOpen])

  const tint = widgetTint(color)
  const activeKey = color || 'default'

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: tint?.background ?? 'var(--color-bg-surface)',
      border: `1px solid ${tint?.borderColor ?? 'var(--color-border)'}`,
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px',
        borderBottom: `1px solid ${tint?.headerBorder ?? 'var(--color-border)'}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--color-text-3)',
        }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {onCopyTo && copyTargets && (
            <div ref={copyRef} style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setCopyOpen(o => !o) }}
                aria-label={`Copy ${title} to another dashboard`}
                title="Copy to another dashboard"
                style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2 }}
              >
                <Copy size={13} strokeWidth={2.5} />
              </button>
              {copyOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 9999,
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: 4, minWidth: 180,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', padding: '4px 8px' }}>Copy to…</div>
                  {copyTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); onCopyTo(t.id); setCopyOpen(false) }}
                      style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}
                    >{t.name}</button>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); onCopyTo('__new__'); setCopyOpen(false) }}
                    style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-accent)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: '6px 8px', borderRadius: 'var(--radius-sm)', borderTop: '1px solid var(--color-border)', marginTop: 2 }}
                  >＋ New dashboard…</button>
                </div>
              )}
            </div>
          )}
          {editing && (onSetColor || onConfigure || onRemove) && (
            <>
              {onSetColor && (
                <div ref={swatchRef} style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSwatchOpen(o => !o) }}
                    aria-label={`Set color for ${title}`}
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
                  {swatchOpen && (
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
                              setSwatchOpen(false)
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
              )}
              {onConfigure && (
                <button onClick={onConfigure} aria-label={`Configure ${title}`} style={{
                  display: 'flex', border: 'none', background: 'transparent',
                  cursor: 'pointer', color: 'var(--color-text-3)', padding: 2,
                }}>
                  <Settings2 size={14} strokeWidth={2.5} />
                </button>
              )}
              {onRemove && (
                <button onClick={onRemove} aria-label={`Remove ${title}`} style={{
                  display: 'flex', border: 'none', background: 'transparent',
                  cursor: 'pointer', color: 'var(--color-text-3)', padding: 2,
                }}>
                  <X size={14} strokeWidth={2.5} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {children}
      </div>
    </div>
  )
}
