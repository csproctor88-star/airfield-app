'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchCurrentWeather, type WeatherResult } from '@/lib/weather'
import { fetchNavaidStatuses, updateNavaidStatus, type NavaidStatus } from '@/lib/supabase/navaids'
import { fetchInstallationNavaids } from '@/lib/supabase/installations'
import { useDashboard } from '@/lib/dashboard-context'
import { useInstallation } from '@/lib/installation-context'
import { logActivity } from '@/lib/supabase/activity'
import { fetchActivityLog } from '@/lib/supabase/activity-queries'
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

// --- User presence helpers ---
function presenceLabel(lastSeen: string | null): { label: string; color: string } {
  if (!lastSeen) return { label: 'Offline', color: 'var(--color-text-3)' }
  const diff = Date.now() - new Date(lastSeen).getTime()
  if (diff < 15 * 60 * 1000) return { label: 'Online', color: 'var(--color-success)' }
  if (diff < 60 * 60 * 1000) return { label: 'Away', color: 'var(--color-warning)' }
  return { label: 'Inactive', color: 'var(--color-text-3)' }
}

// --- Quick Actions (KPI badges) ---
const QUICK_ACTIONS = [
  { label: 'Airfield Inspections', icon: '📋', color: 'var(--color-success)', href: '/inspections?action=begin' },
  { label: 'Airfield Checks', icon: '🛡️', color: 'var(--color-warning)', href: '/checks' },
  { label: 'New Discrepancy', icon: '🚨', color: 'var(--color-danger)', href: '/discrepancies/new' },
]

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

// --- Activity action formatting ---
function formatAction(action: string, entityType: string, displayId?: string): string {
  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy',
    check: 'Check',
    inspection: 'Inspection',
    obstruction_evaluation: 'Obstruction Eval',
    navaid_status: 'NAVAID',
  }
  const entity = typeLabel[entityType] || entityType
  const id = displayId ? ` ${displayId}` : ''
  const actionLabel: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    completed: 'Completed',
    status_updated: 'Status changed on',
    saved: 'Saved',
    filed: 'Filed',
    resumed: 'Resumed',
    reviewed: 'Reviewed',
    waiver_review_deleted: 'Deleted review for',
  }
  const label = actionLabel[action] || (action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' '))
  return `${label} ${entity}${id}`
}

type ActivityEntry = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_display_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_name: string
  user_rank: string | null
}

function getEntityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null
  switch (entityType) {
    case 'discrepancy': return `/discrepancies/${entityId}`
    case 'check': return `/checks/${entityId}`
    case 'inspection': return `/inspections/${entityId}`
    case 'obstruction_evaluation': return `/obstructions`
    default: return null
  }
}

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
  bwc: string | null
  bwcTime: string | null
  lastCheckType: string | null
  lastCheckTime: string | null
  inspectionCompletion: string | null
  rscCondition: string | null
  rscTime: string | null
}

