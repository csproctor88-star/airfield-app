'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Search, Info } from 'lucide-react'
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
 * /training/roster — per-user roll-up of training currency.
 *
 * One bulk fetch of records for the base, grouped in memory into
 * (user, topic) latest. Counts derive from classifyTrainingStatus()
 * over the active topic set so admins can see at-a-glance who's
 * current, expiring, expired, or not yet trained.
 */

type Member = Awaited<ReturnType<typeof fetchInstallationMembers>>[number]

type RosterRow = {
  member: Member
  required: number
  current: number
  expiring: number
  expired: number
  notStarted: number
  lastTrainedAt: string | null  // YYYY-MM-DD
  lastTopicTitle: string | null
}

export default function TrainingRosterPage() {
  const router = useRouter()
  const { installationId, currentInstallation } = useInstallation()

  const [members, setMembers] = useState<Member[]>([])
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TrainingStatus>('all')

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

  const rows: RosterRow[] = useMemo(() => {
    if (!members.length) return []
    // Topic by id, for material/required lookup
    const topicById = new Map(topics.map(t => [t.id, t] as const))
    // De-dup: when both system + base override exist, use whichever the
    // user's roster cares about — code is the canonical key.
    const activeTopicCodes = Array.from(new Set(topics.map(t => t.code)))
    const requiredCount = activeTopicCodes.length

    // Bucket records by (user, topic-code), keep latest by completed_at
    const latestByUserCode = new Map<string, TrainingRecord>()
    for (const r of records) {
      const topic = topicById.get(r.topic_id)
      if (!topic) continue
      const key = `${r.user_id}::${topic.code}`
      const prior = latestByUserCode.get(key)
      if (!prior || r.completed_at > prior.completed_at) latestByUserCode.set(key, r)
    }

    return members.map(member => {
      let current = 0, expiring = 0, expired = 0, notStarted = 0
      let lastTrainedAt: string | null = null
      let lastTopicTitle: string | null = null
      for (const code of activeTopicCodes) {
        const latest = latestByUserCode.get(`${member.user_id}::${code}`) ?? null
        const status = classifyTrainingStatus(latest)
        if (status === 'current') current++
        else if (status === 'expiring') expiring++
        else if (status === 'expired') expired++
        else notStarted++
        if (latest && (!lastTrainedAt || latest.completed_at > lastTrainedAt)) {
          lastTrainedAt = latest.completed_at
          const t = topicById.get(latest.topic_id)
          lastTopicTitle = t?.title ?? null
        }
      }
      return {
        member,
        required: requiredCount,
        current, expiring, expired, notStarted,
        lastTrainedAt, lastTopicTitle,
      }
    })
  }, [members, topics, records])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      const name = r.member.name.toLowerCase()
      if (q && !name.includes(q)) return false
      if (statusFilter === 'expired' && r.expired === 0) return false
      if (statusFilter === 'expiring' && r.expiring === 0) return false
      if (statusFilter === 'not_started' && r.notStarted === 0) return false
      if (statusFilter === 'current' && r.expired + r.expiring + r.notStarted > 0) return false
      return true
    }).sort((a, b) => {
      // Worst-status-first so admins see who needs attention
      const aScore = a.expired * 100 + a.expiring * 10 + a.notStarted
      const bScore = b.expired * 100 + b.expiring * 10 + b.notStarted
      return bScore - aScore
    })
  }, [rows, query, statusFilter])

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <Link href="/training" style={backLinkStyle}>
        <ArrowLeft size={14} /> Training Overview
      </Link>

      <div style={headerRowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={20} color="var(--color-cyan)" />
          <div>
            <div style={titleStyle}>Training Roster</div>
            <div style={subtitleStyle}>
              {topics.length > 0
                ? `${topics.length} active topic${topics.length === 1 ? '' : 's'} × ${members.length} member${members.length === 1 ? '' : 's'}`
                : 'Loading topics…'}
            </div>
          </div>
        </div>
      </div>

      <div style={filterRowStyle}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={searchIconStyle} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name…"
            style={searchInputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <StatusChip label="All"      active={statusFilter === 'all'}         onClick={() => setStatusFilter('all')} />
          <StatusChip label="Expired"  active={statusFilter === 'expired'}     onClick={() => setStatusFilter('expired')}     tint="red" />
          <StatusChip label="Expiring" active={statusFilter === 'expiring'}    onClick={() => setStatusFilter('expiring')}    tint="amber" />
          <StatusChip label="Not Started" active={statusFilter === 'not_started'} onClick={() => setStatusFilter('not_started')} tint="slate" />
          <StatusChip label="Current"  active={statusFilter === 'current'}     onClick={() => setStatusFilter('current')}     tint="green" />
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-3)', padding: 24, textAlign: 'center' }}>Loading…</div>
      ) : filteredRows.length === 0 ? (
        <div style={emptyStateStyle}>
          <Info size={16} />
          {members.length === 0
            ? 'No base members yet. Invite users from User Management.'
            : 'No members match the current filter.'}
        </div>
      ) : (
        <div style={tableWrapStyle}>
          <div style={tableHeaderStyle}>
            <div style={{ flex: 2 }}>Name</div>
            <div style={{ flex: 1 }}>Role</div>
            <div style={{ flex: '0 0 60px', textAlign: 'center' }}>Req</div>
            <div style={{ flex: '0 0 80px', textAlign: 'center' }}>Current</div>
            <div style={{ flex: '0 0 80px', textAlign: 'center' }}>Expiring</div>
            <div style={{ flex: '0 0 80px', textAlign: 'center' }}>Expired</div>
            <div style={{ flex: 1 }}>Last Trained</div>
          </div>
          {filteredRows.map(row => (
            <div
              key={row.member.user_id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/training/${row.member.user_id}`)}
              onKeyDown={e => { if (e.key === 'Enter') router.push(`/training/${row.member.user_id}`) }}
              style={tableRowStyle}
            >
              <div style={{ flex: 2, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                  {row.member.rank ? `${row.member.rank} ` : ''}{row.member.name}
                </div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                  {row.member.email}
                </div>
              </div>
              <div style={{ flex: 1, color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }}>
                {getRoleLabel(row.member.role, currentInstallation) || row.member.role}
              </div>
              <div style={{ flex: '0 0 60px', textAlign: 'center', color: 'var(--color-text-2)' }}>{row.required}</div>
              <CountCell value={row.current} bucket="current" />
              <CountCell value={row.expiring} bucket="expiring" />
              <CountCell value={row.expired} bucket="expired" />
              <div style={{ flex: 1, color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }}>
                {row.lastTrainedAt ? (
                  <>
                    <div>{formatZuluDate(row.lastTrainedAt)}</div>
                    {row.lastTopicTitle && (
                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                        {row.lastTopicTitle}
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{ color: 'var(--color-text-4)', fontStyle: 'italic' }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CountCell({ value, bucket }: { value: number; bucket: 'current' | 'expiring' | 'expired' }) {
  const palette = BUCKET_PALETTE[bucket]
  return (
    <div style={{ flex: '0 0 80px', textAlign: 'center' }}>
      {value > 0 ? (
        <span style={{
          display: 'inline-block',
          minWidth: 30,
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          background: palette.bg,
          border: `1px solid ${palette.border}`,
          color: palette.text,
        }}>
          {value}
        </span>
      ) : (
        <span style={{ color: 'var(--color-text-4)' }}>0</span>
      )}
    </div>
  )
}

const BUCKET_PALETTE = {
  current:  { bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)', border: 'color-mix(in srgb, var(--color-success) 30%, transparent)', text: 'rgb(21,128,61)' },
  expiring: { bg: 'color-mix(in srgb, var(--color-warning) 14%, transparent)', border: 'color-mix(in srgb, var(--color-warning) 30%, transparent)', text: 'rgb(180,83,9)' },
  expired:  { bg: 'color-mix(in srgb, var(--color-error) 14%, transparent)',   border: 'color-mix(in srgb, var(--color-error) 30%, transparent)',   text: 'rgb(185,28,28)' },
} as const

function StatusChip({
  label, active, onClick, tint,
}: {
  label: string
  active: boolean
  onClick: () => void
  tint?: 'red' | 'amber' | 'green' | 'slate'
}) {
  const palette = !tint || !active ? null : CHIP_PALETTE[tint]
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 999,
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        background: active
          ? palette?.bg ?? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
          : 'transparent',
        border: `1px solid ${active
          ? palette?.border ?? 'color-mix(in srgb, var(--color-cyan) 35%, transparent)'
          : 'var(--color-border)'}`,
        color: active
          ? palette?.text ?? 'rgb(3,105,161)'
          : 'var(--color-text-2)',
      }}
    >
      {label}
    </button>
  )
}

const CHIP_PALETTE = {
  red:   { bg: 'color-mix(in srgb, var(--color-error) 14%, transparent)',   border: 'color-mix(in srgb, var(--color-error) 35%, transparent)',   text: 'rgb(185,28,28)' },
  amber: { bg: 'color-mix(in srgb, var(--color-warning) 14%, transparent)', border: 'color-mix(in srgb, var(--color-warning) 35%, transparent)', text: 'rgb(180,83,9)' },
  green: { bg: 'color-mix(in srgb, var(--color-success) 14%, transparent)', border: 'color-mix(in srgb, var(--color-success) 35%, transparent)', text: 'rgb(21,128,61)' },
  slate: { bg: 'color-mix(in srgb, var(--color-text-1) 6%, transparent)',   border: 'color-mix(in srgb, var(--color-text-1) 20%, transparent)',  text: 'rgb(71,85,105)' },
} as const

// ────────────────────────────────────────────────────────────────
// Styles (shared with the topics page where applicable)
// ────────────────────────────────────────────────────────────────
const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
  textDecoration: 'none', marginBottom: 12,
}
const headerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  flexWrap: 'wrap', gap: 12, paddingBottom: 12, marginBottom: 14,
  borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
}
const titleStyle: React.CSSProperties = { fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }
const subtitleStyle: React.CSSProperties = { fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }
const filterRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  flexWrap: 'wrap', gap: 12, marginBottom: 12,
}
const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px 7px 30px',
  borderRadius: 6,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-1)',
  fontFamily: 'inherit',
  fontSize: 'var(--fs-sm)',
}
const searchIconStyle: React.CSSProperties = {
  position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
  color: 'var(--color-text-4)', pointerEvents: 'none',
}
const tableWrapStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
}
const tableHeaderStyle: React.CSSProperties = {
  display: 'flex', gap: 12,
  padding: '10px 14px',
  background: 'color-mix(in srgb, var(--color-cyan) 4%, transparent)',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: 0.5,
  textTransform: 'uppercase', color: 'var(--color-text-3)',
  alignItems: 'center',
}
const tableRowStyle: React.CSSProperties = {
  display: 'flex', gap: 12, padding: '12px 14px',
  borderBottom: '1px solid var(--color-border)',
  alignItems: 'center', cursor: 'pointer',
}
const emptyStateStyle: React.CSSProperties = {
  display: 'flex', gap: 10, padding: 14, borderRadius: 6,
  background: 'color-mix(in srgb, var(--color-amber) 6%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-amber) 25%, transparent)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)',
  alignItems: 'center',
}
