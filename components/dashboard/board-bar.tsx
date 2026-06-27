'use client'
import { Pencil, Plus, Check } from 'lucide-react'

export function BoardBar({
  boardName, editing, onToggleEdit, onAddWidget,
}: {
  boardName: string
  editing: boolean
  onToggleEdit: () => void
  onAddWidget: () => void
}) {
  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 'var(--fs-sm)', fontWeight: 600, border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)', color: 'var(--color-text-1)',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 36 }}>
      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>{boardName}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {editing && (
          <button style={{ ...btn, borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)' }} onClick={onAddWidget}>
            <Plus size={15} strokeWidth={2.5} /> Add Widget
          </button>
        )}
        <button style={btn} onClick={onToggleEdit}>
          {editing ? <><Check size={15} strokeWidth={2.5} /> Done</> : <><Pencil size={15} strokeWidth={2.5} /> Edit</>}
        </button>
      </div>
    </div>
  )
}
