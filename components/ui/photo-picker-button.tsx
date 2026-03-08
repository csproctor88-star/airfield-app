'use client'

type Props = {
  onUpload: () => void
  onCapture?: () => void
  disabled?: boolean
  /** 'full' = full-width block button, 'compact' = smaller inline button */
  variant?: 'full' | 'compact'
  label?: string
}

export function PhotoPickerButton({ onUpload, disabled, variant = 'full', label }: Props) {
  const isCompact = variant === 'compact'

  return (
    <button
      type="button"
      onClick={onUpload}
      disabled={disabled}
      style={isCompact ? {
        padding: '5px 10px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 600,
        border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)',
        color: 'var(--color-accent-secondary)', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.7 : 1,
        display: 'flex', alignItems: 'center', gap: 4,
      } : {
        width: '100%', padding: 10, borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 600,
        border: '1px solid var(--color-border-active)', background: 'var(--color-border)',
        color: 'var(--color-accent)', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.7 : 1, minHeight: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      <svg width={isCompact ? 14 : 16} height={isCompact ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      {label || (disabled ? 'Uploading...' : 'Add Photo')}
    </button>
  )
}
