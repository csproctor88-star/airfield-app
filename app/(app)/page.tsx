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
import { RSC_CONDITIONS, BWC_OPTIONS, RCR_CONDITION_TYPES, CONTRACTOR_STATUS_CONFIG } from '@/lib/constants'
import { fetchActiveContractors, updateContractor, createContractor, type ContractorRow } from '@/lib/supabase/contractors'
import { DEMO_CONTRACTORS } from '@/lib/demo-data'
import { formatZuluDate } from '@/lib/utils'
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

const ADVISORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  WATCH: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', text: 'var(--color-warning)' },
  WARNING: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: 'var(--color-danger)' },
  ADVISORY: { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)', text: 'var(--color-accent)' },
}

export default function HomePage() {
  const router = useRouter()
  const { advisories, addAdvisory, updateAdvisory, removeAdvisory, activeRunway, setActiveRunway, runwayStatus, setRunwayStatus, runwayStatuses, setRunwayActiveEnd, setRunwayStatusForRunway, arffCat, setArffCat, arffStatuses, setArffStatusForAircraft, rscCondition, setRscCondition, rcrValue, rcrCondition, bwcValue, setBwcValue, constructionRemarks, setConstructionRemarks, miscRemarks, setMiscRemarks, refreshStatus } = useDashboard()
  const { installationId, runways, arffAircraft } = useInstallation()
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [weatherLoaded, setWeatherLoaded] = useState(false)
  const [navaids, setNavaids] = useState<NavaidStatus[]>([])
  const [navaidNotes, setNavaidNotes] = useState<Record<string, string>>({})
  const [activeContractors, setActiveContractors] = useState<ContractorRow[]>([])
  const [showAddPersonnel, setShowAddPersonnel] = useState(false)
  const [addingPersonnel, setAddingPersonnel] = useState(false)
  const [pCompany, setPCompany] = useState('')
  const [pLocation, setPLocation] = useState('')
  const [pDescription, setPDescription] = useState('')
  const [pCallsign, setPCallsign] = useState('')
  const [editingConstruction, setEditingConstruction] = useState(false)
  const [constructionDraft, setConstructionDraft] = useState('')
  const [editingMisc, setEditingMisc] = useState(false)
  const [miscDraft, setMiscDraft] = useState('')
  // RSC dialog state
  const [rscDialogOpen, setRscDialogOpen] = useState(false)
  const [rscDraftValue, setRscDraftValue] = useState<string | null>(null)
  const [rscDraftNotes, setRscDraftNotes] = useState('')
  // BWC dialog state
  const [bwcDialogOpen, setBwcDialogOpen] = useState(false)
  const [bwcDraftValue, setBwcDraftValue] = useState<string | null>(null)
  const [bwcDraftNotes, setBwcDraftNotes] = useState('')
  const [advisoryDialogOpen, setAdvisoryDialogOpen] = useState(false)
  const [editingAdvisoryId, setEditingAdvisoryId] = useState<string | null>(null)
  const [advisoryDraftType, setAdvisoryDraftType] = useState<'WATCH' | 'WARNING' | 'ADVISORY'>('ADVISORY')
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

  useEffect(() => { refreshStatus() }, [refreshStatus])

  // Realtime: subscribe to airfield_checks and inspections INSERT events
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    const channel = supabase
      .channel(`dashboard_status:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'airfield_checks', filter: `base_id=eq.${installationId}` },
        () => { refreshStatus() }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inspections', filter: `base_id=eq.${installationId}` },
        () => { refreshStatus() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [installationId, refreshStatus])

  // Realtime: subscribe to navaid_statuses UPDATE events for cross-device sync
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    const channel = supabase
      .channel(`navaid_statuses:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'navaid_statuses' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (row.base_id === installationId) loadNavaids()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [installationId, loadNavaids])

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

  // Re-fetch all data when page regains visibility (tab switch or navigate back)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadNavaids()
        loadContractors()
        refreshStatus()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [loadNavaids, loadContractors, refreshStatus])

  // Realtime: subscribe to airfield_contractors changes for cross-device sync
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    const channel = supabase
      .channel(`airfield_contractors:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'airfield_contractors' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (row.base_id === installationId) loadContractors()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'airfield_contractors' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (row.base_id === installationId) loadContractors()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'airfield_contractors' },
        (payload) => {
          const row = payload.old as Record<string, unknown>
          if (row.base_id === installationId) loadContractors()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [installationId, loadContractors])

  // --- NAVAID status toggle handler ---
  async function handleNavaidToggle(navaid: NavaidStatus, newStatus: 'green' | 'yellow' | 'red', dialogNotes?: string) {
    const notes = newStatus === 'green' ? null : (dialogNotes ?? (navaidNotes[navaid.id] || null))
    const ok = await updateNavaidStatus(navaid.id, newStatus, notes)
    if (ok) {
      loadNavaids()
      logActivity('updated', 'navaid_status', navaid.id, navaid.navaid_name, { details: `${navaid.navaid_name.toUpperCase()} STATUS CHANGED TO ${newStatus === 'green' ? 'OPERATIONAL' : newStatus === 'yellow' ? 'DEGRADED' : 'OUTAGE'}${notes ? `. ${notes.toUpperCase()}` : ''}` }, installationId)
    }
  }

  async function handleNavaidNotesSave(navaid: NavaidStatus, overrideNotes?: string) {
    const notes = overrideNotes ?? (navaidNotes[navaid.id] || null)
    await updateNavaidStatus(navaid.id, navaid.status, notes)
    loadNavaids()
    logActivity('updated', 'navaid_status', navaid.id, navaid.navaid_name, { details: `${navaid.navaid_name.toUpperCase()} REMARKS UPDATED${notes ? `. ${notes.toUpperCase()}` : ''}` }, installationId)
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
                  setEditingAdvisoryId(null)
                  setAdvisoryDraftType('ADVISORY')
                  setAdvisoryDraftText('')
                  setAdvisoryDialogOpen(true)
                }}
                style={{ textAlign: 'right', cursor: 'pointer', minWidth: 60 }}
              >
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Weather Info</div>
                {advisories.length > 0 ? (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: ADVISORY_COLORS[advisories.some(a => a.type === 'WARNING') ? 'WARNING' : advisories.some(a => a.type === 'WATCH') ? 'WATCH' : 'ADVISORY'].text }}>
                    {advisories.length} Active
                  </div>
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
                  setEditingAdvisoryId(null)
                  setAdvisoryDraftType('ADVISORY')
                  setAdvisoryDraftText('')
                  setAdvisoryDialogOpen(true)
                }}
                style={{ textAlign: 'right', cursor: 'pointer', minWidth: 60 }}
              >
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Weather Info</div>
                {advisories.length > 0 ? (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: ADVISORY_COLORS[advisories.some(a => a.type === 'WARNING') ? 'WARNING' : advisories.some(a => a.type === 'WATCH') ? 'WATCH' : 'ADVISORY'].text }}>
                    {advisories.length} Active
                  </div>
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

      {/* Advisory banners — stacked, each clickable to edit */}
      {advisories.map((adv) => (
        <div
          key={adv.id}
          onClick={() => {
            setEditingAdvisoryId(adv.id)
            setAdvisoryDraftType(adv.type)
            setAdvisoryDraftText(adv.text)
            setAdvisoryDialogOpen(true)
          }}
          style={{
            padding: 'var(--advisory-padding)',
            marginBottom: 8,
            borderRadius: 10,
            background: ADVISORY_COLORS[adv.type].bg,
            border: `1px solid ${ADVISORY_COLORS[adv.type].border}`,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: ADVISORY_COLORS[adv.type].text, marginBottom: 2 }}>{adv.type}</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{adv.text}</div>
        </div>
      ))}
      {/* + Add Weather Info button */}
      <div
        onClick={() => {
          setEditingAdvisoryId(null)
          setAdvisoryDraftType('ADVISORY')
          setAdvisoryDraftText('')
          setAdvisoryDialogOpen(true)
        }}
        style={{
          padding: '8px 14px',
          marginBottom: 12,
          borderRadius: 8,
          border: '1px dashed var(--color-border-mid)',
          color: 'var(--color-text-3)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        + Add Weather Info
      </div>

      {/* Advisory dialog (add or edit) */}
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
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>
              {editingAdvisoryId ? 'Edit Weather Info' : 'Add Weather Info'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['WATCH', 'WARNING', 'ADVISORY'] as const).map((t) => (
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
              placeholder="Weather info text..."
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
              {editingAdvisoryId && (
                <button
                  onClick={async () => {
                    const existing = advisories.find(a => a.id === editingAdvisoryId)
                    logRunwayStatusChange({
                      oldAdvisoryType: existing?.type ?? null,
                      oldAdvisoryText: existing?.text ?? null,
                      newAdvisoryType: null,
                      newAdvisoryText: null,
                    }, installationId)
                    if (installationId) logActivity('updated', 'airfield_status', installationId, 'Weather Info Cleared', { details: `WX ${(existing?.type ?? 'INFO').toUpperCase()} CANCELLED` }, installationId)
                    await removeAdvisory(editingAdvisoryId)
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
                onClick={async () => {
                  if (advisoryDraftText.trim()) {
                    if (editingAdvisoryId) {
                      const existing = advisories.find(a => a.id === editingAdvisoryId)
                      logRunwayStatusChange({
                        oldAdvisoryType: existing?.type ?? null,
                        oldAdvisoryText: existing?.text ?? null,
                        newAdvisoryType: advisoryDraftType,
                        newAdvisoryText: advisoryDraftText.trim(),
                      }, installationId)
                      if (installationId) logActivity('updated', 'airfield_status', installationId, `Weather ${advisoryDraftType}`, { details: `WX ${advisoryDraftType.toUpperCase()}, ${advisoryDraftText.trim().toUpperCase()}` }, installationId)
                      await updateAdvisory(editingAdvisoryId, advisoryDraftType, advisoryDraftText.trim())
                    } else {
                      logRunwayStatusChange({
                        newAdvisoryType: advisoryDraftType,
                        newAdvisoryText: advisoryDraftText.trim(),
                      }, installationId)
                      if (installationId) logActivity('updated', 'airfield_status', installationId, `Weather ${advisoryDraftType}`, { details: `WX ${advisoryDraftType.toUpperCase()}, ${advisoryDraftText.trim().toUpperCase()}` }, installationId)
                      await addAdvisory(advisoryDraftType, advisoryDraftText.trim())
                    }
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
                      logActivity('updated', 'airfield_status', installationId, `RSC ${rscDraftValue}`, { details: `ADVISES RSC/${rscDraftValue.toUpperCase()}` }, installationId)
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
                      logActivity('updated', 'airfield_status', installationId, `BWC ${bwcDraftValue}`, { details: `REPORTS BWC CHANGE, BWC/${bwcDraftValue.toUpperCase()}` }, installationId)
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

      {/* ===== Runway & NAVAID Status ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12, alignItems: 'start' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 auto' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Runway Status</div>
            {rwyEntries.map((rwy) => {
              const c = getColors(rwy.status)
              return (
                <div key={rwy.label} className="card" style={{
                  padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  background: c.bg, border: `1px solid ${c.border}`,
                  flex: '0 1 auto', minWidth: 100,
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
                          if (runways.length > 0) {
                            setRunwayActiveEnd(rwy.label, newEnd)
                            if (installationId) logActivity('updated', 'airfield_status', installationId, `Active runway changed to ${newEnd}`, { details: `ADVISES RWY ${newEnd} IN USE${remarks ? `. ${remarks.toUpperCase()}` : ''}` }, installationId)
                            logRunwayStatusChange({ oldActiveRunway: rwy.active_end, newActiveRunway: newEnd }, installationId)
                          } else {
                            const designators = runways.flatMap(r => [r.end1_designator, r.end2_designator])
                            if (designators.length === 0) return
                            const idx = designators.indexOf(activeRunway)
                            const next = designators[(idx + 1) % designators.length]
                            setActiveRunway(next)
                            if (installationId) logActivity('updated', 'airfield_status', installationId, `Active runway changed to ${next}`, { details: `ADVISES RWY ${next} IN USE${remarks ? `. ${remarks.toUpperCase()}` : ''}` }, installationId)
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
                  {rwy.remarks && (rwy.status === 'suspended' || rwy.status === 'closed') && (
                    <div style={{
                      fontSize: 'var(--fs-sm)',
                      color: c.color,
                      background: 'var(--color-bg-inset)',
                      border: `1px solid ${c.border}`,
                      borderRadius: 6,
                      padding: '4px 10px',
                      textAlign: 'center',
                      lineHeight: 1.3,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}>
                      {rwy.remarks}
                    </div>
                  )}
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
                            setRunwayStatusForRunway(rwy.label, val, remarks || null)
                            if (installationId) {
                              const rwyStatusText = val === 'open' ? 'OPS RESUMED' : val.toUpperCase()
                              logActivity('status_updated', 'airfield_status', installationId, `RWY ${rwy.active_end} ${val.toUpperCase()}`, { details: `ADVISES RWY ${rwy.active_end} ${rwyStatusText}${remarks ? `. ${remarks.toUpperCase()}` : ''}` }, installationId)
                            }
                            logRunwayStatusChange({ oldRunwayStatus: rwy.status, newRunwayStatus: val }, installationId)
                          } else {
                            setRunwayStatus(val)
                            if (installationId) {
                              const rwyStatusText2 = val === 'open' ? 'OPS RESUMED' : val.toUpperCase()
                              logActivity('status_updated', 'airfield_status', installationId, `RWY ${activeRunway} ${val.toUpperCase()}`, { details: `ADVISES RWY ${activeRunway} ${rwyStatusText2}${remarks ? `. ${remarks.toUpperCase()}` : ''}` }, installationId)
                            }
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
          {/* RSC / RCR card */}
          {rcrValue ? (
            <div className="card" style={{
              flex: '0 1 140px', minWidth: 100, padding: '8px 10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(34,211,238,0.25)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-cyan)', fontWeight: 600 }}>RCR</div>
              <div style={{ fontSize: 'var(--rwy-btn-font)', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-accent)' }}>{rcrValue}</div>
              {rcrCondition && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', fontWeight: 600, marginTop: 2 }}>{RCR_CONDITION_TYPES.find(c => c.value === rcrCondition)?.label || rcrCondition}</div>
              )}
            </div>
          ) : (
            <div className="card" onClick={() => { setRscDraftValue(rscCondition); setRscDraftNotes(''); setRscDialogOpen(true) }}
              style={{
                flex: '0 1 140px', minWidth: 100, padding: '8px 10px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', textAlign: 'center',
              }}>
              <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)', fontWeight: 600 }}>RSC</div>
              <div style={{ fontSize: 'var(--rwy-btn-font)', fontWeight: 700, color: 'var(--color-accent)' }}>
                {rscCondition || '—'}
              </div>
            </div>
          )}
          {/* BWC card */}
          <div className="card" onClick={() => { setBwcDraftValue(bwcValue); setBwcDraftNotes(''); setBwcDialogOpen(true) }}
            style={{
              flex: '0 1 140px', minWidth: 100, padding: '8px 10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', textAlign: 'center',
            }}>
            <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)', fontWeight: 600 }}>BWC</div>
            <div style={{ fontSize: 'var(--rwy-btn-font)', fontWeight: 700, color: bwcValue === 'SEV' || bwcValue === 'PROHIB' ? 'var(--color-danger)' : bwcValue === 'MOD' ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {bwcValue || '—'}
            </div>
          </div>
          </div>
        )
      })()}

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
                        logActivity('updated', 'arff_status', installationId, `${aircraft} ${selectedStatus.toUpperCase()}`, { details: `REPORTS ${aircraft.toUpperCase()} ${selectedStatus.toUpperCase()}${notes.trim() ? `. ${notes.trim().toUpperCase()}` : ''}` }, installationId)
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

      {/* NAVAID cards — stacked vertically */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 0', minWidth: 160 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NAVAID Status</div>
          {navaids.length === 0 ? (
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', textAlign: 'center' }}>
                Loading NAVAIDs...
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 500, color: 'var(--color-text-2)', flex: 1 }}>
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
                {(n.status === 'yellow' || n.status === 'red') && (
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
                )}
              </div>
            )
            return (<>
                {endGroups.filter(group => group.items.length > 0).map(group => (
                  <div key={group.designator} className="card" style={{ padding: '8px 12px 4px' }}>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-warning)', marginBottom: 8, textAlign: 'center', letterSpacing: '0.06em' }}>RWY {group.designator}</div>
                    {group.items.map(renderNavaidItem)}
                  </div>
                ))}
                {otherNavaids.length > 0 && (
                  <div className="card" style={{ padding: '8px 12px 4px' }}>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-warning)', marginBottom: 8, textAlign: 'center', letterSpacing: '0.06em' }}>OTHER</div>
                    {otherNavaids.map(renderNavaidItem)}
                  </div>
                )}
            </>)
          })()}
      </div>{/* end NAVAID column */}

      {/* ARFF Status — stacked vertically */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ARFF Status</div>
          {/* ARFF CAT card */}
          <div className="card" style={{
            padding: '8px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 600 }}>CAT</div>
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
                      logActivity('updated', 'arff_status', installationId, `ARFF CAT ${val ?? 'None'}`, { details: `REPORTS ARFF CAT CHANGED TO ${val ?? 'NONE'}${remarks ? `. ${remarks.toUpperCase()}` : ''}` }, installationId)
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
                  padding: '8px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  cursor: 'pointer',
                  background: c.bg, border: `1px solid ${c.border}`,
                }}
              >
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 600 }}>{aircraft}</div>
                <div style={{
                  fontSize: 'var(--fs-md)', fontWeight: 700, color: c.color,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {readiness}
                </div>
              </div>
            )
          })}
      </div>{/* end ARFF column */}
      </div>{/* end main status row */}

      {/* ===== Personnel / Construction / Misc (inline row on desktop) ===== */}
      <div className="bottom-info-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>

      <div>
      {/* ===== Personnel on Airfield ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="section-label" style={{ marginBottom: 0 }}>Personnel on Airfield</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowAddPersonnel(prev => !prev)}
            style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            {showAddPersonnel ? 'Cancel' : '+ Add'}
          </button>
          <button
            onClick={() => router.push('/contractors')}
            style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            View All →
          </button>
        </div>
      </div>
      {showAddPersonnel && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input
              placeholder="Company / Name *"
              value={pCompany}
              onChange={e => setPCompany(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}
            />
            <input
              placeholder="Location *"
              value={pLocation}
              onChange={e => setPLocation(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}
            />
            <input
              placeholder="Work Description *"
              value={pDescription}
              onChange={e => setPDescription(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}
            />
            <input
              placeholder="Callsign (optional)"
              value={pCallsign}
              onChange={e => setPCallsign(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}
            />
          </div>
          <button
            disabled={addingPersonnel || !pCompany.trim() || !pLocation.trim() || !pDescription.trim()}
            onClick={async () => {
              setAddingPersonnel(true)
              const { error } = await createContractor({
                company_name: pCompany.trim(),
                location: pLocation.trim(),
                work_description: pDescription.trim(),
                callsign: pCallsign.trim() || undefined,
                base_id: installationId,
              })
              setAddingPersonnel(false)
              if (error) {
                const { toast } = await import('sonner')
                toast.error(error)
              } else {
                setPCompany(''); setPLocation(''); setPDescription(''); setPCallsign('')
                setShowAddPersonnel(false)
                await loadContractors()
              }
            }}
            style={{
              width: '100%',
              padding: '8px 0',
              borderRadius: 6,
              border: 'none',
              background: (!pCompany.trim() || !pLocation.trim() || !pDescription.trim()) ? 'var(--color-border)' : 'var(--color-cyan)',
              color: (!pCompany.trim() || !pLocation.trim() || !pDescription.trim()) ? 'var(--color-text-3)' : '#000',
              fontWeight: 700,
              fontSize: 'var(--fs-sm)',
              cursor: (!pCompany.trim() || !pLocation.trim() || !pDescription.trim()) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {addingPersonnel ? 'Adding…' : 'Add Personnel'}
          </button>
        </div>
      )}
      {activeContractors.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>No active contractors</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          {activeContractors.map(c => {
            const cfg = CONTRACTOR_STATUS_CONFIG[c.status]
            const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(c.start_date).getTime()) / 86400000))
            return (
              <div key={c.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    {/* Header: Callsign (or company name fallback) + status badge + day counter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                        {c.callsign || c.company_name}
                      </span>
                      <span style={{
                        fontSize: 'var(--fs-2xs)',
                        fontWeight: 700,
                        color: cfg.color,
                        background: cfg.bg,
                        padding: '1px 8px',
                        borderRadius: 8,
                      }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>
                        Day {daysSinceStart}
                      </span>
                    </div>
                    {/* Labeled fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.03em' }}>Company: </span>
                        {c.company_name}
                      </div>
                      {c.contact_name && (
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.03em' }}>Contact: </span>
                          {c.contact_name}
                        </div>
                      )}
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.03em' }}>Location: </span>
                        {c.location}
                      </div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.03em' }}>Work: </span>
                        {c.work_description}
                      </div>
                      {(c.radio_number || c.flag_number) && (
                        <div style={{ display: 'flex', gap: 16, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', flexWrap: 'wrap' }}>
                          {c.radio_number && (
                            <span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.03em' }}>Radio: </span>
                              {c.radio_number}
                            </span>
                          )}
                          {c.flag_number && (
                            <span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.03em' }}>Flag: </span>
                              {c.flag_number}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
                      Started: {formatZuluDate(new Date(c.start_date))}
                    </div>
                    {c.notes && (
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic', marginTop: 4 }}>
                        {c.notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`Mark ${c.company_name} as completed / off airfield?`)) return
                      const { error } = await updateContractor(c.id, { status: 'completed' })
                      if (error) {
                        const { toast } = await import('sonner')
                        toast.error(error)
                      } else {
                        await loadContractors()
                      }
                    }}
                    style={{
                      background: 'rgba(34,197,94,0.15)',
                      color: '#22C55E',
                      border: '1px solid rgba(34,197,94,0.4)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontWeight: 700,
                      fontSize: 'var(--fs-sm)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                    title="Mark completed / off airfield"
                  >
                    Mark Completed
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      </div>

      <div>
      {/* ===== Construction / Closures ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="section-label" style={{ marginBottom: 0 }}>Construction / Closures</span>
        <button
          onClick={() => { setConstructionDraft(constructionRemarks || ''); setEditingConstruction(true) }}
          style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          {constructionRemarks ? 'Edit' : 'Add'}
        </button>
      </div>
      <div className="card" style={{ padding: constructionRemarks ? '10px 14px' : 16, textAlign: constructionRemarks ? 'left' : 'center', marginBottom: 12 }}>
        {constructionRemarks ? (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{constructionRemarks}</div>
        ) : (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>None</div>
        )}
      </div>

      </div>

      <div>
      {/* ===== Miscellaneous Info ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="section-label" style={{ marginBottom: 0 }}>Miscellaneous Info</span>
        <button
          onClick={() => { setMiscDraft(miscRemarks || ''); setEditingMisc(true) }}
          style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          {miscRemarks ? 'Edit' : 'Add'}
        </button>
      </div>
      <div className="card" style={{ padding: miscRemarks ? '10px 14px' : 16, textAlign: miscRemarks ? 'left' : 'center', marginBottom: 12 }}>
        {miscRemarks ? (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{miscRemarks}</div>
        ) : (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>None</div>
        )}
      </div>

      </div>
      </div>{/* end bottom-info-row */}

      {/* Construction/Closures edit dialog */}
      {editingConstruction && (
        <div
          onClick={() => setEditingConstruction(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, border: '1px solid var(--color-border-mid)' }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>Construction / Closures</div>
            <textarea
              value={constructionDraft}
              onChange={(e) => setConstructionDraft(e.target.value)}
              placeholder="Enter construction activity, closures, or restrictions..."
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)', color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', outline: 'none', marginBottom: 14, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {constructionRemarks && (
                <button
                  onClick={() => { setConstructionRemarks(null); setEditingConstruction(false) }}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
                >Clear</button>
              )}
              <button
                onClick={() => { setConstructionRemarks(constructionDraft.trim() || null); setEditingConstruction(false) }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.15)', color: 'var(--color-success)' }}
              >Save</button>
              <button
                onClick={() => setEditingConstruction(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border-mid)', background: 'var(--color-bg-inset)', color: 'var(--color-text-3)' }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Miscellaneous Info edit dialog */}
      {editingMisc && (
        <div
          onClick={() => setEditingMisc(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, border: '1px solid var(--color-border-mid)' }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>Miscellaneous Info</div>
            <textarea
              value={miscDraft}
              onChange={(e) => setMiscDraft(e.target.value)}
              placeholder="Enter miscellaneous information or notes..."
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)', color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', outline: 'none', marginBottom: 14, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {miscRemarks && (
                <button
                  onClick={() => { setMiscRemarks(null); setEditingMisc(false) }}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
                >Clear</button>
              )}
              <button
                onClick={() => { setMiscRemarks(miscDraft.trim() || null); setEditingMisc(false) }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.15)', color: 'var(--color-success)' }}
              >Save</button>
              <button
                onClick={() => setEditingMisc(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border-mid)', background: 'var(--color-bg-inset)', color: 'var(--color-text-3)' }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
