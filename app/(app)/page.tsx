'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchCurrentWeather, type WeatherResult } from '@/lib/weather'
import { fetchNavaidStatuses, updateNavaidStatus, type NavaidStatus } from '@/lib/supabase/navaids'
import { fetchInstallationNavaids } from '@/lib/supabase/installations'
import { useDashboard } from '@/lib/dashboard-context'
import { useInstallation } from '@/lib/installation-context'
import { logActivity } from '@/lib/supabase/activity'
import { logRunwayStatusChange } from '@/lib/supabase/airfield-status'
import { RSC_CONDITIONS, BWC_OPTIONS, RCR_CONDITION_TYPES } from '@/lib/constants'
import { fetchActiveContractors, type ContractorRow } from '@/lib/supabase/contractors'
import { DEMO_CONTRACTORS } from '@/lib/demo-data'
import LoginActivityDialog from '@/components/login-activity-dialog'

// --- Weather emoji mapping ---
function weatherEmoji(conditions: string): string {
  const c = conditions.toLowerCase()
  if (c.includes('thunderstorm')) return '⛈️'
  if (c.includes('heavy snow') || c.includes('snow grains')) return '❄️'
  if (c.includes('snow')) return '🌨️'
  if (c.includes('freezing')) return '🌨️'
  if (c.includes('heavy rain') || c.includes('heavy showers')) return '🌧️'
  if (c.includes('rain') || c.includes('drizzle') || c.includes('showers')) return '🌧️'
  if (c.includes('fog')) return '🌫️'
  if (c.includes('overcast')) return '☁️'
  if (c.includes('partly cloudy')) return '⛅'
  if (c.includes('mostly clear')) return '🌤️'
  return '☀️'
}

// --- NAVAID color map (theme-aware for text, raw hex for alpha interpolation) ---
const STATUS_COLORS: Record<string, string> = {
  green: 'var(--color-success)',
  yellow: 'var(--color-warning)',
  red: 'var(--color-danger)',
}
const STATUS_HEX: Record<string, string> = {
  green: '#34D399',
  yellow: '#FBBF24',
  red: '#EF4444',
}

// --- Empty NAVAID default (NAVAIDs are fetched per-base from DB) ---
const DEFAULT_NAVAIDS: NavaidStatus[] = []

type Advisory = {
  type: 'INFO' | 'CAUTION' | 'WARNING'
  text: string
}

const ADVISORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  INFO: { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)', text: 'var(--color-accent)' },
  CAUTION: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', text: 'var(--color-warning)' },
  WARNING: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: 'var(--color-danger)' },
}

type CurrentStatusData = {
  lastCheckType: string | null
  lastCheckTime: string | null
  inspectionCompletion: string | null
}

