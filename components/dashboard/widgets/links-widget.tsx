'use client'
import { useState } from 'react'
import { ExternalLink, Plus, Trash2, Search, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'
import { moveItem } from '@/lib/dashboard/array-move'

type LinkRow = { label: string; url: string; description?: string }
type LinksConfig = { title?: string; links?: LinkRow[] }

function normUrl(u: string): string {
  const t = u.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function LinksWidget({ config }: { config: Record<string, unknown> }) {
  const c = config as LinksConfig
  const links = Array.isArray(c.links) ? c.links : []
  const [query, setQuery] = useState('')

  if (links.length === 0) {
    return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No links yet. Edit this widget to add some.</div>
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? links.filter(l =>
        l.label.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q)
      )
    : links

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--color-text-3)', pointerEvents: 'none',
        }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search links…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '5px 8px 5px 26px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--fs-xs)',
            fontFamily: 'inherit',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filtered.length === 0 && (
          <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)', padding: '4px 0' }}>No matches.</div>
        )}
        {filtered.map((l, i) => (
          <a key={i} href={normUrl(l.url)} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', flexDirection: 'column', padding: '4px 0',
            textDecoration: 'none',
          }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: 'var(--color-accent)', fontSize: 'var(--fs-sm)', fontWeight: 600,
            }}>
              <ExternalLink size={14} strokeWidth={2.25} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label || l.url}</span>
            </span>
            {l.description && (
              <span style={{
                paddingLeft: 22,
                color: 'var(--color-text-3)',
                fontSize: 'var(--fs-xs)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{l.description}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

export function LinksConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as LinksConfig
  const [title, setTitle] = useState(c.title ?? '')
  const [rows, setRows] = useState<LinkRow[]>(
    Array.isArray(c.links) && c.links.length ? c.links : [{ label: '', url: '', description: '' }]
  )
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const setRow = (i: number, patch: Partial<LinkRow>) =>
    setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
      {rows.map((r, i) => (
        <div
          key={i}
          onDragOver={(e) => { e.preventDefault(); if (overIdx !== i) setOverIdx(i) }}
          onDrop={() => { if (dragIdx !== null) setRows(rs => moveItem(rs, dragIdx, i)); setDragIdx(null); setOverIdx(null) }}
          style={{
            display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: '1px solid var(--color-border)',
            borderTop: overIdx === i && dragIdx !== null && dragIdx !== i ? '2px solid var(--color-accent)' : undefined,
            opacity: dragIdx === i ? 0.4 : 1,
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span draggable onDragStart={() => setDragIdx(i)} onDragEnd={() => { setDragIdx(null); setOverIdx(null) }} title="Drag to reorder (desktop)" style={{ cursor: 'move', userSelect: 'none', color: 'var(--color-text-3)', display: 'flex', flexShrink: 0, alignItems: 'center' }}><GripVertical size={15} /></span>
            {/* Tap-to-reorder — works on touch where native drag does not. */}
            <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <button type="button" aria-label="Move link up" title="Move up" onClick={() => setRows(rs => moveItem(rs, i, i - 1))} disabled={i === 0}
                style={{ display: 'flex', border: 'none', background: 'transparent', padding: 0, lineHeight: 0, cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--color-border)' : 'var(--color-text-3)' }}><ChevronUp size={14} /></button>
              <button type="button" aria-label="Move link down" title="Move down" onClick={() => setRows(rs => moveItem(rs, i, i + 1))} disabled={i === rows.length - 1}
                style={{ display: 'flex', border: 'none', background: 'transparent', padding: 0, lineHeight: 0, cursor: i === rows.length - 1 ? 'default' : 'pointer', color: i === rows.length - 1 ? 'var(--color-border)' : 'var(--color-text-3)' }}><ChevronDown size={14} /></button>
            </div>
            <input style={{ ...input, flex: '0 0 35%' }} placeholder="Label" value={r.label} onChange={e => setRow(i, { label: e.target.value })} />
            <input style={{ ...input, flex: 1 }} placeholder="https://…" value={r.url} onChange={e => setRow(i, { url: e.target.value })} />
            <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} aria-label="Remove link" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-3)', flexShrink: 0 }}>
              <Trash2 size={15} />
            </button>
          </div>
          <input
            style={{ ...input, color: 'var(--color-text-2)' }}
            placeholder="Description (optional)"
            value={r.description ?? ''}
            onChange={e => setRow(i, { description: e.target.value })}
          />
        </div>
      ))}
      <button onClick={() => setRows(rs => [...rs, { label: '', url: '', description: '' }])} style={{
        display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '6px 10px',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
        color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
      }}><Plus size={14} /> Add link</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({
          title: title.trim() || undefined,
          links: rows
            .filter(r => r.url.trim())
            .map(r => ({
              label: r.label.trim(),
              url: r.url.trim(),
              ...(r.description?.trim() ? { description: r.description.trim() } : {}),
            })),
        })} style={{
          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
          background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit',
        }}>Save</button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}
