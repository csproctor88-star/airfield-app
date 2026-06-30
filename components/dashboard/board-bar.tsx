'use client'
import { Pencil, Plus, Check, Share2, Trash2, PenLine, Star, Copy } from 'lucide-react'

export interface BoardSummary {
  id: string
  name: string
  scope: 'personal' | 'shared'
  role_template: string | null
}

export interface BoardBarProps {
  boards: BoardSummary[]
  activeId: string | null
  onSwitch: (id: string) => void
  editing: boolean
  onToggleEdit: () => void
  onAddWidget: () => void
  onNewBoard: () => void
  onDuplicate: () => void
  onRenameBoard: () => void
  onDeleteBoard: () => void
  canDeleteActive: boolean
  onShareControls?: () => void
  /** Called when user wants to mark the active board as their default. Omit to hide the control. */
  onSetDefault?: () => void
  /** The board the user has chosen as their default (any board, incl. shared). */
  defaultBoardId?: string | null
}

export function BoardBar({
  boards, activeId, onSwitch, editing, onToggleEdit, onAddWidget,
  onNewBoard, onDuplicate, onRenameBoard, onDeleteBoard, canDeleteActive, onShareControls, onSetDefault, defaultBoardId,
}: BoardBarProps) {
  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 'var(--fs-sm)', fontWeight: 600, border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)', color: 'var(--color-text-1)',
    whiteSpace: 'nowrap' as const,
  }
  const accentBtn: React.CSSProperties = {
    ...btn,
    borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
  }
  const dangerBtn: React.CSSProperties = {
    ...btn,
    color: 'var(--color-danger, #ef4444)',
    borderColor: 'color-mix(in srgb, var(--color-danger, #ef4444) 30%, transparent)',
  }
  const disabledBtn: React.CSSProperties = {
    ...dangerBtn,
    opacity: 0.4,
    cursor: 'not-allowed',
  }

  const personal = boards.filter(b => b.scope === 'personal')
  const shared = boards.filter(b => b.scope === 'shared')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      minHeight: 36, flexWrap: 'wrap',
    }}>
      {/* Board selector */}
      <select
        value={activeId ?? ''}
        onChange={e => onSwitch(e.target.value)}
        style={{
          padding: '5px 8px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)',
          color: 'var(--color-text-1)',
          fontFamily: 'inherit',
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          minWidth: 140,
          maxWidth: 240,
        }}
      >
        {personal.length > 0 && (
          <optgroup label="Personal">
            {personal.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.id === defaultBoardId ? ' ✓' : ''}</option>
            ))}
          </optgroup>
        )}
        {shared.length > 0 && (
          <optgroup label="Shared">
            {shared.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}{b.role_template ? ' ★' : ''}{b.id === defaultBoardId ? ' ✓' : ''}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {/* New board */}
      <button style={btn} onClick={onNewBoard} title="New board">
        <Plus size={14} strokeWidth={2.5} /> New
      </button>

      {/* Duplicate active board → personal copy (always available) */}
      <button style={btn} onClick={onDuplicate} title="Duplicate this dashboard to your own">
        <Copy size={14} strokeWidth={2.5} /> Duplicate
      </button>

      {/* Edit controls */}
      {editing && (
        <>
          <button style={accentBtn} onClick={onAddWidget}>
            <Plus size={14} strokeWidth={2.5} /> Add Widget
          </button>
          <button style={btn} onClick={onRenameBoard} title="Rename board">
            <PenLine size={14} strokeWidth={2.5} /> Rename
          </button>
          <button
            style={canDeleteActive ? dangerBtn : disabledBtn}
            onClick={canDeleteActive ? onDeleteBoard : undefined}
            disabled={!canDeleteActive}
            title={canDeleteActive ? 'Delete board' : "You can't delete this shared board"}
          >
            <Trash2 size={14} strokeWidth={2.5} /> Delete
          </button>
        </>
      )}

      {/* Share controls (permission-gated by parent) */}
      {onShareControls && (
        <button style={btn} onClick={onShareControls} title="Share / template settings">
          <Share2 size={14} strokeWidth={2.5} /> Share
        </button>
      )}

      {/* Set as default — only shown for personal boards that aren't already default */}
      {onSetDefault && (
        <button style={btn} onClick={onSetDefault} title="Set as your default dashboard">
          <Star size={14} strokeWidth={2.5} /> Set as Default
        </button>
      )}

      {/* Edit / Done toggle — pushed right */}
      <div style={{ marginLeft: 'auto' }}>
        <button style={btn} onClick={onToggleEdit}>
          {editing
            ? <><Check size={14} strokeWidth={2.5} /> Done</>
            : <><Pencil size={14} strokeWidth={2.5} /> Edit</>}
        </button>
      </div>
    </div>
  )
}
