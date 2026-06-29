'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { PageHeader } from '@/components/ui/page-header'
import { BoardBar, type BoardSummary } from '@/components/dashboard/board-bar'
import { WidgetGrid } from '@/components/dashboard/widget-grid'
import { WidgetPalette } from '@/components/dashboard/widget-palette'
import { WidgetConfigModal } from '@/components/dashboard/widget-config-modal'
import {
  getOrCreateDefaultBoard, fetchBoards, createBoard, updateBoard,
  deleteBoard, type DashboardBoardRow,
} from '@/lib/supabase/dashboard-boards'
import { saveBoardLayout } from '@/lib/dashboard-board-write'
import { updateWidgetConfig } from '@/lib/dashboard/widget-config'
import { getWidgetDef } from '@/lib/dashboard/registry'
import { validateLayout, type WidgetInstance } from '@/lib/dashboard/layout'
import { usePermissions, PERM } from '@/lib/permissions'
import { USER_ROLES } from '@/lib/constants'
import { toast } from 'sonner'

// Sensible starter layout for a brand-new board.
const DEFAULT_LAYOUT: WidgetInstance[] = [
  { i: 'w-insp', type: 'inspection-status', config: {}, x: 0, y: 0, w: 3, h: 2 },
  { i: 'w-disc', type: 'open-discrepancies', config: {}, x: 3, y: 0, w: 5, h: 3 },
  { i: 'w-last', type: 'last-check', config: {}, x: 8, y: 0, w: 4, h: 1 },
  { i: 'w-shift', type: 'shift-checklist', config: {}, x: 8, y: 1, w: 4, h: 2 },
]

function uuid(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `w-${Math.floor(Math.random() * 1e9).toString(36)}`
}

// ── Tiny inline modal ────────────────────────────────────────────────────────

function SimpleModal({
  title, children, onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 420, padding: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 16 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-input, var(--color-bg-surface))',
  color: 'var(--color-text-1)', fontFamily: 'inherit',
  fontSize: 'var(--fs-base)', marginBottom: 12,
}

const modalBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600,
  background: 'var(--color-bg-surface)', color: 'var(--color-text-1)',
}

const modalBtnPrimary: React.CSSProperties = {
  ...modalBtn,
  background: 'var(--color-accent)', color: '#fff',
  border: '1px solid var(--color-accent)',
}

// ── Main page ────────────────────────────────────────────────────────────────

type ModalKind = 'new' | 'rename' | 'share' | null

