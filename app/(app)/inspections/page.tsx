'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  AIRFIELD_INSPECTION_SECTIONS,
  LIGHTING_INSPECTION_SECTIONS,
  BWC_OPTIONS,
  INSPECTION_PERSONNEL,
  type InspectionSection,
} from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { fetchInspections, createInspection, getInspectorName, type InspectionRow } from '@/lib/supabase/inspections'
import { fetchCurrentWeather } from '@/lib/weather'
import {
  loadDraft,
  saveDraftToStorage,
  clearDraft,
  createNewDraft,
  type DailyInspectionDraft,
  type InspectionHalfDraft,
} from '@/lib/inspection-draft'
import { DEMO_INSPECTIONS } from '@/lib/demo-data'
import type { InspectionItem } from '@/lib/supabase/types'

type BwcValue = null | (typeof BWC_OPTIONS)[number]
type TabType = 'airfield' | 'lighting'

export default function InspectionsPage() {
  const router = useRouter()

  // ── Core state ──
  const [draft, setDraft] = useState<DailyInspectionDraft | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('airfield')
  const [draftLoaded, setDraftLoaded] = useState(false)
  const autoBeginHandled = useRef(false)

  // ── History state ──
  const [liveInspections, setLiveInspections] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showHistory, setShowHistory] = useState(false)

  // ── Sync showHistory from URL (handles client-side navigation) ──
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'history') {
      setShowHistory(true)
    }
  }, [])

  // ── Action state ──
  const [saving, setSaving] = useState(false)
  const [filing, setFiling] = useState(false)

  // ── Load draft from localStorage on mount ──
  useEffect(() => {
    const stored = loadDraft()
    if (stored) setDraft(stored)
    setDraftLoaded(true)
  }, [])

  // ── Auto-begin: if ?action=begin and no draft, create one ──
  useEffect(() => {
    if (!draftLoaded || autoBeginHandled.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'begin' && !draft) {
      autoBeginHandled.current = true
      const newDraft = createNewDraft()
      setDraft(newDraft)
      setActiveTab('airfield')
      saveDraftToStorage(newDraft)
      toast.success('New daily inspection started')
    }
  }, [draftLoaded, draft])

  // ── Load history ──
  const loadHistory = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }
    const data = await fetchInspections()
    setLiveInspections(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // ── Save draft to localStorage whenever it changes ──
  useEffect(() => {
    if (draft && draftLoaded) saveDraftToStorage(draft)
  }, [draft, draftLoaded])

  // ── Current half helpers ──
  const currentHalf: InspectionHalfDraft | null = draft ? draft[activeTab] : null
  const sections = activeTab === 'airfield' ? AIRFIELD_INSPECTION_SECTIONS : LIGHTING_INSPECTION_SECTIONS

  const visibleSections = useMemo(() => {
    if (!currentHalf) return []
    return sections.filter(
      (s) => !s.conditional || currentHalf.enabledConditionals[s.id]
    )
  }, [sections, currentHalf])

  const visibleItems = useMemo(() => {
    return visibleSections.flatMap((s) => s.items)
  }, [visibleSections])

  const totalItems = visibleItems.length
  const answeredCount = currentHalf
    ? visibleItems.filter((item) => {
        if (item.type === 'bwc') return currentHalf.bwcValue !== null
        return currentHalf.responses[item.id] != null
      }).length
    : 0
  const progress = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0

  const passedCount = currentHalf
    ? visibleItems.filter((item) => {
        if (item.type === 'bwc') return currentHalf.bwcValue !== null
        return currentHalf.responses[item.id] === 'pass'
      }).length
    : 0
  const failedCount = currentHalf
    ? visibleItems.filter((item) => currentHalf.responses[item.id] === 'fail').length
    : 0
  const naCount = currentHalf
    ? visibleItems.filter((item) => {
        if (item.type === 'bwc') return false
        return currentHalf.responses[item.id] === 'na'
      }).length
    : 0

  // ── Draft mutation helpers ──
  const updateHalf = (tab: TabType, updater: (h: InspectionHalfDraft) => InspectionHalfDraft) => {
    setDraft((prev) => {
      if (!prev) return prev
      return { ...prev, [tab]: updater(prev[tab]) }
    })
  }

  const toggle = (id: string) => {
    updateHalf(activeTab, (h) => {
      const current = h.responses[id]
      let next: 'pass' | 'fail' | 'na' | null = null
      if (current === null || current === undefined) next = 'pass'
      else if (current === 'pass') next = 'fail'
      else if (current === 'fail') next = 'na'
      return { ...h, responses: { ...h.responses, [id]: next } }
    })
  }

  const markAllPass = () => {
    updateHalf(activeTab, (h) => {
      const updated = { ...h.responses }
      visibleItems.forEach((item) => {
        if (item.type !== 'bwc') updated[item.id] = 'pass'
      })
      return { ...h, responses: updated }
    })
  }

  const setBwcValue = (val: BwcValue) => {
    updateHalf(activeTab, (h) => ({ ...h, bwcValue: h.bwcValue === val ? null : val }))
  }

  const setComment = (itemId: string, text: string) => {
    updateHalf(activeTab, (h) => ({ ...h, comments: { ...h.comments, [itemId]: text } }))
  }

  const setNotes = (text: string) => {
    updateHalf(activeTab, (h) => ({ ...h, notes: text }))
  }

  const toggleConditional = (sectionId: string) => {
    updateHalf(activeTab, (h) => {
      const newValue = !h.enabledConditionals[sectionId]
      // Mutually exclusive: if enabling one, disable the other
      const updated = { ...h.enabledConditionals, [sectionId]: newValue }
      if (newValue) {
        const other = sectionId === 'af-8' ? 'af-9' : 'af-8'
        updated[other] = false
      }
      return { ...h, enabledConditionals: updated }
    })
  }

  // Special mode: construction meeting or joint monthly replaces the checklist
  const isSpecialMode = activeTab === 'airfield' && currentHalf != null && (
    !!currentHalf.enabledConditionals['af-8'] || !!currentHalf.enabledConditionals['af-9']
  )
  const specialModeType: 'construction_meeting' | 'joint_monthly' | null = currentHalf?.enabledConditionals['af-8']
    ? 'construction_meeting'
    : currentHalf?.enabledConditionals['af-9']
    ? 'joint_monthly'
    : null
  const specialModeLabel = specialModeType === 'construction_meeting'
    ? 'Pre/Post Construction Inspection'
    : specialModeType === 'joint_monthly'
    ? 'Joint Monthly Airfield Inspection'
    : ''

  const setSpecialComment = (text: string) => {
    updateHalf(activeTab, (h) => ({ ...h, specialComment: text }))
  }

  const togglePersonnel = (person: string) => {
    updateHalf(activeTab, (h) => {
      const current = h.selectedPersonnel || []
      const names = h.personnelNames || {}
      const removing = current.includes(person)
      const next = removing
        ? current.filter((p) => p !== person)
        : [...current, person]
      // Clear the name when unchecking
      const nextNames = removing
        ? (({ [person]: _, ...rest }) => rest)(names)
        : names
      return { ...h, selectedPersonnel: next, personnelNames: nextNames }
    })
  }

  const setPersonnelName = (person: string, name: string) => {
    updateHalf(activeTab, (h) => ({
      ...h,
      personnelNames: { ...(h.personnelNames || {}), [person]: name },
    }))
  }

  const sectionDoneCount = (section: InspectionSection) =>
    currentHalf
      ? section.items.filter((item) => {
          if (item.type === 'bwc') return currentHalf.bwcValue !== null
          return currentHalf.responses[item.id] != null
        }).length
      : 0

  // ── Begin new inspection ──
  const handleBeginNew = () => {
    const newDraft = createNewDraft()
    setDraft(newDraft)
    setActiveTab('airfield')
    saveDraftToStorage(newDraft)
    toast.success('New daily inspection started')
  }

  // ── Save current tab (auto-captures weather + inspector) ──
  const handleSave = async () => {
    if (!draft || !currentHalf) return
    setSaving(true)

    // Auto-fetch weather
    const weather = await fetchCurrentWeather()

    // Auto-fetch inspector name from auth
    const inspector = await getInspectorName()
    const fallbackName = usingDemo ? 'Demo Inspector' : null

    updateHalf(activeTab, (h) => ({
      ...h,
      inspectorName: inspector.name || fallbackName,
      inspectorId: inspector.id,
      savedAt: new Date().toISOString(),
      weatherConditions: weather?.conditions || h.weatherConditions || null,
      temperatureF: weather?.temperature_f ?? h.temperatureF ?? null,
    }))

    setSaving(false)
    const label = activeTab === 'airfield' ? 'Airfield' : 'Lighting'
    toast.success(`${label} inspection saved`, {
      description: weather
        ? `${weather.conditions}, ${weather.temperature_f}°F`
        : 'Weather data unavailable',
    })
  }

  // ── File the daily inspection (write to Supabase) ──
  const handleFile = async () => {
    if (!draft) return
    const airfieldHalf = draft.airfield
    const lightingHalf = draft.lighting
    const airfieldSaved = !!airfieldHalf.savedAt
    const lightingSaved = !!lightingHalf.savedAt

    // Determine if airfield is in special mode
    const airfieldSpecialMode = !!airfieldHalf.enabledConditionals['af-8'] || !!airfieldHalf.enabledConditionals['af-9']
    const airfieldSpecialType: 'construction_meeting' | 'joint_monthly' | null =
      airfieldHalf.enabledConditionals['af-8'] ? 'construction_meeting'
      : airfieldHalf.enabledConditionals['af-9'] ? 'joint_monthly'
      : null

    if (!airfieldSaved && !lightingSaved) {
      toast.error('Save at least one inspection half before filing')
      return
    }

    setFiling(true)
    const groupId = draft.id
    let filed = 0
    let filedId: string | null = null

    // File airfield half
    if (airfieldSaved) {
      if (airfieldSpecialMode && airfieldSpecialType) {
        // ── Special mode: file as standalone construction_meeting or joint_monthly ──
        const { data: created, error } = await createInspection({
          inspection_type: airfieldSpecialType,
          inspector_name: airfieldHalf.inspectorName || 'Unknown',
          items: [],
          total_items: 0,
          passed_count: 0,
          failed_count: 0,
          na_count: 0,
          construction_meeting: airfieldSpecialType === 'construction_meeting',
          joint_monthly: airfieldSpecialType === 'joint_monthly',
          personnel: (airfieldHalf.selectedPersonnel || []).map((p) => {
            const name = airfieldHalf.personnelNames?.[p]
            return name ? `${p} — ${name}` : p
          }),
          bwc_value: null,
          weather_conditions: airfieldHalf.weatherConditions,
          temperature_f: airfieldHalf.temperatureF,
          notes: airfieldHalf.specialComment || null,
          // No daily_group_id — standalone record
        })
        if (error) {
          toast.error(`Failed to file ${airfieldSpecialType}: ${error}`)
        } else {
          filed++
          if (created && !filedId) filedId = created.id
        }
      } else {
        // ── Normal airfield inspection ──
        const secs = AIRFIELD_INSPECTION_SECTIONS
        const visSecs = secs.filter((s) => !s.conditional || airfieldHalf.enabledConditionals[s.id])
        const visItems = visSecs.flatMap((s) => s.items)

        const items: InspectionItem[] = visItems.map((item) => {
          const section = visSecs.find((s) => s.items.some((i) => i.id === item.id))
          const response = item.type === 'bwc'
            ? (airfieldHalf.bwcValue ? 'pass' : null)
            : (airfieldHalf.responses[item.id] ?? null)
          return {
            id: item.id,
            section: section?.title || '',
            item: item.item,
            response: response as 'pass' | 'fail' | 'na' | null,
            notes: item.type === 'bwc' ? (airfieldHalf.bwcValue || '') : (airfieldHalf.comments[item.id] || ''),
            photo_id: null,
            generated_discrepancy_id: null,
          }
        })

        const passed = visItems.filter((i) => {
          if (i.type === 'bwc') return airfieldHalf.bwcValue !== null
          return airfieldHalf.responses[i.id] === 'pass'
        }).length
        const failed = visItems.filter((i) => airfieldHalf.responses[i.id] === 'fail').length
        const na = visItems.filter((i) => {
          if (i.type === 'bwc') return false
          return airfieldHalf.responses[i.id] === 'na'
        }).length

        const { data: created, error } = await createInspection({
          inspection_type: 'airfield',
          inspector_name: airfieldHalf.inspectorName || 'Unknown',
          items,
          total_items: visItems.length,
          passed_count: passed,
          failed_count: failed,
          na_count: na,
          construction_meeting: false,
          joint_monthly: false,
          bwc_value: airfieldHalf.bwcValue,
          weather_conditions: airfieldHalf.weatherConditions,
          temperature_f: airfieldHalf.temperatureF,
          notes: airfieldHalf.notes || null,
          daily_group_id: groupId,
        })
        if (error) {
          toast.error(`Failed to file airfield: ${error}`)
        } else {
          filed++
          if (created && !filedId) filedId = created.id
        }
      }
    }

    // File lighting half (always normal)
    if (lightingSaved) {
      const secs = LIGHTING_INSPECTION_SECTIONS
      const visSecs = secs.filter((s) => !s.conditional || lightingHalf.enabledConditionals[s.id])
      const visItems = visSecs.flatMap((s) => s.items)

      const items: InspectionItem[] = visItems.map((item) => {
        const section = visSecs.find((s) => s.items.some((i) => i.id === item.id))
        const response = item.type === 'bwc'
          ? (lightingHalf.bwcValue ? 'pass' : null)
          : (lightingHalf.responses[item.id] ?? null)
        return {
          id: item.id,
          section: section?.title || '',
          item: item.item,
          response: response as 'pass' | 'fail' | 'na' | null,
          notes: item.type === 'bwc' ? (lightingHalf.bwcValue || '') : (lightingHalf.comments[item.id] || ''),
          photo_id: null,
          generated_discrepancy_id: null,
        }
      })

      const passed = visItems.filter((i) => {
        if (i.type === 'bwc') return lightingHalf.bwcValue !== null
        return lightingHalf.responses[i.id] === 'pass'
      }).length
      const failed = visItems.filter((i) => lightingHalf.responses[i.id] === 'fail').length
      const na = visItems.filter((i) => {
        if (i.type === 'bwc') return false
        return lightingHalf.responses[i.id] === 'na'
      }).length

      // If airfield was special mode, lighting is standalone (no group)
      const lightingGroupId = airfieldSpecialMode ? undefined : groupId

      const { data: created, error } = await createInspection({
        inspection_type: 'lighting',
        inspector_name: lightingHalf.inspectorName || 'Unknown',
        items,
        total_items: visItems.length,
        passed_count: passed,
        failed_count: failed,
        na_count: na,
        construction_meeting: false,
        joint_monthly: false,
        bwc_value: lightingHalf.bwcValue,
        weather_conditions: lightingHalf.weatherConditions,
        temperature_f: lightingHalf.temperatureF,
        notes: lightingHalf.notes || null,
        daily_group_id: lightingGroupId,
      })
      if (error) {
        toast.error(`Failed to file lighting: ${error}`)
      } else {
        filed++
        if (created && !filedId) filedId = created.id
      }
    }

    if (filed > 0 || usingDemo) {
      clearDraft()
      setDraft(null)
      toast.success(`Inspection${filed !== 1 ? 's' : ''} filed`, {
        description: `${filed} record${filed !== 1 ? 's' : ''} saved to history`,
      })
      // Navigate to the filed inspection detail page
      if (filedId) {
        router.push(`/inspections/${filedId}`)
        return
      }
      await loadHistory()
    }
    setFiling(false)
  }

  // ── Conditional sections list (airfield only) ──
  const conditionalSections = sections.filter((s) => s.conditional)

  // ── History data — group by daily_group_id ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawInspections: any[] = usingDemo ? DEMO_INSPECTIONS : liveInspections

  // Group inspections into daily reports (combined airfield + lighting)
  type DailyReport = {
    id: string                // the group ID or single inspection ID
    type: 'daily' | 'single'  // grouped or standalone
    inspectionType?: string   // for standalone: the specific inspection_type
    airfield: typeof rawInspections[0] | null
    lighting: typeof rawInspections[0] | null
    date: string
    inspectorName: string
    totalPassed: number
    totalFailed: number
    totalNa: number
    totalItems: number
    bwcValue: string | null
    weatherConditions: string | null
    temperatureF: number | null
    completedAt: string | null
    personnel?: string[]
  }

  const dailyReports: DailyReport[] = useMemo(() => {
    const groupMap = new Map<string, typeof rawInspections>()
    const ungrouped: typeof rawInspections = []

    for (const insp of rawInspections) {
      if (insp.daily_group_id) {
        const group = groupMap.get(insp.daily_group_id) || []
        group.push(insp)
        groupMap.set(insp.daily_group_id, group)
      } else {
        ungrouped.push(insp)
      }
    }

    const reports: DailyReport[] = []

    // Add grouped daily reports
    for (const [groupId, members] of Array.from(groupMap)) {
      const af = members.find((m: typeof rawInspections[0]) => m.inspection_type === 'airfield') || null
      const lt = members.find((m: typeof rawInspections[0]) => m.inspection_type === 'lighting') || null
      const primary = af || lt
      reports.push({
        id: groupId,
        type: 'daily',
        airfield: af,
        lighting: lt,
        date: primary.inspection_date,
        inspectorName: primary.inspector_name || 'Unknown',
        totalPassed: (af?.passed_count || 0) + (lt?.passed_count || 0),
        totalFailed: (af?.failed_count || 0) + (lt?.failed_count || 0),
        totalNa: (af?.na_count || 0) + (lt?.na_count || 0),
        totalItems: (af?.total_items || 0) + (lt?.total_items || 0),
        bwcValue: af?.bwc_value || lt?.bwc_value || null,
        weatherConditions: primary.weather_conditions,
        temperatureF: primary.temperature_f,
        completedAt: primary.completed_at,
      })
    }

    // Add ungrouped inspections as standalone reports
    for (const insp of ungrouped) {
      const isSpecialType = insp.inspection_type === 'construction_meeting' || insp.inspection_type === 'joint_monthly'
      reports.push({
        id: insp.id,
        type: 'single',
        inspectionType: insp.inspection_type,
        airfield: insp.inspection_type === 'airfield' ? insp : null,
        lighting: insp.inspection_type === 'lighting' ? insp : null,
        date: insp.inspection_date,
        inspectorName: insp.inspector_name || 'Unknown',
        totalPassed: isSpecialType ? 0 : insp.passed_count,
        totalFailed: isSpecialType ? 0 : insp.failed_count,
        totalNa: isSpecialType ? 0 : insp.na_count,
        totalItems: isSpecialType ? 0 : insp.total_items,
        bwcValue: insp.bwc_value,
        weatherConditions: insp.weather_conditions,
        temperatureF: insp.temperature_f,
        completedAt: insp.completed_at,
        personnel: insp.personnel || [],
      })
    }

    // Sort by completion date descending
    reports.sort((a, b) => {
      const da = a.completedAt || a.date
      const db = b.completedAt || b.date
      return db.localeCompare(da)
    })

    return reports
  }, [rawInspections])

  const filtered = dailyReports.filter((report) => {
    if (typeFilter !== 'all') {
      if (typeFilter === 'airfield' && !report.airfield) return false
      if (typeFilter === 'lighting' && !report.lighting) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const afId = report.airfield?.display_id || ''
      const ltId = report.lighting?.display_id || ''
      const inspType = report.inspectionType || (report.type === 'daily' ? 'daily airfield lighting' : '')
      const typeLabel = report.inspectionType === 'construction_meeting' ? 'construction meeting'
        : report.inspectionType === 'joint_monthly' ? 'joint monthly'
        : ''
      const issuesStr = report.totalFailed > 0 ? `${report.totalFailed} fail issues` : ''
      const personnelStr = (report.personnel || []).join(' ')
      const searchable = `${afId} ${ltId} ${report.inspectorName} ${report.weatherConditions || ''} ${inspType} ${typeLabel} ${issuesStr} ${personnelStr} ${report.bwcValue || ''}`.toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })

  const airfieldCount = dailyReports.filter((r) => r.airfield).length
  const lightingCount = dailyReports.filter((r) => r.lighting).length

  // ── Don't render until draft state is known ──
  if (!draftLoaded) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Loading...</div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  // ══  WORKSPACE VIEW (active draft exists)  ══
  // ══════════════════════════════════════════════
  if (draft && !showHistory) {
    const airfieldSaved = !!draft.airfield.savedAt
    const lightingSaved = !!draft.lighting.savedAt
    const canFile = airfieldSaved || lightingSaved

    return (
      <div style={{ padding: 16, paddingBottom: 120 }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Daily Inspection</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              Started {new Date(draft.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => toast.info('Airfield diagram coming soon')}
              style={{
                background: '#A78BFA14', border: '1px solid #A78BFA33', borderRadius: 8,
                padding: '8px 14px', color: '#A78BFA', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              Airfield Diagram
            </button>
            <button
              onClick={() => setShowHistory(true)}
              style={{
                background: '#0EA5E914', border: '1px solid #0EA5E933', borderRadius: 8,
                padding: '8px 14px', color: '#0EA5E9', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              View History
            </button>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155', marginBottom: 12 }}>
          {(['airfield', 'lighting'] as TabType[]).map((type) => {
            const active = activeTab === type
            const half = draft[type]
            const saved = !!half.savedAt
            const label = type === 'airfield' ? 'Airfield' : 'Lighting'
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  background: active ? '#0EA5E9' : 'transparent',
                  color: active ? '#FFF' : '#94A3B8',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {label}
                {saved && (
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#22C55E', color: '#FFF', fontSize: 11,
                    fontWeight: 800, display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', lineHeight: 1,
                  }}>
                    {'\u2713'}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Status Bar ── */}
        <div className="card" style={{ marginBottom: 12, padding: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
            <div>
              <div style={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9, marginBottom: 2 }}>
                Airfield
              </div>
              {draft.airfield.savedAt ? (
                <>
                  <div style={{ color: '#22C55E', fontWeight: 600 }}>
                    Saved {new Date(draft.airfield.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: 10 }}>{draft.airfield.inspectorName}</div>
                </>
              ) : (
                <div style={{ color: '#475569' }}>Not saved</div>
              )}
            </div>
            <div>
              <div style={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9, marginBottom: 2 }}>
                Lighting
              </div>
              {draft.lighting.savedAt ? (
                <>
                  <div style={{ color: '#22C55E', fontWeight: 600 }}>
                    Saved {new Date(draft.lighting.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: 10 }}>{draft.lighting.inspectorName}</div>
                </>
              ) : (
                <div style={{ color: '#475569' }}>Not saved</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Conditional Section Toggles (airfield only) ── */}
        {conditionalSections.length > 0 && (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: 'rgba(10,16,28,0.92)', border: '1px solid rgba(56,189,248,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Optional Sections
            </div>
            {conditionalSections.map((s) => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={!!currentHalf?.enabledConditionals[s.id]}
                  onChange={() => toggleConditional(s.id)}
                  style={{ accentColor: '#0EA5E9', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: '#CBD5E1' }}>{s.conditional}</span>
              </label>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* ══ SPECIAL MODE: Construction Meeting / Joint Monthly */}
        {/* ══════════════════════════════════════════════════════ */}
        {isSpecialMode ? (
          <>
            {/* Special mode header */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#38BDF8' }}>
                {specialModeLabel}
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                This form will be filed as a standalone record.
              </div>
            </div>

            {/* ── Personnel Multi-Select ── */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Personnel / Offices Present
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {INSPECTION_PERSONNEL.map((person) => {
                  const selected = currentHalf?.selectedPersonnel?.includes(person)
                  const repName = currentHalf?.personnelNames?.[person] || ''
                  return (
                    <div key={person}>
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 12px', borderRadius: selected ? '8px 8px 0 0' : 8, cursor: 'pointer',
                          border: `1px solid ${selected ? 'rgba(56,189,248,0.5)' : '#334155'}`,
                          borderBottom: selected ? 'none' : undefined,
                          background: selected ? 'rgba(56,189,248,0.1)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => togglePersonnel(person)}
                          style={{ accentColor: '#38BDF8', width: 14, height: 14 }}
                        />
                        <span style={{ fontSize: 13, color: selected ? '#38BDF8' : '#94A3B8', fontWeight: selected ? 600 : 400 }}>
                          {person}
                        </span>
                      </label>
                      {selected && (
                        <div style={{
                          padding: '6px 12px 8px',
                          borderRadius: '0 0 8px 8px',
                          border: '1px solid rgba(56,189,248,0.5)',
                          borderTop: 'none',
                          background: 'rgba(56,189,248,0.05)',
                        }}>
                          <input
                            type="text"
                            className="input-dark"
                            placeholder={`Representative name...`}
                            value={repName}
                            onChange={(e) => setPersonnelName(person, e.target.value)}
                            style={{ fontSize: 12, padding: '6px 8px', width: '100%' }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Comment Box ── */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Comments
              </div>
              <textarea
                className="input-dark"
                rows={6}
                placeholder={`Enter ${specialModeLabel.toLowerCase()} comments...`}
                value={currentHalf?.specialComment || ''}
                onChange={(e) => setSpecialComment(e.target.value)}
                style={{ resize: 'vertical', fontSize: 13 }}
              />
            </div>
          </>
        ) : (
          <>
            {/* ══════════════════════════════════════════════ */}
            {/* ══ NORMAL MODE: Standard checklist            */}
            {/* ══════════════════════════════════════════════ */}

            {/* ── Progress + Mark All Pass ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {activeTab === 'airfield' ? 'Airfield Inspection' : 'Lighting Inspection'}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {answeredCount}/{totalItems} items
                </div>
              </div>
              <div
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: `conic-gradient(#22C55E ${progress * 3.6}deg, #1E293B ${progress * 3.6}deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: '50%', background: '#0F172A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#F1F5F9',
                  }}
                >
                  {progress}%
                </div>
              </div>
            </div>

            <button
              onClick={markAllPass}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)',
                color: '#22C55E', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
              }}
            >
              Mark All Items as Pass
            </button>

            {/* ── Sections & Items ── */}
            {visibleSections.map((section) => {
              const done = sectionDoneCount(section)
              const sectionComplete = done === section.items.length

              return (
                <div key={section.id} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sectionComplete ? '#22C55E' : '#94A3B8' }}>
                      {section.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{done}/{section.items.length}</div>
                  </div>

                  {section.guidance && (
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8, lineHeight: '14px', fontStyle: 'italic' }}>
                      {section.guidance}
                    </div>
                  )}

                  {section.items.map((item) => {
                    // BWC item
                    if (item.type === 'bwc') {
                      return (
                        <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #1E293B' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, minWidth: 22 }}>{item.itemNumber}.</span>
                            <span style={{ fontSize: 13, color: '#CBD5E1', lineHeight: '18px' }}>{item.item}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, paddingLeft: 30 }}>
                            {BWC_OPTIONS.map((opt) => {
                              const selected = currentHalf?.bwcValue === opt
                              const colorMap: Record<string, string> = { LOW: '#22C55E', MOD: '#EAB308', SEV: '#F97316', PROHIB: '#EF4444' }
                              const color = colorMap[opt] || '#94A3B8'
                              return (
                                <button
                                  key={opt}
                                  onClick={() => setBwcValue(opt)}
                                  style={{
                                    padding: '6px 12px', borderRadius: 6,
                                    border: `2px solid ${selected ? color : '#334155'}`,
                                    background: selected ? `${color}20` : 'transparent',
                                    color: selected ? color : '#94A3B8',
                                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                  }}
                                >
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }

                    // Standard pass/fail/na item
                    const state = currentHalf?.responses[item.id] ?? null
                    const borderColor = state === 'pass' ? '#22C55E' : state === 'fail' ? '#EF4444' : state === 'na' ? '#64748B' : '#334155'
                    const bgColor = state === 'pass' ? 'rgba(34,197,94,0.1)' : state === 'fail' ? 'rgba(239,68,68,0.1)' : state === 'na' ? 'rgba(100,116,139,0.1)' : 'transparent'

                    return (
                      <div key={item.id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 0' }}>
                          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, minWidth: 22, paddingTop: 5 }}>
                            {item.itemNumber}.
                          </span>
                          <button
                            onClick={() => toggle(item.id)}
                            style={{
                              width: 28, height: 28, minWidth: 28, borderRadius: 6,
                              border: `2px solid ${borderColor}`, background: bgColor,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', padding: 0, flexShrink: 0,
                              fontSize: state === 'na' ? 9 : 14, fontWeight: 700,
                              color: state === 'pass' ? '#22C55E' : state === 'fail' ? '#EF4444' : state === 'na' ? '#64748B' : 'transparent',
                              fontFamily: 'inherit',
                            }}
                          >
                            {state === 'pass' ? '\u2713' : state === 'fail' ? '\u2717' : state === 'na' ? 'N/A' : ''}
                          </button>
                          <div
                            style={{
                              fontSize: 13, color: state === 'na' ? '#64748B' : '#CBD5E1',
                              lineHeight: '18px', paddingTop: 4,
                              textDecoration: state === 'na' ? 'line-through' : 'none',
                            }}
                          >
                            {item.item}
                          </div>
                        </div>

                        {state === 'fail' && (
                          <div style={{ paddingLeft: 58, paddingBottom: 10 }}>
                            <textarea
                              placeholder="Describe the discrepancy..."
                              value={currentHalf?.comments[item.id] || ''}
                              onChange={(e) => setComment(item.id, e.target.value)}
                              rows={2}
                              style={{
                                width: '100%', background: 'rgba(4,8,14,0.9)',
                                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
                                padding: '8px 10px', color: '#F1F5F9', fontSize: 12,
                                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* ── Notes ── */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                General Notes (Optional)
              </div>
              <textarea
                className="input-dark"
                rows={3}
                placeholder="Any additional notes..."
                value={currentHalf?.notes || ''}
                onChange={(e) => setNotes(e.target.value)}
                style={{ resize: 'vertical', fontSize: 13 }}
              />
            </div>
          </>
        )}

        {/* ── Action Buttons ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #0EA5E9, #22D3EE)',
              color: '#FFF', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleFile}
            disabled={filing || !canFile}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 10,
              border: canFile ? '1px solid rgba(34,197,94,0.4)' : '1px solid #334155',
              background: canFile ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: canFile ? '#22C55E' : '#475569',
              fontSize: 15, fontWeight: 700,
              cursor: canFile && !filing ? 'pointer' : 'default', fontFamily: 'inherit',
              opacity: filing ? 0.7 : 1,
            }}
          >
            {filing ? 'Filing...' : 'File'}
          </button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  // ══  HISTORY VIEW (no active draft)         ══
  // ══════════════════════════════════════════════
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Inspections</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            {dailyReports.length} filed report{dailyReports.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {draft && showHistory && (
            <button
              onClick={() => setShowHistory(false)}
              style={{
                background: '#0EA5E914', border: '1px solid #0EA5E933', borderRadius: 8,
                padding: '8px 14px', color: '#0EA5E9', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              View Current Inspection Form
            </button>
          )}
          {!draft && (
            <button
              onClick={handleBeginNew}
              style={{
                background: '#22C55E14', border: '1px solid #22C55E33', borderRadius: 8,
                padding: '8px 14px', color: '#22C55E', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              + Begin New Inspection
            </button>
          )}
        </div>
      </div>

      {/* Type Filter Chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[
          { key: 'all', label: `All (${dailyReports.length})`, color: '#22D3EE' },
          { key: 'airfield', label: `Airfield (${airfieldCount})`, color: '#34D399' },
          { key: 'lighting', label: `Lighting (${lightingCount})`, color: '#FBBF24' },
        ].map((chip) => {
          const active = typeFilter === chip.key
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setTypeFilter(active && chip.key !== 'all' ? 'all' : chip.key)}
              style={{
                padding: '6px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap',
                background: active ? `${chip.color}22` : '#1E293B',
                color: active ? chip.color : '#64748B',
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <input
        className="input-dark"
        placeholder="Search inspections..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 10, fontSize: 13 }}
      />

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Loading...</div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          {search || typeFilter !== 'all' ? 'No inspections match your filter.' : 'No inspections filed yet.'}
        </div>
      )}

      {/* Inspection Report Cards */}
      {!loading && filtered.map((report) => {
        const isDaily = report.type === 'daily'
        const isSpecialType = report.inspectionType === 'construction_meeting' || report.inspectionType === 'joint_monthly'
        // Link to the airfield inspection detail (which will fetch the full group)
        const linkId = isSpecialType ? report.id : (report.airfield?.id || report.lighting?.id)
        const displayIds = isSpecialType ? [] : [report.airfield?.display_id, report.lighting?.display_id].filter(Boolean)

        const specialLabel = report.inspectionType === 'construction_meeting'
          ? 'Construction Meeting Inspection'
          : report.inspectionType === 'joint_monthly'
          ? 'Joint Monthly Airfield Inspection'
          : ''
        const borderColor = isSpecialType ? '#A78BFA' : isDaily ? '#22D3EE' : report.airfield ? '#34D399' : '#FBBF24'

        return (
          <Link
            key={report.id}
            href={`/inspections/${linkId}`}
            className="card"
            style={{
              display: 'block', marginBottom: 6, cursor: 'pointer',
              textDecoration: 'none', color: 'inherit',
              borderLeft: `3px solid ${borderColor}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                {isSpecialType ? (
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#A78BFA' }}>
                    {specialLabel}
                  </span>
                ) : isDaily ? (
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#22D3EE' }}>
                    Airfield Inspection Report
                  </span>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#22D3EE' }}>
                    {displayIds[0]}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {isSpecialType ? (
                  <Badge label={report.inspectionType === 'construction_meeting' ? 'Construction' : 'Joint Monthly'} color="#A78BFA" />
                ) : (
                  <>
                    {report.airfield && <Badge label="Airfield" color="#34D399" />}
                    {report.lighting && <Badge label="Lighting" color="#FBBF24" />}
                  </>
                )}
              </div>
            </div>

            {/* Show both display IDs for daily reports */}
            {isDaily && displayIds.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>
                {displayIds.map((did) => (
                  <span key={did}>{did}</span>
                ))}
              </div>
            )}

            {/* Special type: show personnel instead of pass/fail */}
            {isSpecialType ? (
              <>
                {report.personnel && report.personnel.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {report.personnel.map((p) => (
                      <span key={p} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(167,139,250,0.1)', color: '#A78BFA', fontWeight: 600 }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: '#22C55E', fontWeight: 700 }}>{report.totalPassed} Pass</span>
                  {report.totalFailed > 0 && (
                    <span style={{ color: '#EF4444', fontWeight: 700 }}>{report.totalFailed} Fail</span>
                  )}
                  {report.totalNa > 0 && (
                    <span style={{ color: '#64748B', fontWeight: 600 }}>{report.totalNa} N/A</span>
                  )}
                  <span style={{ color: '#475569' }}>/ {report.totalItems} items</span>
                </div>

                {report.bwcValue && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      color: report.bwcValue === 'LOW' ? '#22C55E' : report.bwcValue === 'MOD' ? '#EAB308' : report.bwcValue === 'SEV' ? '#F97316' : '#EF4444',
                      background: report.bwcValue === 'LOW' ? 'rgba(34,197,94,0.1)' : report.bwcValue === 'MOD' ? 'rgba(234,179,8,0.1)' : report.bwcValue === 'SEV' ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)',
                    }}>
                      BWC: {report.bwcValue}
                    </span>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{report.inspectorName}</span>
                {report.weatherConditions && (
                  <>
                    <span>&bull;</span>
                    <span>{report.weatherConditions}{report.temperatureF != null ? ` ${report.temperatureF}°F` : ''}</span>
                  </>
                )}
              </div>
              <span>
                {report.completedAt
                  ? `${new Date(report.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date(report.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                  : report.date}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
