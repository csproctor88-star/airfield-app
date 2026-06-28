'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, fetchAmtrByBase, type AmtrMember, type AmtrMemberStatus } from '@/lib/supabase/amtr'
import { dueStatus, ratApplies } from '@/lib/amtr/status'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

// ── Unified row ──────────────────────────────────────────────

type AmtrRow = AmtrMember & {
  overdue: number
  dueSoon: number
}

type ProgressRow = Record<string, unknown>

// ── Currency badge ───────────────────────────────────────────

function currencyBadge(v: unknown): React.ReactNode {
  const row = v as AmtrRow
  if (row.overdue > 0) {
    return (
      <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
        {row.overdue} overdue
      </span>
    )
  }
  if (row.dueSoon > 0) {
    return (
      <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
        {row.dueSoon} due soon
      </span>
    )
  }
  return <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Current</span>
}

// ── useRows ──────────────────────────────────────────────────

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<AmtrRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<ProgressRow>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<ProgressRow>('amtr_rat_progress', installationId, 'member_id'),
    ]).then(([members, r1098Prog, ratProg]) => {
      const statusOf = new Map(members.map(m => [m.id, m.status]))
      const perMember: Record<string, { overdue: number; dueSoon: number }> = {}

      const bump = (id: string, s: ReturnType<typeof dueStatus>) => {
        if (s !== 'overdue' && s !== 'due_soon') return
        perMember[id] = perMember[id] ?? { overdue: 0, dueSoon: 0 }
        if (s === 'overdue') perMember[id].overdue++
        else perMember[id].dueSoon++
      }

      for (const r of r1098Prog) {
        bump(
          String(r.member_id),
          dueStatus({ dueDate: r.next_due as string, completedDate: r.last_completed as string }),
        )
      }

      for (const r of ratProg) {
        const ms = statusOf.get(String(r.member_id)) ?? 'Active'
        if (!ratApplies(ms)) continue
        bump(
          String(r.member_id),
          dueStatus({ dueDate: r.due as string, completedDate: r.completed as string }),
        )
      }

      const result: AmtrRow[] = members.map(m => ({
        ...m,
        overdue: perMember[m.id]?.overdue ?? 0,
        dueSoon: perMember[m.id]?.dueSoon ?? 0,
      }))

      setRows(result)
      setLoading(false)
    })
  }, [installationId])

  return { rows, loading }
}

// ── Status filter options ────────────────────────────────────

const AMTR_STATUSES: AmtrMemberStatus[] = ['Active', 'Reserve', 'Guard', 'Civilian', 'Contractor', 'Separated']

// ── Descriptor ───────────────────────────────────────────────

export const amtrDescriptor: TableWidgetDescriptor<AmtrRow> = {
  columns: [
    { key: 'full_name', label: 'Member', accessor: r => r.full_name, defaultVisible: true },
    { key: 'grade', label: 'Grade', accessor: r => r.grade ?? '—', defaultVisible: true },
    { key: 'dafsc', label: 'DAFSC', accessor: r => r.dafsc ?? '—', defaultVisible: true, mono: true },
    { key: 'status', label: 'Status', accessor: r => r.status, defaultVisible: true },
    {
      key: 'currency',
      label: 'Currency',
      accessor: r => r,
      format: currencyBadge,
      defaultVisible: true,
    },
  ],
  filters: [
    {
      key: 'status',
      label: 'Status',
      kind: 'enum-multi',
      options: AMTR_STATUSES.map(s => ({ value: s, label: s })),
      predicate: (r, sel) => (sel as string[]).includes(r.status),
    },
  ],
  row: { mode: 'deeplink', href: r => `/amtr/${r.id}` },
  summary: rows => {
    const totalOverdue = rows.reduce((n, r) => n + r.overdue, 0)
    const totalDueSoon = rows.reduce((n, r) => n + (r.overdue === 0 ? r.dueSoon : 0), 0)
    return [
      { count: rows.length, label: 'members' },
      ...(totalOverdue > 0 ? [{ count: totalOverdue, label: 'overdue', tone: 'danger' as const }] : []),
      ...(totalDueSoon > 0 ? [{ count: totalDueSoon, label: 'due soon', tone: 'warning' as const }] : []),
    ]
  },
  footerHref: '/amtr',
  useRows,
}
