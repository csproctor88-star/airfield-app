'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchCurrentWeather, type WeatherResult } from '@/lib/weather'
import { fetchNavaidStatuses, updateNavaidStatus, type NavaidStatus } from '@/lib/supabase/navaids'

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
  if (!lastSeen) return { label: 'Offline', color: '#64748B' }
  const diff = Date.now() - new Date(lastSeen).getTime()
  if (diff < 15 * 60 * 1000) return { label: 'Online', color: '#34D399' }
  if (diff < 60 * 60 * 1000) return { label: 'Away', color: '#FBBF24' }
  return { label: 'Inactive', color: '#64748B' }
}

// --- Quick Actions (KPI badges) ---
const QUICK_ACTIONS = [
  { label: 'Begin/Continue Airfield Inspection', icon: '📋', color: '#34D399', href: '/inspections?action=begin' },
  { label: 'Begin Airfield Check', icon: '🛡️', color: '#FBBF24', href: '/checks' },
  { label: 'New Discrepancy', icon: '🚨', color: '#EF4444', href: '/discrepancies/new' },
]

// --- NAVAID color map ---
const STATUS_COLORS: Record<string, string> = {
  green: '#34D399',
  yellow: '#FBBF24',
  red: '#EF4444',
}

// --- Activity action formatting ---
function formatAction(action: string, entityType: string, displayId?: string): string {
  const typeLabel: Record<string, string> = {
    discrepancy: 'Discrepancy',
    check: 'Check',
    inspection: 'Inspection',
    obstruction_evaluation: 'Obstruction Eval',
  }
  const entity = typeLabel[entityType] || entityType
  const id = displayId ? ` ${displayId}` : ''
  const actionLabel: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    completed: 'Completed',
    status_updated: 'Status changed on',
  }
  return `${actionLabel[action] || action} ${entity}${id}`
}

type ActivityEntry = {
  id: string
  action: string
  entity_type: string
  entity_display_id: string | null
  created_at: string
  user_name: string
  user_rank: string | null
}

type Advisory = {
  type: 'INFO' | 'CAUTION' | 'WARNING'
  text: string
}

const ADVISORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  INFO: { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)', text: '#38BDF8' },
  CAUTION: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', text: '#FBBF24' },
  WARNING: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#EF4444' },
}

type CurrentStatusData = {
  bwc: string | null
  lastCheckType: string | null
  lastCheckTime: string | null
  inspectionCompletion: string | null
  rscCondition: string | null
  rscTime: string | null
  activeRunway: '01' | '19'
  runwayStatus: 'open' | 'suspended' | 'closed'
}

