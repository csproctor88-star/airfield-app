'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import type { AirfieldStatus } from '@/lib/supabase/airfield-status'

type Alert = {
  id: number
  message: string
}

function describeChanges(prev: AirfieldStatus | null, row: AirfieldStatus): string[] {
  if (!prev) return []

  const parts: string[] = []

  // Advisory
  if (row.advisory_type !== prev.advisory_type || row.advisory_text !== prev.advisory_text) {
    if (row.advisory_type && row.advisory_text) {
      parts.push(`set the Advisory to ${row.advisory_type} — ${row.advisory_text}`)
    } else if (prev.advisory_type) {
      parts.push('cleared the Advisory')
    }
  }

  // Runway status changes (multi-runway)
  if (JSON.stringify(row.runway_statuses) !== JSON.stringify(prev.runway_statuses) && row.runway_statuses) {
    const rs = row.runway_statuses as Record<string, { status?: string; active_end?: string }>
    const prevRs = (prev.runway_statuses || {}) as Record<string, { status?: string; active_end?: string }>
    for (const [label, entry] of Object.entries(rs)) {
      const prevEntry = prevRs[label]
      if (prevEntry?.status !== entry.status) {
        parts.push(`updated RWY ${label} status to ${(entry.status || 'open').toUpperCase()}`)
      }
      if (prevEntry?.active_end !== entry.active_end) {
        parts.push(`updated the Active RWY to RWY ${entry.active_end}`)
      }
    }
  }

  // BWC
  if (row.bwc_value !== prev.bwc_value) {
    if (row.bwc_value) {
      parts.push(`updated the BWC to ${row.bwc_value.toUpperCase()}`)
    } else {
      parts.push('cleared the BWC')
    }
  }

  // RSC
  if (row.rsc_condition !== prev.rsc_condition) {
    if (row.rsc_condition) {
      parts.push(`updated the RSC to ${row.rsc_condition.toUpperCase()}`)
    } else {
      parts.push('cleared the RSC')
    }
  }

  // ARFF CAT
  if (row.arff_cat !== prev.arff_cat) {
    if (row.arff_cat != null) {
      parts.push(`updated the ARFF CAT to CAT ${row.arff_cat}`)
    } else {
      parts.push('cleared the ARFF CAT')
    }
  }

  // ARFF aircraft statuses
  if (JSON.stringify(row.arff_statuses) !== JSON.stringify(prev.arff_statuses) && row.arff_statuses) {
    const curr = row.arff_statuses as Record<string, string>
    const prevS = (prev.arff_statuses || {}) as Record<string, string>
    for (const [name, status] of Object.entries(curr)) {
      if (prevS[name] !== status) {
        parts.push(`updated ${name} readiness to ${status.toUpperCase()}`)
      }
    }
  }

  // Construction remarks
  if (row.construction_remarks !== prev.construction_remarks) {
    if (row.construction_remarks) {
      parts.push('updated the Construction Remarks')
    } else {
      parts.push('cleared the Construction Remarks')
    }
  }

  // Misc remarks
  if (row.misc_remarks !== prev.misc_remarks) {
    if (row.misc_remarks) {
      parts.push('updated the Misc Remarks')
    } else {
      parts.push('cleared the Misc Remarks')
    }
  }

  if (parts.length === 0) parts.push('updated the Airfield Status')
  return parts
}

// Cache profile lookups to avoid repeated queries
const profileCache: Record<string, string> = {}

async function lookupUserName(userId: string): Promise<string> {
  if (profileCache[userId]) return profileCache[userId]
  const supabase = createClient()
  if (!supabase) return 'Someone'
  const { data } = await supabase
    .from('profiles')
    .select('name, rank')
    .eq('id', userId)
    .single()
  const name = data
    ? `${data.rank ? data.rank + ' ' : ''}${data.name || 'Unknown'}`
    : 'Someone'
  profileCache[userId] = name
  return name
}

export function RealtimeAlertBanner() {
  const { installationId } = useInstallation()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const prevStatus = useRef<AirfieldStatus | null>(null)
  const idCounter = useRef(0)
  const isOwnUpdate = useRef(false)

  // Let DashboardProvider mark own updates so we skip showing alerts for them
  useEffect(() => {
    const handler = () => { isOwnUpdate.current = true; setTimeout(() => { isOwnUpdate.current = false }, 2000) }
    window.addEventListener('glidepath:local-status-update', handler)
    return () => window.removeEventListener('glidepath:local-status-update', handler)
  }, [])

  const showAlert = useCallback((message: string) => {
    const id = ++idCounter.current
    setAlerts(prev => [...prev, { id, message }])
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id))
    }, 5000)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    // Seed prev status
    supabase
      .from('airfield_status')
      .select('*')
      .eq('base_id', installationId)
      .single()
      .then(({ data }) => {
        if (data) prevStatus.current = data as AirfieldStatus
      })

    const channel = supabase
      .channel(`alert_banner:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'airfield_status', filter: `base_id=eq.${installationId}` },
        async (payload) => {
          if (isOwnUpdate.current) {
            prevStatus.current = payload.new as AirfieldStatus
            return
          }
          const row = payload.new as AirfieldStatus
          const changes = describeChanges(prevStatus.current, row)
          prevStatus.current = row

          // Look up who made the change
          const userName = row.updated_by
            ? await lookupUserName(row.updated_by)
            : 'Someone'

          for (const change of changes) {
            showAlert(`${userName} ${change}`)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [installationId, showAlert])

  if (alerts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 300,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      pointerEvents: 'none',
      gap: 6,
      padding: '8px 16px',
    }}>
      {alerts.map(alert => (
        <div
          key={alert.id}
          style={{
            background: 'var(--color-cyan)',
            color: '#fff',
            fontSize: 'var(--fs-base)',
            fontWeight: 700,
            padding: '10px 24px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            animation: 'alertSlide 5s ease-in-out',
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 900,
            textAlign: 'center',
          }}
        >
          {alert.message}
        </div>
      ))}
    </div>
  )
}
