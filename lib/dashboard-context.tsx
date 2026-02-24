'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { fetchAirfieldStatus, updateAirfieldStatus, type RunwayStatuses } from '@/lib/supabase/airfield-status'
import { useInstallation } from '@/lib/installation-context'

type Advisory = {
  type: 'INFO' | 'CAUTION' | 'WARNING'
  text: string
}

type DashboardState = {
  advisory: Advisory | null
  setAdvisory: (a: Advisory | null) => void
  // Legacy single-runway accessors (first runway)
  activeRunway: string
  setActiveRunway: (r: string) => void
  runwayStatus: 'open' | 'suspended' | 'closed'
  setRunwayStatus: (s: 'open' | 'suspended' | 'closed') => void
  // Multi-runway support
  runwayStatuses: RunwayStatuses
  setRunwayActiveEnd: (runwayLabel: string, activeEnd: string) => void
  setRunwayStatusForRunway: (runwayLabel: string, status: 'open' | 'suspended' | 'closed') => void
}

const DashboardContext = createContext<DashboardState | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { installationId, runways } = useInstallation()
  const [advisory, setAdvisoryLocal] = useState<Advisory | null>(null)
  const [activeRunway, setActiveRunwayLocal] = useState('01')
  const [runwayStatus, setRunwayStatusLocal] = useState<'open' | 'suspended' | 'closed'>('open')
  const [runwayStatuses, setRunwayStatusesLocal] = useState<RunwayStatuses>({})
  const [loaded, setLoaded] = useState(false)

  // Build runway labels from installation runways (e.g., "06L/24R")
  const runwayLabels = runways.map(r => `${r.end1_designator}/${r.end2_designator}`)

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

        // Load multi-runway statuses, or initialize from legacy fields
        if (status.runway_statuses && Object.keys(status.runway_statuses).length > 0) {
          setRunwayStatusesLocal(status.runway_statuses)
        } else {
          // Initialize from legacy single-runway data
          setRunwayStatusesLocal({
            [status.active_runway]: {
              status: status.runway_status,
              active_end: status.active_runway,
            },
          })
        }
      }
      setLoaded(true)
    }
    load()
  }, [installationId])

  // Initialize runway_statuses entries for any runways not yet tracked
  useEffect(() => {
    if (!loaded || runways.length === 0) return
    setRunwayStatusesLocal(prev => {
      const updated = { ...prev }
      let changed = false
      for (const rwy of runways) {
        const label = `${rwy.end1_designator}/${rwy.end2_designator}`
        if (!updated[label]) {
          updated[label] = { status: 'open', active_end: rwy.end1_designator }
          changed = true
        }
      }
      return changed ? updated : prev
    })
  }, [loaded, runways])

  // Helper: persist runway_statuses and sync legacy fields from first runway
  const persistRunwayStatuses = useCallback(async (updated: RunwayStatuses) => {
    // Sync legacy fields from first runway label
    const firstLabel = runwayLabels[0]
    const firstEntry = firstLabel ? updated[firstLabel] : undefined
    const legacyUpdates: Record<string, unknown> = { runway_statuses: updated }
    if (firstEntry) {
      legacyUpdates.active_runway = firstEntry.active_end
      legacyUpdates.runway_status = firstEntry.status
    }
    await updateAirfieldStatus(legacyUpdates, installationId)
  }, [installationId, runwayLabels])

  // Persist advisory changes
  const setAdvisory = useCallback(async (a: Advisory | null) => {
    setAdvisoryLocal(a)
    await updateAirfieldStatus({
      advisory_type: a?.type ?? null,
      advisory_text: a?.text ?? null,
    }, installationId)
  }, [installationId])

  // Legacy: Persist active runway changes (single-runway compat)
  const setActiveRunway = useCallback(async (r: string) => {
    setActiveRunwayLocal(r)
    await updateAirfieldStatus({ active_runway: r }, installationId)
  }, [installationId])

  // Legacy: Persist runway status changes (single-runway compat)
  const setRunwayStatus = useCallback(async (s: 'open' | 'suspended' | 'closed') => {
    setRunwayStatusLocal(s)
    await updateAirfieldStatus({ runway_status: s }, installationId)
  }, [installationId])

  // Multi-runway: set active end for a specific runway
  const setRunwayActiveEnd = useCallback(async (runwayLabel: string, activeEnd: string) => {
    const updated = { ...runwayStatuses, [runwayLabel]: { ...runwayStatuses[runwayLabel], active_end: activeEnd } }
    setRunwayStatusesLocal(updated)
    // Sync legacy if first runway
    if (runwayLabel === runwayLabels[0]) setActiveRunwayLocal(activeEnd)
    await persistRunwayStatuses(updated)
  }, [runwayStatuses, runwayLabels, persistRunwayStatuses])

  // Multi-runway: set status for a specific runway
  const setRunwayStatusForRunway = useCallback(async (runwayLabel: string, status: 'open' | 'suspended' | 'closed') => {
    const updated = { ...runwayStatuses, [runwayLabel]: { ...runwayStatuses[runwayLabel], status } }
    setRunwayStatusesLocal(updated)
    // Sync legacy if first runway
    if (runwayLabel === runwayLabels[0]) setRunwayStatusLocal(status)
    await persistRunwayStatuses(updated)
  }, [runwayStatuses, runwayLabels, persistRunwayStatuses])

  // Don't render children until initial load completes to avoid flash of defaults
  if (!loaded) return null

  return (
    <DashboardContext.Provider
      value={{
        advisory, setAdvisory,
        activeRunway, setActiveRunway,
        runwayStatus, setRunwayStatus,
        runwayStatuses, setRunwayActiveEnd, setRunwayStatusForRunway,
      }}
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
