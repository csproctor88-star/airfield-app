'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface DeleteConfirmationDialogProps {
  userName: string
  lastName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export function DeleteConfirmationDialog({
  userName,
  lastName,
  onConfirm,
  onCancel,
  loading,
}: DeleteConfirmationDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const isMatch = confirmText.trim().toLowerCase() === lastName.trim().toLowerCase()

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 360, padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: '#F87171' }}>
            Delete User
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} color="var(--color-text-3)" />
          </button>
        </div>

        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginBottom: 16, lineHeight: 1.5 }}>
          Permanently delete <strong>{userName}</strong>? This action cannot be undone.
          All associated data will be removed.
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Type the user&apos;s last name to confirm</span>
          <input
            type="text"
            className="input-dark"
            placeholder={lastName}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-md)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isMatch || loading}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              border: 'none',
              background: isMatch && !loading ? '#DC2626' : 'rgba(220,38,38,0.3)',
              color: '#fff',
              fontSize: 'var(--fs-md)',
              fontWeight: 600,
              cursor: isMatch && !loading ? 'pointer' : 'not-allowed',
              opacity: isMatch && !loading ? 1 : 0.5,
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
