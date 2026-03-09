'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import type { AirfieldStatus } from '@/lib/supabase/airfield-status'

type Alert = {
  id: number
  message: string
}

function describeChange(prev: AirfieldStatus | null, row: AirfieldStatus): string | null {
  if (!prev) return null

  const parts: string[] = []

  // Advisory
  if (row.advisory_type !== prev.advisory_type || row.advisory_text !== prev.advisory_text) {
    if (row.advisory_type && row.advisory_text) {
      parts.push(`${row.advisory_type}: ${row.advisory_text}`)
    } else if (prev.advisory_type) {
      parts.push('Advisory cleared')
    }
  }

  // Runway status changes (multi-runway)
  if (JSON.stringify(row.runway_statuses) !== JSON.stringify(prev.runway_statuses) && row.runway_statuses) {
    const rs = row.runway_statuses as Record<string, { status?: string; active_end?: string }>
    const prevRs = (prev.runway_statuses || {}) as Record<string, { status?: string; active_end?: string }>
    for (const [label, entry] of Object.entries(rs)) {
      const prevEntry = prevRs[label]
      if (prevEntry?.status !== entry.status) {
        parts.push(`Runway ${label} ${(entry.status || 'open').toUpperCase()}`)
      }
      if (prevEntry?.active_end !== entry.active_end) {
        parts.push(`Active runway → ${entry.active_end}`)
      }
    }
  }

  // BWC
  if (row.bwc_value !== prev.bwc_value && row.bwc_value) {
    parts.push(`BWC → ${row.bwc_value.toUpperCase()}`)
  }

  // RSC
  if (row.rsc_condition !== prev.rsc_condition && row.rsc_condition) {
    parts.push(`RSC → ${row.rsc_condition.toUpperCase()}`)
  }

  // ARFF
  if (row.arff_cat !== prev.arff_cat && row.arff_cat != null) {
    parts.push(`ARFF CAT ${row.arff_cat}`)
  }

  if (parts.length === 0) return 'Airfield status updated'
  return parts.join(' | ')
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
    }, 4000)
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
        (payload) => {
          if (isOwnUpdate.current) {
            prevStatus.current = payload.new as AirfieldStatus
            return
          }
          const row = payload.new as AirfieldStatus
          const message = describeChange(prevStatus.current, row)
          prevStatus.current = row
          if (message) showAlert(message)
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
      gap: 4,
      padding: '8px 16px',
    }}>
      {alerts.map(alert => (
        <div
          key={alert.id}
          style={{
            background: 'var(--color-cyan)',
            color: '#000',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            padding: '6px 16px',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            animation: 'alertSlide 4s ease-in-out',
            pointerEvents: 'auto',
            maxWidth: 500,
            textAlign: 'center',
          }}
        >
          {alert.message}
        </div>
      ))}
    </div>
  )
}
