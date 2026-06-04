'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check } from 'lucide-react'
import {
  fetchAmtrNotifications, dismissAmtrNotification, type AmtrNotification,
} from '@/lib/supabase/amtr'
import { formatZuluDate } from '@/lib/utils'

const KIND_COLOR: Record<string, string> = {
  training_due: 'var(--color-warning)',
  signoff: 'var(--color-success)',
  entry_623a: 'var(--color-danger)',
  item_797_added: 'var(--color-accent)',
  signature_797: 'var(--color-danger)',
  signature_required: 'var(--color-danger)',
}

export function NotificationCenter() {
  const router = useRouter()
  const [items, setItems] = useState<AmtrNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setItems(await fetchAmtrNotifications())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const open = async (n: AmtrNotification) => {
    const params = new URLSearchParams()
    if (n.target_tab) params.set('tab', n.target_tab)
    if (n.target_item_id) params.set('item', n.target_item_id)
    router.push(`/amtr/${n.member_id}?${params.toString()}`)
  }

  const dismiss = async (id: string) => {
    await dismissAmtrNotification(id)
    setItems((prev) => prev.filter((n) => n.id !== id))
  }

  if (loading) return null
  if (items.length === 0) {
    return (
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-3)' }}>
        <Bell size={16} /> No training notifications.
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <Bell size={16} /> Notifications
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{items.length}</span>
      </div>
      {items.map((n) => (
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
      ))}
    </div>
  )
}