export default function HomePage() {
  const router = useRouter()
  const { advisory, setAdvisory, activeRunway, setActiveRunway, runwayStatus, setRunwayStatus, runwayStatuses, setRunwayActiveEnd, setRunwayStatusForRunway } = useDashboard()
  const { installationId, currentInstallation, runways } = useInstallation()
  const [time, setTime] = useState('')
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [weatherLoaded, setWeatherLoaded] = useState(false)
  const [userDisplay, setUserDisplay] = useState<{ name: string; lastSeen: string | null }>({ name: '—', lastSeen: null })
  const [navaids, setNavaids] = useState<NavaidStatus[]>([])
  const [navaidNotes, setNavaidNotes] = useState<Record<string, string>>({})
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [currentStatus, setCurrentStatus] = useState<CurrentStatusData>({
    bwc: null, bwcTime: null, lastCheckType: null, lastCheckTime: null, inspectionCompletion: null, rscCondition: null, rscTime: null,
  })
  const [showRscTime, setShowRscTime] = useState(false)
  const [showBwcTime, setShowBwcTime] = useState(false)
  const [advisoryDialogOpen, setAdvisoryDialogOpen] = useState(false)
  const [advisoryDraftType, setAdvisoryDraftType] = useState<'INFO' | 'CAUTION' | 'WARNING'>('INFO')
  const [advisoryDraftText, setAdvisoryDraftText] = useState('')

  // --- Clock ---
  useEffect(() => {
    const update = () => setTime(new Date().toTimeString().slice(0, 5))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  // --- Load user profile + update last_seen_at ---
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      if (!supabase) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Update last_seen_at
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)

        // Fetch profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any).from('profiles').select('name, rank, last_seen_at').eq('id', user.id).single()

        if (profile) {
          const displayName = profile.rank ? `${profile.rank} ${profile.name}` : profile.name
          setUserDisplay({ name: displayName, lastSeen: profile.last_seen_at })
        }
      } catch {
        // No auth — keep default
      }
    }
    loadUser()
    // Update presence every 5 min
    const interval = setInterval(loadUser, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

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

  // --- Load Current Status (BWC, Last Check, Inspection, RSC) ---
  useEffect(() => {
    async function loadCurrentStatus() {
      const supabase = createClient()
      if (!supabase) return

      // Latest inspection with BWC
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let inspQuery = (supabase as any)
        .from('inspections')
        .select('bwc_value, completed_at')
        .not('bwc_value', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
      if (installationId) inspQuery = inspQuery.eq('base_id', installationId)
      const { data: insp } = await inspQuery

      // Latest BASH check (condition_code stored in data JSON)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bashQuery = (supabase as any)
        .from('airfield_checks')
        .select('data, completed_at')
        .eq('check_type', 'bash')
        .order('completed_at', { ascending: false })
        .limit(1)
      if (installationId) bashQuery = bashQuery.eq('base_id', installationId)
      const { data: bashCheck } = await bashQuery

      // Latest completed inspection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let latestInspQuery = (supabase as any)
        .from('inspections')
        .select('completed_at')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
      if (installationId) latestInspQuery = latestInspQuery.eq('base_id', installationId)
      const { data: latestInsp } = await latestInspQuery

      // Latest check of any type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lastCheckQuery = (supabase as any)
        .from('airfield_checks')
        .select('check_type, completed_at')
        .order('completed_at', { ascending: false })
        .limit(1)
      if (installationId) lastCheckQuery = lastCheckQuery.eq('base_id', installationId)
      const { data: lastCheck } = await lastCheckQuery

      // Latest RSC check
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rscQuery = (supabase as any)
        .from('airfield_checks')
        .select('data, completed_at')
        .eq('check_type', 'rsc')
        .order('completed_at', { ascending: false })
        .limit(1)
      if (installationId) rscQuery = rscQuery.eq('base_id', installationId)
      const { data: rscCheck } = await rscQuery

      // Determine BWC: use whichever source (inspection or BASH check) is more recent
      const inspBwc = insp?.[0]?.bwc_value || null
      const inspBwcTime = insp?.[0]?.completed_at ? new Date(insp[0].completed_at).getTime() : 0
      const bashData = bashCheck?.[0]?.data as Record<string, unknown> | undefined
      const bashConditionRaw = (bashData?.condition_code as string) || null
      const bashBwcTime = bashCheck?.[0]?.completed_at ? new Date(bashCheck[0].completed_at).getTime() : 0
      // Normalize BASH condition codes (LOW/MODERATE/SEVERE) to BWC format (LOW/MOD/SEV)
      const bashConditionMap: Record<string, string> = { LOW: 'LOW', MODERATE: 'MOD', SEVERE: 'SEV' }
      const bashBwc = bashConditionRaw ? (bashConditionMap[bashConditionRaw] || bashConditionRaw) : null

      let bwc: string | null
      let bwcTimeMs = 0
      if (inspBwc && bashBwc) {
        bwc = bashBwcTime > inspBwcTime ? bashBwc : inspBwc
        bwcTimeMs = bashBwcTime > inspBwcTime ? bashBwcTime : inspBwcTime
      } else {
        bwc = inspBwc || bashBwc
        bwcTimeMs = inspBwc ? inspBwcTime : bashBwcTime
      }
      const bwcTime = bwcTimeMs ? new Date(bwcTimeMs).toTimeString().slice(0, 5) : null

      const checkType = lastCheck?.[0]?.check_type?.toUpperCase() || null
      const checkTime = lastCheck?.[0]?.completed_at
        ? new Date(lastCheck[0].completed_at).toTimeString().slice(0, 5)
        : null
      const inspTime = latestInsp?.[0]?.completed_at
        ? new Date(latestInsp[0].completed_at).toTimeString().slice(0, 5)
        : null
      const rscData = rscCheck?.[0]?.data as Record<string, unknown> | undefined
      const rscCondition = (rscData?.condition as string) || (rscData?.runway_condition as string) || null
      const rscTime = rscCheck?.[0]?.completed_at
        ? new Date(rscCheck[0].completed_at).toTimeString().slice(0, 5)
        : null

      setCurrentStatus((prev) => ({
        ...prev,
        bwc,
        bwcTime,
        lastCheckType: checkType,
        lastCheckTime: checkTime,
        inspectionCompletion: inspTime,
        rscCondition,
        rscTime,
      }))
    }
    loadCurrentStatus()
  }, [installationId])

  // --- Load Activity Feed ---
  useEffect(() => {
    async function loadActivity() {
      const { data } = await fetchActivityLog({ baseId: installationId, limit: 20 })
      if (data.length > 0) setActivity(data as ActivityEntry[])
    }
    loadActivity()
  }, [installationId])

  // --- NAVAID status toggle handler ---
  async function handleNavaidToggle(navaid: NavaidStatus, newStatus: 'green' | 'yellow' | 'red') {
    const notes = newStatus === 'green' ? null : (navaidNotes[navaid.id] || null)
    const ok = await updateNavaidStatus(navaid.id, newStatus, notes)
    if (ok) {
      loadNavaids()
      logActivity('updated', 'navaid_status', navaid.id, navaid.navaid_name, { status: newStatus }, installationId)
    }
  }

  async function handleNavaidNotesSave(navaid: NavaidStatus) {
    const notes = navaidNotes[navaid.id] || null
    await updateNavaidStatus(navaid.id, navaid.status, notes)
    loadNavaids()
    logActivity('updated', 'navaid_status', navaid.id, navaid.navaid_name, { notes }, installationId)
  }

  const presence = presenceLabel(userDisplay.lastSeen)

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <LoginActivityDialog />
      {/* ===== Clock + Installation + User ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>{time || '--:--'}</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 1 }}>
            {currentInstallation?.name ? `${currentInstallation.name.toUpperCase()}${currentInstallation.icao ? ` \u2022 ${currentInstallation.icao}` : ''}` : 'AIRFIELD OPS'}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-1)' }}>{userDisplay.name}</div>
          <div style={{ fontSize: 10, color: presence.color, fontWeight: 600 }}>{presence.label}</div>
        </div>
      </div>

      {/* ===== Weather Strip ===== */}
      <div
        className="card"
        style={{
          padding: '10px 14px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{weatherEmoji(weather.conditions)}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {weather.temperature_f}&deg;F &bull; {weather.conditions}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
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
                <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Advisory</div>
                {advisory ? (
                  <div style={{ fontSize: 12, fontWeight: 700, color: ADVISORY_COLORS[advisory.type].text }}>{advisory.type}</div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-3)' }}>None</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>❓</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-3)' }}>UNKWN</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Weather data unavailable</div>
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
                <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Advisory</div>
                {advisory ? (
                  <div style={{ fontSize: 12, fontWeight: 700, color: ADVISORY_COLORS[advisory.type].text }}>{advisory.type}</div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-3)' }}>None</div>
                )}
              </div>
            </>
          )
        ) : (
          <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Loading weather...</div>
        )}
      </div>

      {/* Advisory banner */}
      {advisory && (
        <div
          onClick={() => setAdvisoryDialogOpen(true)}
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            borderRadius: 10,
            background: ADVISORY_COLORS[advisory.type].bg,
            border: `1px solid ${ADVISORY_COLORS[advisory.type].border}`,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: ADVISORY_COLORS[advisory.type].text, marginBottom: 2 }}>{advisory.type}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-1)', lineHeight: 1.4 }}>{advisory.text}</div>
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
              background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 340,
              border: '1px solid var(--color-border-mid)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>Set Advisory</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['INFO', 'CAUTION', 'WARNING'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAdvisoryDraftType(t)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700,
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
                color: 'var(--color-text-1)', fontSize: 14, outline: 'none', marginBottom: 14,
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {advisory && (
                <button
                  onClick={() => {
                    setAdvisory(null)
                    setAdvisoryDraftText('')
                    setAdvisoryDialogOpen(false)
                  }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)',
                  }}
                >Clear</button>
              )}
              <button
                onClick={() => {
                  if (advisoryDraftText.trim()) {
                    setAdvisory({ type: advisoryDraftType, text: advisoryDraftText.trim() })
                  }
                  setAdvisoryDialogOpen(false)
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)',
                  background: 'rgba(52,211,153,0.15)', color: 'var(--color-success)',
                }}
              >Save</button>
              <button
                onClick={() => setAdvisoryDialogOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
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
                  padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  background: c.bg, border: `1px solid ${c.border}`,
                }}>
                  <div style={{ fontSize: 14, color: 'var(--color-text-3)', fontWeight: 600 }}>Active RWY</div>
                  <button
                    onClick={() => {
                      // Toggle between the two ends of this runway
                      const newEnd = rwy.active_end === rwy.end1 ? rwy.end2 : rwy.end1
                      if (runways.length > 0) {
                        setRunwayActiveEnd(rwy.label, newEnd)
                        logActivity('updated', 'airfield_status', 'active_runway', `RWY ${newEnd}`, { runway: rwy.label, active_end: newEnd }, installationId)
                      } else {
                        const designators = runways.flatMap(r => [r.end1_designator, r.end2_designator])
                        if (designators.length === 0) return
                        const idx = designators.indexOf(activeRunway)
                        const next = designators[(idx + 1) % designators.length]
                        setActiveRunway(next)
                        logActivity('updated', 'airfield_status', 'active_runway', `RWY ${next}`, { active_runway: next }, installationId)
                      }
                    }}
                    style={{
                      padding: '6px 28px', borderRadius: 6, fontSize: 20, fontWeight: 800,
                      cursor: 'pointer', color: c.color,
                      border: `2px solid ${c.btnBorder}`,
                      background: c.btnBg,
                    }}
                  >{runways.length > 0 ? rwy.active_end : activeRunway}</button>
                  <select
                    value={runways.length > 0 ? rwy.status : runwayStatus}
                    onChange={(e) => {
                      const val = e.target.value as 'open' | 'suspended' | 'closed'
                      if (runways.length > 0) {
                        setRunwayStatusForRunway(rwy.label, val)
                        logActivity('status_updated', 'airfield_status', 'runway_status', `RWY ${rwy.active_end}`, { runway: rwy.label, status: val }, installationId)
                      } else {
                        setRunwayStatus(val)
                        logActivity('status_updated', 'airfield_status', 'runway_status', `RWY ${activeRunway}`, { status: val }, installationId)
                      }
                    }}
                    style={{
                      padding: '3px 10px', borderRadius: 5, fontSize: 12, fontWeight: 700,
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div
            title={currentStatus.rscTime ? `Last checked: ${currentStatus.rscTime}` : undefined}
            onClick={() => setShowRscTime(p => !p)}
            style={{ padding: 14, background: 'var(--color-bg-inset)', borderRadius: 10, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 14, color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 6 }}>RSC</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent)' }}>
              {currentStatus.rscCondition || 'No Data'}
            </div>
            {showRscTime && currentStatus.rscTime && (
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 4 }}>@ {currentStatus.rscTime}</div>
            )}
          </div>
          <div
            title={currentStatus.bwcTime ? `Last checked: ${currentStatus.bwcTime}` : undefined}
            onClick={() => setShowBwcTime(p => !p)}
            style={{ padding: 14, background: 'var(--color-bg-inset)', borderRadius: 10, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 14, color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 6 }}>BWC</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: currentStatus.bwc === 'SEV' || currentStatus.bwc === 'PROHIB' ? 'var(--color-danger)' : currentStatus.bwc === 'MOD' ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {currentStatus.bwc || 'No Data'}
            </div>
            {showBwcTime && currentStatus.bwcTime && (
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 4 }}>@ {currentStatus.bwcTime}</div>
            )}
          </div>
        </div>
      </div>

      {/* ===== NAVAID Status ===== */}
      <span className="section-label">NAVAID Status</span>
      {navaids.length === 0 ? (
        <div className="card" style={{ marginBottom: 16, padding: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)', textAlign: 'center' }}>
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
        const NAVAID_CYCLE: ('green' | 'yellow' | 'red')[] = ['green', 'yellow', 'red']
        const NAVAID_LABELS: Record<string, string> = { green: 'G', yellow: 'Y', red: 'R' }
        const renderNavaidItem = (n: NavaidStatus) => (
          <div key={n.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-1)' }}>
                {getNavaidDisplayName(n.navaid_name)}
              </span>
              <button
                onClick={() => {
                  const idx = NAVAID_CYCLE.indexOf(n.status as 'green' | 'yellow' | 'red')
                  const next = NAVAID_CYCLE[(idx + 1) % NAVAID_CYCLE.length]
                  handleNavaidToggle(n, next)
                }}
                style={{
                  width: 36, height: 28, borderRadius: 6,
                  border: `2px solid ${STATUS_COLORS[n.status]}`,
                  background: `${STATUS_HEX[n.status]}20`,
                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: allFlagged.length > 0 ? 8 : 16 }}>
            {endGroups.filter(group => group.items.length > 0).map(group => (
              <div key={group.designator} className="card" style={{ padding: '10px 14px 4px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-warning)', marginBottom: 8, textAlign: 'center', letterSpacing: '0.06em' }}>RWY {group.designator}</div>
                {group.items.map(renderNavaidItem)}
              </div>
            ))}
            {otherNavaids.length > 0 && (
              <div className="card" style={{ padding: '10px 14px 4px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-warning)', marginBottom: 8, textAlign: 'center', letterSpacing: '0.06em' }}>OTHER</div>
                {otherNavaids.map(renderNavaidItem)}
              </div>
            )}
          </div>
          {allFlagged.length > 0 && (
            <div className="card" style={{ padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)', marginBottom: 6, letterSpacing: '0.04em' }}>NAVAID NOTES</div>
              {allFlagged.map(n => (
                <div key={n.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[n.status], marginBottom: 2 }}>
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
                      borderRadius: 6, padding: '6px 10px', fontSize: 14,
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
          <div style={{ fontSize: 13, color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>Last Check Completed</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-cyan)' }}>
            {currentStatus.lastCheckType && currentStatus.lastCheckTime
              ? `${currentStatus.lastCheckType} @ ${currentStatus.lastCheckTime}`
              : 'No Data'}
          </div>
        </div>
      </div>

      {/* ===== Quick Actions ===== */}
      <span className="section-label">Quick Actions</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {QUICK_ACTIONS.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '14px 16px',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 24 }}>{q.icon}</span>
            <span style={{ fontSize: 15, color: q.color, letterSpacing: '0.04em', fontWeight: 700 }}>
              {q.label}
            </span>
          </Link>
        ))}
      </div>

      {/* ===== Recent Activity ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="section-label" style={{ marginBottom: 0 }}>Recent Activity</span>
        <button
          onClick={() => router.push('/activity')}
          style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          View All →
        </button>
      </div>
      {activity.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>No activity recorded yet</div>
        </div>
      ) : (
        <>
          {activity.slice(0, 5).map((a, i, arr) => {
            const actionColor: Record<string, string> = {
              created: 'var(--color-success)',
              completed: 'var(--color-cyan)',
              updated: 'var(--color-warning)',
              status_updated: 'var(--color-purple)',
              deleted: 'var(--color-danger)',
            }
            const actionDotBg: Record<string, string> = {
              created: 'rgba(52,211,153,0.07)',
              completed: 'rgba(34,211,238,0.07)',
              updated: 'rgba(251,191,36,0.07)',
              status_updated: 'rgba(167,139,250,0.07)',
              deleted: 'rgba(239,68,68,0.07)',
            }
            const color = actionColor[a.action] || 'var(--color-text-3)'
            const dotBg = actionDotBg[a.action] || 'rgba(100,116,139,0.07)'
            const date = new Date(a.created_at)
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const timeStr = date.toTimeString().slice(0, 5)
            const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
            const navaidNoteText = a.entity_type === 'navaid_status' && a.metadata?.notes ? String(a.metadata.notes) : null
            const navaidStatusVal = a.entity_type === 'navaid_status' && a.metadata?.status ? String(a.metadata.status) : null
            const link = getEntityLink(a.entity_type, a.entity_id)

            return (
              <div
                key={a.id}
                onClick={link ? () => router.push(link) : undefined}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '7px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                  cursor: link ? 'pointer' : 'default',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: dotBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    flexShrink: 0,
                    color,
                  }}
                >
                  &bull;
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-cyan)' }}>
                      {userName}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-3)' }}>{dateStr} {timeStr}</span>
                  </div>
                  <div style={{ fontSize: 11, color: link ? 'var(--color-cyan)' : 'var(--color-text-2)' }}>
                    {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined)}
                    {link && (
                      <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.6 }}>→</span>
                    )}
                    {navaidStatusVal && (
                      <span style={{ marginLeft: 6, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: STATUS_HEX[navaidStatusVal] || '#64748B' }} />
                    )}
                  </div>
                  {navaidNoteText && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontStyle: 'italic', marginTop: 2 }}>
                      &ldquo;{navaidNoteText}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
