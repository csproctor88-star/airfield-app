'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'

// Action button matching prototype: colored border + bg tint.
// Accepts both hex literals (`#38BDF8`) and CSS variables
// (`var(--color-cyan)`); uses color-mix so the var-bound callers
// (waivers, inspections, etc.) render correctly. Previously did
// `${color}14` hex-alpha concat which silently dropped the bg +
// border for every var-bound caller — same footgun pinned in
// feedback_amber_text_contrast.md.
// Usage: <ActionButton color="var(--color-cyan)">Edit</ActionButton>

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ color = 'var(--color-cyan)', children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className="action-button"
        style={{
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
          color,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ActionButton.displayName = 'ActionButton'
