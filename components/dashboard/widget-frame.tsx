'use client'
import { Settings2, X, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { widgetTint } from '@/lib/dashboard/widget-colors'
import { ColorSwatchPicker } from '@/components/ui/color-swatch-picker'

export function WidgetFrame({
  title, editing, onRemove, onConfigure, color, onSetColor, copyTargets, onCopyTo,
  collapsed, onToggleCollapse, children,
}: {
  title: string
  editing: boolean
  onRemove?: () => void
  onConfigure?: () => void
  color?: string
  onSetColor?: (color: string) => void
  copyTargets?: { id: string; name: string }[]
  onCopyTo?: (target: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  children: ReactNode
}) {
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyHover, setCopyHover] = useState(false)
  const [copyPos, setCopyPos] = useState<{ top: number; right: number } | null>(null)
  const copyBtnRef = useRef<HTMLButtonElement>(null)
  const copyMenuRef = useRef<HTMLDivElement>(null)

  // Open the copy menu as a portal anchored to the trigger button, so it
  // escapes the frame's overflow:hidden (and react-grid-layout's transform,
  // which a plain z-index/fixed popover can't escape).
  function toggleCopyMenu() {
    if (copyOpen) { setCopyOpen(false); return }
    const r = copyBtnRef.current?.getBoundingClientRect()
    if (r) setCopyPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    setCopyOpen(true)
  }

  useEffect(() => {
    if (!copyOpen) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (copyBtnRef.current?.contains(t) || copyMenuRef.current?.contains(t)) return
      setCopyOpen(false)
    }
    function close() { setCopyOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true) // capture: catches scroll containers too
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [copyOpen])

  const tint = widgetTint(color)

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
          {onToggleCollapse && !editing && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
              aria-label={collapsed ? `Expand ${title}` : `Minimize ${title}`}
              title={collapsed ? 'Expand' : 'Minimize'}
              style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2 }}
            >
              {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
            </button>
          )}
          {onCopyTo && copyTargets && (
            <>
              <button
                ref={copyBtnRef}
                onClick={(e) => { e.stopPropagation(); toggleCopyMenu() }}
                onMouseEnter={() => setCopyHover(true)}
                onMouseLeave={() => setCopyHover(false)}
                aria-label={`Copy ${title} to another dashboard`}
                title="Copy to another dashboard"
                style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: copyHover ? 'var(--color-text-1)' : 'var(--color-text-3)', padding: 2 }}
              >
                <Copy size={13} strokeWidth={2.5} />
              </button>
              {copyOpen && copyPos && createPortal(
                <div
                  ref={copyMenuRef}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed', top: copyPos.top, right: copyPos.right, zIndex: 9999,
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: 4, minWidth: 180, maxWidth: 280,
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
                  >+ New dashboard…</button>
                </div>,
                document.body,
              )}
            </>
          )}
          {editing && (onSetColor || onConfigure || onRemove) && (
            <>
              {onSetColor && (
                <ColorSwatchPicker color={color} onSetColor={onSetColor} ariaLabel={`Set color for ${title}`} />
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
      {!collapsed && (
        <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
          {children}
        </div>
      )}
    </div>
  )
}
