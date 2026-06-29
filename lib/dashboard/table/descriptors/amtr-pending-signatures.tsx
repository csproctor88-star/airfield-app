'use client'

import { useEffect, useState } from 'react'
import { fetchAmtrNotifications } from '@/lib/supabase/amtr'
import type { TableWidgetDescriptor, ColumnDef } from '@/lib/dashboard/table/types'

export type PendingSignatureRow = {
  id: string
  memberId: string
  item: string
  awaiting: string
  when: string
}

function fmtDate(v: unknown): string {
  const s = v as string | null
  if (!s) return '—'
  return s.slice(0, 10) // ISO timestamp → YYYY-MM-DD
}

// Signatures the signed-in user owes: trainee + trainer/certifier signature
// notifications. fetchAmtrNotifications is already RLS-scoped to the current
// user (recipient_user_id = auth.uid()).
function useRows(): { rows: PendingSignatureRow[]; loading: boolean } {
  const [rows, setRows] = useState<PendingSignatureRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAmtrNotifications()
      .then(notes => {
        if (cancelled) return
        setRows(
          notes
            .filter(n => n.kind === 'signature_required' || n.kind === 'trainer_signature_required')
            .map(n => ({
              id: n.id,
              memberId: n.member_id,
              item: n.body,
              awaiting: n.kind === 'trainer_signature_required' ? 'trainer / certifier' : 'you (trainee)',
              when: n.created_at,
            })),
        )
      })
      .catch(() => { /* fetch helper returns [] on Supabase errors; clear the spinner on any unexpected throw */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { rows, loading }
}

const columns: ColumnDef<PendingSignatureRow>[] = [
  { key: 'item', label: 'Item', accessor: r => r.item, defaultVisible: true },
  { key: 'awaiting', label: 'Awaiting', accessor: r => r.awaiting, defaultVisible: true },
  { key: 'when', label: 'When', accessor: r => r.when, format: fmtDate, defaultVisible: true, mono: true },
]

export const amtrPendingSignaturesDescriptor: TableWidgetDescriptor<PendingSignatureRow> = {
  columns,
  filters: [],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => [
    { count: rows.length, label: 'awaiting your signature', tone: rows.length ? 'warning' : 'muted' },
  ],
  footerHref: '/amtr',
  useRows,
}
