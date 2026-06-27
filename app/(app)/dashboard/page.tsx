'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { PageHeader } from '@/components/ui/page-header'
import { BoardBar } from '@/components/dashboard/board-bar'
import { WidgetGrid } from '@/components/dashboard/widget-grid'
import { WidgetPalette } from '@/components/dashboard/widget-palette'
import { getOrCreateDefaultBoard } from '@/lib/supabase/dashboard-boards'
import { saveBoardLayout } from '@/lib/dashboard-board-write'
import { getWidgetDef } from '@/lib/dashboard/registry'
import type { WidgetInstance } from '@/lib/dashboard/layout'
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

export default function DashboardPage() {
  const { installationId } = useInstallation()
  const [boardId, setBoardId] = useState<string | null>(null)
  const [boardName, setBoardName] = useState('My Dashboard')
  const [widgets, setWidgets] = useState<WidgetInstance[]>([])
  const [editing, setEditing] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load user + default board.
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
      const board = await getOrCreateDefaultBoard(installationId, uid)
      if (cancelled || !board) return
      setBoardId(board.id)
      setBoardName(board.name)
      setWidgets(board.layout.length ? board.layout : DEFAULT_LAYOUT)
    })()
    return () => { cancelled = true }
  }, [installationId])

  const persist = useCallback((next: WidgetInstance[]) => {
    if (!boardId || !installationId || !userId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveBoardLayout({ boardId, layout: next, baseId: installationId, userId })
        .catch(() => toast.error('Could not save dashboard layout'))
    }, 800)
  }, [boardId, installationId, userId])

  const onLayoutChange = useCallback((next: WidgetInstance[]) => {
    setWidgets(next); persist(next)
  }, [persist])

  const onRemove = useCallback((id: string) => {
    setWidgets(prev => { const next = prev.filter(w => w.i !== id); persist(next); return next })
  }, [persist])

  const onAdd = useCallback((type: string) => {
    const def = getWidgetDef(type)
    if (!def) return
    setWidgets(prev => {
      const next = [...prev, { i: uuid(), type, config: {}, x: 0, y: Infinity as unknown as number, w: def.defaultSize.w, h: def.defaultSize.h }]
      persist(next); return next
    })
  }, [persist])

  const isEmpty = useMemo(() => widgets.length === 0, [widgets])

  return (
    <div className="page-container dashboard-fullbleed">
      <PageHeader eyebrow="Operations" title="Dashboard" />
      <BoardBar
        boardName={boardName}
        editing={editing}
        onToggleEdit={() => setEditing(e => !e)}
        onAddWidget={() => setShowPalette(true)}
      />
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-3)' }}>
          Your dashboard is empty. {editing ? 'Use "Add Widget" to get started.' : 'Tap Edit, then Add Widget.'}
        </div>
      ) : (
        <WidgetGrid widgets={widgets} editing={editing} onLayoutChange={onLayoutChange} onRemove={onRemove} />
      )}
      {showPalette && <WidgetPalette onAdd={onAdd} onClose={() => setShowPalette(false)} />}
    </div>
  )
}
