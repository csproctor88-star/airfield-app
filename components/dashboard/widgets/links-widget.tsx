'use client'
import { useState } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type LinkRow = { label: string; url: string }
type LinksConfig = { title?: string; links?: LinkRow[] }

function normUrl(u: string): string {
  const t = u.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function LinksWidget({ config }: { config: Record<string, unknown> }) {
  const c = config as LinksConfig
  const links = Array.isArray(c.links) ? c.links : []
  if (links.length === 0) {
    return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No links yet. Edit this widget to add some.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {links.map((l, i) => (
        <a key={i} href={normUrl(l.url)} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
          textDecoration: 'none', color: 'var(--color-accent)', fontSize: 'var(--fs-sm)', fontWeight: 600,
        }}>
          <ExternalLink size={14} strokeWidth={2.25} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label || l.url}</span>
        </a>
      ))}
    </div>
  )
}

export function LinksConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as LinksConfig
  const [title, setTitle] = useState(c.title ?? '')
  const [rows, setRows] = useState<LinkRow[]>(Array.isArray(c.links) && c.links.length ? c.links : [{ label: '', url: '' }])

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const setRow = (i: number, patch: Partial<LinkRow>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...input, flex: '0 0 35%' }} placeholder="Label" value={r.label} onChange={e => setRow(i, { label: e.target.value })} />
          <input style={{ ...input, flex: 1 }} placeholder="https://…" value={r.url} onChange={e => setRow(i, { url: e.target.value })} />
          <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} aria-label="Remove link" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-3)' }}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button onClick={() => setRows(rs => [...rs, { label: '', url: '' }])} style={{
        display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '6px 10px',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
        color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
      }}><Plus size={14} /> Add link</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ title: title.trim() || undefined, links: rows.filter(r => r.url.trim()).map(r => ({ label: r.label.trim(), url: r.url.trim() })) })} style={{
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
