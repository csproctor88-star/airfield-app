'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

// ── Role label map ───────────────────────────────────────────
// Source: components/admin/role-badge.tsx ROLE_CLASSES (labels adapted to
// prose form — no ALL-CAPS per feedback_no_snake_case_prose.md).

const ROLE_LABELS: Record<string, string> = {
  sys_admin:        'Sys Admin',
  base_admin:       'Base Admin',
  airfield_manager: 'Airfield Manager',
  namo:             'NAMO',
  amops:            'AMOPS',
  ces:              'CES',
  safety:           'Safety',
  atc:              'ATC',
  read_only:        'Read Only',
  observer:         'Read Only',
}

function roleLabel(role: string): string {
  // Known roles use the curated label; any unmapped role is humanized (never
  // rendered as raw snake_case) per feedback_no_snake_case_prose.md.
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Profile row type ─────────────────────────────────────────

type ProfileRow = {
  id: string
  name: string | null
  rank: string | null
  role: string
  status: string | null
  operating_initials: string | null
  unit: string | null
  email: string | null
  last_seen_at: string | null
}

// ── Status badge ─────────────────────────────────────────────

function statusSpan(v: unknown): React.ReactNode {
  const s = (v as string | null) ?? ''
  const label = s.charAt(0).toUpperCase() + s.slice(1) || '—'
  let color = 'var(--color-text-3)'
  if (s === 'active') color = 'var(--color-success)'
  if (s === 'pending') color = 'var(--color-warning)'
  return (
    <span style={{ color, fontWeight: 600 }}>{label}</span>
  )
}

// ── useRows ──────────────────────────────────────────────────

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) { setLoading(false); return }
    supabase
      .from('profiles')
      .select('id, name, rank, role, status, operating_initials, unit, email, last_seen_at')
      .eq('primary_base_id', installationId)
      .order('name')
      .then(({ data }) => {
        setRows((data ?? []) as ProfileRow[])
        setLoading(false)
      })
  }, [installationId])

  return { rows, loading }
}

// ── Descriptor ───────────────────────────────────────────────

export const usersDescriptor: TableWidgetDescriptor<ProfileRow> = {
  columns: [
    { key: 'name', label: 'Member', accessor: r => r.name ?? r.email ?? '—', defaultVisible: true },
    { key: 'rank', label: 'Rank', accessor: r => r.rank ?? '—', defaultVisible: true },
    { key: 'role', label: 'Role', accessor: r => r.role, format: v => roleLabel(v as string), defaultVisible: true },
    {
      key: 'status',
      label: 'Status',
      accessor: r => r.status ?? '',
      format: statusSpan,
      defaultVisible: true,
    },
    { key: 'operating_initials', label: 'OI', accessor: r => r.operating_initials ?? '—', mono: true },
    { key: 'unit', label: 'Unit', accessor: r => r.unit ?? '—' },
  ],
  filters: [
    {
      key: 'status',
      label: 'Status',
      kind: 'status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'pending', label: 'Pending' },
        { value: 'deactivated', label: 'Deactivated' },
      ],
      defaultSelected: ['active', 'pending'],
      predicate: (r, sel) => (sel as string[]).includes(r.status ?? ''),
    },
  ],
  row: { mode: 'deeplink', href: r => `/users?user=${r.id}` },
  summary: rows => {
    const pending = rows.filter(r => r.status === 'pending').length
    return [
      { count: rows.length, label: 'members' },
      ...(pending > 0 ? [{ count: pending, label: 'pending', tone: 'warning' as const }] : []),
    ]
  },
  footerHref: '/users',
  useRows,
}
