'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

interface HeadingSliderProps {
  value: number
  // Fires every tick while the user drags. Use for cheap visual previews
  // (e.g. imperative marker rotation). Skip DB writes here.
  onPreview?: (value: number) => void
  // Fires once when the user releases the slider. Commit DB writes here.
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  style?: CSSProperties
  className?: string
  disabled?: boolean
}

// Range slider that decouples per-tick visual feedback from per-tick
// commits. Holds a local draft so the parent isn't re-rendered on every
// onChange — and so the slider stays smooth even when the committed
// value is awaiting a network round-trip. Commit fires on pointerup,
// pointercancel, touchend, mouseup, or blur.
export function HeadingSlider({
  value,
  onPreview,
  onCommit,
  min = 0,
  max = 360,
  step = 1,
  style,
  className,
  disabled,
}: HeadingSliderProps) {
  const [draft, setDraft] = useState<number>(value)
  const draggingRef = useRef(false)
  const draftRef = useRef(value)

  useEffect(() => {
    if (!draggingRef.current) {
      setDraft(value)
      draftRef.current = value
    }
  }, [value])

  const commit = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (draftRef.current !== value) onCommit(draftRef.current)
  }

  const onPointerDown = (_e: PointerEvent<HTMLInputElement>) => {
    draggingRef.current = true
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={draft}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onChange={e => {
        const v = Number(e.target.value)
        setDraft(v)
        draftRef.current = v
        if (draggingRef.current) onPreview?.(v)
      }}
      onPointerUp={commit}
      onPointerCancel={commit}
      onMouseUp={commit}
      onTouchEnd={commit}
      onBlur={commit}
      style={style}
      className={className}
    />
  )
}
