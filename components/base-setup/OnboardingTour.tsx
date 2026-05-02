'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type TourStep = {
  id: string
  anchor?: string                       // data-tour value to anchor to; null = center
  title: string
  body: string
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Base Setup',
    body:
      'This wizard configures everything Glidepath needs to fit your installation. ' +
      'It takes about 30–60 minutes the first time. You can pause and resume at any step ' +
      '— your work auto-saves.',
  },
  {
    id: 'stepper',
    anchor: 'stepper-rail',
    title: 'Labeled stepper',
    body:
      'Each pill is one configuration area. Click any pill to jump to that step, ' +
      'or use the Next button at the bottom to move through in order.',
  },
  {
    id: 'guide',
    anchor: 'guide-panel',
    title: 'Per-step Guide',
    body:
      'The Guide panel on the right of every step explains what it does, why it matters, ' +
      'and the DAFMAN paragraph it satisfies. Open it any time you are unsure what to enter.',
  },
  {
    id: 'fieldhint',
    title: '(?) Field hints',
    body:
      'Inside each step, look for the (?) icon next to field labels. Hover or click it for ' +
      'a concrete example of what goes there.',
  },
  {
    id: 'autosave',
    anchor: 'autosave-pill',
    title: 'Auto-save indicator',
    body:
      'Your edits save automatically. The pill in the bottom-left confirms the last save ' +
      'and warns you if something fails to persist.',
  },
  {
    id: 'quicksetup',
    anchor: 'quick-setup-button',
    title: 'Quick Setup',
    body:
      'For typical configurations, Quick Setup pre-fills defaults from ICAO data and DAFMAN ' +
      'templates across 5 of the 16 steps. You will review every pre-filled step before it ' +
      'commits — nothing writes to your live tables without your explicit confirmation.',
  },
]

type AnchorRect = { top: number; left: number; width: number; height: number } | null

function readAnchorRect(anchorId: string | undefined): AnchorRect {
  if (!anchorId || typeof window === 'undefined') return null
  const el = document.querySelector<HTMLElement>(`[data-tour="${anchorId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height }
}

export function OnboardingTour({
  active,
  onDismiss,
}: {
  active: boolean
  onDismiss: (reason: 'completed' | 'skipped') => void
}) {
  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect] = useState<AnchorRect>(null)
  const step = TOUR_STEPS[stepIdx]

  useEffect(() => {
    if (!active) return
    const update = () => setRect(readAnchorRect(step?.anchor))
    update()
    // Re-measure on resize, scroll, layout shift
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const id = window.setTimeout(update, 60) // give layout one tick to settle
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.clearTimeout(id)
    }
  }, [active, step?.anchor, stepIdx])

  // Scroll the anchor into view at the start of each step
  useEffect(() => {
    if (!active || !step?.anchor) return
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [active, step?.anchor])

  if (!active || !step) return null

  const isCentered = !step.anchor || !rect
  const isLast = stepIdx === TOUR_STEPS.length - 1

  // Bubble position: just below the anchor (or centered if no anchor / not found)
  const bubbleStyle: React.CSSProperties = isCentered
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 380,
      }
    : (() => {
        const padding = 12
        const top = (rect?.top ?? 0) + (rect?.height ?? 0) + padding
        const wantedLeft = (rect?.left ?? 0) + (rect?.width ?? 0) / 2 - 190
        const maxLeft = (typeof window !== 'undefined' ? window.scrollX + window.innerWidth : 0) - 380 - 12
        const minLeft = (typeof window !== 'undefined' ? window.scrollX : 0) + 12
        const left = Math.max(minLeft, Math.min(wantedLeft, maxLeft))
        return {
          position: 'absolute',
          top,
          left,
          width: 380,
        }
      })()

  return (
    <>
      {/* Dim overlay (cuts a hole around the anchor by drawing the spotlight border on top) */}
      <div
        onClick={() => onDismiss('skipped')}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 9000,
          pointerEvents: 'auto',
        }}
      />

      {/* Spotlight ring around the anchor */}
      {!isCentered && rect && (
        <div
          style={{
            position: 'absolute',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            border: '2px solid var(--color-cyan)',
            borderRadius: 12,
            boxShadow: '0 0 0 4px color-mix(in srgb, var(--color-cyan) 35%, transparent)',
            pointerEvents: 'none',
            zIndex: 9001,
          }}
        />
      )}

      {/* Bubble */}
      <div
        style={{
          ...bubbleStyle,
          zIndex: 9002,
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid color-mix(in srgb, var(--color-cyan) 40%, transparent)',
          borderRadius: 12,
          padding: 18,
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 800, color: 'var(--color-cyan)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
              Tour · Step {stepIdx + 1} of {TOUR_STEPS.length}
            </div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {step.title}
            </div>
          </div>
          <button
            onClick={() => onDismiss('skipped')}
            title="Skip tour"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-3)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{
          fontSize: 'var(--fs-sm)',
          color: 'var(--color-text-2)',
          lineHeight: 1.55,
          marginTop: 10,
          marginBottom: 14,
        }}>
          {step.body}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => onDismiss('skipped')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-3)',
              fontSize: 'var(--fs-xs)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '6px 0',
            }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {stepIdx > 0 && (
              <button
                onClick={() => setStepIdx(prev => Math.max(0, prev - 1))}
                style={navBtnStyle('outlined')}
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={() => onDismiss('completed')}
                style={navBtnStyle('filled')}
              >
                Done
              </button>
            ) : (
              <button
                onClick={() => setStepIdx(prev => prev + 1)}
                style={navBtnStyle('filled')}
              >
                Next
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function navBtnStyle(variant: 'filled' | 'outlined'): React.CSSProperties {
  if (variant === 'filled') {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '6px 14px',
      borderRadius: 6,
      border: 'none',
      background: 'var(--color-cyan)',
      color: 'var(--color-cyan-btn-text, #fff)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-inset)',
    color: 'var(--color-text-2)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}