export default function HomePage() {
  const router = useRouter()
  const { advisory, setAdvisory, activeRunway, setActiveRunway, runwayStatus, setRunwayStatus, runwayStatuses, setRunwayActiveEnd, setRunwayStatusForRunway, arffCat, setArffCat, arffStatuses, setArffStatusForAircraft, rscCondition, setRscCondition, rcrValue, rcrCondition, bwcValue, setBwcValue, refreshStatus } = useDashboard()
  const { installationId, runways, arffAircraft } = useInstallation()
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [weatherLoaded, setWeatherLoaded] = useState(false)
  const [navaids, setNavaids] = useState<NavaidStatus[]>([])
  const [navaidNotes, setNavaidNotes] = useState<Record<string, string>>({})
  const [activeContractors, setActiveContractors] = useState<ContractorRow[]>([])
  const [currentStatus, setCurrentStatus] = useState<CurrentStatusData>({
    lastCheckType: null, lastCheckTime: null, inspectionCompletion: null,
  })
  // RSC dialog state
  const [rscDialogOpen, setRscDialogOpen] = useState(false)
  const [rscDraftValue, setRscDraftValue] = useState<string | null>(null)
  const [rscDraftNotes, setRscDraftNotes] = useState('')
  // BWC dialog state
  const [bwcDialogOpen, setBwcDialogOpen] = useState(false)
  const [bwcDraftValue, setBwcDraftValue] = useState<string | null>(null)
  const [bwcDraftNotes, setBwcDraftNotes] = useState('')
  const [advisoryDialogOpen, setAdvisoryDialogOpen] = useState(false)
  const [advisoryDraftType, setAdvisoryDraftType] = useState<'INFO' | 'CAUTION' | 'WARNING'>('INFO')
  const [advisoryDraftText, setAdvisoryDraftText] = useState('')

  // Confirmation dialog state for runway changes
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    color: string
    notes: string
    onConfirm: (notes: string) => void
  } | null>(null)

  // NAVAID status dialog state
  const [navaidDialog, setNavaidDialog] = useState<{
    navaid: NavaidStatus
    selectedStatus: 'green' | 'yellow' | 'red'
    notes: string
  } | null>(null)

  // ARFF aircraft readiness dialog state
  const [arffDialog, setArffDialog] = useState<{
    aircraft: string
    selectedStatus: 'inadequate' | 'critical' | 'reduced' | 'optimum'
    notes: string
  } | null>(null)

  // --- Load weather ---
  useEffect(() => {
    async function loadWeather() {
      const rwy = runways[0]
      const baseLat = rwy ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2 : undefined
      const baseLon = rwy ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2 : undefined
      const result = await fetchCurrentWeather(baseLat, baseLon)
      setWeather(result)
      setWeatherLoaded(true)
    }
    loadWeather()
  }, [])

  // --- Load NAVAIDs ---
  const loadNavaids = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      // No Supabase — use defaults so NAVAIDs still render
      setNavaids(DEFAULT_NAVAIDS)
      return
    }

    const data = await fetchNavaidStatuses(installationId)

    // Filter to only show navaids that still exist in the base_navaids config.
    // This prevents deleted navaids from lingering on the dashboard.
    let resolved: NavaidStatus[] = data
    if (installationId && data.length > 0) {
      const configuredNavaids = await fetchInstallationNavaids(installationId)
      const configuredNames = new Set(configuredNavaids.map((n) => n.navaid_name))
      resolved = data.filter((n) => configuredNames.has(n.navaid_name))
    }
    resolved = resolved.length > 0 ? resolved : DEFAULT_NAVAIDS

    setNavaids(resolved)
    const notes: Record<string, string> = {}
    resolved.forEach((n) => { notes[n.id] = n.notes || '' })
    setNavaidNotes(notes)
  }, [installationId])

  useEffect(() => { loadNavaids() }, [loadNavaids])

  // --- Load Current Status (Last Check, Inspection) ---
  const loadCurrentStatus = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return

    // Latest completed inspection
    let latestInspQuery = supabase
      .from('inspections')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
    if (installationId) latestInspQuery = latestInspQuery.eq('base_id', installationId)
    const { data: latestInsp } = await latestInspQuery

    // Latest check of any type
    let lastCheckQuery = supabase
      .from('airfield_checks')
      .select('check_type, completed_at')
      .order('completed_at', { ascending: false })
      .limit(1)
    if (installationId) lastCheckQuery = lastCheckQuery.eq('base_id', installationId)
    const { data: lastCheck } = await lastCheckQuery

    const checkType = lastCheck?.[0]?.check_type?.toUpperCase() || null
    const checkTime = lastCheck?.[0]?.completed_at
      ? new Date(lastCheck[0].completed_at).toTimeString().slice(0, 5)
      : null
    const inspTime = latestInsp?.[0]?.completed_at
      ? new Date(latestInsp[0].completed_at).toTimeString().slice(0, 5)
      : null

    setCurrentStatus((prev) => ({
      ...prev,
      lastCheckType: checkType,
      lastCheckTime: checkTime,
      inspectionCompletion: inspTime,
    }))
  }, [installationId])

  useEffect(() => { loadCurrentStatus(); refreshStatus() }, [loadCurrentStatus, refreshStatus])

  // Realtime: subscribe to airfield_checks and inspections INSERT events
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    const channel = supabase
      .channel(`dashboard_status:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'airfield_checks', filter: `base_id=eq.${installationId}` },
        () => { loadCurrentStatus(); refreshStatus() }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inspections', filter: `base_id=eq.${installationId}` },
        () => { loadCurrentStatus(); refreshStatus() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [installationId, loadCurrentStatus, refreshStatus])

  // --- Load Active Contractors ---
  const loadContractors = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setActiveContractors(DEMO_CONTRACTORS.filter(c => c.status === 'active') as ContractorRow[])
      return
    }
    const data = await fetchActiveContractors(installationId)
    setActiveContractors(data)
  }, [installationId])

  useEffect(() => { loadContractors() }, [loadContractors])

  // --- NAVAID status toggle handler ---
  async function handleNavaidToggle(navaid: NavaidStatus, newStatus: 'green' | 'yellow' | 'red', dialogNotes?: string) {
    const notes = newStatus === 'green' ? null : (dialogNotes ?? (navaidNotes[navaid.id] || null))
    const ok = await updateNavaidStatus(navaid.id, newStatus, notes)
    if (ok) {
      loadNavaids()
      logActivity('updated', 'navaid_status', navaid.id, navaid.navaid_name, { navaid: navaid.navaid_name, changed_to: newStatus, reason: notes || undefined }, installationId)
    }
  }

  async function handleNavaidNotesSave(navaid: NavaidStatus, overrideNotes?: string) {
    const notes = overrideNotes ?? (navaidNotes[navaid.id] || null)
    await updateNavaidStatus(navaid.id, navaid.status, notes)
    loadNavaids()
    logActivity('updated', 'navaid_status', navaid.id, navaid.navaid_name, { navaid: navaid.navaid_name, reason: notes || undefined }, installationId)
  }

  return (
    <div className="page-container">
      <LoginActivityDialog />

      {/* ===== Weather Strip ===== */}
      <div
        className="card"
        style={{
          padding: 'var(--weather-padding)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(56,189,248,0.03)',
          border: '1px solid var(--color-border-mid)',
          marginBottom: 16,
        }}
      >
        {weatherLoaded ? (
          weather ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--weather-gap)' }}>
                <span style={{ fontSize: 'var(--fs-3xl)' }}>{weatherEmoji(weather.conditions)}</span>
                <div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>
                    {weather.temperature_f}&deg;F &bull; {weather.conditions}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                    Wind {weather.wind_speed_mph} mph &bull; Vis {weather.visibility_miles} SM
                  </div>
                </div>
              </div>
              <div
                onClick={() => {
                  setAdvisoryDraftType(advisory?.type || 'INFO')
                  setAdvisoryDraftText(advisory?.text || '')
                  setAdvisoryDialogOpen(true)
                }}
                style={{ textAlign: 'right', cursor: 'pointer', minWidth: 60 }}
              >
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Advisory</div>
                {advisory ? (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: ADVISORY_COLORS[advisory.type].text }}>{advisory.type}</div>
                ) : (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-3)' }}>None</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--weather-gap)' }}>
                <span style={{ fontSize: 'var(--fs-3xl)' }}>❓</span>
                <div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-3)' }}>UNKWN</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>Weather data unavailable</div>
                </div>
              </div>
              <div
                onClick={() => {
                  setAdvisoryDraftType(advisory?.type || 'INFO')
                  setAdvisoryDraftText(advisory?.text || '')
                  setAdvisoryDialogOpen(true)
                }}
                style={{ textAlign: 'right', cursor: 'pointer', minWidth: 60 }}
              >
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Advisory</div>
                {advisory ? (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: ADVISORY_COLORS[advisory.type].text }}>{advisory.type}</div>
                ) : (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-3)' }}>None</div>
                )}
              </div>
            </>
          )
        ) : (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Loading weather...</div>
        )}
      </div>

      {/* Advisory banner */}
      {advisory && (
        <div
          onClick={() => setAdvisoryDialogOpen(true)}
          style={{
            padding: 'var(--advisory-padding)',
            marginBottom: 12,
            borderRadius: 10,
            background: ADVISORY_COLORS[advisory.type].bg,
            border: `1px solid ${ADVISORY_COLORS[advisory.type].border}`,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: ADVISORY_COLORS[advisory.type].text, marginBottom: 2 }}>{advisory.type}</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{advisory.text}</div>
        </div>
      )}

      {/* Advisory dialog */}
      {advisoryDialogOpen && (
        <div
          onClick={() => setAdvisoryDialogOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 'var(--advisory-dialog-padding)', width: '100%', maxWidth: 'var(--advisory-dialog-width)',
              border: '1px solid var(--color-border-mid)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>Set Advisory</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['INFO', 'CAUTION', 'WARNING'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAdvisoryDraftType(t)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 700,
                    cursor: 'pointer', textAlign: 'center',
                    border: advisoryDraftType === t
                      ? `2px solid ${ADVISORY_COLORS[t].text}`
                      : '1px solid var(--color-border-mid)',
                    background: advisoryDraftType === t ? ADVISORY_COLORS[t].bg : 'var(--color-bg-inset)',
                    color: ADVISORY_COLORS[t].text,
                  }}
                >{t}</button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Advisory text..."
              value={advisoryDraftText}
              onChange={(e) => setAdvisoryDraftText(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none', marginBottom: 14,
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {advisory && (
                <button
                  onClick={() => {
                    logRunwayStatusChange({
                      oldAdvisoryType: advisory?.type ?? null,
                      oldAdvisoryText: advisory?.text ?? null,
                      newAdvisoryType: null,
                      newAdvisoryText: null,
                    }, installationId)
                    if (installationId) logActivity('updated', 'airfield_status', installationId, 'Advisory Cleared', { old_advisory: advisory?.type ?? null }, installationId)
                    setAdvisory(null)
                    setAdvisoryDraftText('')
                    setAdvisoryDialogOpen(false)
                  }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                    cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)',
                  }}
                >Clear</button>
              )}
              <button
                onClick={() => {
                  if (advisoryDraftText.trim()) {
                    logRunwayStatusChange({
                      oldAdvisoryType: advisory?.type ?? null,
                      oldAdvisoryText: advisory?.text ?? null,
                      newAdvisoryType: advisoryDraftType,
                      newAdvisoryText: advisoryDraftText.trim(),
                    }, installationId)
                    if (installationId) logActivity('updated', 'airfield_status', installationId, `Advisory ${advisoryDraftType}`, { advisory_type: advisoryDraftType, advisory_text: advisoryDraftText.trim() }, installationId)
                    setAdvisory({ type: advisoryDraftType, text: advisoryDraftText.trim() })
                  }
                  setAdvisoryDialogOpen(false)
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)',
                  background: 'rgba(52,211,153,0.15)', color: 'var(--color-success)',
                }}
              >Save</button>
              <button
                onClick={() => setAdvisoryDialogOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* NAVAID status dialog */}
      {navaidDialog && (
        <div
          onClick={() => setNavaidDialog(null)}
          style={{
            position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380,
              border: '1px solid var(--color-border-mid)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 6 }}>
              {navaidDialog.navaid.navaid_name}
            </div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', marginBottom: 16 }}>
              Select status
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['green', 'yellow', 'red'] as const).map((s) => {
                const selected = navaidDialog.selectedStatus === s
                const color = s === 'red' ? 'var(--color-danger)' : s === 'yellow' ? 'var(--color-warning)' : 'var(--color-success)'
                const label = s === 'red' ? 'RED' : s === 'yellow' ? 'YELLOW' : 'GREEN'
                return (
                  <button
                    key={s}
                    onClick={() => setNavaidDialog({ ...navaidDialog, selectedStatus: s })}
                    style={{
                      flex: 1, padding: '12px 4px', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: 'pointer', textAlign: 'center',
                      border: selected ? `2px solid ${color}` : '1px solid var(--color-border-mid)',
                      background: selected ? `${STATUS_HEX[s]}20` : 'var(--color-bg-inset)',
                      color: selected ? color : 'var(--color-text-3)',
                    }}
                  >{label}</button>
                )
              })}
            </div>
            {navaidDialog.selectedStatus !== 'green' && (
              <textarea
                placeholder="Notes (optional)..."
                value={navaidDialog.notes}
                onChange={(e) => setNavaidDialog({ ...navaidDialog, notes: e.target.value })}
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
                  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none', marginBottom: 14,
                  fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
                }}
              />
            )}
            {(() => {
              const statusChanged = navaidDialog.selectedStatus !== navaidDialog.navaid.status
              const notesChanged = navaidDialog.notes !== (navaidDialog.navaid.notes || '')
              const hasChanges = statusChanged || notesChanged
              const selColor = navaidDialog.selectedStatus === 'red' ? 'var(--color-danger)' : navaidDialog.selectedStatus === 'yellow' ? 'var(--color-warning)' : 'var(--color-success)'
              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const { navaid, selectedStatus, notes } = navaidDialog
                      if (statusChanged) {
                        handleNavaidToggle(navaid, selectedStatus, notes || undefined)
                      } else if (notesChanged) {
                        // Only notes changed — save notes for current status
                        setNavaidNotes(prev => ({ ...prev, [navaid.id]: notes }))
                        handleNavaidNotesSave(navaid, notes)
                      }
                      setNavaidDialog(null)
                    }}
                    disabled={!hasChanges}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: hasChanges ? 'pointer' : 'not-allowed',
                      border: `1px solid ${hasChanges ? selColor : 'var(--color-border-mid)'}`,
                      background: 'var(--color-bg-inset)',
                      color: hasChanges ? selColor : 'var(--color-text-3)',
                      opacity: hasChanges ? 1 : 0.5,
                    }}
                  >Save</button>
                  <button
                    onClick={() => setNavaidDialog(null)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                      background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                    }}
                  >Cancel</button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Confirmation dialog for runway changes */}
      {confirmDialog && (
        <div
          onClick={() => setConfirmDialog(null)}
          style={{
            position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380,
              border: '1px solid var(--color-border-mid)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 12 }}>
              {confirmDialog.title}
            </div>
            <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-2)', marginBottom: 14, lineHeight: 1.5 }}>
              {confirmDialog.message}
            </div>
            <textarea
              placeholder="Notes (optional)..."
              value={confirmDialog.notes}
              onChange={(e) => setConfirmDialog({ ...confirmDialog, notes: e.target.value })}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none', marginBottom: 14,
                fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  confirmDialog.onConfirm(confirmDialog.notes.trim())
                  setConfirmDialog(null)
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: `1px solid ${confirmDialog.color}`,
                  background: 'var(--color-bg-inset)', color: confirmDialog.color,
                }}
              >Confirm</button>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* RSC dialog */}
      {rscDialogOpen && (
        <div
          onClick={() => setRscDialogOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380,
              border: '1px solid var(--color-border-mid)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>
              Runway Surface Condition
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {RSC_CONDITIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setRscDraftValue(c)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 8, fontSize: 'var(--fs-lg)', fontWeight: 700,
                    cursor: 'pointer', border: rscDraftValue === c ? '2px solid var(--color-accent)' : '1px solid var(--color-border-mid)',
                    background: rscDraftValue === c ? 'rgba(56,189,248,0.12)' : 'var(--color-bg-inset)',
                    color: rscDraftValue === c ? 'var(--color-accent)' : 'var(--color-text-2)',
                  }}
                >{c}</button>
              ))}
            </div>
            <textarea
              placeholder="Notes (optional)..."
              value={rscDraftNotes}
              onChange={(e) => setRscDraftNotes(e.target.value)}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none', marginBottom: 14,
                fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (rscDraftValue) {
                    setRscCondition(rscDraftValue)
                    if (installationId) {
                      const details: Record<string, unknown> = { old_value: rscCondition, new_value: rscDraftValue }
                      if (rscDraftNotes.trim()) details.notes = rscDraftNotes.trim()
                      logActivity('updated', 'airfield_status', installationId, `RSC ${rscDraftValue}`, details, installationId)
                    }
                  }
                  setRscDialogOpen(false)
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-accent)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-accent)',
                  opacity: rscDraftValue ? 1 : 0.4,
                }}
                disabled={!rscDraftValue}
              >Confirm</button>
              <button
                onClick={() => setRscDialogOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* BWC dialog */}
      {bwcDialogOpen && (
        <div
          onClick={() => setBwcDialogOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380,
              border: '1px solid var(--color-border-mid)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>
              Bird Watch Condition
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {BWC_OPTIONS.map(opt => {
                const bwcColors: Record<string, string> = { LOW: 'var(--color-success)', MOD: 'var(--color-warning)', SEV: 'var(--color-danger)', PROHIB: 'var(--color-danger)' }
                const c = bwcColors[opt] || 'var(--color-text-2)'
                return (
                  <button
                    key={opt}
                    onClick={() => setBwcDraftValue(opt)}
                    style={{
                      padding: '12px 0', borderRadius: 8, fontSize: 'var(--fs-lg)', fontWeight: 700,
                      cursor: 'pointer', border: bwcDraftValue === opt ? `2px solid ${c}` : '1px solid var(--color-border-mid)',
                      background: bwcDraftValue === opt ? `${c}15` : 'var(--color-bg-inset)',
                      color: bwcDraftValue === opt ? c : 'var(--color-text-2)',
                    }}
                  >{opt}</button>
                )
              })}
            </div>
            <textarea
              placeholder="Notes (optional)..."
              value={bwcDraftNotes}
              onChange={(e) => setBwcDraftNotes(e.target.value)}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none', marginBottom: 14,
                fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (bwcDraftValue) {
                    setBwcValue(bwcDraftValue)
                    if (installationId) {
                      const details: Record<string, unknown> = { old_value: bwcValue, new_value: bwcDraftValue }
                      if (bwcDraftNotes.trim()) details.notes = bwcDraftNotes.trim()
                      logActivity('updated', 'airfield_status', installationId, `BWC ${bwcDraftValue}`, details, installationId)
                    }
                  }
                  setBwcDialogOpen(false)
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-accent)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-accent)',
                  opacity: bwcDraftValue ? 1 : 0.4,
                }}
                disabled={!bwcDraftValue}
              >Confirm</button>
              <button
                onClick={() => setBwcDialogOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Current Status ===== */}
      <span className="section-label">Current Status</span>
      {/* Active RWY cards — one per runway, side-by-side for multi-runway bases */}
      {(() => {
        // Build runway entries from installation runways
        const rwyEntries = runways.map(r => {
          const label = `${r.end1_designator}/${r.end2_designator}`
          const entry = runwayStatuses[label] ?? { status: 'open' as const, active_end: r.end1_designator }
          return { label, end1: r.end1_designator, end2: r.end2_designator, ...entry }
        })

        // Fallback for bases with no configured runways
        if (rwyEntries.length === 0) {
          rwyEntries.push({ label: `${activeRunway}`, end1: activeRunway, end2: activeRunway, status: runwayStatus, active_end: activeRunway })
        }

        const getColors = (s: 'open' | 'suspended' | 'closed') => ({
          color: s === 'closed' ? 'var(--color-danger)' : s === 'suspended' ? 'var(--color-warning)' : 'var(--color-success)',
          bg: s === 'closed' ? 'rgba(239,68,68,0.08)' : s === 'suspended' ? 'rgba(251,191,36,0.08)' : 'rgba(52,211,153,0.08)',
          border: s === 'closed' ? 'rgba(239,68,68,0.2)' : s === 'suspended' ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.2)',
          btnBorder: s === 'closed' ? 'rgba(239,68,68,0.25)' : s === 'suspended' ? 'rgba(251,191,36,0.25)' : 'rgba(52,211,153,0.25)',
          btnBg: s === 'closed' ? 'rgba(239,68,68,0.1)' : s === 'suspended' ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.1)',
          selectBorder: s === 'closed' ? 'rgba(239,68,68,0.4)' : s === 'suspended' ? 'rgba(251,191,36,0.4)' : 'rgba(52,211,153,0.4)',
        })

        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: rwyEntries.length > 1 ? `repeat(${rwyEntries.length}, 1fr)` : '1fr',
            gap: 8,
            marginBottom: 8,
          }}>
            {rwyEntries.map((rwy) => {
              const c = getColors(rwy.status)
              return (
                <div key={rwy.label} className="card" style={{
                  padding: 'var(--rwy-card-padding)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--rwy-card-gap)',
                  background: c.bg, border: `1px solid ${c.border}`,
                }}>
                  <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)', fontWeight: 600 }}>Active RWY</div>
                  <button
                    onClick={() => {
                      const newEnd = rwy.active_end === rwy.end1 ? rwy.end2 : rwy.end1
                      setConfirmDialog({
                        title: 'Change Active Runway',
                        message: `Switch active runway from RWY ${rwy.active_end} to RWY ${newEnd}?`,
                        color: c.color,
                        notes: '',
                        onConfirm: (remarks) => {
                          const details: Record<string, unknown> = { runway: rwy.label, active_end: newEnd }
                          if (remarks) details.notes = remarks
                          if (runways.length > 0) {
                            setRunwayActiveEnd(rwy.label, newEnd)
                            if (installationId) logActivity('updated', 'airfield_status', installationId, `RWY ${newEnd}`, details, installationId)
                            logRunwayStatusChange({ oldActiveRunway: rwy.active_end, newActiveRunway: newEnd }, installationId)
                          } else {
                            const designators = runways.flatMap(r => [r.end1_designator, r.end2_designator])
                            if (designators.length === 0) return
                            const idx = designators.indexOf(activeRunway)
                            const next = designators[(idx + 1) % designators.length]
                            setActiveRunway(next)
                            if (installationId) logActivity('updated', 'airfield_status', installationId, `RWY ${next}`, { active_runway: next, ...(remarks ? { notes: remarks } : {}) }, installationId)
                            logRunwayStatusChange({ oldActiveRunway: activeRunway, newActiveRunway: next }, installationId)
                          }
                        },
                      })
                    }}
                    style={{
                      padding: 'var(--rwy-btn-padding)', borderRadius: 8, fontSize: 'var(--rwy-btn-font)', fontWeight: 800,
                      cursor: 'pointer', color: c.color,
                      border: `2px solid ${c.btnBorder}`,
                      background: c.btnBg,
                    }}
                  >{runways.length > 0 ? rwy.active_end : activeRunway}</button>
                  <select
                    value={runways.length > 0 ? rwy.status : runwayStatus}
                    onChange={(e) => {
                      const val = e.target.value as 'open' | 'suspended' | 'closed'
                      const currentVal = runways.length > 0 ? rwy.status : runwayStatus
                      if (val === currentVal) return
                      const statusColor = val === 'closed' ? 'var(--color-danger)' : val === 'suspended' ? 'var(--color-warning)' : 'var(--color-success)'
                      setConfirmDialog({
                        title: 'Change Runway Status',
                        message: `Change RWY ${rwy.active_end} status from ${currentVal.toUpperCase()} to ${val.toUpperCase()}?`,
                        color: statusColor,
                        notes: '',
                        onConfirm: (remarks) => {
                          if (runways.length > 0) {
                            setRunwayStatusForRunway(rwy.label, val)
                            if (installationId) logActivity('status_updated', 'airfield_status', installationId, `RWY ${rwy.active_end} ${val.toUpperCase()}`, { runway: rwy.label, status: val, ...(remarks ? { notes: remarks } : {}) }, installationId)
                            logRunwayStatusChange({ oldRunwayStatus: rwy.status, newRunwayStatus: val }, installationId)
                          } else {
                            setRunwayStatus(val)
                            if (installationId) logActivity('status_updated', 'airfield_status', installationId, `RWY ${activeRunway} ${val.toUpperCase()}`, { status: val, ...(remarks ? { notes: remarks } : {}) }, installationId)
                            logRunwayStatusChange({ oldRunwayStatus: runwayStatus, newRunwayStatus: val }, installationId)
                          }
                        },
                      })
                      // Reset select to current value — it only changes after confirm
                      e.target.value = currentVal
                    }}
                    style={{
                      padding: 'var(--rwy-select-padding)', borderRadius: 6, fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', outline: 'none',
                      color: c.color, background: 'var(--color-bg-inset)',
                      border: `1px solid ${c.selectBorder}`,
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="suspended">Suspended</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              )
            })}
          </div>
        )
      })()}
      <div className="card" style={{ marginBottom: 12, padding: '14px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
          {rcrValue ? (
            /* RWY RCR card — display-only, set from checks */
            <div
              style={{ flex: '0 1 200px', padding: 14, background: 'var(--color-bg-inset)', borderRadius: 10, border: '1px solid rgba(34,211,238,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
            >
              <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-cyan)', fontWeight: 600, marginBottom: 6 }}>RWY RCR</div>
              <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-accent)' }}>{rcrValue}</div>
              {rcrCondition && (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600, marginTop: 4 }}>{RCR_CONDITION_TYPES.find(c => c.value === rcrCondition)?.label || rcrCondition}</div>
              )}
            </div>
          ) : (
            /* Standard RSC card — clickable */
            <div
              onClick={() => { setRscDraftValue(rscCondition); setRscDraftNotes(''); setRscDialogOpen(true) }}
              style={{ flex: '0 1 200px', padding: 14, background: 'var(--color-bg-inset)', borderRadius: 10, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center' }}
            >
              <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 6 }}>RSC</div>
              <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
                {rscCondition || 'No Data'}
              </div>
            </div>
          )}
          <div
            onClick={() => { setBwcDraftValue(bwcValue); setBwcDraftNotes(''); setBwcDialogOpen(true) }}
            style={{ flex: '0 1 200px', padding: 14, background: 'var(--color-bg-inset)', borderRadius: 10, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center' }}
          >
            <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 6 }}>BWC</div>
            <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, color: bwcValue === 'SEV' || bwcValue === 'PROHIB' ? 'var(--color-danger)' : bwcValue === 'MOD' ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {bwcValue || 'No Data'}
            </div>
          </div>
        </div>
      </div>

      {/* ===== ARFF Status ===== */}
      <span className="section-label">ARFF Status</span>
      <div style={{
        display: 'grid',
        gridTemplateColumns: arffAircraft.length > 0
          ? `repeat(${Math.min(arffAircraft.length + 1, 4)}, 1fr)`
          : '1fr',
        gap: 8,
        marginBottom: 16,
      }}>
        {/* ARFF CAT card */}
        <div className="card" style={{
          padding: '14px 12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)', fontWeight: 600 }}>ARFF CAT</div>
          <select
            value={arffCat ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : null
              const current = arffCat
              if (val === current) return
              setConfirmDialog({
                title: 'Change ARFF Category',
                message: `Change ARFF Category from ${current ?? 'None'} to ${val ?? 'None'}?`,
                color: 'var(--color-accent)',
                notes: '',
                onConfirm: (remarks) => {
                  setArffCat(val)
                  if (installationId) {
                    const details: Record<string, unknown> = { old_cat: current, new_cat: val }
                    if (remarks) details.notes = remarks
                    logActivity('updated', 'arff_status', installationId, `ARFF CAT ${val ?? 'None'}`, details, installationId)
                  }
                },
              })
              // Reset select to current value — changes after confirm
              e.target.value = String(current ?? '')
            }}
            style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 'var(--fs-2xl)', fontWeight: 800,
              cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', outline: 'none',
              color: 'var(--color-accent)', background: 'var(--color-bg-inset)',
              border: '2px solid rgba(56,189,248,0.3)',
              minWidth: 70,
            }}
          >
            <option value="">—</option>
            {[6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Aircraft readiness cards */}
        {arffAircraft.map(aircraft => {
          const readiness = (arffStatuses[aircraft] ?? 'optimum') as 'inadequate' | 'critical' | 'reduced' | 'optimum'
          const ARFF_COLORS: Record<string, { color: string; bg: string; border: string }> = {
            optimum: { color: 'var(--color-success)', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
            reduced: { color: 'var(--color-warning)', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
            critical: { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' },
            inadequate: { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
          }
          const c = ARFF_COLORS[readiness]
          return (
            <div
              key={aircraft}
              className="card"
              onClick={() => setArffDialog({ aircraft, selectedStatus: readiness, notes: '' })}
              style={{
                padding: '14px 12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                cursor: 'pointer',
                background: c.bg, border: `1px solid ${c.border}`,
              }}
            >
              <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)', fontWeight: 600 }}>{aircraft}</div>
              <div style={{
                fontSize: 'var(--fs-md)', fontWeight: 700, color: c.color,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {readiness}
              </div>
            </div>
          )
        })}
      </div>

      {/* ARFF Aircraft Readiness Dialog */}
      {arffDialog && (
        <div
          onClick={() => setArffDialog(null)}
          style={{
            position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380,
              border: '1px solid var(--color-border-mid)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>
              {arffDialog.aircraft} Readiness
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {([
                { key: 'optimum', label: 'Optimum', color: 'var(--color-success)', hex: '#34D399' },
                { key: 'reduced', label: 'Reduced', color: 'var(--color-warning)', hex: '#FBBF24' },
                { key: 'critical', label: 'Critical', color: '#f97316', hex: '#f97316' },
                { key: 'inadequate', label: 'Inadequate', color: 'var(--color-danger)', hex: '#EF4444' },
              ] as const).map(({ key, label, color, hex }) => {
                const selected = arffDialog.selectedStatus === key
                return (
                  <button
                    key={key}
                    onClick={() => setArffDialog({ ...arffDialog, selectedStatus: key })}
                    style={{
                      padding: '12px 4px', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: 'pointer', textAlign: 'center',
                      border: selected ? `2px solid ${color}` : '1px solid var(--color-border-mid)',
                      background: selected ? `${hex}20` : 'var(--color-bg-inset)',
                      color: selected ? color : 'var(--color-text-3)',
                    }}
                  >{label}</button>
                )
              })}
            </div>
            <textarea
              placeholder="Notes (optional)..."
              value={arffDialog.notes}
              onChange={(e) => setArffDialog({ ...arffDialog, notes: e.target.value })}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none', marginBottom: 14,
                fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
              }}
            />
            {(() => {
              const currentReadiness = (arffStatuses[arffDialog.aircraft] ?? 'optimum') as string
              const hasChanges = arffDialog.selectedStatus !== currentReadiness || arffDialog.notes.trim() !== ''
              const ARFF_SEL_COLORS: Record<string, string> = {
                optimum: 'var(--color-success)', reduced: 'var(--color-warning)',
                critical: '#f97316', inadequate: 'var(--color-danger)',
              }
              const selColor = ARFF_SEL_COLORS[arffDialog.selectedStatus]
              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const { aircraft, selectedStatus, notes } = arffDialog
                      setArffStatusForAircraft(aircraft, selectedStatus)
                      if (installationId) {
                        const details: Record<string, unknown> = { aircraft, status: selectedStatus, old_status: currentReadiness }
                        if (notes.trim()) details.notes = notes.trim()
                        logActivity('updated', 'arff_status', installationId, `${aircraft} ${selectedStatus.toUpperCase()}`, details, installationId)
                      }
                      setArffDialog(null)
                    }}
                    disabled={!hasChanges}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: hasChanges ? 'pointer' : 'not-allowed',
                      border: `1px solid ${hasChanges ? selColor : 'var(--color-border-mid)'}`,
                      background: 'var(--color-bg-inset)',
                      color: hasChanges ? selColor : 'var(--color-text-3)',
                      opacity: hasChanges ? 1 : 0.5,
                    }}
                  >Save</button>
                  <button
                    onClick={() => setArffDialog(null)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                      background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                    }}
                  >Cancel</button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ===== NAVAID Status ===== */}
      <span className="section-label">NAVAID Status</span>
      {navaids.length === 0 ? (
        <div className="card" style={{ marginBottom: 16, padding: 12 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', textAlign: 'center' }}>
            Loading NAVAID statuses...
          </div>
        </div>
      ) : (() => {
        const allEndDesignators = runways.flatMap(r => [r.end1_designator, r.end2_designator])
        const endGroups = allEndDesignators.map(des => ({
          designator: des,
          items: navaids
            .filter(n => n.navaid_name === des || n.navaid_name.startsWith(des + ' '))
            .sort((a, b) => (a.navaid_name.includes('ILS') ? -1 : b.navaid_name.includes('ILS') ? 1 : 0)),
        }))
        const otherNavaids = navaids
          .filter(n => !allEndDesignators.some(des => n.navaid_name === des || n.navaid_name.startsWith(des + ' ')))
          .sort((a, b) => a.navaid_name.localeCompare(b.navaid_name))
        const getNavaidDisplayName = (name: string) => {
          for (const des of allEndDesignators) {
            if (name.startsWith(des + ' ')) return name.slice(des.length).trim()
          }
          return name
        }
        const NAVAID_LABELS: Record<string, string> = { green: 'G', yellow: 'Y', red: 'R' }
        const renderNavaidItem = (n: NavaidStatus) => (
          <div key={n.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 500, color: 'var(--color-text-2)' }}>
                {getNavaidDisplayName(n.navaid_name)}
              </span>
              <button
                onClick={() => {
                  setNavaidDialog({ navaid: n, selectedStatus: n.status as 'green' | 'yellow' | 'red', notes: navaidNotes[n.id] || '' })
                }}
                style={{
                  width: 36, height: 28, borderRadius: 6,
                  border: `2px solid ${STATUS_COLORS[n.status]}`,
                  background: `${STATUS_HEX[n.status]}20`,
                  cursor: 'pointer', fontSize: 'var(--fs-base)', fontWeight: 700,
                  color: STATUS_COLORS[n.status], textTransform: 'uppercase', padding: 0,
                }}
              >
                {NAVAID_LABELS[n.status] || 'G'}
              </button>
            </div>
          </div>
        )
        const allFlagged = navaids.filter(n => n.status === 'yellow' || n.status === 'red')
        return (
          <>
          <div className="navaid-grid" style={{ marginBottom: allFlagged.length > 0 ? 8 : 16 }}>
            {endGroups.filter(group => group.items.length > 0).map(group => (
              <div key={group.designator} className="card" style={{ padding: '10px 14px 4px' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-warning)', marginBottom: 8, textAlign: 'center', letterSpacing: '0.06em' }}>RWY {group.designator}</div>
                {group.items.map(renderNavaidItem)}
              </div>
            ))}
            {otherNavaids.length > 0 && (
              <div className="card" style={{ padding: '10px 14px 4px' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-warning)', marginBottom: 8, textAlign: 'center', letterSpacing: '0.06em' }}>OTHER</div>
                {otherNavaids.map(renderNavaidItem)}
              </div>
            )}
          </div>
          {allFlagged.length > 0 && (
            <div className="card" style={{ padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-warning)', marginBottom: 6, letterSpacing: '0.04em' }}>NAVAID NOTES</div>
              {allFlagged.map(n => (
                <div key={n.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: STATUS_COLORS[n.status], marginBottom: 2 }}>
                    {n.navaid_name}
                  </div>
                  <textarea
                    placeholder="Add note..."
                    value={navaidNotes[n.id] || ''}
                    onChange={(e) => setNavaidNotes((prev) => ({ ...prev, [n.id]: e.target.value }))}
                    onBlur={() => handleNavaidNotesSave(n)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleNavaidNotesSave(n) }}
                    rows={1}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'var(--color-bg-inset)',
                      border: `1px solid ${STATUS_HEX[n.status]}40`,
                      borderRadius: 6, padding: '6px 10px', fontSize: 'var(--fs-lg)',
                      color: 'var(--color-text-1)', outline: 'none',
                      resize: 'none', overflow: 'hidden',
                      fontFamily: 'inherit',
                      fieldSizing: 'content' as unknown as undefined,
                      minHeight: 32,
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = el.scrollHeight + 'px'
                      }
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = target.scrollHeight + 'px'
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          </>
        )
      })()}

      {/* ===== Last Check Completed ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 12, background: 'var(--color-bg-inset)', borderRadius: 10, border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>Last Check Completed</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--color-cyan)' }}>
            {currentStatus.lastCheckType && currentStatus.lastCheckTime
              ? `${currentStatus.lastCheckType} @ ${currentStatus.lastCheckTime}`
              : 'No Data'}
          </div>
        </div>
      </div>

      {/* ===== Personnel on Airfield ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="section-label" style={{ marginBottom: 0 }}>Personnel on Airfield</span>
        <button
          onClick={() => router.push('/contractors')}
          style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          View All →
        </button>
      </div>
      {activeContractors.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>No active contractors</div>
        </div>
      ) : (
        <div className="card" style={{ padding: '6px 14px', marginBottom: 20 }}>
          {activeContractors.map((c, i, arr) => {
            const startDate = new Date(c.start_date)
            const dayNum = Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / 86400000))
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-cyan)' }}>
                    {c.company_name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                    {c.location}
                  </div>
                </div>
                <div style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--color-text-3)',
                  background: 'var(--color-bg-surface)',
                  padding: '2px 8px',
                  borderRadius: 8,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  Day {dayNum}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
