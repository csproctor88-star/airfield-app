'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'

type Row = Pick<DiscrepancyRow, 'id' | 'title' | 'status' | 'assigned_shop' | 'created_at'>

function ageDays(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return `${d}d`
}

export function OpenDiscrepanciesWidget() {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!installationId) return
    fetchDiscrepancies(installationId).then((all) => {
      setRows(all.filter(r => r.status === 'open'))
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>Open</span>
        <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>{rows.length}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {rows.map(r => (
          <Link key={r.id} href={`/discrepancies/${r.id}`} style={{
            display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0',
            borderBottom: '1px solid var(--color-border)', textDecoration: 'none',
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
            <span style={{ flexShrink: 0, color: 'var(--color-text-3)', fontFamily: 'var(--font-family-mono)' }}>
              {r.assigned_shop ?? '—'} · {ageDays(r.created_at)}
            </span>
          </Link>
        ))}
        {rows.length === 0 && (
          <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '8px 0' }}>No open discrepancies.</div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <Link href="/discrepancies/new" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>+ New</Link>
        <Link href="/discrepancies" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
      </div>
    </div>
  )
}
