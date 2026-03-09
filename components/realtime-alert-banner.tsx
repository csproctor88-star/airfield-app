'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import type { AirfieldStatus } from '@/lib/supabase/airfield-status'

type Alert = {
  id: number
  message: string
  link: string
}

type Change = {
  message: string
  link: string  // where to navigate when clicked
}

function describeChanges(prev: AirfieldStatus | null, row: AirfieldStatus): Change[] {
  if (!prev) return []

  const parts: Change[] = []

  // Advisory → Airfield Status page (/)
  if (row.advisory_type !== prev.advisory_type || row.advisory_text !== prev.advisory_text) {
    if (row.advisory_type && row.advisory_text) {
      parts.push({ message: `set the Advisory to ${row.advisory_type} — ${row.advisory_text}`, link: '/' })
    } else if (prev.advisory_type) {
      parts.push({ message: 'cleared the Advisory', link: '/' })
    }
  }

  // Runway status changes → Airfield Status page
  if (JSON.stringify(row.runway_statuses) !== JSON.stringify(prev.runway_statuses) && row.runway_statuses) {
    const rs = row.runway_statuses as Record<string, { status?: string; active_end?: string }>
    const prevRs = (prev.runway_statuses || {}) as Record<string, { status?: string; active_end?: string }>
    for (const [label, entry] of Object.entries(rs)) {
      const prevEntry = prevRs[label]
      if (prevEntry?.status !== entry.status) {
        parts.push({ message: `updated RWY ${label} status to ${(entry.status || 'open').toUpperCase()}`, link: '/' })
      }
      if (prevEntry?.active_end !== entry.active_end) {
        parts.push({ message: `updated the Active RWY to RWY ${entry.active_end}`, link: '/' })
      }
    }
  }

  // BWC → Dashboard
  if (row.bwc_value !== prev.bwc_value) {
    if (row.bwc_value) {
      parts.push({ message: `updated the BWC to ${row.bwc_value.toUpperCase()}`, link: '/dashboard' })
    } else {
      parts.push({ message: 'cleared the BWC', link: '/dashboard' })
    }
  }

  // RSC → Dashboard
  if (row.rsc_condition !== prev.rsc_condition) {
    if (row.rsc_condition) {
      parts.push({ message: `updated the RSC to ${row.rsc_condition.toUpperCase()}`, link: '/dashboard' })
    } else {
      parts.push({ message: 'cleared the RSC', link: '/dashboard' })
    }
  }

  // ARFF CAT → Airfield Status page
  if (row.arff_cat !== prev.arff_cat) {
    if (row.arff_cat != null) {
      parts.push({ message: `updated the ARFF CAT to CAT ${row.arff_cat}`, link: '/' })
    } else {
      parts.push({ message: 'cleared the ARFF CAT', link: '/' })
    }
  }

  // ARFF aircraft statuses → Airfield Status page
  if (JSON.stringify(row.arff_statuses) !== JSON.stringify(prev.arff_statuses) && row.arff_statuses) {
    const curr = row.arff_statuses as Record<string, string>
    const prevS = (prev.arff_statuses || {}) as Record<string, string>
    for (const [name, status] of Object.entries(curr)) {
      if (prevS[name] !== status) {
        parts.push({ message: `updated ${name} readiness to ${status.toUpperCase()}`, link: '/' })
      }
    }
  }

  // Construction remarks → Airfield Status page
  if (row.construction_remarks !== prev.construction_remarks) {
    if (row.construction_remarks) {
      parts.push({ message: 'updated the Construction Remarks', link: '/' })
    } else {
      parts.push({ message: 'cleared the Construction Remarks', link: '/' })
    }
  }

  // Misc remarks → Airfield Status page
  if (row.misc_remarks !== prev.misc_remarks) {
    if (row.misc_remarks) {
      parts.push({ message: 'updated the Misc Remarks', link: '/' })
    } else {
      parts.push({ message: 'cleared the Misc Remarks', link: '/' })
    }
  }

  if (parts.length === 0) parts.push({ message: 'updated the Airfield Status', link: '/' })
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
  const router = useRouter()
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

  const showAlert = useCallback((message: string, link: string) => {
    const id = ++idCounter.current
    setAlerts(prev => [...prev, { id, message, link }])
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
            showAlert(`${userName} ${change.message}`, change.link)
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
          role="button"
          tabIndex={0}
          onClick={() => { router.push(alert.link); setAlerts(prev => prev.filter(a => a.id !== alert.id)) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { router.push(alert.link); setAlerts(prev => prev.filter(a => a.id !== alert.id)) } }}
          style={{
            background: 'var(--color-cyan)',
            color: '#fff',
            fontSize: 'var(--fs-base)',
            fontWeight: 500,
            padding: '10px 24px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            animation: 'alertSlide 5s ease-in-out',
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 900,
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          {alert.message}
        </div>
      ))}
    </div>
  )
}
