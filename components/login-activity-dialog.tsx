'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'

type ActivityEntry = {
  id: string
  action: string
  entity_type: string
  entity_display_id: string | null
  created_at: string
  user_name: string
  user_rank: string | null
  metadata: Record<string, unknown> | null
}

function formatAction(action: string, entityType: string, displayId?: string): string {
  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy',
    check: 'Check',
    inspection: 'Inspection',
    obstruction_evaluation: 'Obstruction Eval',
    manual: 'Manual Entry',
    airfield_status: 'Runway',
    waiver: 'Waiver',
    navaid: 'NAVAID',
  }
  const entity = typeLabel[entityType] || entityType
  const id = displayId ? ` ${displayId}` : ''
  const actionLabel: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    completed: 'Completed',
    status_updated: 'Status Changed',
    noted: 'Logged',
  }
  return `${actionLabel[action] || action} ${entity}${id}`
}

function buildDetails(entry: ActivityEntry): string {
  const meta = entry.metadata
  if (!meta) return ''
  if (meta.notes) return meta.notes as string
  if (meta.status) return `Status: ${meta.status}`
  if (meta.changes) {
    const c = meta.changes as Record<string, unknown>
    return Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  return ''
}

export default function LoginActivityDialog() {
  const { installationId } = useInstallation()
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function checkLoginActivity() {
      // Only run once per browser tab session
      try {
        if (sessionStorage.getItem('glidepath_activity_checked')) return
        sessionStorage.setItem('glidepath_activity_checked', '1')
      } catch {
        return
      }

      const supabase = createClient()
      if (!supabase) return

      // Determine "last seen" timestamp:
      // 1) From login page (stored in sessionStorage during sign-in flow)
      // 2) Fallback: read directly from the user's profile (covers session resume)
      let lastSeenAt: string | null = null
      try {
        lastSeenAt = sessionStorage.getItem('glidepath_previous_login_at')
        if (lastSeenAt) sessionStorage.removeItem('glidepath_previous_login_at')
      } catch { /* noop */ }

      if (!lastSeenAt) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_seen_at')
          .eq('id', user.id)
          .single()
        lastSeenAt = profile?.last_seen_at ?? null
      }

      if (!lastSeenAt) return

      // Update last_seen_at now so the header heartbeat doesn't clobber
      // the old value before we finish querying
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)
      }

      // Query activity since last seen
      let query = supabase
        .from('activity_log')
        .select('id, action, entity_type, entity_display_id, created_at, metadata, user_id, profiles:user_id(name, rank)')
        .gt('created_at', lastSeenAt)
        .order('created_at', { ascending: false })
        .limit(50)

      if (installationId) {
        query = query.eq('base_id', installationId)
      }

      const { data, error } = await query

      if (error) {
        // Fallback without profile join
        let fallbackQuery = supabase
          .from('activity_log')
          .select('*')
          .gt('created_at', lastSeenAt)
          .order('created_at', { ascending: false })
          .limit(50)
        if (installationId) fallbackQuery = fallbackQuery.eq('base_id', installationId)
        const { data: fallback } = await fallbackQuery

        if (fallback && fallback.length > 0) {
          setEntries(fallback.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            action: r.action as string,
            entity_type: r.entity_type as string,
            entity_display_id: (r.entity_display_id as string) || null,
            created_at: r.created_at as string,
            user_name: 'Unknown',
            user_rank: null,
            metadata: (r.metadata as Record<string, unknown>) || null,
          })))
          setOpen(true)
        }
        return
      }

      if (data && data.length > 0) {
        setEntries(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          action: r.action as string,
          entity_type: r.entity_type as string,
          entity_display_id: (r.entity_display_id as string) || null,
          created_at: r.created_at as string,
          user_name: (r.profiles as { name?: string } | null)?.name || 'Unknown',
          user_rank: (r.profiles as { rank?: string } | null)?.rank || null,
          metadata: (r.metadata as Record<string, unknown>) || null,
        })))
        setOpen(true)
      }
    }

    checkLoginActivity()
  }, [installationId])

  if (!open || entries.length === 0) return null

  // Group entries by date for date header rows
  const grouped: { date: string; items: ActivityEntry[] }[] = []
  entries.forEach((e) => {
    const d = new Date(e.created_at)
    const dateKey = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const last = grouped[grouped.length - 1]
    if (last && last.date === dateKey) {
      last.items.push(e)
    } else {
      grouped.push({ date: dateKey, items: [e] })
    }
  })

  const cellStyle: React.CSSProperties = {
    padding: '5px 8px',
    fontSize: 'var(--fs-sm)',
    color: 'var(--color-text-2)',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 600,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              Activity Since Last Login
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
              {entries.length} {entries.length === 1 ? 'update' : 'updates'} while you were away
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} color="var(--color-text-3)" />
          </button>
        </div>

        {/* Scrollable columnar table */}
        <div style={{ overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Time (Z)', 'User', 'Action', 'Details'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 8px',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      color: 'var(--color-text-3)',
                      textAlign: 'left',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <>
                  {/* Date header row */}
                  <tr key={`date-${group.date}`}>
                    <td
                      colSpan={4}
                      style={{
                        padding: '8px 8px 4px',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        color: 'var(--color-cyan)',
                        background: 'var(--color-bg-surface)',
                      }}
                    >
                      {group.date}
                    </td>
                  </tr>
                  {group.items.map((a) => {
                    const d = new Date(a.created_at)
                    const timeZ = d.toISOString().slice(11, 16)
                    const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
                    const details = buildDetails(a)

                    return (
                      <tr
                        key={a.id}
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td style={cellStyle}>{timeZ}</td>
                        <td style={cellStyle}>{userName}</td>
                        <td style={cellStyle}>
                          {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined)}
                        </td>
                        <td style={{ ...cellStyle, whiteSpace: 'normal', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {details}
                        </td>
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Acknowledge All button */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              width: '100%',
              padding: '10px 0',
              borderRadius: 8,
              border: 'none',
              background: '#06B6D4',
              color: '#fff',
              fontSize: 'var(--fs-md)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Acknowledge All
          </button>
        </div>
      </div>
    </div>
  )
}
