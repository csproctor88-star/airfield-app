'use client'

import { useEffect, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { getFieldHint } from '@/lib/base-setup-guide'
import type { WizardStepKey } from '@/lib/modules-config'

export function FieldHint({ stepKey, fieldId }: { stepKey: WizardStepKey; fieldId: string }) {
  const hint = getFieldHint(stepKey, fieldId)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (ref.current.contains(e.target as Node)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!hint) return null

  return (
    <span
      ref={ref}
      data-tour="field-hint"
      style={{
        position: 'relative',
        display: 'inline-flex',
        verticalAlign: 'middle',
        marginLeft: 6,
      }}
    >
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); setOpen(prev => !prev) }}
        title="Field guidance"
        aria-label="Field guidance"
        style={{
          width: 18,
          height: 18,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: open ? 'var(--color-cyan)' : 'var(--color-text-3)',
          cursor: 'help',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'inherit',
          transition: 'color 0.15s',
        }}
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            width: 240,
            padding: '8px 10px',
            background: 'var(--color-bg-surface-solid)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--color-text-1)',
            lineHeight: 1.5,
            fontWeight: 400,
            textAlign: 'left',
            whiteSpace: 'normal',
          }}
        >
          {hint}
        </span>
      )}
    </span>
  )
}
