'use client'
import { useMemo, useState } from 'react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'
import type { TableWidgetConfig, TableWidgetDescriptor, ColumnDef } from '@/lib/dashboard/table/types'
import { normalizeTableConfig } from '@/lib/dashboard/table/config'
import { resolveVisibleColumns } from '@/lib/dashboard/table/columns'

export function TableConfigForm<Row>({
  config, onSave, onCancel, descriptor,
}: WidgetConfigProps & { descriptor: TableWidgetDescriptor<Row> }) {
  const allColumns: ColumnDef<Row>[] = descriptor.useColumns ? descriptor.useColumns() : (descriptor.columns ?? [])
  const start = useMemo(() => normalizeTableConfig(config as TableWidgetConfig, descriptor, allColumns), [])

  const [title, setTitle] = useState(start.title ?? '')
  const [visibleKeys, setVisibleKeys] = useState<string[]>(
    resolveVisibleColumns(allColumns, start.columns).map(c => c.key),
  )
  const [filters, setFilters] = useState<Record<string, string[] | string>>(start.filters ?? {})
  const [extras, setExtras] = useState<Record<string, string>>(start.extras ?? {})

  const box: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const section: React.CSSProperties = { fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', marginTop: 6 }

  function toggleColumn(key: string) {
    setVisibleKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  function toggleEnum(fk: string, val: string) {
    setFilters(prev => {
      const cur = Array.isArray(prev[fk]) ? (prev[fk] as string[]) : []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      return { ...prev, [fk]: next }
    })
  }

  function save() {
    // Persist visibleKeys in descriptor order so the table column order is stable.
    const ordered = allColumns.filter(c => visibleKeys.includes(c.key)).map(c => c.key)
    onSave({
      title: title.trim() || undefined,
      columns: ordered,
      filters,
      extras,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input style={box} placeholder="Widget title (optional)" value={title} onChange={e => setTitle(e.target.value)} />

      <div style={section}>Columns</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {allColumns.map(c => (
          <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
            <input type="checkbox" checked={visibleKeys.includes(c.key)} onChange={() => toggleColumn(c.key)} />
            {c.label}
          </label>
        ))}
      </div>

      {descriptor.filters.map(f => (
        <div key={f.key}>
          <div style={section}>{f.label}</div>
          {f.kind === 'text' ? (
            <input style={box} placeholder={`Filter by ${f.label.toLowerCase()}`}
              value={(filters[f.key] as string) ?? ''} onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(f.options ?? []).map(o => {
                const sel = Array.isArray(filters[f.key]) ? (filters[f.key] as string[]) : []
                return (
                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
                    <input type="checkbox" checked={sel.includes(o.value)} onChange={() => toggleEnum(f.key, o.value)} />
                    {o.label}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {(descriptor.extras ?? []).map(e => (
        <div key={e.key}>
          <div style={section}>{e.label}</div>
          <select style={box} value={extras[e.key] ?? e.default} onChange={ev => setExtras(p => ({ ...p, [e.key]: ev.target.value }))}>
            {e.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={save} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
