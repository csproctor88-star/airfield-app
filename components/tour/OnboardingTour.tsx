'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, SkipForward } from 'lucide-react'

export type TourStep = {
  id: string                            // unique within a tour; also the skipSubTourTo target
  anchor?: string                       // data-tour value; null = centered bubble
  anchorIsFixed?: boolean               // anchor lives in a position:fixed ancestor
  navigateTo?: string                   // router.push to this href before showing this step
  expandSidebarGroup?: string           // sidebar group label to auto-open on this step
  dispatchOnEnter?: { event: string; detail?: unknown }
                                        // page-controlled UI hook: fire a CustomEvent on window
                                        // before waiting for the anchor. Pages listen for the
                                        // event and open a panel / switch a tab / select a row
                                        // so the next anchor can mount. Convention: name the
                                        // event `glidepath:tour-<page>-<action>`.
  requiresPerm?: string                 // skip step if user lacks this perm key
  waitForAnchorMs?: number              // override default 3000ms anchor-readiness timeout
  skipSubTourTo?: string                // page-intro step: id to fast-forward to
  title: string
  body: string
}

type AnchorRect = { top: number; left: number; width: number; height: number } | null

const DEFAULT_ANCHOR_TIMEOUT_MS = 3000
const ANCHOR_POLL_INTERVAL_MS = 100
const PATH_POLL_INTERVAL_MS = 50
const PATH_TIMEOUT_MS = 2000

