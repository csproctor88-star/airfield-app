'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchCurrentWeather, type WeatherResult } from '@/lib/weather'
import { fetchNavaidStatuses, updateNavaidStatus, type NavaidStatus } from '@/lib/supabase/navaids'
import { fetchCustomStatusBoards, fetchAllCustomStatusItems, updateCustomStatusItem, type CustomStatusBoard, type CustomStatusItem } from '@/lib/supabase/custom-status'
import { fetchPprEntriesForDate, fetchPprColumns, formatPprColumnValue, type PprEntry, type PprColumn } from '@/lib/supabase/ppr'
import { fetchInstallationNavaids } from '@/lib/supabase/installations'
import { useDashboard } from '@/lib/dashboard-context'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { logActivity, logManualEntry } from '@/lib/supabase/activity'
import { toast } from 'sonner'
import { logRunwayStatusChange, logArffStatusChange } from '@/lib/supabase/airfield-status'
import { RSC_CONDITIONS, BWC_OPTIONS, RCR_CONDITION_TYPES, CONTRACTOR_STATUS_CONFIG } from '@/lib/constants'
import { fetchActiveContractors, updateContractor, createContractor, type ContractorRow } from '@/lib/supabase/contractors'
import { DEMO_CONTRACTORS } from '@/lib/demo-data'
import { formatZuluDate, formatZuluTime, formatZuluDateTime } from '@/lib/utils'
import LoginActivityDialog from '@/components/login-activity-dialog'
import { subscribeWithErrorHandling } from '@/lib/realtime-subscribe'
import {
  Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning,
  Snowflake, HelpCircle, DoorOpen, AlertOctagon, Plus,
} from 'lucide-react'

// Weather conditions → Lucide icon component. The hero / weather strip
// renders these at varying sizes; pass `size` and `color` at the
// callsite. Falls back to Sun when no rule matches.
function weatherIcon(conditions: string) {
  const c = conditions.toLowerCase()
  if (c.includes('thunderstorm')) return CloudLightning
  if (c.includes('heavy snow') || c.includes('snow grains')) return Snowflake
  if (c.includes('snow')) return CloudSnow
  if (c.includes('freezing')) return CloudSnow
  if (c.includes('heavy rain') || c.includes('heavy showers')) return CloudRain
  if (c.includes('rain') || c.includes('drizzle') || c.includes('showers')) return CloudRain
  if (c.includes('fog')) return CloudFog
  if (c.includes('overcast')) return Cloud
  if (c.includes('partly cloudy')) return CloudSun
  if (c.includes('mostly clear')) return CloudSun
  return Sun
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
  WATCH: { bg: 'rgba(251,191,36,0.18)', border: 'rgba(251,191,36,0.50)', text: 'var(--color-warning)' },
  WARNING: { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.50)', text: 'var(--color-danger)' },
  ADVISORY: { bg: 'rgba(56,189,248,0.18)', border: 'rgba(56,189,248,0.50)', text: 'var(--color-accent)' },
}

// Render order so a red is never visually buried under a yellow.
const ADVISORY_SEVERITY: Record<string, number> = { WARNING: 0, WATCH: 1, ADVISORY: 2 }

