'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { PageHeader } from '@/components/ui/page-header'
import { BoardBar, type BoardSummary } from '@/components/dashboard/board-bar'
import { WidgetGrid } from '@/components/dashboard/widget-grid'
import { WidgetPalette } from '@/components/dashboard/widget-palette'
import { WidgetConfigModal } from '@/components/dashboard/widget-config-modal'
import { DashboardActionsProvider } from '@/components/dashboard/dashboard-actions'
import {
  getOrCreateDefaultBoard, fetchBoards, createBoard, updateBoard,
  deleteBoard, setDefaultBoard, getUserDefaultBoardId, type DashboardBoardRow,
} from '@/lib/supabase/dashboard-boards'
import { saveBoardLayout } from '@/lib/dashboard-board-write'
import { updateWidgetConfig } from '@/lib/dashboard/widget-config'
import { getWidgetDef } from '@/lib/dashboard/registry'
import {
  appendWidgetToLayout, appendWidgetToBoardLayout,
  reconcileBoardLayout,
  type WidgetInstance, type BoardLayout, type DeviceClass,
} from '@/lib/dashboard/layout'
import { usePermissions, PERM } from '@/lib/permissions'
import { USER_ROLES } from '@/lib/constants'
import { toast } from 'sonner'

// Sensible starter layout for a brand-new board.
const DEFAULT_LAYOUT: WidgetInstance[] = [
  { i: 'w-insp', type: 'inspection-status', config: {}, x: 0, y: 0, w: 6, h: 4 },
  { i: 'w-disc', type: 'open-discrepancies', config: {}, x: 6, y: 0, w: 10, h: 6 },
  { i: 'w-last', type: 'last-check', config: {}, x: 16, y: 0, w: 8, h: 2 },
  { i: 'w-shift', type: 'shift-checklist', config: {}, x: 16, y: 2, w: 8, h: 4 },
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
  const [mdWidgets, setMdWidgets] = useState<WidgetInstance[] | undefined>(undefined)
  const [smWidgets, setSmWidgets] = useState<WidgetInstance[] | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [configuringId, setConfiguringId] = useState<string | null>(null)
  // The user's chosen default board (any board, incl. shared) at this base.
  const [defaultBoardId, setDefaultBoardId] = useState<string | null>(null)

  // modal state
  const [modalKind, setModalKind] = useState<ModalKind>(null)
  const [modalInput, setModalInput] = useState('')
  const [shareNewName, setShareNewName] = useState('')
  const [shareTemplate, setShareTemplate] = useState<string>('')
  const [modalBusy, setModalBusy] = useState(false)

  // Derive the board layout — always reconciled so md/sm stay aligned to lg's
  // widget set automatically (add/remove/config only need to touch widgets/lg).
  const boardLayout = useMemo(
    () => reconcileBoardLayout({ lg: widgets, md: mdWidgets, sm: smWidgets }),
    [widgets, mdWidgets, smWidgets],
  )

  // Dirty-tracked snapshot ref + flush. Edits batch and save once on Done /
  // board switch / unmount. Never persist on every change.
  const saveRef = useRef<{ boardId: string; layout: BoardLayout } | null>(null)
  const dirtyRef = useRef(false)
  useEffect(() => {
    if (activeId) saveRef.current = { boardId: activeId, layout: boardLayout }
  }, [activeId, boardLayout])
  const markDirty = useCallback(() => { dirtyRef.current = true }, [])
  const flushSave = useCallback(() => {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    const snap = saveRef.current
    if (!snap || !installationId || !userId) return
    saveBoardLayout({ boardId: snap.boardId, layout: snap.layout, baseId: installationId, userId })
      .catch((e) => toast.error(e instanceof Error && e.message ? e.message : 'Could not save dashboard layout'))
  }, [installationId, userId])

  // Flush any staged edits on unmount.
  useEffect(() => flushSave, [flushSave])

  // The dashboard is a tall, full-bleed grid in <main className="app-content">
  // (the real scroll container, not window); browsers restore the previous
  // scroll position on reload/return, opening it mid-page. A fixed timeout
  // can't win the race because the board/widgets load asynchronously and the
  // react-grid-layout grid reflows afterward. Instead, settle-based: once the
  // board has loaded (activeId set), scroll to top across several settle points
  // (immediate, two rAFs, first grid resize, 300ms fallback) so the async grid
  // reflow can't leave the page scrolled mid-way.
  useEffect(() => {
    if (!activeId) return
    const toTop = () => {
      document.querySelector('.app-content')?.scrollTo({ top: 0 })
      window.scrollTo({ top: 0 })
    }
    toTop()
    const r1 = requestAnimationFrame(toTop)
    let r2Inner = 0
    const r2 = requestAnimationFrame(() => { r2Inner = requestAnimationFrame(toTop) })
    let observer: ResizeObserver | null = null
    const grid = document.querySelector('.dashboard-grid')
    if (grid && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        toTop()
        observer?.disconnect()
        observer = null
      })
      observer.observe(grid)
    }
    const t = setTimeout(toTop, 300)
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
      cancelAnimationFrame(r2Inner)
      observer?.disconnect()
      clearTimeout(t)
    }
  }, [activeId])

  // Helper: refresh boards list, optionally switch to a specific id.
  const refreshBoards = useCallback(async (switchTo?: string) => {
    if (!installationId) return
    const list = await fetchBoards(installationId)
    setBoards(list)
    if (userId) setDefaultBoardId(await getUserDefaultBoardId(installationId, userId))
    const nextId =
      (switchTo && list.some(b => b.id === switchTo)) ? switchTo
      : (activeId && list.some(b => b.id === activeId)) ? activeId
      : (list[0]?.id ?? null)
    if (nextId !== activeId) {
      setActiveId(nextId)
      const found = list.find(b => b.id === nextId)
      setWidgets(found ? found.layout.lg : [])
      setMdWidgets(found?.layout.md)
      setSmWidgets(found?.layout.sm)
      dirtyRef.current = false
    }
  }, [installationId, activeId, userId])

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

      // Pick initial active board: user's chosen default (any board) first, then any personal, then first.
      const defId = await getUserDefaultBoardId(installationId, uid)
      if (cancelled) return
      setDefaultBoardId(defId)
      const myDefault = (defId && list.find(b => b.id === defId)) || null
      const firstPersonal = list.find(b => b.owner_id === uid)
      const initial = myDefault ?? firstPersonal ?? list[0] ?? null
      if (initial) {
        setActiveId(initial.id)
        // Show DEFAULT_LAYOUT only for the user's own new/empty default board.
        const isEmpty = initial.layout.lg.length === 0
        const isMyDefault = initial.owner_id === uid && initial.id === defId
        setWidgets(isEmpty && isMyDefault ? DEFAULT_LAYOUT : initial.layout.lg)
        setMdWidgets(initial.layout.md)
        setSmWidgets(initial.layout.sm)
        dirtyRef.current = false
      }
    })()
    return () => { cancelled = true }
  }, [installationId])

  const onSwitch = useCallback((id: string) => {
    const board = boards.find(b => b.id === id)
    if (!board) return
    flushSave()
    setActiveId(id)
    setWidgets(board.layout.lg.length ? board.layout.lg : [])
    setMdWidgets(board.layout.md)
    setSmWidgets(board.layout.sm)
    dirtyRef.current = false
    setEditing(false)
    setShowPalette(false)
    setConfiguringId(null)
  }, [boards, flushSave])

  // Per-device edit handler — every breakpoint persists to its own device slot.
  const onDeviceLayoutChange = useCallback((device: DeviceClass, layout: WidgetInstance[]) => {
    if (device === 'lg') setWidgets(layout)
    else if (device === 'md') setMdWidgets(layout)
    else setSmWidgets(layout)
    markDirty()
  }, [markDirty])

  const onWidgetConfigChange = useCallback((id: string, config: Record<string, unknown>) => {
    setWidgets(prev => {
      const next = updateWidgetConfig(prev, id, config)
      markDirty()
      return next
    })
  }, [markDirty])

  const onRemove = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.i !== id))
    markDirty()
  }, [markDirty])

  const onAdd = useCallback((type: string) => {
    const def = getWidgetDef(type)
    if (!def) return
    const bottomY = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0)
    setWidgets(prev => {
      const next = [
        ...prev,
        { i: uuid(), type, config: {}, x: 0, y: bottomY, w: def.defaultSize.w, h: def.defaultSize.h },
      ]
      markDirty(); return next
    })
  }, [markDirty, widgets])

  const onAddLightingArea = useCallback(async () => {
    if (!installationId) return
    const { fetchLightingSystems } = await import('@/lib/supabase/lighting-systems')
    const { listAreas } = await import('@/lib/infrastructure/areas')
    const systems = await fetchLightingSystems(installationId)
    const areas = listAreas(systems)
    if (!areas.length) { toast('No lighting systems found for this base.'); return }
    const def = getWidgetDef('lighting')
    const w = def?.defaultSize.w ?? 8
    const h = def?.defaultSize.h ?? 8
    setWidgets(prev => {
      let bottomY = prev.reduce((m, x) => Math.max(m, x.y + x.h), 0)
      const additions = areas.map(area => {
        const widget: WidgetInstance = { i: uuid(), type: 'lighting', config: { scope: 'area', value: area }, x: 0, y: bottomY, w, h }
        bottomY += h
        return widget
      })
      return [...prev, ...additions]
    })
    markDirty()
    setShowPalette(false)
    toast.success(`Added ${areas.length} lighting widget${areas.length === 1 ? '' : 's'}`)
  }, [installationId, markDirty])

  // Board-level actions exposed to widgets via context (e.g. the Airfield
  // Lighting widget's "add one per area" button). Gated to infra viewers.
  const canViewInfra = has(PERM.INFRASTRUCTURE_VIEW)
  const dashboardActions = useMemo(
    () => ({ addLightingAreas: canViewInfra ? onAddLightingArea : undefined }),
    [canViewInfra, onAddLightingArea],
  )

  const isEmpty = useMemo(() => widgets.length === 0, [widgets])

  // The active board row.
  const activeBoard = useMemo(() => boards.find(b => b.id === activeId) ?? null, [boards, activeId])

  // Block entering Edit on a shared board the user can't publish; point them to Duplicate.
  const onToggleEdit = useCallback(() => {
    if (!editing && activeBoard?.scope === 'shared' && !canPublishShared) {
      toast('Shared dashboards can only be edited by an admin. Use Duplicate to make your own editable copy.', { id: 'shared-edit-guard' })
      return
    }
    if (editing) flushSave()
    setEditing(e => !e)
  }, [editing, activeBoard, canPublishShared, flushSave])

  // Safety net: if the active board becomes shared and the user can't publish,
  // drop out of Edit mode (covers landing on a shared board via refreshBoards,
  // not just the explicit onToggleEdit click).
  useEffect(() => {
    if (editing && activeBoard?.scope === 'shared' && !canPublishShared) {
      setEditing(false)
    }
  }, [editing, activeBoard, canPublishShared])

  // Delete: a personal board by its owner (even if it's their default — the
  // default just falls back on next load); a shared board only by a publisher.
  const canDeleteActive = useMemo(() => {
    if (!activeBoard || !userId) return false
    return activeBoard.scope === 'personal' ? activeBoard.owner_id === userId : canPublishShared
  }, [activeBoard, userId, canPublishShared])

  // "Set as Default" is eligible for ANY board (personal or shared) that isn't
  // already the user's default.
  const canSetDefault = useMemo(() => {
    if (!activeBoard || !userId) return false
    return activeBoard.id !== defaultBoardId
  }, [activeBoard, userId, defaultBoardId])

  // ── Modal handlers ───────────────────────────────────────────────────────

  const openModal = (kind: ModalKind, prefill = '') => {
    setModalInput(prefill)
    // Sharing a personal board converts it (keeps its name); prefill so the user
    // doesn't have to retype it.
    setShareNewName(kind === 'share' && activeBoard?.scope === 'personal' ? (activeBoard?.name ?? '') : '')
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

  // Duplicate the active board into a personal copy the user can edit.
  const duplicatingRef = useRef(false)
  const handleDuplicateBoard = async () => {
    if (!activeBoard || !installationId || !userId) return
    if (duplicatingRef.current) return
    duplicatingRef.current = true
    try {
      const name = `${activeBoard.name} (copy)`
      const { data, error } = await createBoard({
        base_id: installationId, owner_id: userId, name, scope: 'personal',
        layout: boardLayout,
      })
      if (error) { toast.error(error); return }
      toast.success(`Duplicated to "${name}"`)
      await refreshBoards(data?.id)
    } finally {
      duplicatingRef.current = false
    }
  }

  // Copy a single widget (with its config) onto one of the user's boards.
  const copyWidgetToBoard = async (widget: WidgetInstance, target: string) => {
    if (!installationId || !userId) return
    if (target === '__new__') {
      const name = 'New dashboard'
      const { error } = await createBoard({
        base_id: installationId, owner_id: userId, name, scope: 'personal',
        layout: appendWidgetToBoardLayout({ lg: [] }, widget, uuid()),
      })
      if (error) { toast.error(error); return }
      toast.success(`Copied to new dashboard "${name}"`)
      await refreshBoards()
      return
    }
    const dest = boards.find(b => b.id === target)
    if (!dest) return
    if (target === activeId) {
      setWidgets(appendWidgetToLayout(widgets, widget, uuid()))
      markDirty()
    } else {
      const nextBl = appendWidgetToBoardLayout(dest.layout, widget, uuid())
      try {
        await saveBoardLayout({ boardId: target, layout: nextBl, baseId: installationId, userId })
      } catch { toast.error('Could not copy the widget'); return }
    }
    toast.success(`Copied to "${dest.name}"`)
    await refreshBoards()
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
    // Deleting the board cascades away any default row pointing at it; switch to
    // the remaining default if it wasn't the one deleted, else the first board.
    const nextId = defaultBoardId && defaultBoardId !== activeId ? defaultBoardId : undefined
    await refreshBoards(nextId)
  }

  // Set the active board (any board, incl. shared) as the user's default.
  const handleSetDefault = async () => {
    if (!activeId || !installationId || !userId) return
    const { error } = await setDefaultBoard(activeId, installationId, userId)
    if (error) { toast.error(error); return }
    setDefaultBoardId(activeId)
    toast.success('Set as default dashboard')
    await refreshBoards(activeId)
  }

  // Create shared board (from share modal)
  const handleCreateShared = async () => {
    const name = shareNewName.trim()
    if (!name || !installationId) return
    setModalBusy(true)
    // Capture whether we're converting a personal board the user owns *before*
    // the async work, so a board switch can't change it mid-flight.
    const convertFrom = (activeBoard?.scope === 'personal' && activeBoard.owner_id === userId) ? activeId : null
    const { data, error } = await createBoard({
      base_id: installationId, owner_id: null, name, scope: 'shared',
      // Copy the current dashboard's full layout (all device breakpoints) into the shared board.
      layout: boardLayout,
    })
    if (error) { toast.error(error); setModalBusy(false); return }
    // Convert: remove the personal original so the board appears only under
    // "Shared". (RLS blocks an in-place owner_id flip, so we create-then-delete.)
    if (convertFrom) {
      const del = await deleteBoard(convertFrom)
      if (del.error) {
        toast.error(`Shared "${name}" created, but couldn't remove the personal copy: ${del.error}`)
      }
    }
    toast.success(convertFrom ? `"${name}" is now a shared dashboard` : `Shared board "${name}" created with ${widgets.length} widget${widgets.length === 1 ? '' : 's'}`)
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
      markDirty()
      return next
    })
    setConfiguringId(null)
  }, [configuringId, markDirty])

  // Build BoardSummary list for BoardBar.
  const boardSummaries: BoardSummary[] = useMemo(
    () => boards.map(b => ({ id: b.id, name: b.name, scope: b.scope, role_template: b.role_template })),
    [boards],
  )

  // Personal boards the user can copy a widget into.
  const copyBoards = useMemo(
    () => boards.filter(b => b.owner_id === userId).map(b => ({ id: b.id, name: b.name })),
    [boards, userId],
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
        onToggleEdit={onToggleEdit}
        onAddWidget={() => setShowPalette(true)}
        onNewBoard={() => openModal('new', '')}
        onDuplicate={handleDuplicateBoard}
        onRenameBoard={() => openModal('rename', activeBoard?.name ?? '')}
        onDeleteBoard={handleDeleteBoard}
        canDeleteActive={canDeleteActive}
        onShareControls={canPublishShared ? () => openModal('share') : undefined}
        onSetDefault={canSetDefault ? handleSetDefault : undefined}
        defaultBoardId={defaultBoardId}
      />

      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-3)' }}>
          Your dashboard is empty. {editing ? 'Use "Add Widget" to get started.' : 'Tap Edit, then Add Widget.'}
        </div>
      ) : (
        <DashboardActionsProvider value={dashboardActions}>
          <WidgetGrid
            boardLayout={boardLayout}
            editing={editing}
            onDeviceLayoutChange={onDeviceLayoutChange}
            onRemove={onRemove}
            onConfigure={(id) => setConfiguringId(id)}
            onWidgetConfigChange={onWidgetConfigChange}
            copyBoards={copyBoards}
            onCopyWidget={(id, target) => {
              const w = widgets.find(x => x.i === id)
              if (w) copyWidgetToBoard(w, target)
            }}
          />
        </DashboardActionsProvider>
      )}

      {showPalette && (
        <WidgetPalette
          onAdd={onAdd}
          onClose={() => setShowPalette(false)}
        />
      )}

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
            {activeBoard?.scope === 'personal'
              ? 'Make this dashboard shared. It moves out of your Personal list and becomes visible to everyone at this base.'
              : 'Create a new shared board visible to all users at this base.'}
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
              {activeBoard?.scope === 'personal'
                ? (modalBusy ? 'Converting…' : 'Convert to Shared')
                : (modalBusy ? 'Creating…' : 'Create Shared Board')}
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