export default function HomePage() {
  const [time, setTime] = useState('')
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [weatherLoaded, setWeatherLoaded] = useState(false)
  const [userDisplay, setUserDisplay] = useState<{ name: string; lastSeen: string | null }>({ name: '—', lastSeen: null })
  const [navaids, setNavaids] = useState<NavaidStatus[]>([])
  const [navaidNotes, setNavaidNotes] = useState<Record<string, string>>({})
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [activityExpanded, setActivityExpanded] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<CurrentStatusData>({
    bwc: null, lastCheckType: null, lastCheckTime: null, inspectionCompletion: null, rscCondition: null, rscTime: null, activeRunway: '01', runwayStatus: 'open',
  })
  const [advisory, setAdvisory] = useState<Advisory | null>(null)
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
      const result = await fetchCurrentWeather()
      setWeather(result)
      setWeatherLoaded(true)
    }
    loadWeather()
  }, [])

  // --- Load NAVAIDs ---
  const loadNavaids = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return

    const data = await fetchNavaidStatuses()
    setNavaids(data)
    const notes: Record<string, string> = {}
    data.forEach((n) => { notes[n.id] = n.notes || '' })
    setNavaidNotes(notes)
  }, [])

  useEffect(() => { loadNavaids() }, [loadNavaids])

  // --- Load Current Status (BWC, Last Check, Inspection, RSC) ---
  useEffect(() => {
    async function loadCurrentStatus() {
      const supabase = createClient()
      if (!supabase) return

      // Latest inspection with BWC
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: insp } = await (supabase as any)
        .from('inspections')
        .select('bwc_value, completed_at')
        .not('bwc_value', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)

      // Latest completed inspection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: latestInsp } = await (supabase as any)
        .from('inspections')
        .select('completed_at')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)

      // Latest check of any type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lastCheck } = await (supabase as any)
        .from('airfield_checks')
        .select('check_type, completed_at')
        .order('completed_at', { ascending: false })
        .limit(1)

      // Latest RSC check
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rscCheck } = await (supabase as any)
        .from('airfield_checks')
        .select('data, completed_at')
        .eq('check_type', 'rsc')
        .order('completed_at', { ascending: false })
        .limit(1)

      const bwc = insp?.[0]?.bwc_value || null
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
        lastCheckType: checkType,
        lastCheckTime: checkTime,
        inspectionCompletion: inspTime,
        rscCondition,
        rscTime,
      }))
    }
    loadCurrentStatus()
  }, [])

  // --- Load Activity Feed ---
  useEffect(() => {
    async function loadActivity() {
      const supabase = createClient()
      if (!supabase) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('activity_log')
        .select('id, action, entity_type, entity_display_id, created_at, user_id, profiles:user_id(name, rank)')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        // Try without join
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: fallback } = await (supabase as any)
          .from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)

        if (fallback) {
          setActivity(fallback.map((r: Record<string, unknown>) => ({
            ...r,
            user_name: 'Unknown',
            user_rank: null,
          })) as ActivityEntry[])
        }
        return
      }

      if (data) {
        setActivity(data.map((r: Record<string, unknown>) => ({
          ...r,
          user_name: (r.profiles as { name?: string } | null)?.name || 'Unknown',
          user_rank: (r.profiles as { rank?: string } | null)?.rank || null,
        })) as ActivityEntry[])
      }
    }
    loadActivity()
  }, [])

  // --- NAVAID status toggle handler ---
  async function handleNavaidToggle(navaid: NavaidStatus, newStatus: 'green' | 'yellow' | 'red') {
    const notes = newStatus === 'green' ? null : (navaidNotes[navaid.id] || null)
    const ok = await updateNavaidStatus(navaid.id, newStatus, notes)
    if (ok) loadNavaids()
  }

  async function handleNavaidNotesSave(navaid: NavaidStatus) {
    const notes = navaidNotes[navaid.id] || null
    await updateNavaidStatus(navaid.id, navaid.status, notes)
    loadNavaids()
  }

  const presence = presenceLabel(userDisplay.lastSeen)

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* ===== Clock + User ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>{time || '--:--'}</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9' }}>{userDisplay.name}</div>
          <div style={{ fontSize: 9, color: presence.color, fontWeight: 600 }}>{presence.label}</div>
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
          border: '1px solid rgba(56,189,248,0.1)',
          marginBottom: 16,
        }}
      >
        {weatherLoaded ? (
          weather ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{weatherEmoji(weather.conditions)}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {weather.temperature_f}&deg;F &bull; {weather.conditions}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>
                    Wind {weather.wind_speed_mph} mph &bull; Vis {weather.visibility_miles} SM
                  </div>
                </div>
              </div>
              <div
                onClick={() => setAdvisoryDialogOpen(true)}
                style={{ textAlign: 'right', cursor: 'pointer', minWidth: 60 }}
              >
                <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Advisory</div>
                {advisory ? (
                  <div style={{ fontSize: 11, fontWeight: 700, color: ADVISORY_COLORS[advisory.type].text }}>{advisory.type}</div>
                ) : (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>None</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>❓</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>UNKWN</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>Weather data unavailable</div>
                </div>
              </div>
              <div
                onClick={() => setAdvisoryDialogOpen(true)}
                style={{ textAlign: 'right', cursor: 'pointer', minWidth: 60 }}
              >
                <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Advisory</div>
                {advisory ? (
                  <div style={{ fontSize: 11, fontWeight: 700, color: ADVISORY_COLORS[advisory.type].text }}>{advisory.type}</div>
                ) : (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>None</div>
                )}
              </div>
            </>
          )
        ) : (
          <div style={{ fontSize: 11, color: '#64748B' }}>Loading weather...</div>
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
          <div style={{ fontSize: 11, fontWeight: 800, color: ADVISORY_COLORS[advisory.type].text, marginBottom: 2 }}>{advisory.type}</div>
          <div style={{ fontSize: 12, color: '#E2E8F0', lineHeight: 1.4 }}>{advisory.text}</div>
        </div>
      )}

      {/* Advisory dialog */}
      {advisoryDialogOpen && (
        <div
          onClick={() => setAdvisoryDialogOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0F172A', borderRadius: 14, padding: 20, width: '100%', maxWidth: 340,
              border: '1px solid rgba(56,189,248,0.12)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9', marginBottom: 14 }}>Set Advisory</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['INFO', 'CAUTION', 'WARNING'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAdvisoryDraftType(t)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', textAlign: 'center',
                    border: advisoryDraftType === t
                      ? `2px solid ${ADVISORY_COLORS[t].text}`
                      : '1px solid rgba(56,189,248,0.12)',
                    background: advisoryDraftType === t ? ADVISORY_COLORS[t].bg : 'rgba(4,7,12,0.5)',
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
                background: 'rgba(4,7,12,0.7)', border: '1px solid rgba(56,189,248,0.12)',
                color: '#E2E8F0', fontSize: 13, outline: 'none', marginBottom: 14,
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
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)', color: '#EF4444',
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
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)',
                  background: 'rgba(52,211,153,0.15)', color: '#34D399',
                }}
              >Save</button>
              <button
                onClick={() => setAdvisoryDialogOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid rgba(56,189,248,0.12)',
                  background: 'rgba(4,7,12,0.5)', color: '#64748B',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Current Status ===== */}
      <span className="section-label">Current Status</span>
      <div className="card" style={{
        marginBottom: 8, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: currentStatus.runwayStatus === 'suspended'
          ? 'rgba(251,191,36,0.08)'
          : currentStatus.runwayStatus === 'closed'
            ? 'rgba(239,68,68,0.08)'
            : undefined,
        border: currentStatus.runwayStatus === 'suspended'
          ? '1px solid rgba(251,191,36,0.2)'
          : currentStatus.runwayStatus === 'closed'
            ? '1px solid rgba(239,68,68,0.2)'
            : undefined,
      }}>
        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Active RWY</div>
        <button
          onClick={() => setCurrentStatus((prev) => ({ ...prev, activeRunway: prev.activeRunway === '01' ? '19' : '01' }))}
          style={{
            padding: '4px 20px', borderRadius: 6, fontSize: 15, fontWeight: 800, cursor: 'pointer',
            border: '2px solid #475569',
            background: 'rgba(71,85,105,0.15)',
            color: '#E2E8F0',
          }}
        >{currentStatus.activeRunway}</button>
        <select
          value={currentStatus.runwayStatus}
          onChange={(e) => setCurrentStatus((prev) => ({ ...prev, runwayStatus: e.target.value as 'open' | 'suspended' | 'closed' }))}
          style={{
            padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
            border: currentStatus.runwayStatus === 'suspended'
              ? '1px solid rgba(251,191,36,0.4)'
              : currentStatus.runwayStatus === 'closed'
                ? '1px solid rgba(239,68,68,0.4)'
                : '1px solid rgba(52,211,153,0.3)',
            background: 'rgba(4,7,12,0.7)',
            color: currentStatus.runwayStatus === 'suspended' ? '#FBBF24' : currentStatus.runwayStatus === 'closed' ? '#EF4444' : '#34D399',
            fontFamily: 'inherit', outline: 'none',
          }}
        >
          <option value="open">Open</option>
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="card" style={{ marginBottom: 12, padding: '12px 10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ padding: 12, background: 'rgba(4,7,12,0.5)', borderRadius: 10, border: '1px solid rgba(56,189,248,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>RSC</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#38BDF8' }}>
              {currentStatus.rscCondition
                ? `${currentStatus.rscCondition}${currentStatus.rscTime ? ` @ ${currentStatus.rscTime}` : ''}`
                : 'No Data'}
            </div>
          </div>
          <div style={{ padding: 12, background: 'rgba(4,7,12,0.5)', borderRadius: 10, border: '1px solid rgba(56,189,248,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>BWC</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: currentStatus.bwc === 'SEV' || currentStatus.bwc === 'PROHIB' ? '#EF4444' : currentStatus.bwc === 'MOD' ? '#FBBF24' : '#34D399' }}>
              {currentStatus.bwc || 'No Data'}
            </div>
          </div>
        </div>
      </div>

      {/* ===== NAVAID Status ===== */}
      <span className="section-label">NAVAID Status</span>
      {navaids.length === 0 ? (
        <div className="card" style={{ marginBottom: 16, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>
            Connect to Supabase to manage NAVAID statuses
          </div>
        </div>
      ) : (() => {
        const rwy01 = navaids
          .filter((n) => n.navaid_name.startsWith('01'))
          .sort((a, b) => (a.navaid_name.includes('ILS') ? -1 : b.navaid_name.includes('ILS') ? 1 : 0))
        const rwy19 = navaids
          .filter((n) => n.navaid_name.startsWith('19') && !n.navaid_name.includes('Localizer'))
          .sort((a, b) => (a.navaid_name.includes('ILS') ? -1 : b.navaid_name.includes('ILS') ? 1 : 0))
        const NAVAID_CYCLE: ('green' | 'yellow' | 'red')[] = ['green', 'yellow', 'red']
        const NAVAID_LABELS: Record<string, string> = { green: 'G', yellow: 'Y', red: 'R' }
        const renderNavaidItem = (n: NavaidStatus) => (
          <div key={n.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>
                {n.navaid_name.replace(/^(01|19)\s*/, '')}
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
                  background: `${STATUS_COLORS[n.status]}20`,
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
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
                  background: 'rgba(4,7,12,0.7)',
                  border: `1px solid ${STATUS_COLORS[n.status]}40`,
                  borderRadius: 6, padding: '6px 10px', fontSize: 13,
                  color: '#E2E8F0', outline: 'none',
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
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div className="card" style={{ padding: '10px 14px 4px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#FBBF24', marginBottom: 8, textAlign: 'center', letterSpacing: '0.06em' }}>RWY 01</div>
              {rwy01.map(renderNavaidItem)}
            </div>
            <div className="card" style={{ padding: '10px 14px 4px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#FBBF24', marginBottom: 8, textAlign: 'center', letterSpacing: '0.06em' }}>RWY 19</div>
              {rwy19.map(renderNavaidItem)}
            </div>
          </div>
        )
      })()}

      {/* ===== Last Check Completed ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 12, background: 'rgba(4,7,12,0.5)', borderRadius: 10, border: '1px solid rgba(56,189,248,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Last Check Completed</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#22D3EE' }}>
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
              background: 'rgba(10,16,28,0.92)',
              border: '1px solid rgba(56,189,248,0.06)',
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
            <span style={{ fontSize: 14, color: q.color, letterSpacing: '0.04em', fontWeight: 700 }}>
              {q.label}
            </span>
          </Link>
        ))}
      </div>

      {/* ===== Recent Activity ===== */}
      <span className="section-label">Recent Activity</span>
      {activity.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 11, color: '#64748B' }}>No activity recorded yet</div>
        </div>
      ) : (
        <>
          {(activityExpanded ? activity : activity.slice(0, 3)).map((a, i, arr) => {
            const actionColor: Record<string, string> = {
              created: '#34D399',
              completed: '#22D3EE',
              updated: '#FBBF24',
              status_updated: '#A78BFA',
              deleted: '#EF4444',
            }
            const color = actionColor[a.action] || '#64748B'
            const date = new Date(a.created_at)
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const timeStr = date.toTimeString().slice(0, 5)
            const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name

            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '7px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(56,189,248,0.06)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: `${color}12`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    flexShrink: 0,
                    color,
                  }}
                >
                  &bull;
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#22D3EE' }}>
                      {userName}
                    </span>
                    <span style={{ fontSize: 9, color: '#64748B' }}>{dateStr} {timeStr}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>
                    {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined)}
                  </div>
                </div>
              </div>
            )
          })}
          {activity.length > 3 && (
            <button
              onClick={() => setActivityExpanded((p) => !p)}
              style={{
                width: '100%', padding: '8px 0', marginTop: 4,
                background: 'none', border: 'none',
                color: '#0EA5E9', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {activityExpanded ? 'Show Less' : `Show All (${activity.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
