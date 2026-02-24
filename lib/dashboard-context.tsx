'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { fetchAirfieldStatus, updateAirfieldStatus } from '@/lib/supabase/airfield-status'
import { useInstallation } from '@/lib/installation-context'

type Advisory = {
  type: 'INFO' | 'CAUTION' | 'WARNING'
  text: string
}

type DashboardState = {
  advisory: Advisory | null
  setAdvisory: (a: Advisory | null) => void
  activeRunway: string
  setActiveRunway: (r: string) => void
  runwayStatus: 'open' | 'suspended' | 'closed'
  setRunwayStatus: (s: 'open' | 'suspended' | 'closed') => void
}

const DashboardContext = createContext<DashboardState | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { installationId } = useInstallation()
  const [advisory, setAdvisoryLocal] = useState<Advisory | null>(null)
  const [activeRunway, setActiveRunwayLocal] = useState('01')
  const [runwayStatus, setRunwayStatusLocal] = useState<'open' | 'suspended' | 'closed'>('open')
  const [loaded, setLoaded] = useState(false)

  // Load from Supabase on mount or when base changes
  useEffect(() => {
    async function load() {
      setLoaded(false)
      const status = await fetchAirfieldStatus(installationId)
      if (status) {
        if (status.advisory_type && status.advisory_text) {
          setAdvisoryLocal({ type: status.advisory_type, text: status.advisory_text })
        } else {
          setAdvisoryLocal(null)
        }
        setActiveRunwayLocal(status.active_runway)
        setRunwayStatusLocal(status.runway_status)
      }
      setLoaded(true)
    }
    load()
  }, [installationId])

  // Persist advisory changes
  const setAdvisory = useCallback(async (a: Advisory | null) => {
    setAdvisoryLocal(a)
    await updateAirfieldStatus({
      advisory_type: a?.type ?? null,
      advisory_text: a?.text ?? null,
    }, installationId)
  }, [installationId])

  // Persist active runway changes
  const setActiveRunway = useCallback(async (r: string) => {
    setActiveRunwayLocal(r)
    await updateAirfieldStatus({ active_runway: r }, installationId)
  }, [installationId])

  // Persist runway status changes
  const setRunwayStatus = useCallback(async (s: 'open' | 'suspended' | 'closed') => {
    setRunwayStatusLocal(s)
    await updateAirfieldStatus({ runway_status: s }, installationId)
  }, [installationId])

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
