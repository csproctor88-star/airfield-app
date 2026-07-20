'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertOctagon } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { useDashboard } from '@/lib/dashboard-context'
import { fetchCustomStatusBoards, fetchCustomStatusItems, type CustomStatusBoard } from '@/lib/supabase/custom-status'
import { fetchNavaidStatuses } from '@/lib/supabase/navaids'
import { fetchInstallationNavaids } from '@/lib/supabase/installations'
import { groupNavaidsByEnd, navaidDisplayName } from '@/lib/status-board-navaids'
import { statusBoardColor, statusBoardLabel, statusBoardChip, type StatusBoardKind } from '@/lib/dashboard/status-board'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type StatusBoardConfig = { title?: string; kind?: StatusBoardKind; boardId?: string }
type Row = { name: string; value: string; detail?: string }

// ── Row renderers mirroring the Airfield Status page's vocabulary ──────────
// NAVAID + custom boards use a letter chip (G/Y/R) on the page; runway + ARFF
// use tinted status cards. The widget echoes both so it reads as the same app.

/** NAVAID / custom-board row: name + a G/Y/R letter chip (page navaid chip). */
function ChipRow({ kind, row }: { kind: StatusBoardKind; row: Row }) {
  const color = statusBoardColor(kind, row.value)
  const v = String(row.value ?? '').toLowerCase()
  // Page only surfaces the note alongside off-nominal (yellow/red) items.
  const showNote = (v === 'yellow' || v === 'red') && !!row.detail
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
        <span style={{
          width: 28, height: 24, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--radius-sm)', border: `1.5px solid ${color}`,
          background: `color-mix(in srgb, ${color} 13%, transparent)`,
          color, fontWeight: 800, fontSize: 'var(--fs-sm)', lineHeight: 1,
        }}>{statusBoardChip(row.value)}</span>
      </div>
      {showNote && (
        <div style={{
          marginTop: 4, fontSize: 'var(--fs-2xs)', color: 'var(--color-text-1)',
          background: 'var(--color-bg-inset)',
          border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          borderRadius: 'var(--radius-sm)', padding: '4px 8px', lineHeight: 1.3,
        }}>{row.detail}</div>
      )}
    </div>
  )
}

/** Runway / ARFF row: a status-tinted card with a colored status word. */
function TintRow({ kind, row }: { kind: StatusBoardKind; row: Row }) {
  const color = statusBoardColor(kind, row.value)
  const v = String(row.value ?? '').toLowerCase()
  const isArff = kind === 'arff'
  const heavy = isArff && (v === 'critical' || v === 'inadequate')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 6,
      borderRadius: 'var(--radius-md)',
      background: `color-mix(in srgb, ${color} ${heavy ? 16 : 8}%, transparent)`,
      // Echo the page's tier escalation: the critical/inadequate tier gets a
      // heavier border + a 3px accent left edge.
      border: `1px solid color-mix(in srgb, ${color} ${heavy ? 40 : 22}%, transparent)`,
      borderLeft: heavy ? `3px solid ${color}` : `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: isArff ? 700 : 600, fontFamily: isArff ? 'monospace' : 'inherit', color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
        {row.detail && <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.detail}</div>}
      </div>
      {/* ARFF readiness is uppercased like the page card; runway stays the
          page's title-case ('Open'/'Suspended'/'Closed'). 'inadequate' carries
          the page's AlertOctagon — the only state meaning ARFF can't meet mission. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--fs-xs)', fontWeight: 800, color, textTransform: isArff ? 'uppercase' : 'none', letterSpacing: '0.04em', flexShrink: 0 }}>
        {isArff && v === 'inadequate' && <AlertOctagon size={11} strokeWidth={2.5} />}
        {statusBoardLabel(kind, row.value)}
      </span>
    </div>
  )
}

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
  const { installationId, currentInstallation, runways, arffAircraft } = useInstallation()
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
      // Mirror the status page's loadNavaids: statuses intersect with the
      // base_navaids config — deleted NAVAIDs linger in navaid_statuses and
      // must not resurface here.
      Promise.all([
        fetchNavaidStatuses(installationId),
        fetchInstallationNavaids(installationId),
      ]).then(([ns, configured]) => {
        if (cancelled) return
        const configuredNames = new Set(configured.map((n) => n.navaid_name))
        const resolved = ns.length > 0 ? ns.filter((n) => configuredNames.has(n.navaid_name)) : ns
        setFetched(resolved.map((n) => ({ name: n.navaid_name, value: n.status, detail: n.notes || undefined })))
        setLoading(false)
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
  const isChipKind = kind === 'navaid' || kind === 'custom'

  // NAVAIDs render grouped per runway end exactly like the status board:
  // same matcher, same display-name stripping, same custom column labels
  // (bases.status_labels) — never the raw DB rows.
  const renderNavaidGroups = () => {
    const statusLabels = (currentInstallation?.status_labels ?? {}) as Record<string, string>
    const endDesignators = runways.flatMap((r) => [r.end1_designator, r.end2_designator])
    const { groups, other } = groupNavaidsByEnd(
      rows.map((r) => ({ ...r, navaid_name: r.name })),
      endDesignators,
    )
    const blocks = [
      ...groups.filter((g) => g.items.length > 0).map((g) => ({
        key: `rwy_${g.designator}`,
        label: statusLabels[`navaid_rwy_${g.designator}`] || `RWY ${g.designator}`,
        items: g.items,
      })),
      ...(other.length > 0 ? [{ key: 'other', label: statusLabels['navaid_other'] || 'OTHER', items: other }] : []),
    ]
    return blocks.map((b, bi) => (
      <div key={b.key}>
        <div style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
          margin: bi === 0 ? '0 0 5px' : '8px 0 5px',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>{b.label}</div>
        {b.items.map((item) => (
          <ChipRow key={item.navaid_name} kind={kind} row={{ ...item, name: navaidDisplayName(item.navaid_name, endDesignators) }} />
        ))}
      </div>
    ))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {header && <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{header}</div>}
        {loading ? <div style={muted}>Loading…</div>
          : rows.length === 0 ? <div style={{ ...muted, fontStyle: 'italic' }}>{emptyMsg}</div>
          : kind === 'navaid' ? renderNavaidGroups()
          : isChipKind ? rows.map((row, i) => <ChipRow key={i} kind={kind} row={row} />)
          : rows.map((row, i) => <TintRow key={i} kind={kind} row={row} />)}
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
