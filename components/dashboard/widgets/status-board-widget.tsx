'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { useDashboard } from '@/lib/dashboard-context'
import { fetchCustomStatusBoards, fetchCustomStatusItems, type CustomStatusBoard } from '@/lib/supabase/custom-status'
import { fetchNavaidStatuses } from '@/lib/supabase/navaids'
import { statusBoardColor, statusBoardLabel, type StatusBoardKind } from '@/lib/dashboard/status-board'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type StatusBoardConfig = { title?: string; kind?: StatusBoardKind; boardId?: string }
type Row = { name: string; value: string; detail?: string }

const KINDS: { value: StatusBoardKind; label: string }[] = [
  { value: 'custom', label: 'Custom Status Board' },
  { value: 'navaid', label: 'NAVAIDs' },
  { value: 'runway', label: 'Runway Status' },
  { value: 'arff', label: 'ARFF' },
]

const muted: React.CSSProperties = { color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }

export function StatusBoardWidget({ config }: WidgetProps) {
  const c = config as StatusBoardConfig
  const kind: StatusBoardKind = c.kind ?? 'custom'
  const { installationId, runways, arffAircraft } = useInstallation()
  const { runwayStatuses, arffStatuses, arffCat } = useDashboard()

  const isFetchKind = kind === 'custom' || kind === 'navaid'
  const [fetched, setFetched] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(isFetchKind)

  useEffect(() => {
    let cancelled = false
    if (kind === 'custom') {
      if (!c.boardId) { setFetched([]); setLoading(false); return }
      setLoading(true)
      fetchCustomStatusItems(c.boardId).then((items) => {
        if (!cancelled) { setFetched(items.map((i) => ({ name: i.item_name, value: i.status, detail: i.notes || undefined }))); setLoading(false) }
      })
    } else if (kind === 'navaid') {
      if (!installationId) return
      setLoading(true)
      fetchNavaidStatuses(installationId).then((ns) => {
        if (!cancelled) { setFetched(ns.map((n) => ({ name: n.navaid_name, value: n.status, detail: n.notes || undefined }))); setLoading(false) }
      })
    }
    return () => { cancelled = true }
  }, [kind, c.boardId, installationId])

  let header: string | null = null
  let rows: Row[] = []
  if (isFetchKind) {
    rows = fetched ?? []
  } else if (kind === 'runway') {
    rows = runways.map((r) => {
      const label = `${r.end1_designator}/${r.end2_designator}`
      const e = runwayStatuses[label] as { status?: string; active_end?: string | null; remarks?: string | null } | undefined
      const status = e?.status ?? 'open'
      const detail = e?.remarks || (e?.active_end ? `Active ${e.active_end}` : undefined)
      return { name: label, value: status, detail }
    })
  } else {
    header = arffCat != null ? `ARFF Index ${arffCat}` : null
    rows = (arffAircraft as string[]).map((a) => ({ name: a, value: arffStatuses[a] ?? 'optimum' }))
  }

  const emptyMsg = kind === 'custom' && !c.boardId ? 'Pick a status board in settings.' : 'Nothing to show.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {header && <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 6 }}>{header}</div>}
        {loading ? <div style={muted}>Loading…</div>
          : rows.length === 0 ? <div style={{ ...muted, fontStyle: 'italic' }}>{emptyMsg}</div>
          : rows.map((row, i) => {
              const color = statusBoardColor(kind, row.value)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, alignSelf: 'center' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>{row.name}</div>
                    {row.detail && <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>{row.detail}</div>}
                  </div>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color }}>{statusBoardLabel(kind, row.value)}</span>
                </div>
              )
            })}
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View status board →</Link>
      </div>
    </div>
  )
}

export function StatusBoardConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const { installationId } = useInstallation()
  const c = config as StatusBoardConfig
  const [title, setTitle] = useState(c.title ?? '')
  const [kind, setKind] = useState<StatusBoardKind>(c.kind ?? 'custom')
  const [boardId, setBoardId] = useState(c.boardId ?? '')
  const [boards, setBoards] = useState<CustomStatusBoard[]>([])

  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    fetchCustomStatusBoards(installationId).then((b) => {
      if (cancelled) return
      setBoards(b)
      setBoardId((prev) => prev || b[0]?.id || '')
    })
    return () => { cancelled = true }
  }, [installationId])

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 3, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div>
        <span style={label}>Show</span>
        <select style={input} value={kind} onChange={(e) => setKind(e.target.value as StatusBoardKind)}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>
      {kind === 'custom' && (
        <div>
          <span style={label}>Board</span>
          <select style={input} value={boardId} onChange={(e) => setBoardId(e.target.value)}>
            {boards.length === 0 && <option value="">No custom boards at this base</option>}
            {boards.map((b) => <option key={b.id} value={b.id}>{b.board_name}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ ...config, title: title.trim() || undefined, kind, boardId: kind === 'custom' ? (boardId || undefined) : undefined })}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