function readAnchorRect(anchorId: string | undefined): AnchorRect {
  if (!anchorId || typeof window === 'undefined') return null
  const el = document.querySelector<HTMLElement>(`[data-tour="${anchorId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  // Always return viewport-relative coords. Spotlight + bubble both
  // render with position: fixed and re-read rect on scroll/resize, so
  // they stay glued to the anchor regardless of page scroll. This also
  // means a page-content anchor that's taller than the viewport (e.g.
  // a whole-page wrapper div) won't push the bubble off-screen — the
  // bubble's smart vertical placement clamps to the viewport.
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

async function waitForAnchor(anchorId: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (document.querySelector(`[data-tour="${anchorId}"]`)) return true
    await new Promise(resolve => setTimeout(resolve, ANCHOR_POLL_INTERVAL_MS))
  }
  return false
}

async function waitForPath(target: string, currentPathRef: { current: string }, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (currentPathRef.current === target) return true
    await new Promise(resolve => setTimeout(resolve, PATH_POLL_INTERVAL_MS))
  }
  return false
}

export function OnboardingTour({
  tourId,
  steps,
  active,
  onDismiss,
  hasPermission,
}: {
  tourId: string
  steps: TourStep[]
  active: boolean
  onDismiss: (tourId: string, reason: 'completed' | 'skipped') => void
  /** Optional permission predicate. When omitted, requiresPerm steps are kept. */
  hasPermission?: (perm: string) => boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Filter steps once per tour activation by perm; the engine still consults
  // hasPermission live for any steps that became gated mid-tour, but the
  // initial filter is what the min-step floor uses.
  const visibleSteps = active
    ? steps.filter(s => !s.requiresPerm || !hasPermission || hasPermission(s.requiresPerm))
    : steps

  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect] = useState<AnchorRect>(null)
  const [transitioning, setTransitioning] = useState(false)
  const pathRef = useRef(pathname)

  useEffect(() => { pathRef.current = pathname }, [pathname])

  // Reset to step 0 whenever the tour identity changes (e.g. replay).
  useEffect(() => { setStepIdx(0) }, [tourId])

  const step = visibleSteps[stepIdx]
  const isLast = stepIdx === visibleSteps.length - 1

  // Min-step floor: if perm-filtering left fewer than 3 visible steps,
  // silently mark the tour completed.
  useEffect(() => {
    if (!active) return
    if (visibleSteps.length < 3) {
      onDismiss(tourId, 'completed')
    }
  }, [active, visibleSteps.length, tourId, onDismiss])

  // Step transition: navigate, wait for path, expand group, wait for anchor,
  // then read the rect. Sets a transitioning flag so the bubble briefly hides
  // while the underlying page is still settling.
  useEffect(() => {
    if (!active || !step) return
    let cancelled = false

    ;(async () => {
      setTransitioning(true)
      setRect(null)

      // 1. Navigate if needed.
      if (step.navigateTo && pathRef.current !== step.navigateTo) {
        router.push(step.navigateTo)
        await waitForPath(step.navigateTo, pathRef, PATH_TIMEOUT_MS)
        if (cancelled) return
      }

      // 2. Expand sidebar group if requested.
      if (step.expandSidebarGroup) {
        window.dispatchEvent(new CustomEvent('glidepath:tour-expand-group', {
          detail: step.expandSidebarGroup,
        }))
        window.dispatchEvent(new CustomEvent('glidepath:more-expand-group', {
          detail: step.expandSidebarGroup,
        }))
      }

      // 2b. Page-controlled UI hook (open a panel, switch a tab, etc.).
      if (step.dispatchOnEnter) {
        window.dispatchEvent(new CustomEvent(step.dispatchOnEnter.event, {
          detail: step.dispatchOnEnter.detail,
        }))
      }

      // 3. Wait for anchor (if any). On timeout, advance to next step.
      if (step.anchor) {
        const found = await waitForAnchor(
          step.anchor,
          step.waitForAnchorMs ?? DEFAULT_ANCHOR_TIMEOUT_MS,
        )
        if (cancelled) return
        if (!found) {
          // Anchor never appeared — skip this step.
          if (stepIdx + 1 < visibleSteps.length) {
            setStepIdx(prev => prev + 1)
          } else {
            onDismiss(tourId, 'completed')
          }
          return
        }
      }

      // 4. Read the rect (or null for centered bubble).
      setRect(readAnchorRect(step.anchor))
      setTransitioning(false)
    })()

    return () => { cancelled = true }
  }, [active, stepIdx, step?.id, step?.navigateTo, step?.anchor, step?.expandSidebarGroup, step?.dispatchOnEnter, step?.anchorIsFixed, step?.waitForAnchorMs, tourId, onDismiss, router, visibleSteps.length])

  // Re-read the rect on resize / scroll while the step is active.
  useEffect(() => {
    if (!active || !step?.anchor || transitioning) return
    const update = () => setRect(readAnchorRect(step.anchor))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, step?.anchor, step?.anchorIsFixed, transitioning])

  // Scroll the anchor into view at the start of each step. Runs for
  // fixed anchors too — sidebar items live in an `overflow-y: auto`
  // container, so an item below the visible nav area would otherwise
  // have its spotlight clipped (rect.top > sidebar visible bottom).
  // scrollIntoView on the item walks up to its closest scrollable
  // ancestor and brings it into view there.
  useEffect(() => {
    if (!active || !step?.anchor) return
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [active, step?.anchor])

  const skipToNextSubTourBoundary = useCallback(() => {
    if (!step?.skipSubTourTo) return
    const targetIdx = visibleSteps.findIndex(s => s.id === step.skipSubTourTo)
    if (targetIdx >= 0) setStepIdx(targetIdx)
  }, [step, visibleSteps])

  // Keyboard navigation: arrow keys advance / regress, Escape skips.
  // Skipped when the user is typing in an input — tour shouldn't hijack
  // form keystrokes (defensive; tour is modal so this is rarely hit).
  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (isLast) {
          onDismiss(tourId, 'completed')
        } else {
          setStepIdx(prev => prev + 1)
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (stepIdx > 0) setStepIdx(prev => Math.max(0, prev - 1))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss(tourId, 'skipped')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, stepIdx, isLast, tourId, onDismiss])

  if (!active || !step || transitioning) {
    // Still render the dim overlay during transitions so the user knows the
    // tour is alive between page navigations.
    if (!active) return null
    return (
      <div
        onClick={() => onDismiss(tourId, 'skipped')}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.32)',
          zIndex: 9000,
          pointerEvents: 'auto',
        }}
      />
    )
  }

  const isCentered = !step.anchor || !rect
  const useFixed = Boolean(step.anchorIsFixed)
  // Estimated bubble height — used to clamp top position so the bubble
  // never falls off the viewport. Errs on the tall side so the clamp
  // kicks in early rather than letting the bubble run off-screen.
  const ESTIMATED_BUBBLE_HEIGHT = 280
  const BUBBLE_WIDTH = 380
  const BUBBLE_GAP = 12
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const bubbleStyle: React.CSSProperties = isCentered
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: BUBBLE_WIDTH,
      }
    : useFixed
      ? (() => {
          // Sidebar / fixed-position anchor: place the bubble to the
          // right of the anchor, vertically aligned with its top, so
          // sidebar items deep in the list don't push the bubble below
          // the viewport.
          const wantedLeft = (rect?.left ?? 0) + (rect?.width ?? 0) + BUBBLE_GAP
          const maxLeft = vw - BUBBLE_WIDTH - BUBBLE_GAP
          const left = Math.max(BUBBLE_GAP, Math.min(wantedLeft, maxLeft))
          const wantedTop = rect?.top ?? 0
          const maxTop = vh - ESTIMATED_BUBBLE_HEIGHT - BUBBLE_GAP
          const top = Math.max(BUBBLE_GAP, Math.min(wantedTop, maxTop))
          return {
            position: 'fixed',
            top,
            left,
            width: BUBBLE_WIDTH,
          }
        })()
      : (() => {
          // Page-content anchor: prefer below the anchor; fall back to
          // above; if neither fits, pin near the top of the viewport.
          // All in viewport coords (position: fixed) so a tall anchor
          // (e.g. an anchor on the whole page-container wrapper) never
          // pushes the bubble off-screen.
          const rTop = rect?.top ?? 0
          const rHeight = rect?.height ?? 0
          const rLeft = rect?.left ?? 0
          const rWidth = rect?.width ?? 0
          const wantedBelow = rTop + rHeight + BUBBLE_GAP
          const wantedAbove = rTop - ESTIMATED_BUBBLE_HEIGHT - BUBBLE_GAP
          let top: number
          if (wantedBelow + ESTIMATED_BUBBLE_HEIGHT + BUBBLE_GAP <= vh) {
            top = wantedBelow
          } else if (wantedAbove >= BUBBLE_GAP) {
            top = wantedAbove
          } else {
            top = BUBBLE_GAP
          }
          // Final clamp — protects against rect changes mid-render.
          top = Math.max(BUBBLE_GAP, Math.min(top, vh - ESTIMATED_BUBBLE_HEIGHT - BUBBLE_GAP))
          const wantedLeft = rLeft + rWidth / 2 - BUBBLE_WIDTH / 2
          const maxLeft = vw - BUBBLE_WIDTH - BUBBLE_GAP
          const left = Math.max(BUBBLE_GAP, Math.min(wantedLeft, maxLeft))
          return {
            position: 'fixed',
            top,
            left,
            width: BUBBLE_WIDTH,
          }
        })()

  return (
    <>
      {/* Dim overlay (clicking it skips the tour). */}
      <div
        onClick={() => onDismiss(tourId, 'skipped')}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.32)',
          zIndex: 9000,
          pointerEvents: 'auto',
        }}
      />

      {/* Spotlight ring around the anchor. Always position: fixed so
          tracker stays glued to the anchor's viewport position; the
          resize/scroll listeners re-read the rect as the page moves. */}
      {!isCentered && rect && (
        <div
          style={{
            position: 'fixed',
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
              Tour · Step {stepIdx + 1} of {visibleSteps.length}
            </div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {step.title}
            </div>
          </div>
          <button
            onClick={() => onDismiss(tourId, 'skipped')}
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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => onDismiss(tourId, 'skipped')}
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
            {step.skipSubTourTo && (
              <button
                onClick={skipToNextSubTourBoundary}
                title="Skip this page's deep-dive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-3)',
                  fontSize: 'var(--fs-xs)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '6px 0',
                }}
              >
                <SkipForward size={12} />
                Skip this page
              </button>
            )}
          </div>
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
                onClick={() => onDismiss(tourId, 'completed')}
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
