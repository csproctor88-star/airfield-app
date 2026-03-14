'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { fetchAirfieldStatus, updateAirfieldStatus, type AirfieldStatus, type AdvisoryItem, type RunwayStatuses } from '@/lib/supabase/airfield-status'
import { logBwcChange } from '@/lib/supabase/wildlife'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'

type ArffReadiness = 'inadequate' | 'critical' | 'reduced' | 'optimum'

type DashboardState = {
  advisories: AdvisoryItem[]
  addAdvisory: (type: AdvisoryItem['type'], text: string) => Promise<void>
  updateAdvisory: (id: string, type: AdvisoryItem['type'], text: string) => Promise<void>
  removeAdvisory: (id: string) => Promise<void>
  // Legacy single-runway accessors (first runway)
  activeRunway: string
  setActiveRunway: (r: string) => void
  runwayStatus: 'open' | 'suspended' | 'closed'
  setRunwayStatus: (s: 'open' | 'suspended' | 'closed') => void
  // Multi-runway support
  runwayStatuses: RunwayStatuses
  setRunwayActiveEnd: (runwayLabel: string, activeEnd: string) => void
  setRunwayStatusForRunway: (runwayLabel: string, status: 'open' | 'suspended' | 'closed', remarks?: string | null) => void
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
  constructionRemarks: string | null
  setConstructionRemarks: (val: string | null) => Promise<void>
  miscRemarks: string | null
  setMiscRemarks: (val: string | null) => Promise<void>
  refreshStatus: () => Promise<void>
}

