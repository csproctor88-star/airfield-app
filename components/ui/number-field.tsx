'use client'

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from 'react'

interface NumberFieldProps {
  value: number | null | undefined
  onCommit: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  allowEmpty?: boolean
  placeholder?: string
  style?: CSSProperties
  className?: string
  disabled?: boolean
  selectOnFocus?: boolean
  ariaLabel?: string
}

// Local draft buffer for numeric input. While focused, the field shows the
// user's raw keystrokes (including empty) and does NOT commit per keystroke
// — that pattern races with async parent writes (Supabase round-trips) and
// causes typed digits to be overwritten when an older response lands last.
//
// Commit fires on blur and on Enter. Escape reverts the draft. When
// allowEmpty is false and the user leaves the field empty, draft reverts
// to the last committed value.
export function NumberField({
  value,
  onCommit,
  min,
  max,
  step = 1,
  allowEmpty = true,
  placeholder,
  style,
  className,
  disabled,
  selectOnFocus = true,
  ariaLabel,
}: NumberFieldProps) {
  const formatted = value == null || Number.isNaN(value) ? '' : String(value)
  const [draft, setDraft] = useState<string>(formatted)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setDraft(formatted)
  }, [formatted])

  const clamp = (n: number): number => {
    let out = n
    if (min != null) out = Math.max(min, out)
    if (max != null) out = Math.min(max, out)
    return out
  }

  const commit = () => {
    const raw = draft.trim()
    if (raw === '') {
      if (allowEmpty) {
        if (value != null) onCommit(null)
      } else {
        setDraft(formatted)
      }
      return
    }
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) {
      setDraft(formatted)
      return
    }
    const next = clamp(parsed)
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }

  const onFocus = (e: FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true
    if (selectOnFocus) e.target.select()
  }

  const onBlur = () => {
    focusedRef.current = false
    commit()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      ;(e.currentTarget as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(formatted)
      ;(e.currentTarget as HTMLInputElement).blur()
    }
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={e => setDraft(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      style={style}
      className={className}
    />
  )
}