export default function HomePage() {
  const router = useRouter()
  const { advisories, addAdvisory, updateAdvisory, removeAdvisory, activeRunway, setActiveRunway, runwayStatus, setRunwayStatus, runwayStatuses, setRunwayActiveEnd, setRunwayStatusForRunway, arffCat, setArffCat, arffStatuses, setArffStatusForAircraft, rscCondition, setRscCondition, rcrValue, rcrCondition, bwcValue, setBwcValue, constructionRemarks, setConstructionRemarks, miscRemarks, setMiscRemarks, afmOutOfOffice, afmOooMessage, setAfmOutOfOffice, afmClosed, afmClosedMessage, setAfmClosed, refreshStatus } = useDashboard()
  const { installationId, runways, arffAircraft, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  // Full airfield-status write — runway / ARFF / advisory / remarks / labels.
  // Held by AFM, NAMO, amops, base_admin, sys_admin.
  const canWriteAirfieldStatus = has(PERM.AIRFIELD_STATUS_WRITE)
  // Narrow RSC + BWC write — safety role holds `airfield_status:write:rsc_bwc_only`
  // without the full key. Full-write holders trivially also qualify.
  const canEditRscBwc =
    canWriteAirfieldStatus || has(PERM.AIRFIELD_STATUS_WRITE_RSC_BWC_ONLY)
  const showArffCat = (() => {
    const cfg = (currentInstallation as unknown as { arff_config?: { show_cat_dropdown?: boolean } } | null)?.arff_config
    return cfg?.show_cat_dropdown !== false  // default true
  })()
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [weatherLoaded, setWeatherLoaded] = useState(false)
  const [navaids, setNavaids] = useState<NavaidStatus[]>([])
  const [navaidNotes, setNavaidNotes] = useState<Record<string, string>>({})
  const [customBoards, setCustomBoards] = useState<CustomStatusBoard[]>([])
  const [customItems, setCustomItems] = useState<CustomStatusItem[]>([])
  const [customItemNotes, setCustomItemNotes] = useState<Record<string, string>>({})

  // Editable status board labels (stored on bases.status_labels JSONB)
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({})
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState('')
  const canEditLabels = canWriteAirfieldStatus
  const [oooMinimized, setOooMinimized] = useState(false)
  const [showOooDeactivate, setShowOooDeactivate] = useState(false)
  const [showClosedDeactivate, setShowClosedDeactivate] = useState(false)
  const [customItemDialog, setCustomItemDialog] = useState<{
    item: CustomStatusItem
    boardName: string
    selectedStatus: 'green' | 'yellow' | 'red'
    notes: string
  } | null>(null)
  const [todayPprs, setTodayPprs] = useState<PprEntry[]>([])
  const [pprColumns, setPprColumns] = useState<PprColumn[]>([])
  const [activeContractors, setActiveContractors] = useState<ContractorRow[]>([])
  const [showAddPersonnel, setShowAddPersonnel] = useState(false)
  const [addingPersonnel, setAddingPersonnel] = useState(false)
  const [pCompany, setPCompany] = useState('')
  const [pLocation, setPLocation] = useState('')
  const [pDescription, setPDescription] = useState('')
  const [pCallsign, setPCallsign] = useState('')
  const [pRadio, setPRadio] = useState('')
  const [pFlag, setPFlag] = useState('')
  const [pNotes, setPNotes] = useState('')
  type ContractorTemplate = { name: string; company: string; contact: string; callsign: string; notes: string; af_form_483: string; af_form_483_expiration: string; contact_phone: string }
  const [contractorTemplates, setContractorTemplates] = useState<ContractorTemplate[]>([])
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ContractorTemplate | null>(null)
  const [editingConstruction, setEditingConstruction] = useState(false)
  const [constructionDraft, setConstructionDraft] = useState('')
  // Inline structured-add state for Construction/Closures. Lets users
  // append a single LOCATION + work entry without dropping into the
  // free-text textarea for the bulk Edit flow.
  const [addingConstruction, setAddingConstruction] = useState(false)
  const [newConstructionLocation, setNewConstructionLocation] = useState('')
  const [newConstructionWork, setNewConstructionWork] = useState('')
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
  const [advisoryDraftStart, setAdvisoryDraftStart] = useState('')
  const [advisoryDraftEnd, setAdvisoryDraftEnd] = useState('')
  const [advisoryDraftUfn, setAdvisoryDraftUfn] = useState(true)
  const [advisoryDraftNumber, setAdvisoryDraftNumber] = useState('')
  const [, setExpiryTick] = useState(0)
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Confirmation dialog state for runway changes
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    color: string
    notes: string
    // When set, the dialog renders a datetime-local picker (for runway close/suspend)
    showEstimatedResume?: boolean
    estimatedResumeAt?: string
    onConfirm: (notes: string, estimatedResumeAt?: string) => void
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

  // --- Advisory expiration timer ---
  useEffect(() => {
    const hasExpiring = advisories.some(a => a.effective_end)
    if (!hasExpiring) {
      if (expiryTimerRef.current) { clearInterval(expiryTimerRef.current); expiryTimerRef.current = null }
      return
    }
    // Tick every 15s to update countdowns and check for expirations
    expiryTimerRef.current = setInterval(() => {
      const now = Date.now()
      for (const adv of advisories) {
        if (adv.effective_end) {
          const endMs = new Date(adv.effective_end).getTime()
          if (now >= endMs) {
            // Expired — log and remove
            const effLabel = adv.effective_start
              ? `${formatZuluTime(new Date(adv.effective_start))}Z–${formatZuluTime(new Date(adv.effective_end))}Z`
              : `UFN–${formatZuluTime(new Date(adv.effective_end))}Z`
            const expNum = adv.number ? ` #${adv.number.toUpperCase()}` : ''
            if (installationId) logActivity('updated', 'weather_info', installationId, `WX-${adv.type.toUpperCase()}${expNum}`, { details: `WEATHER ${adv.type.toUpperCase()}${expNum} EXPIRED — ${adv.text.toUpperCase()} (EFF ${effLabel})` }, installationId)
            removeAdvisory(adv.id)
          }
        }
      }
      setExpiryTick(t => t + 1) // force re-render for countdowns
    }, 15000)
    return () => { if (expiryTimerRef.current) clearInterval(expiryTimerRef.current) }
  }, [advisories, installationId, removeAdvisory])

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

  // --- Load Custom Status Boards ---
  const loadCustomBoards = useCallback(async () => {
    if (!installationId) { setCustomBoards([]); setCustomItems([]); return }
    const boards = await fetchCustomStatusBoards(installationId)
    setCustomBoards(boards)
    if (boards.length > 0) {
      const items = await fetchAllCustomStatusItems(installationId)
      setCustomItems(items)
      const notes: Record<string, string> = {}
      items.forEach(i => { notes[i.id] = i.notes || '' })
      setCustomItemNotes(notes)
    } else {
      setCustomItems([])
    }
  }, [installationId])

  useEffect(() => { loadCustomBoards() }, [loadCustomBoards])

  // --- Load status labels ---
  useEffect(() => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    supabase.from('bases').select('status_labels').eq('id', installationId).single()
      .then(({ data }) => {
        const row = data as Record<string, unknown> | null
        if (row?.status_labels && typeof row.status_labels === 'object') {
          setStatusLabels(row.status_labels as Record<string, string>)
        }
      })
  }, [installationId])

  const saveStatusLabel = async (key: string, value: string) => {
    const updated = { ...statusLabels, [key]: value }
    setStatusLabels(updated)
    setEditingLabel(null)
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    await supabase.from('bases').update({ status_labels: updated } as any).eq('id', installationId)
  }

  // --- Load today's PPRs ---
  // Filter to approved entries only — the airfield status page is the
  // operational view of what's actually scheduled to be on the field.
  // Pending review / coordination / approval and denied entries live
  // in the PPR module proper, not here.
  //
  // "Today" here means today **in base local time** — operators read
  // this panel for what's landing on their field today, not what's
  // happening on the UTC calendar. en-CA returns YYYY-MM-DD which
  // matches the storage shape of `arrival_date` directly. Falls back
  // to UTC if the installation timezone is somehow missing.
  const baseTimezone = (currentInstallation as { timezone?: string | null } | null)?.timezone || 'UTC'
  const loadTodayPprs = useCallback(async () => {
    if (!installationId) { setTodayPprs([]); setPprColumns([]); return }
    let today: string
    try {
      today = new Intl.DateTimeFormat('en-CA', { timeZone: baseTimezone }).format(new Date())
    } catch {
      today = new Date().toISOString().slice(0, 10)
    }
    const [entries, cols] = await Promise.all([
      fetchPprEntriesForDate(installationId, today),
      fetchPprColumns(installationId),
    ])
    setTodayPprs(entries.filter((e) => e.status === 'approved'))
    setPprColumns(cols)
  }, [installationId, baseTimezone])

  useEffect(() => { loadTodayPprs() }, [loadTodayPprs])

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
    subscribeWithErrorHandling(channel)

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
    subscribeWithErrorHandling(channel)

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

  // Load contractor templates from base
  useEffect(() => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    supabase.from('bases').select('contractor_templates').eq('id', installationId).single()
      .then(({ data }) => {
        const row = data as Record<string, unknown> | null
        if (row?.contractor_templates && Array.isArray(row.contractor_templates)) {
          setContractorTemplates(row.contractor_templates as ContractorTemplate[])
        }
      })
  }, [installationId])

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
    subscribeWithErrorHandling(channel)

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

  // --- Custom Status Board handlers ---
  async function handleCustomItemToggle(item: CustomStatusItem, boardName: string, newStatus: 'green' | 'yellow' | 'red', dialogNotes?: string) {
    const notes = newStatus === 'green' ? null : (dialogNotes ?? (customItemNotes[item.id] || null))
    const updated = await updateCustomStatusItem(item.id, { status: newStatus, notes })
    if (updated) {
      loadCustomBoards()
      logActivity('updated', 'custom_status', item.id, `${boardName} — ${item.item_name}`, { details: `${boardName.toUpperCase()} — ${item.item_name.toUpperCase()} STATUS CHANGED TO ${newStatus === 'green' ? 'OPERATIONAL' : newStatus === 'yellow' ? 'DEGRADED' : 'OUTAGE'}${notes ? `. ${notes.toUpperCase()}` : ''}` }, installationId)
    }
  }

  async function handleCustomItemNotesSave(item: CustomStatusItem, boardName: string, overrideNotes?: string) {
    const notes = overrideNotes ?? (customItemNotes[item.id] || null)
    await updateCustomStatusItem(item.id, { notes })
    loadCustomBoards()
    logActivity('updated', 'custom_status', item.id, `${boardName} — ${item.item_name}`, { details: `${boardName.toUpperCase()} — ${item.item_name.toUpperCase()} REMARKS UPDATED${notes ? `. ${notes.toUpperCase()}` : ''}` }, installationId)
  }

  return (
    <div className="page-container">
      <LoginActivityDialog />

      {/* The operational status strip (advisories chip / PPRs chip /
          live Zulu clock / Julian / calendar date) lives in the
          app-shell header now, so it follows the user across every
          page instead of only landing on /. */}

      {/* AFM Out of Office banner — informational tier. Calmer than
          Closed; left accent rule keeps the affordance scannable
          without dominating the page when also-Closed. */}
      {afmOutOfOffice && !oooMinimized && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--color-border-mid)',
          borderLeft: '2px solid var(--color-accent)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <DoorOpen size={20} color="var(--color-accent)" strokeWidth={2.25} />
            <span style={{
              fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              AFM Out of Office
            </span>
          </div>
          <div style={{
            fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', lineHeight: 1.5,
            marginTop: 6, whiteSpace: 'pre-wrap',
          }}>
            {afmOooMessage || 'Airfield Management is currently out of office.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => setOooMinimized(true)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-mid)', background: 'transparent',
                color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Minimize</button>
            {canWriteAirfieldStatus && (
              <button
                onClick={() => setShowOooDeactivate(true)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.1)',
                  color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Deactivate</button>
            )}
          </div>
        </div>
      )}
      {afmOutOfOffice && oooMinimized && (
        <div
          onClick={() => setOooMinimized(false)}
          style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: 'rgba(15, 23, 42, 0.9)',
            borderLeft: '2px solid var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px',
            marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer',
          }}
        >
          <DoorOpen size={14} color="var(--color-accent)" />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase' }}>
            AFM Out of Office
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>— tap to expand</span>
        </div>
      )}

      {/* OOO deactivation dialog */}
      {showOooDeactivate && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowOooDeactivate(false) }} style={{ padding: 24, zIndex: 10000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid, #1E293B)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 380, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>
              End Out of Office
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
              Clear the Out of Office overlay and log Command Post notification.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmOutOfOffice(false)
                  await logManualEntry('AMOPS back in office, Command Post notified.', installationId)
                  setShowOooDeactivate(false)
                  toast.success('Out of Office deactivated')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-success)',
                  background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)',
                }}
              >Deactivate</button>
              <button
                onClick={() => setShowOooDeactivate(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* AFM Closed banner — blocking-state tier. Thick danger rule
          + larger title. No minimize: a closed airfield is not
          background information. */}
      {afmClosed && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(239, 68, 68, 0.45)',
          borderLeft: '4px solid var(--color-danger)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 22px',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <AlertOctagon size={26} color="var(--color-danger)" strokeWidth={2.5} />
            <span style={{
              fontSize: 'var(--fs-2xl)', fontWeight: 800, color: '#FECACA',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Airfield Management Closed
            </span>
          </div>
          <div style={{
            fontSize: 'var(--fs-md)', color: '#CBD5E1', lineHeight: 1.5,
            marginTop: 8, whiteSpace: 'pre-wrap',
          }}>
            {afmClosedMessage || 'Airfield Management is closed for the day.'}
          </div>
          {canWriteAirfieldStatus && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setShowClosedDeactivate(true)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.1)',
                  color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Reopen</button>
            </div>
          )}
        </div>
      )}

      {/* Closed deactivation dialog */}
      {showClosedDeactivate && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowClosedDeactivate(false) }} style={{ padding: 24, zIndex: 10000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid, #1E293B)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 380, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>
              Reopen Airfield
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16, lineHeight: 1.55 }}>
              The opening check will capture fresh runway, RSC, and BWC status.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmClosed(false)
                  await logManualEntry('AMOPS Open. Command Post notified.', installationId)
                  setShowClosedDeactivate(false)
                  toast.success('Airfield reopened')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-success)',
                  background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)',
                }}
              >Reopen</button>
              <button
                onClick={() => setShowClosedDeactivate(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Weather Strip =====
          Renders three states:
            - loading  → skeleton pulse so layout doesn't jump
            - loaded + data → Lucide weather icon + temp/conditions
                              + a visible Edit affordance for write users
            - loaded + no data → fallback "Weather Unavailable"
          The right-side "Weather Info" cluster is the entry point for
          adding/editing WWA advisories — kept clickable for write users. */}
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
          position: 'relative',
        }}
      >
        {!weatherLoaded ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--weather-gap)', width: '100%',
          }}>
            <div className="weather-skeleton" style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--color-bg-inset)',
            }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="weather-skeleton" style={{
                width: '40%', height: 14, borderRadius: 4, background: 'var(--color-bg-inset)',
              }} />
              <div className="weather-skeleton" style={{
                width: '28%', height: 10, borderRadius: 4, background: 'var(--color-bg-inset)',
              }} />
            </div>
          </div>
        ) : weather ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--weather-gap)' }}>
              {(() => {
                const Icon = weatherIcon(weather.conditions)
                return <Icon size={32} color="var(--color-accent)" strokeWidth={2} />
              })()}
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
              onClick={canWriteAirfieldStatus ? () => {
                setEditingAdvisoryId(null)
                setAdvisoryDraftType('ADVISORY')
                setAdvisoryDraftText('')
                setAdvisoryDialogOpen(true)
              } : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: canWriteAirfieldStatus ? 'pointer' : 'default',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Weather Alerts</div>
                {advisories.length > 0 ? (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: ADVISORY_COLORS[advisories.some(a => a.type === 'WARNING') ? 'WARNING' : advisories.some(a => a.type === 'WATCH') ? 'WATCH' : 'ADVISORY'].text }}>
                    {advisories.length} Active
                  </div>
                ) : (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-3)' }}>None</div>
                )}
              </div>
              {canWriteAirfieldStatus && (
                <div
                  title="Add a weather alert"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(56,189,248,0.35)',
                    background: 'rgba(56,189,248,0.08)',
                    color: 'var(--color-accent)',
                  }}>
                  <Plus size={14} strokeWidth={2.5} />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--weather-gap)' }}>
              <HelpCircle size={32} color="var(--color-text-3)" strokeWidth={2} />
              <div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-3)' }}>UNKWN</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>Weather data unavailable</div>
              </div>
            </div>
            <div
              onClick={canWriteAirfieldStatus ? () => {
                setEditingAdvisoryId(null)
                setAdvisoryDraftType('ADVISORY')
                setAdvisoryDraftText('')
                setAdvisoryDialogOpen(true)
              } : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: canWriteAirfieldStatus ? 'pointer' : 'default',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Weather Alerts</div>
                {advisories.length > 0 ? (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: ADVISORY_COLORS[advisories.some(a => a.type === 'WARNING') ? 'WARNING' : advisories.some(a => a.type === 'WATCH') ? 'WATCH' : 'ADVISORY'].text }}>
                    {advisories.length} Active
                  </div>
                ) : (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-3)' }}>None</div>
                )}
              </div>
              {canWriteAirfieldStatus && (
                <div
                  title="Add a weather alert"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(56,189,248,0.35)',
                    background: 'rgba(56,189,248,0.08)',
                    color: 'var(--color-accent)',
                  }}>
                  <Plus size={14} strokeWidth={2.5} />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Advisory banners — severity-sorted (WARNING → WATCH → ADVISORY)
          so red never lands below yellow. Each clickable to edit. */}
      {[...advisories]
        .sort((a, b) => (ADVISORY_SEVERITY[a.type] ?? 9) - (ADVISORY_SEVERITY[b.type] ?? 9))
        .map((adv) => {
        const now = Date.now()
        const endMs = adv.effective_end ? new Date(adv.effective_end).getTime() : null
        const msRemaining = endMs ? endMs - now : null
        const expiringSoon = msRemaining !== null && msRemaining > 0 && msRemaining <= 5 * 60 * 1000
        const urgentCountdown = msRemaining !== null && msRemaining > 0 && msRemaining <= 30 * 60 * 1000
        const colors = ADVISORY_COLORS[adv.type]

        // Build effective time label
        let effLabel = ''
        if (adv.effective_start || adv.effective_end) {
          const startStr = adv.effective_start ? formatZuluTime(new Date(adv.effective_start)) + 'Z' : 'Now'
          const endStr = adv.effective_end ? formatZuluTime(new Date(adv.effective_end)) + 'Z' : 'UFN'
          effLabel = `${startStr} – ${endStr}`
        }

        // Countdown text
        let countdownText = ''
        if (msRemaining !== null && msRemaining > 0) {
          const mins = Math.ceil(msRemaining / 60000)
          if (mins >= 60) {
            const hrs = Math.floor(mins / 60)
            const rem = mins % 60
            countdownText = rem > 0 ? `${hrs}h ${rem}m remaining` : `${hrs}h remaining`
          } else {
            countdownText = `${mins}m remaining`
          }
        }

        return (
          <div
            key={adv.id}
            onClick={() => {
              setEditingAdvisoryId(adv.id)
              setAdvisoryDraftType(adv.type)
              setAdvisoryDraftText(adv.text)
              setAdvisoryDraftStart(adv.effective_start ? new Date(adv.effective_start).toISOString().slice(0, 16) : '')
              setAdvisoryDraftEnd(adv.effective_end ? new Date(adv.effective_end).toISOString().slice(0, 16) : '')
              setAdvisoryDraftUfn(!adv.effective_end)
              setAdvisoryDraftNumber(adv.number || '')
              setAdvisoryDialogOpen(true)
            }}
            style={{
              padding: 'var(--advisory-padding)',
              marginBottom: 8,
              borderRadius: 'var(--radius-md)',
              background: expiringSoon ? 'transparent' : colors.bg,
              border: expiringSoon ? `2px solid ${colors.text}` : `1px solid ${colors.border}`,
              cursor: 'pointer',
              opacity: expiringSoon ? 0.85 : 1,
              transition: 'all 0.3s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <div style={{
                fontSize: 'var(--fs-base)', fontWeight: 800, color: colors.text,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{adv.type}{adv.number ? ` #${adv.number.toUpperCase()}` : ''}</div>
              {countdownText && (
                <div style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: urgentCountdown ? 800 : 600,
                  color: urgentCountdown ? 'var(--color-danger)' : 'var(--color-text-3)',
                  letterSpacing: urgentCountdown ? '0.04em' : 0,
                }}>
                  {countdownText}
                </div>
              )}
            </div>
            <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{adv.text}</div>
            {effLabel && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, fontWeight: 600 }}>
                Effective {effLabel}
              </div>
            )}
          </div>
        )
      })}
      {/* The standalone "+ Add Weather Info" button was removed —
          the +Add chip on the weather card's Weather Alerts cluster
          is the single canonical entry point for adding an advisory. */}

      {/* Advisory dialog (add or edit) */}
      {advisoryDialogOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setAdvisoryDialogOpen(false) }}
          style={{ padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 'var(--advisory-dialog-padding)', width: '100%', maxWidth: 'var(--advisory-dialog-width)',
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
                    flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700,
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Number (e.g. WW-042)"
                value={advisoryDraftNumber}
                onChange={(e) => setAdvisoryDraftNumber(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', outline: 'none',
                  fontFamily: 'monospace', letterSpacing: '0.03em',
                }}
              />
              <input
                type="text"
                placeholder="Weather info text..."
                value={advisoryDraftText}
                onChange={(e) => setAdvisoryDraftText(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Effective Times */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 6 }}>Effective Times (Zulu)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 2 }}>Start</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="date"
                      value={advisoryDraftStart.slice(0, 10)}
                      onChange={(e) => {
                        const time = advisoryDraftStart.slice(11, 16) || '00:00'
                        setAdvisoryDraftStart(e.target.value ? `${e.target.value}T${time}` : '')
                      }}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                        color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                      }}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1500"
                      value={advisoryDraftStart.slice(11, 16).replace(':', '')}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                        const date = advisoryDraftStart.slice(0, 10) || new Date().toISOString().slice(0, 10)
                        if (v.length === 4) {
                          setAdvisoryDraftStart(`${date}T${v.slice(0, 2)}:${v.slice(2, 4)}`)
                        } else {
                          setAdvisoryDraftStart(`${date}T${v}`)
                        }
                      }}
                      style={{
                        width: 56, padding: '8px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                        color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'monospace',
                        textAlign: 'center', letterSpacing: '0.08em',
                      }}
                    />
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)' }}>Z</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 2 }}>End</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="date"
                      value={advisoryDraftEnd.slice(0, 10)}
                      disabled={advisoryDraftUfn}
                      onChange={(e) => {
                        const time = advisoryDraftEnd.slice(11, 16) || '00:00'
                        setAdvisoryDraftEnd(e.target.value ? `${e.target.value}T${time}` : '')
                        setAdvisoryDraftUfn(false)
                      }}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                        color: advisoryDraftUfn ? 'var(--color-text-4)' : 'var(--color-text-1)',
                        fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                        opacity: advisoryDraftUfn ? 0.5 : 1,
                      }}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1800"
                      disabled={advisoryDraftUfn}
                      value={advisoryDraftEnd.slice(11, 16).replace(':', '')}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                        const date = advisoryDraftEnd.slice(0, 10) || new Date().toISOString().slice(0, 10)
                        if (v.length === 4) {
                          setAdvisoryDraftEnd(`${date}T${v.slice(0, 2)}:${v.slice(2, 4)}`)
                        } else {
                          setAdvisoryDraftEnd(`${date}T${v}`)
                        }
                        setAdvisoryDraftUfn(false)
                      }}
                      style={{
                        width: 56, padding: '8px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                        color: advisoryDraftUfn ? 'var(--color-text-4)' : 'var(--color-text-1)',
                        fontSize: 'var(--fs-sm)', fontFamily: 'monospace',
                        textAlign: 'center', letterSpacing: '0.08em',
                        opacity: advisoryDraftUfn ? 0.5 : 1,
                      }}
                    />
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)' }}>Z</span>
                  </div>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={advisoryDraftUfn}
                  onChange={(e) => { setAdvisoryDraftUfn(e.target.checked); if (e.target.checked) setAdvisoryDraftEnd('') }}
                />
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600 }}>Until Further Notice (UFN)</span>
              </label>
            </div>

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
                    const cancelNum = existing?.number ? ` #${existing.number.toUpperCase()}` : ''
                    if (installationId) logActivity('updated', 'weather_info', installationId, `WX-${(existing?.type ?? 'INFO').toUpperCase()}${cancelNum}`, { details: `WEATHER ${(existing?.type ?? 'INFO').toUpperCase()}${cancelNum} CANCELLED — ${(existing?.text ?? '').toUpperCase()}` }, installationId)
                    await removeAdvisory(editingAdvisoryId)
                    setAdvisoryDialogOpen(false)
                  }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                    cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)',
                  }}
                >Clear</button>
              )}
              <button
                onClick={async () => {
                  if (advisoryDraftText.trim()) {
                    const effStart = advisoryDraftStart ? advisoryDraftStart + 'Z' : null
                    const effEnd = (!advisoryDraftUfn && advisoryDraftEnd) ? advisoryDraftEnd + 'Z' : null
                    const startLabel = effStart ? formatZuluTime(new Date(effStart)) + 'Z' : 'Now'
                    const endLabel = effEnd ? formatZuluTime(new Date(effEnd)) + 'Z' : 'UFN'
                    const effSuffix = ` — EFF ${startLabel}–${endLabel}`
                    if (editingAdvisoryId) {
                      const existing = advisories.find(a => a.id === editingAdvisoryId)
                      logRunwayStatusChange({
                        oldAdvisoryType: existing?.type ?? null,
                        oldAdvisoryText: existing?.text ?? null,
                        newAdvisoryType: advisoryDraftType,
                        newAdvisoryText: advisoryDraftText.trim(),
                      }, installationId)
                      const wxNum = advisoryDraftNumber.trim() ? ` #${advisoryDraftNumber.trim().toUpperCase()}` : ''
                      if (installationId) logActivity('updated', 'weather_info', installationId, `WX-${advisoryDraftType.toUpperCase()}${wxNum}`, { details: `WEATHER ${advisoryDraftType.toUpperCase()}${wxNum} UPDATED — ${advisoryDraftText.trim().toUpperCase()}${effSuffix}` }, installationId)
                      await updateAdvisory(editingAdvisoryId, advisoryDraftType, advisoryDraftText.trim(), effStart, effEnd, advisoryDraftNumber.trim() || null)
                    } else {
                      logRunwayStatusChange({
                        newAdvisoryType: advisoryDraftType,
                        newAdvisoryText: advisoryDraftText.trim(),
                      }, installationId)
                      const wxNumNew = advisoryDraftNumber.trim() ? ` #${advisoryDraftNumber.trim().toUpperCase()}` : ''
                      if (installationId) logActivity('created', 'weather_info', installationId, `WX-${advisoryDraftType.toUpperCase()}${wxNumNew}`, { details: `WEATHER ${advisoryDraftType.toUpperCase()}${wxNumNew} ISSUED — ${advisoryDraftText.trim().toUpperCase()}${effSuffix}` }, installationId)
                      await addAdvisory(advisoryDraftType, advisoryDraftText.trim(), effStart, effEnd, advisoryDraftNumber.trim() || null)
                    }
                  }
                  setAdvisoryDialogOpen(false)
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)',
                  background: 'rgba(52,211,153,0.15)', color: 'var(--color-success)',
                }}
              >Save</button>
              <button
                onClick={() => setAdvisoryDialogOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setNavaidDialog(null) }}
          style={{ padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 380,
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
                      flex: 1, padding: '12px 4px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
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
                      flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
                      flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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

      {/* Custom Status Item dialog */}
      {customItemDialog && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setCustomItemDialog(null) }}
          style={{ padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 380,
              border: '1px solid var(--color-border-mid)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 2 }}>
              {customItemDialog.item.item_name}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
              {customItemDialog.boardName}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['green', 'yellow', 'red'] as const).map((s) => {
                const selected = customItemDialog.selectedStatus === s
                const color = s === 'red' ? 'var(--color-danger)' : s === 'yellow' ? 'var(--color-warning)' : 'var(--color-success)'
                const label = s === 'red' ? 'RED' : s === 'yellow' ? 'YELLOW' : 'GREEN'
                return (
                  <button
                    key={s}
                    onClick={() => setCustomItemDialog({ ...customItemDialog, selectedStatus: s })}
                    style={{
                      flex: 1, padding: '12px 4px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: 'pointer', textAlign: 'center',
                      border: selected ? `2px solid ${color}` : '1px solid var(--color-border-mid)',
                      background: selected ? `${STATUS_HEX[s]}20` : 'var(--color-bg-inset)',
                      color: selected ? color : 'var(--color-text-3)',
                    }}
                  >{label}</button>
                )
              })}
            </div>
            {customItemDialog.selectedStatus !== 'green' && (
              <textarea
                placeholder="Notes (optional)..."
                value={customItemDialog.notes}
                onChange={(e) => setCustomItemDialog({ ...customItemDialog, notes: e.target.value })}
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none', marginBottom: 14,
                  fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
                }}
              />
            )}
            {(() => {
              const statusChanged = customItemDialog.selectedStatus !== customItemDialog.item.status
              const notesChanged = customItemDialog.notes !== (customItemDialog.item.notes || '')
              const hasChanges = statusChanged || notesChanged
              const selColor = customItemDialog.selectedStatus === 'red' ? 'var(--color-danger)' : customItemDialog.selectedStatus === 'yellow' ? 'var(--color-warning)' : 'var(--color-success)'
              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const { item, boardName, selectedStatus, notes } = customItemDialog
                      if (statusChanged) {
                        handleCustomItemToggle(item, boardName, selectedStatus, notes || undefined)
                      } else if (notesChanged) {
                        setCustomItemNotes(prev => ({ ...prev, [item.id]: notes }))
                        handleCustomItemNotesSave(item, boardName, notes)
                      }
                      setCustomItemDialog(null)
                    }}
                    disabled={!hasChanges}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                      cursor: hasChanges ? 'pointer' : 'not-allowed',
                      border: `1px solid ${hasChanges ? selColor : 'var(--color-border-mid)'}`,
                      background: 'var(--color-bg-inset)',
                      color: hasChanges ? selColor : 'var(--color-text-3)',
                      opacity: hasChanges ? 1 : 0.5,
                    }}
                  >Save</button>
                  <button
                    onClick={() => setCustomItemDialog(null)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDialog(null) }}
          style={{ padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 380,
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
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none', marginBottom: 14,
                fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
              }}
            />
            {confirmDialog.showEstimatedResume && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 6 }}>
                  Estimated Resume Time (local, optional) — DAFMAN 6.2.2
                </div>
                <input
                  type="datetime-local"
                  value={confirmDialog.estimatedResumeAt || ''}
                  onChange={(e) => setConfirmDialog({ ...confirmDialog, estimatedResumeAt: e.target.value })}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                    color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  confirmDialog.onConfirm(confirmDialog.notes.trim(), confirmDialog.estimatedResumeAt)
                  setConfirmDialog(null)
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: `1px solid ${confirmDialog.color}`,
                  background: 'var(--color-bg-inset)', color: confirmDialog.color,
                }}
              >Confirm</button>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setRscDialogOpen(false) }}
          style={{ padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 380,
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
                    flex: 1, padding: '12px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-lg)', fontWeight: 700,
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
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
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
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-accent)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-accent)',
                  opacity: rscDraftValue ? 1 : 0.4,
                }}
                disabled={!rscDraftValue}
              >Confirm</button>
              <button
                onClick={() => setRscDialogOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setBwcDialogOpen(false) }}
          style={{ padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 380,
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
                      padding: '12px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-lg)', fontWeight: 700,
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
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
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
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-accent)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-accent)',
                  opacity: bwcDraftValue ? 1 : 0.4,
                }}
                disabled={!bwcDraftValue}
              >Confirm</button>
              <button
                onClick={() => setBwcDialogOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Airfield Status Sections ===== */}
      {(() => {
        // Group custom boards by section
        const boardsBySection: Record<string, typeof customBoards> = { runway: [], navaid: [], arff: [], standalone: [] }
        for (const b of customBoards) {
          const sec = (b as any).section || 'standalone'
          if (!boardsBySection[sec]) boardsBySection[sec] = []
          boardsBySection[sec].push(b)
        }

        // Render a custom board card (reused across sections)
        const renderBoardCard = (board: typeof customBoards[0]) => {
          const boardItems = customItems.filter(i => i.board_id === board.id)
          const BOARD_LABELS: Record<string, string> = { green: 'G', yellow: 'Y', red: 'R' }
          return (
            <div key={board.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 0', minWidth: 140 }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{board.board_name}</div>
              {boardItems.length === 0 ? (
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', textAlign: 'center' }}>No items configured</div>
                </div>
              ) : (
                <div className="card" style={{ padding: '8px 12px 4px' }}>
                  {boardItems.map(item => (
                    <div key={item.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 500, color: 'var(--color-text-2)', flex: 1 }}>{item.item_name}</span>
                        <button
                          onClick={() => setCustomItemDialog({ item, boardName: board.board_name, selectedStatus: item.status, notes: customItemNotes[item.id] || '' })}
                          style={{
                            width: 36, height: 28, borderRadius: 'var(--radius-sm)',
                            border: `2px solid ${STATUS_COLORS[item.status]}`,
                            background: `${STATUS_HEX[item.status]}20`,
                            cursor: 'pointer', fontSize: 'var(--fs-base)', fontWeight: 700,
                            color: STATUS_COLORS[item.status], textTransform: 'uppercase', padding: 0,
                          }}
                        >{BOARD_LABELS[item.status] || 'G'}</button>
                      </div>
                      {(item.status === 'yellow' || item.status === 'red') && (
                        <textarea
                          placeholder="Add note..."
                          value={customItemNotes[item.id] || ''}
                          onChange={(e) => setCustomItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => handleCustomItemNotesSave(item, board.board_name)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleCustomItemNotesSave(item, board.board_name) }}
                          rows={1}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'var(--color-bg-inset)',
                            border: `1px solid ${STATUS_HEX[item.status]}40`,
                            borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-lg)',
                            color: 'var(--color-text-1)', outline: 'none', resize: 'none', overflow: 'hidden',
                            fontFamily: 'inherit', fieldSizing: 'content' as unknown as undefined, minHeight: 32,
                          }}
                          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                          onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        }

        // Inline-editable label — click to rename (admins only)
        const renderEditableLabel = (key: string, defaultText: string, style: Record<string, any>) => {
          const displayText = statusLabels[key] || defaultText
          if (editingLabel === key) {
            return (
              <input
                autoFocus
                value={editingLabelValue}
                onChange={e => setEditingLabelValue(e.target.value)}
                onBlur={() => saveStatusLabel(key, editingLabelValue.trim() || defaultText)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveStatusLabel(key, editingLabelValue.trim() || defaultText)
                  if (e.key === 'Escape') setEditingLabel(null)
                }}
                style={{
                  ...style,
                  background: 'var(--color-bg-inset)',
                  border: '1px solid var(--color-cyan)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box' as const,
                }}
              />
            )
          }
          return (
            <div
              onClick={canEditLabels ? () => { setEditingLabel(key); setEditingLabelValue(displayText) } : undefined}
              style={{
                ...style,
                cursor: canEditLabels ? 'pointer' : 'default',
                ...(canEditLabels ? { borderBottom: '1px dashed transparent' } : {}),
              }}
              title={canEditLabels ? 'Click to rename' : undefined}
            >
              {displayText}
            </div>
          )
        }

        // Inner grid for cards within each section container
        const sectionRowStyle = {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 8,
          alignItems: 'start',
        }

        // Section container card style
        const sectionCardStyle = {
          flex: '1 1 280px',
          minWidth: 0,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 12px',
        }

        const sectionHeaderStyle = {
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          color: 'var(--color-text-2)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          marginBottom: 6,
          paddingBottom: 4,
          borderBottom: '1px solid rgba(56,189,248,0.20)',
        }

        return (<>
      {/* ── Status Sections — side-by-side on desktop, stacked on mobile ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>

      {/* ── RUNWAY STATUS ──
          Promoted with an accent left border + elevated background so
          the operational vital signs (active runway / RSC / BWC) read
          as the most weighty zone on the page. NAVAID + ARFF stay on
          the calmer default sectionCardStyle. */}
      <div style={{
        ...sectionCardStyle,
        background: 'var(--color-bg-elevated)',
        borderLeft: '3px solid var(--color-accent)',
      }}>
        {renderEditableLabel('section_runway', 'Runway Status', sectionHeaderStyle)}
        <div style={sectionRowStyle}>
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

        return (<>
            {rwyEntries.map((rwy) => {
              const c = getColors(rwy.status)
              return (
                <div key={rwy.label} className="card" style={{
                  padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  background: c.bg, border: `1px solid ${c.border}`,
                }}>
                  <div style={{
                    fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>Active RWY</div>
                  <button
                    disabled={!canWriteAirfieldStatus}
                    onClick={() => {
                      if (!canWriteAirfieldStatus) return
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
                      padding: 'var(--rwy-btn-padding)', borderRadius: 'var(--radius-md)', fontSize: 'var(--rwy-btn-font)', fontWeight: 800,
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
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px',
                      textAlign: 'center',
                      lineHeight: 1.3,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}>
                      {rwy.remarks}
                    </div>
                  )}
                  {(rwy as { estimated_resume_at?: string | null }).estimated_resume_at && (rwy.status === 'suspended' || rwy.status === 'closed') && (
                    <div style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--color-text-3)',
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}>
                      Est. resume: {formatZuluDateTime(new Date((rwy as { estimated_resume_at: string }).estimated_resume_at))}
                    </div>
                  )}
                  <select
                    value={runways.length > 0 ? rwy.status : runwayStatus}
                    disabled={!canWriteAirfieldStatus}
                    onChange={(e) => {
                      if (!canWriteAirfieldStatus) return
                      const val = e.target.value as 'open' | 'suspended' | 'closed'
                      const currentVal = runways.length > 0 ? rwy.status : runwayStatus
                      if (val === currentVal) return
                      const statusColor = val === 'closed' ? 'var(--color-danger)' : val === 'suspended' ? 'var(--color-warning)' : 'var(--color-success)'
                      setConfirmDialog({
                        title: 'Change Runway Status',
                        message: `Change RWY ${rwy.active_end} status from ${currentVal.toUpperCase()} to ${val.toUpperCase()}?`,
                        color: statusColor,
                        notes: '',
                        showEstimatedResume: val !== 'open',
                        estimatedResumeAt: '',
                        onConfirm: (remarks, estimatedResumeAt) => {
                          const resumeIso = estimatedResumeAt ? new Date(estimatedResumeAt).toISOString() : null
                          if (runways.length > 0) {
                            setRunwayStatusForRunway(rwy.label, val, remarks || null, resumeIso)
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
                      padding: 'var(--rwy-select-padding)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
          {/* RSC / RCR + BWC — secondary vital signs. Smaller chrome
              than the active-runway button so the runway stays the
              dominant element in the band. Values still mono. */}
          {rcrValue ? (
            <div className="card" style={{
              padding: '6px 10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              border: '1px solid rgba(34,211,238,0.25)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-cyan)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>RCR</div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, fontFamily: 'monospace', color: 'var(--color-accent)', lineHeight: 1 }}>{rcrValue}</div>
              {rcrCondition && (
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>{RCR_CONDITION_TYPES.find(c => c.value === rcrCondition)?.label || rcrCondition}</div>
              )}
            </div>
          ) : (
            <div className="card" onClick={canEditRscBwc ? () => { setRscDraftValue(rscCondition); setRscDraftNotes(''); setRscDialogOpen(true) } : undefined}
              style={{
                padding: '6px 10px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                cursor: canEditRscBwc ? 'pointer' : 'default', textAlign: 'center',
              }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>RSC</div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-accent)', lineHeight: 1 }}>
                {rscCondition || '—'}
              </div>
            </div>
          )}
          {(() => {
            const bwcAlert = bwcValue === 'SEV' || bwcValue === 'PROHIB'
            const bwcMod = bwcValue === 'MOD'
            const bwcColor = bwcAlert ? 'var(--color-danger)' : bwcMod ? 'var(--color-warning)' : 'var(--color-success)'
            return (
              <div className="card" onClick={canEditRscBwc ? () => { setBwcDraftValue(bwcValue); setBwcDraftNotes(''); setBwcDialogOpen(true) } : undefined}
                style={{
                  padding: '6px 10px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  cursor: canEditRscBwc ? 'pointer' : 'default', textAlign: 'center',
                  // BWC at MOD/SEV/PROHIB earns alert chrome — calm at LOW,
                  // urgent above. The colored border + tint is the only
                  // signal we need; no extra label or icon noise.
                  border: bwcAlert || bwcMod ? `1px solid ${bwcColor}55` : undefined,
                  background: bwcAlert ? 'rgba(239,68,68,0.06)' : bwcMod ? 'rgba(251,191,36,0.06)' : undefined,
                }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>BWC</div>
                <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: bwcColor, lineHeight: 1 }}>
                  {bwcValue || '—'}
                </div>
              </div>
            )
          })()}
        </>)
      })()}
      {boardsBySection.runway.map(b => renderBoardCard(b))}
        </div>
      </div>

      {/* ── NAVAID STATUS ── */}
      <div style={sectionCardStyle}>
        {renderEditableLabel('section_navaid', 'NAVAID Status', sectionHeaderStyle)}
        <div style={sectionRowStyle}>

      {/* ARFF Aircraft Readiness Dialog */}
      {arffDialog && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setArffDialog(null) }}
          style={{ padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 380,
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
                { key: 'critical', label: 'Critical', color: 'var(--color-orange)', hex: '#f97316' },
                { key: 'inadequate', label: 'Inadequate', color: 'var(--color-danger)', hex: '#EF4444' },
              ] as const).map(({ key, label, color, hex }) => {
                const selected = arffDialog.selectedStatus === key
                return (
                  <button
                    key={key}
                    onClick={() => setArffDialog({ ...arffDialog, selectedStatus: key })}
                    style={{
                      padding: '12px 4px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
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
                critical: 'var(--color-orange)', inadequate: 'var(--color-danger)',
              }
              const selColor = ARFF_SEL_COLORS[arffDialog.selectedStatus]
              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const { aircraft, selectedStatus, notes } = arffDialog
                      const prev = arffStatuses[aircraft] ?? null
                      setArffStatusForAircraft(aircraft, selectedStatus)
                      if (installationId) {
                        logActivity('updated', 'arff_status', installationId, `${aircraft} ${selectedStatus.toUpperCase()}`, { details: `REPORTS ${aircraft.toUpperCase()} ${selectedStatus.toUpperCase()}${notes.trim() ? `. ${notes.trim().toUpperCase()}` : ''}` }, installationId)
                        logArffStatusChange({
                          aircraftName: aircraft,
                          oldReadiness: prev,
                          newReadiness: selectedStatus,
                          reason: notes.trim() || null,
                        }, installationId)
                      }
                      setArffDialog(null)
                    }}
                    disabled={!hasChanges}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
                      flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
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
                  <span style={{
                    fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-3)',
                    letterSpacing: '0.04em', flex: 1,
                  }}>
                    {getNavaidDisplayName(n.navaid_name)}
                  </span>
                  <button
                    disabled={!canWriteAirfieldStatus}
                    onClick={canWriteAirfieldStatus ? () => {
                      setNavaidDialog({ navaid: n, selectedStatus: n.status as 'green' | 'yellow' | 'red', notes: navaidNotes[n.id] || '' })
                    } : undefined}
                    style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${STATUS_COLORS[n.status]}`,
                      background: `${STATUS_HEX[n.status]}22`,
                      cursor: canWriteAirfieldStatus ? 'pointer' : 'default', fontSize: 'var(--fs-base)', fontWeight: 800,
                      color: STATUS_COLORS[n.status], textTransform: 'uppercase', padding: 0,
                      letterSpacing: 0, lineHeight: 1,
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
                      borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-lg)',
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
                    {renderEditableLabel(`navaid_rwy_${group.designator}`, `RWY ${group.designator}`, { fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 8, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' })}
                    {group.items.map(renderNavaidItem)}
                  </div>
                ))}
                {otherNavaids.length > 0 && (
                  <div className="card" style={{ padding: '8px 12px 4px' }}>
                    {renderEditableLabel('navaid_other', 'OTHER', { fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 8, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' })}
                    {otherNavaids.map(renderNavaidItem)}
                  </div>
                )}
            </>)
          })()}
      {boardsBySection.navaid.map(b => renderBoardCard(b))}
        </div>
      </div>

      {/* ── ARFF STATUS ── */}
      <div style={sectionCardStyle}>
        {renderEditableLabel('section_arff', 'ARFF Status', sectionHeaderStyle)}
        <div style={sectionRowStyle}>
          {/* ARFF CAT card — hidden per Base Setup → ARFF → Show CAT toggle */}
          {showArffCat && (
          <div className="card" style={{
            padding: '8px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <div style={{
              fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>CAT</div>
            <select
              value={arffCat ?? ''}
              disabled={!canWriteAirfieldStatus}
              onChange={(e) => {
                if (!canWriteAirfieldStatus) return
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
                      logArffStatusChange({ oldCat: current, newCat: val, reason: remarks || null }, installationId)
                    }
                  },
                })
                // Reset select to current value — changes after confirm
                e.target.value = String(current ?? '')
              }}
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-2xl)', fontWeight: 800,
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
          )}

          {/* Aircraft readiness cards — tiered by readiness so off-nominal
              states pop. Optimum reads as calm reassurance; reduced gets
              a warning hue; critical and inadequate get heavier left
              borders + elevated background tint, with INADEQUATE picking
              up an AlertTriangle prefix because it's the only state that
              means "ARFF cannot meet mission". */}
          {arffAircraft.map(aircraft => {
            const readiness = (arffStatuses[aircraft] ?? 'optimum') as 'inadequate' | 'critical' | 'reduced' | 'optimum'
            const ARFF_COLORS: Record<string, { color: string; bg: string; border: string; tint: string }> = {
              optimum: { color: 'var(--color-success)', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.20)', tint: 'rgba(52,211,153,0.10)' },
              reduced: { color: 'var(--color-warning)', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.30)', tint: 'rgba(251,191,36,0.14)' },
              critical: { color: 'var(--color-orange)', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.40)', tint: 'rgba(249,115,22,0.18)' },
              inadequate: { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.50)', tint: 'rgba(239,68,68,0.20)' },
            }
            const c = ARFF_COLORS[readiness]
            const heavyTier = readiness === 'critical' || readiness === 'inadequate'
            return (
              <div
                key={aircraft}
                className="card"
                onClick={canWriteAirfieldStatus ? () => setArffDialog({ aircraft, selectedStatus: readiness, notes: '' }) : undefined}
                style={{
                  padding: '8px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  cursor: canWriteAirfieldStatus ? 'pointer' : 'default',
                  background: heavyTier ? c.tint : c.bg,
                  border: `1px solid ${c.border}`,
                  borderLeft: heavyTier ? `3px solid ${c.color}` : `1px solid ${c.border}`,
                }}
              >
                <div style={{
                  fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'monospace',
                  color: 'var(--color-text-1)', letterSpacing: '0.04em',
                }}>{aircraft}</div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 'var(--fs-sm)', fontWeight: 800, color: c.color,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {readiness === 'inadequate' && <AlertOctagon size={12} strokeWidth={2.5} />}
                  {readiness}
                </div>
              </div>
            )
          })}
      {boardsBySection.arff.map(b => renderBoardCard(b))}
        </div>
      </div>

      {/* ── STANDALONE BOARDS ── */}
      {boardsBySection.standalone.map(b => (
        <div key={b.id} style={sectionCardStyle}>
          {renderBoardCard(b)}
        </div>
      ))}

      </div>{/* end sections flex row */}

      </>)
      })()}

      {/* ===== Personnel / Construction / Misc (inline row on desktop) ===== */}
      <div className="bottom-info-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>

      <div>
      {/* ===== Personnel on Airfield ===== */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid rgba(56,189,248,0.20)',
      }}>
        <span style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Personnel on Airfield
          {activeContractors.length > 0 && (
            <span style={{ color: 'var(--color-text-3)', fontWeight: 600, marginLeft: 8 }}>
              · {activeContractors.length}
            </span>
          )}
        </span>
        <button
          onClick={() => router.push('/contractors')}
          style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          View All →
        </button>
      </div>
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
              <div key={c.id} className="card" style={{ padding: '12px 14px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Header: Callsign (or company fallback) + status badge + day counter.
                        Drops the form-style LABEL: value layout in favor of a scannable
                        status row — name dominant, supporting facts as compact chips. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)',
                        fontFamily: c.callsign ? 'monospace' : 'inherit', letterSpacing: c.callsign ? '0.03em' : 0,
                      }}>
                        {c.callsign || c.company_name}
                      </span>
                      <span style={{
                        fontSize: 'var(--fs-2xs)', fontWeight: 700,
                        color: cfg.color, background: cfg.bg,
                        padding: '1px 8px', borderRadius: 'var(--radius-md)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>
                        Day {daysSinceStart}
                      </span>
                    </div>

                    {/* Body row 1: Company · Contact (no labels — context is enough) */}
                    {c.callsign && (
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 600 }}>{c.company_name}</span>
                        {c.contact_name && (
                          <>
                            <span style={{ color: 'var(--color-text-3)' }}>·</span>
                            <span style={{ color: 'var(--color-text-3)' }}>{c.contact_name}</span>
                          </>
                        )}
                      </div>
                    )}
                    {!c.callsign && c.contact_name && (
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                        {c.contact_name}
                      </div>
                    )}

                    {/* Body row 2: Location chip · Work chip — visually
                        groups the "where + what" into one scan band. */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-2)',
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                      }}>{c.location}</span>
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-2)',
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                      }}>{c.work_description}</span>
                      {c.radio_number && (
                        <span style={{
                          fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
                          padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                          fontFamily: 'monospace',
                        }}>RADIO {c.radio_number}</span>
                      )}
                      {c.flag_number && (
                        <span style={{
                          fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
                          padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                          fontFamily: 'monospace',
                        }}>FLAG {c.flag_number}</span>
                      )}
                    </div>

                    {/* Footer: Started date dim. Notes (if any) below in italic. */}
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Started {formatZuluDate(new Date(c.start_date))}
                    </div>
                    {c.notes && (
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
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
                      color: 'var(--color-status-pass)',
                      border: '1px solid rgba(34,197,94,0.4)',
                      borderRadius: 'var(--radius-md)',
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid rgba(56,189,248,0.20)',
      }}>
        <span style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Construction / Closures
        </span>
        {canWriteAirfieldStatus && (
          <button
            onClick={() => { setConstructionDraft(constructionRemarks || ''); setEditingConstruction(true) }}
            style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            {constructionRemarks ? 'Edit' : 'Add'}
          </button>
        )}
      </div>
      <div className="card" style={{ padding: '10px 14px', textAlign: 'left', marginBottom: 12 }}>
        {(() => {
          // Best-effort parse of the free-text remarks into structured
          // rows. Pattern recognized: optional leading "<digit>." then
          // a LOCATION segment ending in ":" then work text on the
          // next non-blank line(s). Anything we can't parse falls
          // back to plain pre-wrap so user formatting always survives.
          type Item = { location: string; work: string }
          const items: Item[] = []
          if (constructionRemarks) {
            const blocks = constructionRemarks.split(/\n\s*\n+/)
            for (const block of blocks) {
              const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
              if (lines.length === 0) continue
              const headMatch = lines[0].match(/^\s*(?:\d+[.)]\s*)?(.+?):\s*$/)
              if (headMatch && lines.length >= 2) {
                items.push({ location: headMatch[1].trim(), work: lines.slice(1).join(' ').trim() })
              } else {
                // Single-line "LOCATION: work" form
                const inlineMatch = lines[0].match(/^\s*(?:\d+[.)]\s*)?(.+?):\s+(.+)$/)
                if (inlineMatch) {
                  items.push({ location: inlineMatch[1].trim(), work: inlineMatch[2].trim() })
                }
              }
            }
          }
          // Free-text fell through the parser — render it as-is and
          // skip the structured add (the user is mid-edit in the
          // bulk-edit flow; let them finish there).
          if (constructionRemarks && items.length === 0) {
            return <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{constructionRemarks}</div>
          }

          const handleSaveNewItem = () => {
            const loc = newConstructionLocation.trim()
            const work = newConstructionWork.trim()
            if (!loc || !work) return
            const entry = `${loc.toUpperCase()}: ${work}`
            const next = constructionRemarks ? `${constructionRemarks}\n\n${entry}` : entry
            setConstructionRemarks(next)
            setNewConstructionLocation('')
            setNewConstructionWork('')
            setAddingConstruction(false)
          }
          const handleCancelNewItem = () => {
            setNewConstructionLocation('')
            setNewConstructionWork('')
            setAddingConstruction(false)
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 'var(--fs-2xs)', fontWeight: 700, fontFamily: 'monospace',
                    color: 'var(--color-warning)', letterSpacing: '0.04em', textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.35)',
                    whiteSpace: 'nowrap',
                  }}>{it.location}</span>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>
                    {it.work}
                  </span>
                </div>
              ))}

              {items.length === 0 && !addingConstruction && (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', textAlign: 'center', padding: '4px 0' }}>None</div>
              )}

              {/* Inline structured add — appends one LOCATION: work
                  entry to the underlying free-text remarks. The bulk
                  Edit flow remains available via the section-header
                  Edit/Add link for free-form changes. */}
              {canWriteAirfieldStatus && !addingConstruction && (
                <button
                  type="button"
                  onClick={() => setAddingConstruction(true)}
                  style={{
                    alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginTop: items.length > 0 ? 4 : 0,
                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                    border: '1px dashed rgba(56,189,248,0.40)', background: 'transparent',
                    color: 'var(--color-accent)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Plus size={11} strokeWidth={2.5} />
                  Add Item
                </button>
              )}

              {canWriteAirfieldStatus && addingConstruction && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  marginTop: items.length > 0 ? 4 : 0,
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      autoFocus
                      value={newConstructionLocation}
                      onChange={(e) => setNewConstructionLocation(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNewItem()
                        if (e.key === 'Escape') handleCancelNewItem()
                      }}
                      placeholder="LOCATION (e.g. HANGAR 4)"
                      style={{
                        flex: '1 1 140px', minWidth: 0,
                        padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-mid)',
                        background: 'var(--color-bg)', color: 'var(--color-warning)',
                        fontFamily: 'monospace', fontSize: 'var(--fs-xs)', fontWeight: 700,
                        letterSpacing: '0.04em', textTransform: 'uppercase', outline: 'none',
                      }}
                    />
                    <input
                      value={newConstructionWork}
                      onChange={(e) => setNewConstructionWork(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNewItem()
                        if (e.key === 'Escape') handleCancelNewItem()
                      }}
                      placeholder="Work description"
                      style={{
                        flex: '2 1 200px', minWidth: 0,
                        padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-mid)',
                        background: 'var(--color-bg)', color: 'var(--color-text-1)',
                        fontSize: 'var(--fs-sm)', fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleCancelNewItem}
                      style={{
                        padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-mid)', background: 'transparent',
                        color: 'var(--color-text-3)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >Cancel</button>
                    <button
                      type="button"
                      onClick={handleSaveNewItem}
                      disabled={!newConstructionLocation.trim() || !newConstructionWork.trim()}
                      style={{
                        padding: '3px 12px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(56,189,248,0.40)',
                        background: 'rgba(56,189,248,0.10)',
                        color: 'var(--color-accent)', fontSize: 'var(--fs-2xs)', fontWeight: 800,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        cursor: newConstructionLocation.trim() && newConstructionWork.trim() ? 'pointer' : 'not-allowed',
                        opacity: newConstructionLocation.trim() && newConstructionWork.trim() ? 1 : 0.5,
                        fontFamily: 'inherit',
                      }}
                    >Save</button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      </div>

      <div>
      {/* ===== Miscellaneous Info ===== */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid rgba(56,189,248,0.20)',
      }}>
        <span style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Miscellaneous Info
        </span>
        {canWriteAirfieldStatus && (
          <button
            onClick={() => { setMiscDraft(miscRemarks || ''); setEditingMisc(true) }}
            style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            {miscRemarks ? 'Edit' : 'Add'}
          </button>
        )}
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

      {/* ===== Today's PPRs =====
          Column set intentionally mirrors the slim PPR Log on /ppr:
          PPR # / Status / Arrival Date / Callsign / Aircraft Type.
          Anything else (requester, all admin columns, notes, coord,
          remarks) lives in the detail view on /ppr. */}
      {pprColumns.length > 0 && (() => {
        // Custom columns the admin chose to surface on this panel.
        // info_only is excluded — it would render as a wall of text in
        // a row. The legacy isSummaryColumn() check has been retired
        // in favor of the explicit show_on_status flag set in Base
        // Setup → PPR Columns.
        const summaryCols = pprColumns.filter(
          (c) => c.show_on_status && c.column_type !== 'info_only',
        )
        const ppPanelTh: React.CSSProperties = {
          padding: '6px 8px', textAlign: 'center', fontWeight: 700,
          color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
        }
        const ppPanelTd: React.CSSProperties = {
          padding: '6px 8px', color: 'var(--color-text-1)',
          whiteSpace: 'nowrap', textAlign: 'center',
        }
        // Compact status pill \u2014 single source of styling for the four
        // statuses that can show on a "today's" board.
        const statusMeta: Record<string, { label: string; bg: string; fg: string; border: string }> = {
          approved:               { label: 'Approved',  bg: 'rgba(34,197,94,0.10)',  fg: '#22c55e', border: 'rgba(34,197,94,0.4)' },
          pending_amops_approval: { label: 'Pending',   bg: 'rgba(245,158,11,0.10)', fg: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
          pending_coordination:   { label: 'Coord',     bg: 'rgba(56,189,248,0.10)', fg: '#38bdf8', border: 'rgba(56,189,248,0.4)' },
          pending_amops_triage:   { label: 'Triage',    bg: 'rgba(167,139,250,0.10)',fg: '#a78bfa', border: 'rgba(167,139,250,0.4)' },
          denied:                 { label: 'Denied',    bg: 'rgba(239,68,68,0.10)',  fg: '#ef4444', border: 'rgba(239,68,68,0.4)' },
          canceled:               { label: 'Canceled',  bg: 'rgba(148,163,184,0.10)',fg: '#94a3b8', border: 'rgba(148,163,184,0.4)' },
        }
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid rgba(56,189,248,0.20)',
            }}>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Prior Permission Required
                <span style={{ color: 'var(--color-text-3)', fontWeight: 600, marginLeft: 8 }}>
                  · {todayPprs.length}
                </span>
              </span>
              <button
                onClick={() => router.push('/ppr')}
                style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              >
                View All &rarr;
              </button>
            </div>
            {todayPprs.length === 0 ? (
              <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No PPRs for today</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <table style={{ width: 'auto', minWidth: 'min(100%, 720px)', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-inset)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={ppPanelTh}>PPR #</th>
                      <th style={ppPanelTh}>Status</th>
                      <th style={ppPanelTh}>Arrival Date</th>
                      {summaryCols.map(col => (
                        <th key={col.id} style={ppPanelTh}>{col.column_name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayPprs.map(entry => {
                      const meta = statusMeta[entry.status] ?? statusMeta.approved
                      const canceled = entry.status === 'canceled'
                      return (
                        <tr
                          key={entry.id}
                          style={{
                            borderBottom: '1px solid var(--color-border)',
                            textDecoration: canceled ? 'line-through' : undefined,
                            opacity: canceled ? 0.55 : 1,
                          }}
                        >
                          <td style={{ ...ppPanelTd, fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                            {entry.ppr_number}
                          </td>
                          <td style={ppPanelTd}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                              fontSize: 'var(--fs-xs)', fontWeight: 700,
                              background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}`,
                              textTransform: 'uppercase', letterSpacing: '0.03em',
                            }}>
                              {meta.label}
                            </span>
                          </td>
                          <td style={ppPanelTd}>{formatZuluDate(entry.arrival_date + 'T00:00:00Z')}</td>
                          {summaryCols.map(col => {
                            const formatted = formatPprColumnValue(
                              col,
                              (entry.column_values || {})[col.id],
                              { tz: baseTimezone },
                            )
                            return (
                              <td key={col.id} style={ppPanelTd}>
                                {formatted || '\u2014'}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* Construction/Closures edit dialog */}
      {editingConstruction && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingConstruction(false) }}
          style={{ padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 440, border: '1px solid var(--color-border-mid)' }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>Construction / Closures</div>
            <textarea
              value={constructionDraft}
              onChange={(e) => setConstructionDraft(e.target.value)}
              placeholder="Enter construction activity, closures, or restrictions..."
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)', color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', outline: 'none', marginBottom: 14, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {constructionRemarks && (
                <button
                  onClick={() => { setConstructionRemarks(null); setEditingConstruction(false) }}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
                >Clear</button>
              )}
              <button
                onClick={() => { setConstructionRemarks(constructionDraft.trim() || null); setEditingConstruction(false) }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.15)', color: 'var(--color-success)' }}
              >Save</button>
              <button
                onClick={() => setEditingConstruction(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border-mid)', background: 'var(--color-bg-inset)', color: 'var(--color-text-3)' }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Miscellaneous Info edit dialog */}
      {editingMisc && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingMisc(false) }}
          style={{ padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 440, border: '1px solid var(--color-border-mid)' }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>Miscellaneous Info</div>
            <textarea
              value={miscDraft}
              onChange={(e) => setMiscDraft(e.target.value)}
              placeholder="Enter miscellaneous information or notes..."
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)', color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', outline: 'none', marginBottom: 14, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {miscRemarks && (
                <button
                  onClick={() => { setMiscRemarks(null); setEditingMisc(false) }}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
                >Clear</button>
              )}
              <button
                onClick={() => { setMiscRemarks(miscDraft.trim() || null); setEditingMisc(false) }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.15)', color: 'var(--color-success)' }}
              >Save</button>
              <button
                onClick={() => setEditingMisc(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border-mid)', background: 'var(--color-bg-inset)', color: 'var(--color-text-3)' }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
