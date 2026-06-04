'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check } from 'lucide-react'
import {
  fetchAmtrNotifications, dismissAmtrNotification, type AmtrNotification,
} from '@/lib/supabase/amtr'
import { useInstallation } from '@/lib/installation-context'
import { formatZuluDate } from '@/lib/utils'

const KIND_COLOR: Record<string, string> = {
  training_due: 'var(--color-warning)',
  signoff: 'var(--color-success)',
  entry_623a: 'var(--color-danger)',
  item_797_added: 'var(--color-accent)',
  signature_797: 'var(--color-danger)',
  signature_required: 'var(--color-danger)',
  trainer_signature_required: 'var(--color-accent)',
}

export function NotificationCenter({ memberId }: { memberId?: string } = {}) {
  const router = useRouter()
  const { allInstallations } = useInstallation()
  const [allItems, setAllItems] = useState<AmtrNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setAllItems(await fetchAmtrNotifications())
    setLoading(false)
  }, [])

  // On an individual record (memberId set) show only that member's items; the
  // global roster view (no memberId) shows everything the user must act on.
  const items = memberId ? allItems.filter((n) => n.member_id === memberId) : allItems

  useEffect(() => { load() }, [load])

  const open = async (n: AmtrNotification) => {
    const params = new URLSearchParams()
    if (n.target_tab) params.set('tab', n.target_tab)
    if (n.target_item_id) params.set('item', n.target_item_id)
    router.push(`/amtr/${n.member_id}?${params.toString()}`)
  }

  const dismiss = async (id: string) => {
    await dismissAmtrNotification(id)
    setAllItems((prev) => prev.filter((n) => n.id !== id))
    window.dispatchEvent(new Event('glidepath:badges-refresh'))
  }

  if (loading) return null
  if (items.length === 0) {
    return (
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-3)' }}>
        <Bell size={16} /> No training notifications.
      </div>
    )
  }

  // Group by base so a multi-base signer can see which notifications belong to
  // which base. Single-base users get a flat list (no redundant base header).
  const baseName = (id: string) => allInstallations.find((b) => b.id === id)?.name ?? 'Another base'
  const byBase = new Map<string, AmtrNotification[]>()
  for (const n of items) {
    const arr = byBase.get(n.base_id) ?? []
    arr.push(n)
    byBase.set(n.base_id, arr)
  }
  const groups = Array.from(byBase.entries()).sort((a, b) => baseName(a[0]).localeCompare(baseName(b[0])))
  const multiBase = groups.length > 1

  const renderRow = (n: AmtrNotification) => (
    <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: KIND_COLOR[n.kind] ?? '#94A3B8', flexShrink: 0 }} />
      <button
        onClick={() => open(n)}
        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}
      >
        {n.body}
        <span style={{ display: 'block', color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)' }}>{formatZuluDate(n.created_at)}</span>
      </button>
      <button
        onClick={() => dismiss(n.id)}
        title="Dismiss"
        style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer' }}
      >
        <Check size={16} />
      </button>
    </div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <Bell size={16} /> Notifications
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{items.length}</span>
      </div>
      {groups.map(([baseId, list]) => (
        <div key={baseId}>
          {multiBase && (
            <div style={{
              padding: '6px 16px', background: 'var(--color-bg-inset)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {baseName(baseId)}
              <span style={{ marginLeft: 'auto', color: 'var(--color-text-3)' }}>{list.length}</span>
            </div>
          )}
          {list.map(renderRow)}
        </div>
      ))}
    </div>
  )
}
