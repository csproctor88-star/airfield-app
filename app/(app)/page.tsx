'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus,
  ClipboardCheck,
  TriangleAlert,
  ClipboardList,
} from 'lucide-react'
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

// --- Quick Actions ---
const QUICK_ACTIONS = [
  { label: 'New Discrepancy', icon: Plus, color: '#EF4444', href: '/discrepancies/new' },
  { label: 'Airfield Check History', icon: ClipboardCheck, color: '#22D3EE', href: '/checks/history' },
  { label: 'Obstruction Database', icon: TriangleAlert, color: '#F97316', href: '/obstructions/history' },
  { label: 'Airfield Inspection History', icon: ClipboardList, color: '#34D399', href: '/inspections?view=history' },
]

// --- KPI Tiles ---
const KPI_TILES = [
  { label: 'Begin\nAirfield Check', icon: '🛡️', color: '#FBBF24', href: '/checks' },
  { label: 'Begin/Continue\nAirfield Inspection', icon: '📋', color: '#34D399', href: '/inspections?action=begin' },
  { label: 'Obstruction\nEvaluation', icon: '🗺️', color: '#38BDF8', href: '/obstructions' },
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

type CurrentStatusData = {
  bwc: string | null
  lastCheckType: string | null
  lastCheckTime: string | null
  inspectionCompletion: string | null
  rscCondition: string | null
  rscTime: string | null
  activeRunway: '01' | '19'
}

export default function HomePage() {
  const [time, setTime] = useState('')
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [weatherLoaded, setWeatherLoaded] = useState(false)
  const [userDisplay, setUserDisplay] = useState<{ name: string; lastSeen: string | null }>({ name: '—', lastSeen: null })
  const [navaids, setNavaids] = useState<NavaidStatus[]>([])
  const [navaidNotes, setNavaidNotes] = useState<Record<string, string>>({})
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [currentStatus, setCurrentStatus] = useState<CurrentStatusData>({
    bwc: null, lastCheckType: null, lastCheckTime: null, inspectionCompletion: null, rscCondition: null, rscTime: null, activeRunway: '01',
  })

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
          marginBottom: 8,
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
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>❓</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>UNKWN</div>
                <div style={{ fontSize: 10, color: '#475569' }}>Weather data unavailable</div>
              </div>
            </div>
          )
        ) : (
          <div style={{ fontSize: 11, color: '#64748B' }}>Loading weather...</div>
        )}
      </div>

      {/* ===== Current Status ===== */}
      <span className="section-label">Current Status</span>
      <div className="card" style={{ marginBottom: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div style={{ padding: 8, background: 'rgba(4,7,12,0.5)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>RSC</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8' }}>
              {currentStatus.rscCondition
                ? `${currentStatus.rscCondition}${currentStatus.rscTime ? ` @ ${currentStatus.rscTime}` : ''}`
                : 'No Data'}
            </div>
          </div>
          <div style={{ padding: 8, background: 'rgba(4,7,12,0.5)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>BWC</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: currentStatus.bwc === 'SEV' || currentStatus.bwc === 'PROHIB' ? '#EF4444' : currentStatus.bwc === 'MOD' ? '#FBBF24' : '#34D399' }}>
              {currentStatus.bwc || 'No Data'}
            </div>
          </div>
          <div style={{ padding: 8, background: 'rgba(4,7,12,0.5)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Active RWY</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              <button
                onClick={() => setCurrentStatus((prev) => ({ ...prev, activeRunway: '01' }))}
                style={{
                  padding: '2px 10px',
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: currentStatus.activeRunway === '01'
                    ? '2px solid #34D399'
                    : '1px solid rgba(56,189,248,0.12)',
                  background: currentStatus.activeRunway === '01'
                    ? 'rgba(52,211,153,0.15)'
                    : 'rgba(4,7,12,0.5)',
                  color: currentStatus.activeRunway === '01' ? '#34D399' : '#64748B',
                }}
              >
                01
              </button>
              <button
                onClick={() => setCurrentStatus((prev) => ({ ...prev, activeRunway: '19' }))}
                style={{
                  padding: '2px 10px',
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: currentStatus.activeRunway === '19'
                    ? '2px solid #34D399'
                    : '1px solid rgba(56,189,248,0.12)',
                  background: currentStatus.activeRunway === '19'
                    ? 'rgba(52,211,153,0.15)'
                    : 'rgba(4,7,12,0.5)',
                  color: currentStatus.activeRunway === '19' ? '#34D399' : '#64748B',
                }}
              >
                19
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Last Completed ===== */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ padding: 8, background: 'rgba(4,7,12,0.5)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 2 }}>Last Inspection Completed</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: currentStatus.inspectionCompletion ? '#34D399' : '#FBBF24' }}>
              {currentStatus.inspectionCompletion || 'Not Completed'}
            </div>
          </div>
          <div style={{ padding: 8, background: 'rgba(4,7,12,0.5)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 2 }}>Last Check Completed</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#22D3EE' }}>
              {currentStatus.lastCheckType && currentStatus.lastCheckTime
                ? `${currentStatus.lastCheckType} @ ${currentStatus.lastCheckTime}`
                : 'No Data'}
            </div>
          </div>
        </div>
      </div>

      {/* ===== KPI Tiles — 3 across ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {KPI_TILES.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            style={{
              background: 'rgba(10,16,28,0.92)',
              border: '1px solid rgba(56,189,248,0.06)',
              borderRadius: 10,
              padding: '14px 6px',
              textAlign: 'center',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: 12, color: k.color, letterSpacing: '0.04em', fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.3 }}>
              {k.label}
            </div>
          </Link>
        ))}
      </div>

      {/* ===== Quick Actions ===== */}
      <span className="section-label">Quick Actions</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
        {QUICK_ACTIONS.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            style={{
              background: 'rgba(10,16,28,0.92)',
              border: '1px solid rgba(56,189,248,0.06)',
              borderRadius: 10,
              padding: '14px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: `${q.color}12`,
                border: `1px solid ${q.color}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <q.icon size={18} color={q.color} />
            </div>
            <span style={{ fontSize: 11, color: '#E2E8F0', fontWeight: 700, lineHeight: 1.3 }}>
              {q.label}
            </span>
          </Link>
        ))}
      </div>

      {/* ===== NAVAID Status ===== */}
      <span className="section-label">NAVAID Status</span>
      <div className="card" style={{ marginBottom: 10, padding: '10px 12px' }}>
        {navaids.length === 0 ? (
          <div style={{ fontSize: 11, color: '#64748B', textAlign: 'center', padding: 12 }}>
            Connect to Supabase to manage NAVAID statuses
          </div>
        ) : (
          navaids.map((n) => (
            <div key={n.id} style={{ marginBottom: navaids.indexOf(n) < navaids.length - 1 ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#E2E8F0' }}>{n.navaid_name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['green', 'yellow', 'red'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleNavaidToggle(n, s)}
                      style={{
                        width: 28,
                        height: 22,
                        borderRadius: 5,
                        border: n.status === s
                          ? `2px solid ${STATUS_COLORS[s]}`
                          : '1px solid rgba(56,189,248,0.12)',
                        background: n.status === s
                          ? `${STATUS_COLORS[s]}20`
                          : 'rgba(4,7,12,0.5)',
                        cursor: 'pointer',
                        fontSize: 8,
                        fontWeight: 700,
                        color: STATUS_COLORS[s],
                        textTransform: 'uppercase',
                        padding: 0,
                      }}
                    >
                      {s.charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {(n.status === 'yellow' || n.status === 'red') && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="Add note..."
                    value={navaidNotes[n.id] || ''}
                    onChange={(e) => setNavaidNotes((prev) => ({ ...prev, [n.id]: e.target.value }))}
                    onBlur={() => handleNavaidNotesSave(n)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNavaidNotesSave(n) }}
                    style={{
                      flex: 1,
                      background: 'rgba(4,7,12,0.7)',
                      border: `1px solid ${STATUS_COLORS[n.status]}40`,
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 10,
                      color: '#E2E8F0',
                      outline: 'none',
                    }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ===== Recent Activity ===== */}
      <span className="section-label">Recent Activity</span>
      {activity.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 11, color: '#64748B' }}>No activity recorded yet</div>
        </div>
      ) : (
        activity.map((a, i) => {
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
                borderBottom: i < activity.length - 1 ? '1px solid rgba(56,189,248,0.06)' : 'none',
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
        })
      )}
    </div>
  )
}
