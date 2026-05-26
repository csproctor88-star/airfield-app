'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, ClipboardCheck, Download, X, Info, ExternalLink,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { getRoleLabel } from '@/lib/airport-mode'
import { fetchInstallationMembers } from '@/lib/supabase/installations'
import {
  fetchTrainingTopics,
  fetchTrainingRecords,
  classifyTrainingStatus,
  type TrainingTopic,
  type TrainingRecord,
  type TrainingStatus,
} from '@/lib/supabase/training-part139'
import { formatZuluDate } from '@/lib/utils'

/**
 * /training/compliance — users × topics matrix view.
 *
 * Rows = base members. Columns = active topics (system + base
 * overrides, de-duped by code). Cells colored by the latest record's
 * status. Click cell to see the chain history for that (user, topic).
 *
 * Mobile: matrix scrolls horizontally; the leftmost user column is
 * sticky-left so the row context survives scroll.
 */

type Member = Awaited<ReturnType<typeof fetchInstallationMembers>>[number]

type CellData = {
  status: TrainingStatus
  latestRecord: TrainingRecord | null
  chain: TrainingRecord[]
}

export default function TrainingCompliancePage() {
  const router = useRouter()
  const { installationId, currentInstallation } = useInstallation()

  const [members, setMembers] = useState<Member[]>([])
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [drill, setDrill] = useState<{ member: Member; topic: TrainingTopic; cell: CellData } | null>(null)

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [m, t, r] = await Promise.all([
      fetchInstallationMembers(installationId),
      fetchTrainingTopics(installationId),
      fetchTrainingRecords({ base_id: installationId }),
    ])
    setMembers(m)
    setTopics(t)
    setRecords(r)
    setLoading(false)
  }, [installationId])

  useEffect(() => { void load() }, [load])

  // Topics de-duped by code, base override wins
  const activeTopics = useMemo(() => {
    const byCode = new Map<string, TrainingTopic>()
    for (const t of topics) {
      const prior = byCode.get(t.code)
      if (!prior || (t.base_id && !prior.base_id)) byCode.set(t.code, t)
    }
    return Array.from(byCode.values()).sort((a, b) => a.sort_order - b.sort_order)
  }, [topics])

  // (user_id, topic_code) → CellData
  const cells = useMemo(() => {
    const topicCodeById = new Map(topics.map(t => [t.id, t.code] as const))
    // All records bucketed by (user, code), sorted newest first
    const byKey = new Map<string, TrainingRecord[]>()
    for (const r of records) {
      const code = topicCodeById.get(r.topic_id)
      if (!code) continue
      const key = `${r.user_id}::${code}`
      const arr = byKey.get(key) ?? []
      arr.push(r)
      byKey.set(key, arr)
    }
    for (const arr of Array.from(byKey.values())) {
      arr.sort((a: TrainingRecord, b: TrainingRecord) => (b.completed_at > a.completed_at ? 1 : -1))
    }

    const out = new Map<string, CellData>()
    for (const m of members) {
      for (const t of activeTopics) {
        const chain = byKey.get(`${m.user_id}::${t.code}`) ?? []
        const latest = chain[0] ?? null
        out.set(`${m.user_id}::${t.code}`, {
          status: classifyTrainingStatus(latest),
          latestRecord: latest,
          chain,
        })
      }
    }
    return out
  }, [members, activeTopics, records, topics])

  // Stats roll-up: total cells per status bucket
  const stats = useMemo(() => {
    let current = 0, expiring = 0, expired = 0, notStarted = 0
    for (const c of Array.from(cells.values())) {
      if (c.status === 'current') current++
      else if (c.status === 'expiring') expiring++
      else if (c.status === 'expired') expired++
      else notStarted++
    }
    const total = current + expiring + expired + notStarted
    return { current, expiring, expired, notStarted, total }
  }, [cells])

  function exportCsv() {
    // Wide table — one row per member, one column per topic + counts.
    const headerCols = ['Name', 'Role', 'Email', ...activeTopics.map(t => t.code)]
    const lines: string[] = [headerCols.map(csvEscape).join(',')]
    for (const m of members) {
      const row: string[] = [
        m.rank ? `${m.rank} ${m.name}` : m.name,
        getRoleLabel(m.role, currentInstallation) || m.role,
        m.email,
      ]
      for (const t of activeTopics) {
        const c = cells.get(`${m.user_id}::${t.code}`)
        if (!c) { row.push(''); continue }
        if (c.status === 'not_started') row.push('NOT STARTED')
        else if (c.status === 'expired') row.push(`EXPIRED${c.latestRecord?.expires_at ? ' ' + c.latestRecord.expires_at : ''}`)
        else if (c.status === 'expiring') row.push(`EXPIRING ${c.latestRecord?.expires_at ?? ''}`)
        else row.push(`CURRENT ${c.latestRecord?.expires_at ?? ''}`)
      }
      lines.push(row.map(csvEscape).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-compliance-${formatZuluDate(new Date().toISOString())}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded')
  }

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      <Link href="/training" style={backLinkStyle}>
        <ArrowLeft size={14} /> Training Overview
      </Link>

      <div style={headerRowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardCheck size={20} color="var(--color-cyan)" />
          <div>
            <div style={titleStyle}>Compliance Matrix</div>
            <div style={subtitleStyle}>
              {members.length} member{members.length === 1 ? '' : 's'} × {activeTopics.length} topic{activeTopics.length === 1 ? '' : 's'} = {stats.total} cells
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={exportCsv} style={secondaryBtnStyle} disabled={loading || members.length === 0}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div style={statsRowStyle}>
        <StatChip label="Current"     count={stats.current}    tint="green" />
        <StatChip label="Expiring"    count={stats.expiring}   tint="amber" />
        <StatChip label="Expired"     count={stats.expired}    tint="red"   />
        <StatChip label="Not started" count={stats.notStarted} tint="slate" />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)' }}>
          <Info size={12} /> Cells colored by latest record status. Click any cell to see history.
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-3)', padding: 24, textAlign: 'center' }}>Loading…</div>
      ) : members.length === 0 || activeTopics.length === 0 ? (
        <div style={emptyStateStyle}>
          <Info size={16} />
          {members.length === 0
            ? 'No base members yet. Invite users from User Management.'
            : 'No active topics yet — visit Training Topics to confirm the seed loaded.'}
        </div>
      ) : (
        <div style={matrixOuterStyle}>
          <div style={matrixInnerStyle}>
            {/* Header row */}
            <div style={matrixHeaderRowStyle}>
              <div style={{ ...stickyCellStyle, ...headerCellStyle }}>Member</div>
              {activeTopics.map(t => (
                <div key={t.code} style={{ ...topicHeaderStyle }} title={t.title}>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--fs-2xs)' }}>{t.code}</div>
                  <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </div>
                </div>
              ))}
            </div>

            {/* Body rows */}
            {members.map(m => (
              <div key={m.user_id} style={matrixBodyRowStyle}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/training/${m.user_id}`)}
                  onKeyDown={e => { if (e.key === 'Enter') router.push(`/training/${m.user_id}`) }}
                  style={{ ...stickyCellStyle, ...memberCellStyle, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.rank ? `${m.rank} ${m.name}` : m.name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getRoleLabel(m.role, currentInstallation) || m.role}
                  </div>
                </div>
                {activeTopics.map(t => {
                  const cell = cells.get(`${m.user_id}::${t.code}`)
                  if (!cell) return <div key={t.code} style={matrixCellStyle} />
                  const palette = CELL_PALETTE[cell.status]
                  return (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => setDrill({ member: m, topic: t, cell })}
                      style={{
                        ...matrixCellStyle,
                        background: palette.bg,
                        border: `1px solid ${palette.border}`,
                        color: palette.text,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                      title={
                        cell.status === 'not_started' ? 'Not started'
                          : cell.latestRecord ? `Completed ${cell.latestRecord.completed_at}${cell.latestRecord.expires_at ? ` · expires ${cell.latestRecord.expires_at}` : ''}`
                            : cell.status
                      }
                    >
                      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: 0.3 }}>
                        {STATUS_GLYPH[cell.status]}
                      </div>
                      {cell.latestRecord?.expires_at && cell.status !== 'not_started' && (
                        <div style={{ fontSize: 'var(--fs-2xs)', marginTop: 2, fontFamily: 'var(--font-mono, monospace)' }}>
                          {cell.latestRecord.expires_at.slice(2).replace(/-/g, '')}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {drill && (
        <DrillModal
          member={drill.member}
          topic={drill.topic}
          cell={drill.cell}
          onClose={() => setDrill(null)}
          onOpenUser={() => router.push(`/training/${drill.member.user_id}`)}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

// ────────────────────────────────────────────────────────────────
// Drill-in modal (records chain for one cell)
// ────────────────────────────────────────────────────────────────
function DrillModal({
  member, topic, cell, onClose, onOpenUser,
}: {
  member: Member
  topic: TrainingTopic
  cell: CellData
  onClose: () => void
  onOpenUser: () => void
}) {
  return (
    <div className="modal-overlay" style={{ zIndex: 'var(--z-modal)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)',
        padding: 20, width: '92vw', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
        border: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              {topic.code}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginTop: 2 }}>
              {topic.title}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 6 }}>
              {member.rank ? `${member.rank} ` : ''}{member.name}
            </div>
          </div>
          <button type="button" onClick={onClose} style={iconBtnStyle} title="Close"><X size={16} /></button>
        </div>

        {cell.chain.length === 0 ? (
          <div style={emptyStateStyle}>
            <Info size={16} /> This user has no training records on this topic.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cell.chain.map((r, idx) => (
              <div key={r.id} style={chainRowStyle}>
                <div style={chainBadgeStyle}>{r.training_type}{idx === 0 ? ' · latest' : ''}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
                    {formatZuluDate(r.completed_at)}
                    {r.expires_at && <span style={{ color: 'var(--color-text-3)' }}> · expires {formatZuluDate(r.expires_at)}</span>}
                  </div>
                  {r.evidence_url && (
                    <a href={r.evidence_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-cyan)', textDecoration: 'none' }}>
                      <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> evidence
                    </a>
                  )}
                  {r.notes && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 4, fontStyle: 'italic' }}>{r.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={onOpenUser} style={primaryBtnStyle}>
          Open user detail
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
function StatChip({ label, count, tint }: { label: string; count: number; tint: 'green' | 'amber' | 'red' | 'slate' }) {
  const palette = CHIP_PALETTE[tint]
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 999,
      background: palette.bg, border: `1px solid ${palette.border}`,
      fontSize: 'var(--fs-xs)', color: palette.text, fontWeight: 600,
    }}>
      <span style={{ fontWeight: 800 }}>{count}</span>
      <span>{label}</span>
    </div>
  )
}

const CELL_PALETTE: Record<TrainingStatus, { bg: string; border: string; text: string }> = {
  current:     { bg: 'color-mix(in srgb, var(--color-success) 14%, transparent)', border: 'color-mix(in srgb, var(--color-success) 35%, transparent)', text: 'rgb(21,128,61)' },
  expiring:    { bg: 'color-mix(in srgb, var(--color-warning) 14%, transparent)', border: 'color-mix(in srgb, var(--color-warning) 35%, transparent)', text: 'rgb(180,83,9)'  },
  expired:     { bg: 'color-mix(in srgb, var(--color-error) 14%, transparent)',   border: 'color-mix(in srgb, var(--color-error) 35%, transparent)',   text: 'rgb(185,28,28)' },
  not_started: { bg: 'color-mix(in srgb, var(--color-text-1) 4%, transparent)',   border: 'color-mix(in srgb, var(--color-text-1) 14%, transparent)',  text: 'rgb(71,85,105)' },
}

const STATUS_GLYPH: Record<TrainingStatus, string> = {
  current: '✓',
  expiring: '!',
  expired: '✗',
  not_started: '–',
}

const CHIP_PALETTE = {
  green: { bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)', border: 'color-mix(in srgb, var(--color-success) 30%, transparent)', text: 'rgb(21,128,61)' },
  amber: { bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', border: 'color-mix(in srgb, var(--color-warning) 30%, transparent)', text: 'rgb(180,83,9)'  },
  red:   { bg: 'color-mix(in srgb, var(--color-error) 12%, transparent)',   border: 'color-mix(in srgb, var(--color-error) 30%, transparent)',   text: 'rgb(185,28,28)' },
  slate: { bg: 'color-mix(in srgb, var(--color-text-1) 6%, transparent)',   border: 'color-mix(in srgb, var(--color-text-1) 20%, transparent)',  text: 'rgb(71,85,105)' },
} as const

// ────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────
const backLinkStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', textDecoration: 'none', marginBottom: 12 }
const headerRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)' }
const titleStyle: React.CSSProperties = { fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }
const subtitleStyle: React.CSSProperties = { fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }
const statsRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }
const matrixOuterStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
}
const matrixInnerStyle: React.CSSProperties = { display: 'inline-block', minWidth: '100%' }
const matrixHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--color-border)',
  background: 'color-mix(in srgb, var(--color-cyan) 4%, transparent)',
  position: 'sticky',
  top: 0,
  zIndex: 2,
}
const matrixBodyRowStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--color-border)',
}
const stickyCellStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--color-bg-surface)',
  borderRight: '1px solid var(--color-border)',
  zIndex: 1,
  minWidth: 200,
  maxWidth: 240,
}
const headerCellStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 'var(--fs-2xs)',
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: 'var(--color-text-3)',
  background: 'color-mix(in srgb, var(--color-cyan) 4%, transparent)',
}
const memberCellStyle: React.CSSProperties = { padding: '8px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }
const topicHeaderStyle: React.CSSProperties = {
  width: 92,
  minWidth: 92,
  padding: '8px 6px',
  textAlign: 'center',
  borderRight: '1px solid var(--color-border)',
  color: 'var(--color-text-2)',
  fontWeight: 700,
}
const matrixCellStyle: React.CSSProperties = {
  width: 92,
  minWidth: 92,
  height: 56,
  padding: 4,
  borderRight: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
}
const iconBtnStyle: React.CSSProperties = { background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--color-text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const primaryBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'var(--color-cyan)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }
const secondaryBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'transparent', color: 'var(--color-text-2)', border: '1px solid var(--color-border)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer' }
const emptyStateStyle: React.CSSProperties = { display: 'flex', gap: 10, padding: 14, borderRadius: 6, background: 'color-mix(in srgb, var(--color-amber) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-amber) 25%, transparent)', color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', alignItems: 'center' }
const chainRowStyle: React.CSSProperties = { display: 'flex', gap: 10, padding: 10, borderRadius: 6, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', alignItems: 'flex-start' }
const chainBadgeStyle: React.CSSProperties = { fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: 0.5, padding: '2px 7px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-cyan) 10%, transparent)', color: 'rgb(3,105,161)', textTransform: 'uppercase', flexShrink: 0, marginTop: 1 }
