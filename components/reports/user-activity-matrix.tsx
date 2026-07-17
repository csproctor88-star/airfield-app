'use client'

// NAMO/NAMT Report Tool — presentational matrix (users × selected domains).
// Spec: docs/superpowers/specs/2026-07-16-namo-namt-report-tool-design.md
// Kept separate from the page for testability (no data fetching in here).

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react'
import type { DomainDef, UserActivityData, UserActivityRow } from '@/lib/reports/user-activity-data'
import { formatZuluDate } from '@/lib/utils'

interface UserActivityMatrixProps {
  data: UserActivityData
  /** Selected domains, in column display order. */
  domains: DomainDef[]
}

const stickyCellBase: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  background: 'var(--color-bg-surface-solid)',
}

export function UserActivityMatrix({ data, domains }: UserActivityMatrixProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const toggle = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const linked = data.rows.filter((r) => r.kind === 'profile')
  const unlinked = data.rows.filter((r) => r.kind === 'unlinked')
  const unattributed = data.rows.filter((r) => r.kind === 'unattributed')
  const colCount = domains.length + 2 // user + domains + total
  const grandTotal = domains.reduce((sum, d) => sum + data.totals[d.key], 0)

  return (
    <div>
      <div
        style={{
          overflowX: 'auto',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          background: 'var(--color-bg-surface)',
        }}
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ ...stickyCellBase, ...headerCellStyle, textAlign: 'left' }}>User</th>
              {domains.map((d) => (
                <th key={d.key} style={headerCellStyle}>{d.label}</th>
              ))}
              <th style={{ ...headerCellStyle, fontWeight: 800 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}
                >
                  No attributed activity in this range
                </td>
              </tr>
            )}

            {linked.length > 0 && <SectionHeader label="Personnel" colSpan={colCount} />}
            {linked.map((row) => (
              <MatrixRow
                key={`profile:${row.key}`}
                row={row}
                domains={domains}
                expanded={expandedKeys.has(row.key)}
                onToggle={() => toggle(row.key)}
              />
            ))}

            {unlinked.length > 0 && <SectionHeader label="Unlinked names" colSpan={colCount} />}
            {unlinked.map((row) => (
              <MatrixRow
                key={`unlinked:${row.key}`}
                row={row}
                domains={domains}
                expanded={expandedKeys.has(row.key)}
                onToggle={() => toggle(row.key)}
                chip="unlinked"
              />
            ))}

            {unattributed.length > 0 && <SectionHeader label="Unattributed" colSpan={colCount} />}
            {unattributed.map((row) => (
              <MatrixRow
                key={`unattributed:${row.key}`}
                row={row}
                domains={domains}
                expanded={expandedKeys.has(row.key)}
                onToggle={() => toggle(row.key)}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...stickyCellBase, ...footerCellStyle, textAlign: 'left', fontWeight: 800 }}>Totals</td>
              {domains.map((d) => (
                <td key={d.key} style={{ ...footerCellStyle, fontWeight: 800 }}>{data.totals[d.key]}</td>
              ))}
              <td style={{ ...footerCellStyle, fontWeight: 800, color: 'var(--color-accent)' }}>{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {data.zeroActivityUnavailable && (
        <div style={noticeStyle}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Personnel with zero activity could not be loaded for this base — the matrix above reflects recorded activity only.</span>
        </div>
      )}

      {data.coverageNotes.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.coverageNotes.map((note) => {
            const def = domains.find((d) => d.key === note.domain)
            return (
              <div key={note.domain} style={noticeStyle}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  {def?.label ?? note.domain}: per-user attribution begins {formatZuluDate(note.coverageStart)};{' '}
                  {note.affected} record{note.affected === 1 ? '' : 's'} in this range lack per-user attribution.
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────

function MatrixRow({
  row, domains, expanded, onToggle, chip,
}: {
  row: UserActivityRow
  domains: DomainDef[]
  expanded: boolean
  onToggle: () => void
  chip?: string
}) {
  const domainsWithRecords = domains.filter((d) => (row.records[d.key]?.length ?? 0) > 0)

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer', borderTop: '1px solid var(--color-border)' }}
      >
        <td style={{ ...stickyCellBase, ...cellStyle, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {expanded ? <ChevronDown size={14} color="var(--color-text-3)" /> : <ChevronRight size={14} color="var(--color-text-3)" />}
            <span style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{row.display}</span>
            {chip && (
              <span style={chipStyle}>{chip}</span>
            )}
          </div>
        </td>
        {domains.map((d) => (
          <td key={d.key} style={cellStyle}>{row.counts[d.key] || '—'}</td>
        ))}
        <td style={{ ...cellStyle, fontWeight: 700 }}>{row.total}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={domains.length + 2} style={{ padding: 0, background: 'var(--color-bg)' }}>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {domainsWithRecords.length === 0 && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>No records in the selected range.</div>
              )}
              {domainsWithRecords.map((d) => (
                <div key={d.key}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', marginBottom: 4 }}>
                    {d.label} ({row.records[d.key]!.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {row.records[d.key]!.map((rec) => (
                      <div
                        key={rec.id}
                        style={{
                          display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8,
                          fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)',
                        }}
                      >
                        <span style={{ color: 'var(--color-text-4)', minWidth: 80 }}>{formatZuluDate(rec.ts)}</span>
                        {rec.href ? (
                          <Link href={rec.href} style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                            {rec.label}
                          </Link>
                        ) : (
                          <span>{rec.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          padding: '6px 12px', fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          background: 'color-mix(in srgb, var(--color-text-3) 6%, transparent)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {label}
      </td>
    </tr>
  )
}

// ── Styles ───────────────────────────────────────────────────

const headerCellStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)',
  textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)',
}

const cellStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)',
  textAlign: 'right', whiteSpace: 'nowrap',
}

const footerCellStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
  textAlign: 'right', whiteSpace: 'nowrap', borderTop: '2px solid var(--color-border)',
}

const chipStyle: React.CSSProperties = {
  fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
  border: '1px solid var(--color-border)', color: 'var(--color-text-3)',
  background: 'color-mix(in srgb, var(--color-text-3) 8%, transparent)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
}

const noticeStyle: React.CSSProperties = {
  marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start',
  fontSize: 'var(--fs-xs)', color: 'var(--color-warning)',
}