export default function DashboardPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canPublishShared = has(PERM.DASHBOARD_PUBLISH_SHARED)
  const canManageTemplates = has(PERM.DASHBOARD_MANAGE_TEMPLATES)

  const [boards, setBoards] = useState<DashboardBoardRow[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [widgets, setWidgets] = useState<WidgetInstance[]>([])
  const [editing, setEditing] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [configuringId, setConfiguringId] = useState<string | null>(null)

  // modal state
  const [modalKind, setModalKind] = useState<ModalKind>(null)
  const [modalInput, setModalInput] = useState('')
  const [shareNewName, setShareNewName] = useState('')
  const [shareTemplate, setShareTemplate] = useState<string>('')
  const [modalBusy, setModalBusy] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear pending save on unmount.
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  // Helper: refresh boards list, optionally switch to a specific id.
  const refreshBoards = useCallback(async (switchTo?: string) => {
    if (!installationId) return
    const list = await fetchBoards(installationId)
    setBoards(list)
    const nextId =
      (switchTo && list.some(b => b.id === switchTo)) ? switchTo
      : (activeId && list.some(b => b.id === activeId)) ? activeId
      : (list[0]?.id ?? null)
    if (nextId !== activeId) {
      setActiveId(nextId)
      const found = list.find(b => b.id === nextId)
      setWidgets(found ? found.layout : [])
    }
  }, [installationId, activeId])

  // Load user + boards on base change.
  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (cancelled) return
      setUserId(uid)
      if (!uid) return

      // Ensure default board exists for this user, then fetch all.
      await getOrCreateDefaultBoard(installationId, uid)
      if (cancelled) return
      const list = await fetchBoards(installationId)
      if (cancelled) return
      setBoards(list)

      // Pick initial active board: user's default personal first, then any personal, then first.
      const myDefault = list.find(b => b.owner_id === uid && b.is_default)
      const firstPersonal = list.find(b => b.owner_id === uid)
      const initial = myDefault ?? firstPersonal ?? list[0] ?? null
      if (initial) {
        setActiveId(initial.id)
        // Show DEFAULT_LAYOUT only for user's own new/empty default board.
        const isEmpty = initial.layout.length === 0
        const isMyDefault = initial.owner_id === uid && initial.is_default
        setWidgets(isEmpty && isMyDefault ? DEFAULT_LAYOUT : initial.layout)
      }
    })()
    return () => { cancelled = true }
  }, [installationId])

  const persist = useCallback((next: WidgetInstance[]) => {
    if (!activeId || !installationId || !userId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveBoardLayout({ boardId: activeId, layout: validateLayout(next), baseId: installationId, userId })
        .catch(() => toast.error('Could not save dashboard layout'))
    }, 800)
  }, [activeId, installationId, userId])

  const onSwitch = useCallback((id: string) => {
    const board = boards.find(b => b.id === id)
    if (!board) return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    setActiveId(id)
    setWidgets(board.layout.length ? board.layout : [])
    setEditing(false)
    setShowPalette(false)
    setConfiguringId(null)
  }, [boards])

  const onLayoutChange = useCallback((next: WidgetInstance[]) => {
    setWidgets(next); persist(next)
  }, [persist])

  const onWidgetConfigChange = useCallback((id: string, config: Record<string, unknown>) => {
    setWidgets(prev => {
      const next = updateWidgetConfig(prev, id, config)
      persist(next)
      return next
    })
  }, [persist])

  const onRemove = useCallback((id: string) => {
    setWidgets(prev => { const next = prev.filter(w => w.i !== id); persist(next); return next })
  }, [persist])

  const onAdd = useCallback((type: string) => {
    const def = getWidgetDef(type)
    if (!def) return
    const bottomY = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0)
    setWidgets(prev => {
      const next = [
        ...prev,
        { i: uuid(), type, config: {}, x: 0, y: bottomY, w: def.defaultSize.w, h: def.defaultSize.h },
      ]
      persist(next); return next
    })
  }, [persist, widgets])

  const isEmpty = useMemo(() => widgets.length === 0, [widgets])

  // The active board row.
  const activeBoard = useMemo(() => boards.find(b => b.id === activeId) ?? null, [boards, activeId])

  // Cannot delete if it's the user's own default personal board.
  const canDeleteActive = useMemo(() => {
    if (!activeBoard || !userId) return false
    return !(activeBoard.owner_id === userId && activeBoard.is_default)
  }, [activeBoard, userId])

  // ── Modal handlers ───────────────────────────────────────────────────────

  const openModal = (kind: ModalKind, prefill = '') => {
    setModalInput(prefill)
    setShareNewName('')
    if (activeBoard?.role_template) {
      setShareTemplate(activeBoard.role_template)
    } else {
      setShareTemplate('')
    }
    setModalKind(kind)
    setModalBusy(false)
  }
  const closeModal = () => { setModalKind(null); setModalBusy(false) }

  // New personal board
  const handleNewBoard = async () => {
    const name = modalInput.trim()
    if (!name || !installationId || !userId) return
    setModalBusy(true)
    const { data, error } = await createBoard({
      base_id: installationId, owner_id: userId, name, scope: 'personal',
    })
    if (error) { toast.error(error); setModalBusy(false); return }
    toast.success(`Board "${name}" created`)
    closeModal()
    await refreshBoards(data?.id)
  }

  // Rename active board
  const handleRenameBoard = async () => {
    const name = modalInput.trim()
    if (!name || !activeId) return
    setModalBusy(true)
    const { error } = await updateBoard(activeId, { name })
    if (error) { toast.error(error); setModalBusy(false); return }
    toast.success('Board renamed')
    closeModal()
    await refreshBoards()
  }

  // Delete active board
  const handleDeleteBoard = async () => {
    if (!activeId || !canDeleteActive) return
    const confirmed = window.confirm(`Delete "${activeBoard?.name ?? 'this board'}"? This cannot be undone.`)
    if (!confirmed) return
    const { error } = await deleteBoard(activeId)
    if (error) { toast.error(error); return }
    toast.success('Board deleted')
    // Switch to user's default personal board.
    const myDefault = boards.find(b => b.owner_id === userId && b.is_default && b.id !== activeId)
    await refreshBoards(myDefault?.id)
  }

  // Create shared board (from share modal)
  const handleCreateShared = async () => {
    const name = shareNewName.trim()
    if (!name || !installationId) return
    setModalBusy(true)
    const { data, error } = await createBoard({
      base_id: installationId, owner_id: null, name, scope: 'shared',
      // Copy the current dashboard's widgets into the shared board, so sharing
      // publishes what the user built rather than creating an empty board.
      layout: validateLayout(widgets),
    })
    if (error) { toast.error(error); setModalBusy(false); return }
    toast.success(`Shared board "${name}" created with ${widgets.length} widget${widgets.length === 1 ? '' : 's'}`)
    closeModal()
    await refreshBoards(data?.id)
  }

  // Update role template on active shared board
  const handleSetTemplate = async () => {
    if (!activeId || !activeBoard || activeBoard.scope !== 'shared') return
    setModalBusy(true)
    const role_template = shareTemplate || null
    const { error } = await updateBoard(activeId, { role_template })
    if (error) { toast.error(error); setModalBusy(false); return }
    toast.success(role_template ? `Template set to "${USER_ROLES[role_template as keyof typeof USER_ROLES]?.label ?? role_template}"` : 'Template cleared')
    closeModal()
    await refreshBoards()
  }

  // Widget config save
  const handleConfigSave = useCallback((config: Record<string, unknown>) => {
    if (!configuringId) return
    setWidgets(prev => {
      const next = updateWidgetConfig(prev, configuringId, config)
      persist(next)
      return next
    })
    setConfiguringId(null)
  }, [configuringId, persist])

  // Build BoardSummary list for BoardBar.
  const boardSummaries: BoardSummary[] = useMemo(
    () => boards.map(b => ({ id: b.id, name: b.name, scope: b.scope, role_template: b.role_template })),
    [boards],
  )

  // Widget being configured
  const configuringWidget = useMemo(
    () => (configuringId ? widgets.find(w => w.i === configuringId) ?? null : null),
    [configuringId, widgets],
  )

  return (
    <div className="page-container dashboard-fullbleed">
      <PageHeader eyebrow="Operations" title="Dashboard" />

      <BoardBar
        boards={boardSummaries}
        activeId={activeId}
        onSwitch={onSwitch}
        editing={editing}
        onToggleEdit={() => setEditing(e => !e)}
        onAddWidget={() => setShowPalette(true)}
        onNewBoard={() => openModal('new', '')}
        onRenameBoard={() => openModal('rename', activeBoard?.name ?? '')}
        onDeleteBoard={handleDeleteBoard}
        canDeleteActive={canDeleteActive}
        onShareControls={canPublishShared ? () => openModal('share') : undefined}
      />

      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-3)' }}>
          Your dashboard is empty. {editing ? 'Use "Add Widget" to get started.' : 'Tap Edit, then Add Widget.'}
        </div>
      ) : (
        <WidgetGrid
          widgets={widgets}
          editing={editing}
          onLayoutChange={onLayoutChange}
          onRemove={onRemove}
          onConfigure={(id) => setConfiguringId(id)}
          onWidgetConfigChange={onWidgetConfigChange}
        />
      )}

      {showPalette && <WidgetPalette onAdd={onAdd} onClose={() => setShowPalette(false)} />}

      {/* Widget config modal */}
      {configuringWidget && (
        <WidgetConfigModal
          widget={configuringWidget}
          onSave={handleConfigSave}
          onClose={() => setConfiguringId(null)}
        />
      )}

      {/* New board modal */}
      {modalKind === 'new' && (
        <SimpleModal title="New Board" onClose={closeModal}>
          <input
            style={inputStyle}
            placeholder="Board name"
            value={modalInput}
            onChange={e => setModalInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleNewBoard() }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={modalBtn} onClick={closeModal}>Cancel</button>
            <button
              style={modalBtnPrimary}
              onClick={handleNewBoard}
              disabled={!modalInput.trim() || modalBusy}
            >
              {modalBusy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </SimpleModal>
      )}

      {/* Rename board modal */}
      {modalKind === 'rename' && (
        <SimpleModal title="Rename Board" onClose={closeModal}>
          <input
            style={inputStyle}
            placeholder="New name"
            value={modalInput}
            onChange={e => setModalInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameBoard() }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={modalBtn} onClick={closeModal}>Cancel</button>
            <button
              style={modalBtnPrimary}
              onClick={handleRenameBoard}
              disabled={!modalInput.trim() || modalBusy}
            >
              {modalBusy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </SimpleModal>
      )}

      {/* Share / template modal (canPublishShared only) */}
      {modalKind === 'share' && (
        <SimpleModal title="Shared Boards" onClose={closeModal}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 12 }}>
            Create a new shared board visible to all users at this base.
          </div>
          <input
            style={inputStyle}
            placeholder="Shared board name"
            value={shareNewName}
            onChange={e => setShareNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateShared() }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 20 }}>
            <button style={modalBtn} onClick={closeModal}>Cancel</button>
            <button
              style={modalBtnPrimary}
              onClick={handleCreateShared}
              disabled={!shareNewName.trim() || modalBusy}
            >
              {modalBusy ? 'Creating…' : 'Create Shared Board'}
            </button>
          </div>

          {/* Role-template assignment — only for active shared board when canManageTemplates */}
          {canManageTemplates && activeBoard?.scope === 'shared' && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0 0 16px' }} />
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 8 }}>
                Role template for "{activeBoard.name}"
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 8 }}>
                New users with this role will start from this board's layout.
              </div>
              <select
                value={shareTemplate}
                onChange={e => setShareTemplate(e.target.value)}
                style={{ ...inputStyle, marginBottom: 12, width: 'auto', minWidth: 200 }}
              >
                <option value="">— None —</option>
                {Object.entries(USER_ROLES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  style={modalBtnPrimary}
                  onClick={handleSetTemplate}
                  disabled={modalBusy}
                >
                  {modalBusy ? 'Saving…' : 'Save Template'}
                </button>
              </div>
            </>
          )}
        </SimpleModal>
      )}
    </div>
  )
}
