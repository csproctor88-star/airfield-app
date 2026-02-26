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
}

function formatAction(action: string, entityType: string, displayId?: string): string {
  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy',
    check: 'Check',
    inspection: 'Inspection',
    obstruction_evaluation: 'Obstruction Eval',
  }
  const entity = typeLabel[entityType] || entityType
  const id = displayId ? ` ${displayId}` : ''
  const actionLabel: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    completed: 'Completed',
    status_updated: 'Status changed on',
  }
  return `${actionLabel[action] || action} ${entity}${id}`
}

export default function LoginActivityDialog() {
  const { installationId } = useInstallation()
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function checkLoginActivity() {
      let previousLoginAt: string | null = null
      try {
        previousLoginAt = sessionStorage.getItem('glidepath_previous_login_at')
        if (previousLoginAt) sessionStorage.removeItem('glidepath_previous_login_at')
      } catch {
        return
      }

      if (!previousLoginAt) return

      const supabase = createClient()
      if (!supabase) return

      let query = (supabase as any)
        .from('activity_log')
        .select('id, action, entity_type, entity_display_id, created_at, user_id, profiles:user_id(name, rank)')
        .gt('created_at', previousLoginAt)
        .order('created_at', { ascending: false })
        .limit(50)

      if (installationId) {
        query = query.eq('base_id', installationId)
      }

      const { data, error } = await query

      if (error) {
        // Fallback without profile join
        let fallbackQuery = (supabase as any)
          .from('activity_log')
          .select('*')
          .gt('created_at', previousLoginAt)
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
        })))
        setOpen(true)
      }
    }

    checkLoginActivity()
  }, [installationId])

  if (!open || entries.length === 0) return null

  const actionColor: Record<string, string> = {
    created: 'var(--color-success)',
    completed: 'var(--color-cyan)',
    updated: 'var(--color-warning)',
    status_updated: 'var(--color-purple)',
    deleted: 'var(--color-danger)',
  }
  const actionDotBg: Record<string, string> = {
    created: 'rgba(52,211,153,0.07)',
    completed: 'rgba(34,211,238,0.07)',
    updated: 'rgba(251,191,36,0.07)',
    status_updated: 'rgba(167,139,250,0.07)',
    deleted: 'rgba(239,68,68,0.07)',
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
          maxWidth: 400,
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
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-1)' }}>
              Activity Since Last Login
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
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

        {/* Scrollable activity list */}
        <div style={{ overflowY: 'auto', padding: '8px 20px' }}>
          {entries.map((a, i, arr) => {
            const color = actionColor[a.action] || 'var(--color-text-3)'
            const dotBg = actionDotBg[a.action] || 'rgba(100,116,139,0.07)'
            const date = new Date(a.created_at)
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const timeStr = date.toTimeString().slice(0, 5)
            const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name

            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '7px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: dotBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    flexShrink: 0,
                    color,
                  }}
                >
                  &bull;
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-cyan)' }}>
                      {userName}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-3)' }}>{dateStr} {timeStr}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-2)' }}>
                    {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined)}
                  </div>
                </div>
              </div>
            )
          })}
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
              fontSize: 13,
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
