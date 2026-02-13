'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'

// Action button matching prototype: colored border + bg tint
// Usage: <ActionButton color="#38BDF8">✏️ Edit</ActionButton>

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ color = '#38BDF8', children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        style={{
          background: `${color}14`,
          border: `1px solid ${color}33`,
          borderRadius: 8,
          padding: '10px',
          color,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          minHeight: 44,
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
