'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

type Props = {
  src: string
  alt: string
  style?: React.CSSProperties
}

/**
 * Image with pinch-to-zoom, scroll-wheel zoom, double-tap zoom, and pan.
 * Renders inside its parent container — use within a flex/centered overlay.
 */
export function ZoomableImage({ src, alt, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })

  // Refs for gesture tracking
  const pinchStart = useRef<number | null>(null)
  const scaleStart = useRef(1)
  const panStart = useRef<{ x: number; y: number } | null>(null)
  const translateStart = useRef({ x: 0, y: 0 })
  const lastTap = useRef(0)

  const resetZoom = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  // Reset when src changes
  useEffect(() => { resetZoom() }, [src, resetZoom])

  // Clamp scale
  const clampScale = (s: number) => Math.min(Math.max(s, 1), 5)

  // ── Wheel zoom ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(prev => {
      const next = clampScale(prev * delta)
      if (next === 1) setTranslate({ x: 0, y: 0 })
      return next
    })
  }, [])

  // ── Touch handlers (pinch + pan + double-tap) ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchStart.current = Math.hypot(dx, dy)
      scaleStart.current = scale
      e.preventDefault()
    } else if (e.touches.length === 1) {
      // Double-tap detection
      const now = Date.now()
      if (now - lastTap.current < 300) {
        // Double-tap: toggle between 1x and 2.5x
        if (scale > 1) {
          resetZoom()
        } else {
          setScale(2.5)
        }
        lastTap.current = 0
        e.preventDefault()
        return
      }
      lastTap.current = now

      // Pan start (only when zoomed)
      if (scale > 1) {
        panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        translateStart.current = { ...translate }
        e.preventDefault()
      }
    }
  }, [scale, translate, resetZoom])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current !== null) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const next = clampScale(scaleStart.current * (dist / pinchStart.current))
      setScale(next)
      if (next === 1) setTranslate({ x: 0, y: 0 })
      e.preventDefault()
    } else if (e.touches.length === 1 && panStart.current && scale > 1) {
      // Pan
      const dx = e.touches[0].clientX - panStart.current.x
      const dy = e.touches[0].clientY - panStart.current.y
      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy,
      })
      e.preventDefault()
    }
  }, [scale])

  const handleTouchEnd = useCallback(() => {
    pinchStart.current = null
    panStart.current = null
  }, [])

  // ── Mouse drag for desktop pan ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return
    panStart.current = { x: e.clientX, y: e.clientY }
    translateStart.current = { ...translate }
  }, [scale, translate])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panStart.current || scale <= 1) return
    setTranslate({
      x: translateStart.current.x + (e.clientX - panStart.current.x),
      y: translateStart.current.y + (e.clientY - panStart.current.y),
    })
  }, [scale])

  const handleMouseUp = useCallback(() => {
    panStart.current = null
  }, [])

  // Double-click zoom for desktop
  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      resetZoom()
    } else {
      setScale(2.5)
    }
  }, [scale, resetZoom])

  const isZoomed = scale > 1

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{
        overflow: 'hidden',
        cursor: isZoomed ? 'grab' : 'zoom-in',
        touchAction: 'none',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: '100%',
          maxHeight: '70vh',
          objectFit: 'contain',
          borderRadius: 8,
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: panStart.current ? 'none' : 'transform 0.15s ease-out',
          ...style,
        }}
      />
      {isZoomed && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); resetZoom() }}
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6, padding: '4px 10px', color: '#fff',
            fontSize: 'var(--fs-sm)', cursor: 'pointer', fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}
        >
          Reset Zoom
        </button>
      )}
    </div>
  )
}
