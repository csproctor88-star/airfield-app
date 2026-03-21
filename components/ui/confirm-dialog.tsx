'use client'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="card"
        style={{ width: '100%', maxWidth: 400, padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 20, lineHeight: 1.5 }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: destructive ? 'var(--color-red)' : 'var(--color-cyan)',
              color: '#fff',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