const DashboardContext = createContext<DashboardState | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { installationId, runways } = useInstallation()
  const [advisories, setAdvisoriesLocal] = useState<AdvisoryItem[]>([])
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
  const [constructionRemarks, setConstructionRemarksLocal] = useState<string | null>(null)
  const [miscRemarks, setMiscRemarksLocal] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const lastLocalUpdate = useRef(0)

  // Build runway labels from installation runways (e.g., "06L/24R")
  const runwayLabels = runways.map(r => `${r.end1_designator}/${r.end2_designator}`)

  // Load from Supabase on mount or when base changes
  useEffect(() => {
    async function load() {
      setLoaded(false)
      const status = await fetchAirfieldStatus(installationId)
      if (status) {
        // Load advisories array, fall back to legacy single advisory
        if (Array.isArray(status.advisories) && status.advisories.length > 0) {
          setAdvisoriesLocal(status.advisories)
        } else if (status.advisory_type && status.advisory_text) {
          setAdvisoriesLocal([{ id: crypto.randomUUID(), type: status.advisory_type, text: status.advisory_text, created_at: new Date().toISOString() }])
        } else {
          setAdvisoriesLocal([])
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
        setConstructionRemarksLocal(status.construction_remarks ?? null)
        setMiscRemarksLocal(status.misc_remarks ?? null)
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
          // Advisories realtime
          if (Array.isArray(row.advisories)) {
            setAdvisoriesLocal(row.advisories)
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
          // Construction / Misc remarks realtime
          setConstructionRemarksLocal(row.construction_remarks ?? null)
          setMiscRemarksLocal(row.misc_remarks ?? null)
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

  // Signal to the alert banner that this is a local update (skip showing alert)
  const markLocalUpdate = useCallback(() => {
    lastLocalUpdate.current = Date.now()
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('glidepath:local-status-update'))
  }, [])

  // Helper: persist runway_statuses and sync legacy fields from first runway
  const persistRunwayStatuses = useCallback(async (updated: RunwayStatuses) => {
    markLocalUpdate()
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

  // Helper: persist advisories array + sync legacy fields from first item
  const persistAdvisories = useCallback(async (items: AdvisoryItem[]) => {
    setAdvisoriesLocal(items)
    markLocalUpdate()
    const first = items[0] ?? null
    await updateAirfieldStatus({
      advisories: items,
      advisory_type: first?.type ?? null,
      advisory_text: first?.text ?? null,
    }, installationId)
  }, [installationId, markLocalUpdate])

  const addAdvisory = useCallback(async (type: AdvisoryItem['type'], text: string) => {
    const item: AdvisoryItem = { id: crypto.randomUUID(), type, text, created_at: new Date().toISOString() }
    await persistAdvisories([...advisories, item])
  }, [advisories, persistAdvisories])

  const updateAdvisoryFn = useCallback(async (id: string, type: AdvisoryItem['type'], text: string) => {
    const updated = advisories.map(a => a.id === id ? { ...a, type, text } : a)
    await persistAdvisories(updated)
  }, [advisories, persistAdvisories])

  const removeAdvisory = useCallback(async (id: string) => {
    const updated = advisories.filter(a => a.id !== id)
    await persistAdvisories(updated)
  }, [advisories, persistAdvisories])

  // Legacy: Persist active runway changes (single-runway compat)
  const setActiveRunway = useCallback(async (r: string) => {
    setActiveRunwayLocal(r)
    markLocalUpdate()
    await updateAirfieldStatus({ active_runway: r }, installationId)
  }, [installationId])

  // Legacy: Persist runway status changes (single-runway compat)
  const setRunwayStatus = useCallback(async (s: 'open' | 'suspended' | 'closed') => {
    setRunwayStatusLocal(s)
    markLocalUpdate()
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
  const setRunwayStatusForRunway = useCallback(async (runwayLabel: string, status: 'open' | 'suspended' | 'closed', remarks?: string | null) => {
    const entry = { ...runwayStatuses[runwayLabel], status, remarks: (status === 'open') ? null : (remarks || null) }
    const updated = { ...runwayStatuses, [runwayLabel]: entry }
    setRunwayStatusesLocal(updated)
    // Sync legacy if first runway
    if (runwayLabel === runwayLabels[0]) setRunwayStatusLocal(status)
    await persistRunwayStatuses(updated)
  }, [runwayStatuses, runwayLabels, persistRunwayStatuses])

  // ARFF: set ARFF CAT
  const setArffCat = useCallback(async (cat: number | null) => {
    setArffCatLocal(cat)
    markLocalUpdate()
    await updateAirfieldStatus({ arff_cat: cat }, installationId)
  }, [installationId])

  // ARFF: set readiness status for a specific aircraft
  const setArffStatusForAircraft = useCallback(async (name: string, status: ArffReadiness) => {
    const updated = { ...arffStatuses, [name]: status }
    setArffStatusesLocal(updated)
    markLocalUpdate()
    await updateAirfieldStatus({ arff_statuses: updated }, installationId)
  }, [arffStatuses, installationId])

  // RSC: set runway surface condition
  const setRscCondition = useCallback(async (val: string | null) => {
    const now = new Date().toISOString()
    setRscConditionLocal(val)
    setRscUpdatedAtLocal(now)
    markLocalUpdate()
    await updateAirfieldStatus({ rsc_condition: val, rsc_updated_at: now }, installationId)
  }, [installationId])

  // BWC: set bird watch condition
  const setBwcValue = useCallback(async (val: string | null) => {
    const now = new Date().toISOString()
    setBwcValueLocal(val)
    setBwcUpdatedAtLocal(now)
    markLocalUpdate()
    await updateAirfieldStatus({ bwc_value: val, bwc_updated_at: now }, installationId)
    if (val) {
      logBwcChange(installationId, val, 'dashboard', null, null, null)
    }
  }, [installationId])

  // Construction remarks
  const setConstructionRemarks = useCallback(async (val: string | null) => {
    setConstructionRemarksLocal(val)
    markLocalUpdate()
    await updateAirfieldStatus({ construction_remarks: val }, installationId)
  }, [installationId])

  // Misc remarks
  const setMiscRemarks = useCallback(async (val: string | null) => {
    setMiscRemarksLocal(val)
    markLocalUpdate()
    await updateAirfieldStatus({ misc_remarks: val }, installationId)
  }, [installationId])

  // Re-fetch airfield_status (called on mount, by dashboard realtime, and by polling fallback)
  const refreshStatus = useCallback(async () => {
    // Skip polling refresh if a local update was made within the last 15 seconds
    // to prevent race conditions where polling overwrites optimistic updates
    if (Date.now() - lastLocalUpdate.current < 15000) return
    const status = await fetchAirfieldStatus(installationId)
    if (status) {
      if (Array.isArray(status.advisories) && status.advisories.length > 0) {
        setAdvisoriesLocal(status.advisories)
      } else if (status.advisory_type && status.advisory_text) {
        setAdvisoriesLocal([{ id: crypto.randomUUID(), type: status.advisory_type, text: status.advisory_text, created_at: new Date().toISOString() }])
      } else {
        setAdvisoriesLocal([])
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
      setConstructionRemarksLocal(status.construction_remarks ?? null)
      setMiscRemarksLocal(status.misc_remarks ?? null)
    }
  }, [installationId])

  // Polling fallback: re-fetch airfield_status every 30s in case realtime is unavailable
  useEffect(() => {
    if (!loaded) return
    const interval = setInterval(refreshStatus, 30000)
    return () => clearInterval(interval)
  }, [loaded, refreshStatus])

  // Don't render children until initial load completes to avoid flash of defaults
  if (!loaded) return null

  return (
    <DashboardContext.Provider
      value={{
        advisories, addAdvisory, updateAdvisory: updateAdvisoryFn, removeAdvisory,
        activeRunway, setActiveRunway,
        runwayStatus, setRunwayStatus,
        runwayStatuses, setRunwayActiveEnd, setRunwayStatusForRunway,
        arffCat, setArffCat,
        arffStatuses, setArffStatusForAircraft,
        rscCondition, rscUpdatedAt, setRscCondition,
        rcrValue, rcrCondition,
        bwcValue, bwcUpdatedAt, setBwcValue,
        constructionRemarks, setConstructionRemarks,
        miscRemarks, setMiscRemarks,
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
