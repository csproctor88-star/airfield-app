// components/flip/change-report.tsx
'use client'

import { useState, useMemo } from 'react'
import { FileDown, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import type { FlipChange } from '@/lib/supabase/flip'
import { generateFlipChangesReportPdf, changeStatus, changeContentAbbrs, CHANGE_CONTENT } from '@/lib/flip-changes-pdf'

type SortKey = 'flip_title' | 'status' | 'submitted_by_name' | 'coordinated_at'
const STATUSES = ['Coordination', 'Submitted', 'Published', 'Rejected']

const STATUS_COLOR: Record<string, string> = {
  Coordination: 'var(--color-warning)', Submitted: 'var(--color-blue)', Published: 'var(--color-success)', Rejected: 'var(--color-danger)',
}

export function ChangeReport({ changes }: { changes: FlipChange[] }) {
  const { currentInstallation } = useInstallation()
  const [flipFilter, setFlipFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [contentFilter, setContentFilter] = useState<string[]>([])
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'coordinated_at', dir: 'desc' })

  const titles = useMemo(() => Array.from(new Set(changes.map((c) => c.flip_title))).sort(), [changes])

  const toggleSort = (key: SortKey) => setSort((p) => p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  const toggleContent = (key: string) => setContentFilter((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key])

  const rows = useMemo(() => {
    let r = changes.slice()
    if (flipFilter) r = r.filter((c) => c.flip_title === flipFilter)
    if (statusFilter) r = r.filter((c) => changeStatus(c) === statusFilter)
    if (contentFilter.length) r = r.filter((c) => contentFilter.some((k) => c[k as keyof FlipChange]))
    r.sort((a, b) => {
      const av = sort.key === 'status' ? changeStatus(a) : String(a[sort.key as keyof FlipChange] ?? '')
      const bv = sort.key === 'status' ? changeStatus(b) : String(b[sort.key as keyof FlipChange] ?? '')
      const cmp = av.localeCompare(bv)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return r
  }, [changes, flipFilter, statusFilter, contentFilter, sort])

  const exportPdf = () => {
    if (rows.length === 0) { toast.error('No changes to export.'); return }
    const { doc, filename } = generateFlipChangesReportPdf({
      changes: rows,
      baseName: currentInstallation?.name ?? undefined, baseIcao: currentInstallation?.icao ?? undefined,
      filters: {
        flip: flipFilter || undefined,
        status: statusFilter || undefined,
        content: contentFilter.length ? contentFilter.map((k) => CHANGE_CONTENT.find((c) => c.key === k)?.label ?? k) : undefined,
      },
    })
    doc.save(filename)
    toast.success('Report generated')
  }

  const selectStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)' }
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 'var(--fs-sm)', verticalAlign: 'top' }

  const sortable = (key: SortKey, lbl: string) => (
    <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(key)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {lbl}
        {sort.key === key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </span>
    </th>
  )

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select style={selectStyle} value={flipFilter} onChange={(e) => setFlipFilter(e.target.value)}>
          <option value="">All FLIPs</option>
          {titles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 999, padding: '3px 6px' }}>
          {CHANGE_CONTENT.map((ct) => {
            const on = contentFilter.includes(ct.key)
            return (
              <button key={ct.key} onClick={() => toggleContent(ct.key)}
                style={{ padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 600,
                  background: on ? 'var(--color-accent)' : 'transparent', color: on ? '#fff' : 'var(--color-text-3)' }}>
                {ct.label}
              </button>
            )
          })}
        </div>
        <button onClick={exportPdf} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
          <FileDown size={15} /> Export PDF
        </button>
      </div>

      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 8 }}>{rows.length} change{rows.length === 1 ? '' : 's'}</div>

      <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'auto', background: 'var(--color-bg-surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-inset)' }}>
              {sortable('flip_title', 'FLIP Title')}
              <th style={th}>Content</th>
              <th style={th}>Reference Doc &amp; Page</th>
              <th style={th}>NOTAM</th>
              {sortable('status', 'Status')}
              {sortable('submitted_by_name', 'Submitted By')}
              {sortable('coordinated_at', 'Coordinated')}
              <th style={th}>Published</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const status = changeStatus(c)
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.flip_title}</td>
                  <td style={td}>{changeContentAbbrs(c).join(', ') || '—'}</td>
                  <td style={td}>{c.reference_doc_page ?? '—'}</td>
                  <td style={td}>{c.notam ?? '—'}</td>
                  <td style={{ ...td, fontWeight: 700, color: STATUS_COLOR[status] ?? 'var(--color-text-1)' }}>{status}</td>
                  <td style={td}>{c.submitted_by_name}</td>
                  <td style={td}>{c.coordinated_at.slice(0, 10)}</td>
                  <td style={td}>{c.published_date ?? '—'}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, color: 'var(--color-text-3)', fontStyle: 'italic' }}>No changes match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
