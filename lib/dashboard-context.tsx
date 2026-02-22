'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { fetchAirfieldStatus, updateAirfieldStatus } from '@/lib/supabase/airfield-status'

type Advisory = {
  type: 'INFO' | 'CAUTION' | 'WARNING'
  text: string
}

type DashboardState = {
  advisory: Advisory | null
  setAdvisory: (a: Advisory | null) => void
  activeRunway: '01' | '19'
  setActiveRunway: (r: '01' | '19') => void
  runwayStatus: 'open' | 'suspended' | 'closed'
  setRunwayStatus: (s: 'open' | 'suspended' | 'closed') => void
}

const DashboardContext = createContext<DashboardState | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [advisory, setAdvisoryLocal] = useState<Advisory | null>(null)
  const [activeRunway, setActiveRunwayLocal] = useState<'01' | '19'>('01')
  const [runwayStatus, setRunwayStatusLocal] = useState<'open' | 'suspended' | 'closed'>('open')
  const [loaded, setLoaded] = useState(false)

  // Load from Supabase on mount
  useEffect(() => {
    async function load() {
      const status = await fetchAirfieldStatus()
      if (status) {
        if (status.advisory_type && status.advisory_text) {
          setAdvisoryLocal({ type: status.advisory_type, text: status.advisory_text })
        }
        setActiveRunwayLocal(status.active_runway)
        setRunwayStatusLocal(status.runway_status)
      }
      setLoaded(true)
    }
    load()
  }, [])

  // Persist advisory changes
  const setAdvisory = useCallback(async (a: Advisory | null) => {
    setAdvisoryLocal(a)
    await updateAirfieldStatus({
      advisory_type: a?.type ?? null,
      advisory_text: a?.text ?? null,
    })
  }, [])

  // Persist active runway changes
  const setActiveRunway = useCallback(async (r: '01' | '19') => {
    setActiveRunwayLocal(r)
    await updateAirfieldStatus({ active_runway: r })
  }, [])

  // Persist runway status changes
  const setRunwayStatus = useCallback(async (s: 'open' | 'suspended' | 'closed') => {
    setRunwayStatusLocal(s)
    await updateAirfieldStatus({ runway_status: s })
  }, [])

  // Don't render children until initial load completes to avoid flash of defaults
  if (!loaded) return null

  return (
    <DashboardContext.Provider
      value={{ advisory, setAdvisory, activeRunway, setActiveRunway, runwayStatus, setRunwayStatus }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
