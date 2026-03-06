'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { fetchAirfieldStatus, updateAirfieldStatus, type AirfieldStatus, type RunwayStatuses } from '@/lib/supabase/airfield-status'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'

type Advisory = {
  type: 'INFO' | 'CAUTION' | 'WARNING'
  text: string
}

type ArffReadiness = 'inadequate' | 'critical' | 'reduced' | 'optimum'

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
  // ARFF
  arffCat: number | null
  setArffCat: (cat: number | null) => Promise<void>
  arffStatuses: Record<string, ArffReadiness>
  setArffStatusForAircraft: (name: string, status: ArffReadiness) => Promise<void>
  // RSC / RCR / BWC
  rscCondition: string | null
  rscUpdatedAt: string | null
  setRscCondition: (val: string | null) => Promise<void>
  rcrValue: string | null
  rcrCondition: string | null
  bwcValue: string | null
  bwcUpdatedAt: string | null
  setBwcValue: (val: string | null) => Promise<void>
  refreshStatus: () => Promise<void>
}

const DashboardContext = createContext<DashboardState | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { installationId, runways } = useInstallation()
  const [advisory, setAdvisoryLocal] = useState<Advisory | null>(null)
  const [activeRunway, setActiveRunwayLocal] = useState('01')
  const [runwayStatus, setRunwayStatusLocal] = useState<'open' | 'suspended' | 'closed'>('open')
  const [runwayStatuses, setRunwayStatusesLocal] = useState<RunwayStatuses>({})
  const [arffCat, setArffCatLocal] = useState<number | null>(null)
  const [arffStatuses, setArffStatusesLocal] = useState<Record<string, ArffReadiness>>({})
  const [rscCondition, setRscConditionLocal] = useState<string | null>(null)
  const [rscUpdatedAt, setRscUpdatedAtLocal] = useState<string | null>(null)
  const [rcrValue, setRcrValueLocal] = useState<string | null>(null)
  const [rcrCondition, setRcrConditionLocal] = useState<string | null>(null)
  const [bwcValue, setBwcValueLocal] = useState<string | null>(null)
  const [bwcUpdatedAt, setBwcUpdatedAtLocal] = useState<string | null>(null)
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

        // ARFF state
        setArffCatLocal(status.arff_cat ?? null)
        if (status.arff_statuses && typeof status.arff_statuses === 'object') {
          setArffStatusesLocal(status.arff_statuses as Record<string, ArffReadiness>)
        }

        // RSC / RCR / BWC state
        setRscConditionLocal(status.rsc_condition ?? null)
        setRscUpdatedAtLocal(status.rsc_updated_at ?? null)
        setRcrValueLocal(status.rcr_touchdown ?? null)
        setRcrConditionLocal(status.rcr_condition ?? null)
        setBwcValueLocal(status.bwc_value ?? null)
        setBwcUpdatedAtLocal(status.bwc_updated_at ?? null)
      }
      setLoaded(true)
    }
    load()
  }, [installationId])

  // Realtime: subscribe to airfield_status UPDATE events for this base
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    const channel = supabase
      .channel(`airfield_status:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'airfield_status', filter: `base_id=eq.${installationId}` },
        (payload) => {
          const row = payload.new as AirfieldStatus
          if (row.advisory_type && row.advisory_text) {
            setAdvisoryLocal({ type: row.advisory_type, text: row.advisory_text })
          } else {
            setAdvisoryLocal(null)
          }
          setActiveRunwayLocal(row.active_runway)
          setRunwayStatusLocal(row.runway_status)
          if (row.runway_statuses && Object.keys(row.runway_statuses).length > 0) {
            setRunwayStatusesLocal(row.runway_statuses)
          }
          // ARFF realtime
          setArffCatLocal(row.arff_cat ?? null)
          if (row.arff_statuses && typeof row.arff_statuses === 'object') {
            setArffStatusesLocal(row.arff_statuses as Record<string, ArffReadiness>)
          }
          // RSC / RCR / BWC realtime
          setRscConditionLocal(row.rsc_condition ?? null)
          setRscUpdatedAtLocal(row.rsc_updated_at ?? null)
          setRcrValueLocal(row.rcr_touchdown ?? null)
          setRcrConditionLocal(row.rcr_condition ?? null)
          setBwcValueLocal(row.bwc_value ?? null)
          setBwcUpdatedAtLocal(row.bwc_updated_at ?? null)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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

  // ARFF: set ARFF CAT
  const setArffCat = useCallback(async (cat: number | null) => {
    setArffCatLocal(cat)
    await updateAirfieldStatus({ arff_cat: cat }, installationId)
  }, [installationId])

  // ARFF: set readiness status for a specific aircraft
  const setArffStatusForAircraft = useCallback(async (name: string, status: ArffReadiness) => {
    const updated = { ...arffStatuses, [name]: status }
    setArffStatusesLocal(updated)
    await updateAirfieldStatus({ arff_statuses: updated }, installationId)
  }, [arffStatuses, installationId])

  // RSC: set runway surface condition
  const setRscCondition = useCallback(async (val: string | null) => {
    const now = new Date().toISOString()
    setRscConditionLocal(val)
    setRscUpdatedAtLocal(now)
    await updateAirfieldStatus({ rsc_condition: val, rsc_updated_at: now }, installationId)
  }, [installationId])

  // BWC: set bird watch condition
  const setBwcValue = useCallback(async (val: string | null) => {
    const now = new Date().toISOString()
    setBwcValueLocal(val)
    setBwcUpdatedAtLocal(now)
    await updateAirfieldStatus({ bwc_value: val, bwc_updated_at: now }, installationId)
  }, [installationId])

  // Re-fetch airfield_status (called on mount, by dashboard realtime, and by polling fallback)
  const refreshStatus = useCallback(async () => {
    const status = await fetchAirfieldStatus(installationId)
    if (status) {
      if (status.advisory_type && status.advisory_text) {
        setAdvisoryLocal({ type: status.advisory_type, text: status.advisory_text })
      } else {
        setAdvisoryLocal(null)
      }
      setActiveRunwayLocal(status.active_runway)
      setRunwayStatusLocal(status.runway_status)
      if (status.runway_statuses && Object.keys(status.runway_statuses).length > 0) {
        setRunwayStatusesLocal(status.runway_statuses)
      }
      setArffCatLocal(status.arff_cat ?? null)
      if (status.arff_statuses && typeof status.arff_statuses === 'object') {
        setArffStatusesLocal(status.arff_statuses as Record<string, ArffReadiness>)
      }
      setRscConditionLocal(status.rsc_condition ?? null)
      setRscUpdatedAtLocal(status.rsc_updated_at ?? null)
      setRcrValueLocal(status.rcr_touchdown ?? null)
      setRcrConditionLocal(status.rcr_condition ?? null)
      setBwcValueLocal(status.bwc_value ?? null)
      setBwcUpdatedAtLocal(status.bwc_updated_at ?? null)
    }
  }, [installationId])

  // Polling fallback: re-fetch airfield_status every 10s in case realtime is unavailable
  useEffect(() => {
    if (!loaded) return
    const interval = setInterval(refreshStatus, 10000)
    return () => clearInterval(interval)
  }, [loaded, refreshStatus])

  // Don't render children until initial load completes to avoid flash of defaults
  if (!loaded) return null

  return (
    <DashboardContext.Provider
      value={{
        advisory, setAdvisory,
        activeRunway, setActiveRunway,
        runwayStatus, setRunwayStatus,
        runwayStatuses, setRunwayActiveEnd, setRunwayStatusForRunway,
        arffCat, setArffCat,
        arffStatuses, setArffStatusForAircraft,
        rscCondition, rscUpdatedAt, setRscCondition,
        rcrValue, rcrCondition,
        bwcValue, bwcUpdatedAt, setBwcValue,
        refreshStatus,
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
