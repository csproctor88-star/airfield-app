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
import { fetchInspections, createInspection, saveInspectionDraft, fileInspection, fetchDailyGroup, getInspectorName, type InspectionRow } from '@/lib/supabase/inspections'
import { logActivity } from '@/lib/supabase/activity'
import { useInstallation } from '@/lib/installation-context'
import { fetchCurrentWeather } from '@/lib/weather'
import { fetchInspectionTemplate, toInspectionSections } from '@/lib/supabase/inspection-templates'
import {
  loadDraft,
  saveDraftToStorage,
  clearDraft,
  createNewDraft,
  halfDraftToItems,
  type DailyInspectionDraft,
  type InspectionHalfDraft,
} from '@/lib/inspection-draft'
import { DEMO_INSPECTIONS } from '@/lib/demo-data'
import { getAirfieldDiagram } from '@/lib/airfield-diagram'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'
import { uploadInspectionPhoto } from '@/lib/supabase/inspections'
import type { InspectionItem } from '@/lib/supabase/types'
import dynamic from 'next/dynamic'

const InspectionLocationMap = dynamic(
  () => import('@/components/discrepancies/location-map'),
  { ssr: false },
)

type BwcValue = null | (typeof BWC_OPTIONS)[number]
type TabType = 'airfield' | 'lighting' | 'construction_meeting' | 'joint_monthly'

export default function InspectionsPage() {
  const router = useRouter()
  const { installationId, runways } = useInstallation()

  // Base coordinates for weather (midpoint of first runway)
  const rwy0 = runways[0]
  const baseLat = rwy0 ? ((rwy0.end1_latitude ?? 0) + (rwy0.end2_latitude ?? 0)) / 2 : undefined
  const baseLon = rwy0 ? ((rwy0.end1_longitude ?? 0) + (rwy0.end2_longitude ?? 0)) / 2 : undefined

  // ── DB-driven templates (fall back to constants if not in DB) ──
  const [dbAirfieldSections, setDbAirfieldSections] = useState<InspectionSection[] | null>(null)
  const [dbLightingSections, setDbLightingSections] = useState<InspectionSection[] | null>(null)

  useEffect(() => {
    if (!installationId) return
    async function loadTemplates() {
      const [af, lt] = await Promise.all([
        fetchInspectionTemplate(installationId!, 'airfield'),
        fetchInspectionTemplate(installationId!, 'lighting'),
      ])
      if (af.length > 0) setDbAirfieldSections(toInspectionSections(af))
      if (lt.length > 0) setDbLightingSections(toInspectionSections(lt))
    }
    loadTemplates()
  }, [installationId])

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

  // ── Scroll to top on mount ──
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // ── Sync showHistory from URL (handles client-side navigation) ──
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'history') {
      setShowHistory(true)
    }
  }, [])

  // ── Action state ──
  const [saving, setSaving] = useState(false)
  const [filing, setFiling] = useState(false)
  const [showLightingWarning, setShowLightingWarning] = useState(false)

  // ── Photo state for fail items & special inspections ──
  const [itemPhotos, setItemPhotos] = useState<Record<string, { file: File; url: string; name: string }[]>>({})
  const [specialPhotos, setSpecialPhotos] = useState<{ file: File; url: string; name: string }[]>([])
  const [activePhotoItemId, setActivePhotoItemId] = useState<string | null>(null)
  const itemFileRef = useRef<HTMLInputElement>(null)
  const itemCameraRef = useRef<HTMLInputElement>(null)
  const specialFileRef = useRef<HTMLInputElement>(null)
  const specialCameraRef = useRef<HTMLInputElement>(null)

  // ── GPS location state for fail items ──
  const [itemLocations, setItemLocations] = useState<Record<string, { lat: number; lon: number }>>({})
  const [gpsLoading, setGpsLoading] = useState<string | null>(null)
  const [itemFlyTo, setItemFlyTo] = useState<Record<string, { lat: number; lng: number }>>({})


  // ── Airfield diagram state ──
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null)
  const [showDiagram, setShowDiagram] = useState(false)

  useEffect(() => {
    if (!installationId) return
    getAirfieldDiagram(installationId).then(setDiagramUrl).catch(() => setDiagramUrl(null))
  }, [installationId])

  const handleItemPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activePhotoItemId) return
    const files = e.target.files
    if (!files?.length) return
    const itemId = activePhotoItemId
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file)
      setItemPhotos((prev) => ({
        ...prev,
        [itemId]: [...(prev[itemId] || []), { file, url, name: file.name }],
      }))
    })
    e.target.value = ''
  }

  const handleSpecialPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file)
      setSpecialPhotos((prev) => [...prev, { file, url, name: file.name }])
    })
    e.target.value = ''
  }

  const captureLocation = useCallback((itemId: string) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(itemId)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        setItemLocations((prev) => ({
          ...prev,
          [itemId]: { lat, lon },
        }))
        setItemFlyTo((prev) => ({ ...prev, [itemId]: { lat, lng: lon } }))
        setGpsLoading(null)
        toast.success('Location acquired')
      },
      (error) => {
        setGpsLoading(null)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location access denied. Enable in browser settings.')
            break
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information unavailable.')
            break
          case error.TIMEOUT:
            toast.error('Location request timed out.')
            break
          default:
            toast.error('Unable to get your location.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [])

  const handleItemPointSelected = useCallback((itemId: string, lat: number, lng: number) => {
    setItemLocations((prev) => ({ ...prev, [itemId]: { lat, lon: lng } }))
    toast.success(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }, [])

  // ── Load draft from localStorage on mount (scoped to current base) ──
  useEffect(() => {
    const stored = loadDraft(installationId)
    if (stored) setDraft(stored)
    setDraftLoaded(true)
  }, [installationId])

  // ── Auto-begin: if ?action=begin and no draft, create one ──
  useEffect(() => {
    if (!draftLoaded || autoBeginHandled.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'begin' && !draft) {
      autoBeginHandled.current = true
      const newDraft = createNewDraft()
      setDraft(newDraft)
      setActiveTab('airfield')
      saveDraftToStorage(newDraft, installationId)
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
    const data = await fetchInspections(installationId)
    setLiveInspections(data)
    setLoading(false)
  }, [installationId])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // ── Save draft to localStorage whenever it changes ──
  useEffect(() => {
    if (draft && draftLoaded) saveDraftToStorage(draft, installationId)
  }, [draft, draftLoaded])

  // ── Current half helpers ──
  const currentHalf: InspectionHalfDraft | null = draft ? draft[activeTab] : null
  const sections = activeTab === 'airfield'
    ? (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
    : activeTab === 'lighting'
    ? (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
    : [] // CM/JM tabs have no checklist sections

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

  // CM/JM tabs use specialComment and personnel directly
  const isCmJmTab = activeTab === 'construction_meeting' || activeTab === 'joint_monthly'
  const cmJmLabel = activeTab === 'construction_meeting'
    ? 'Pre/Post Construction Inspection'
    : activeTab === 'joint_monthly'
    ? 'Joint Monthly Inspection'
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
    saveDraftToStorage(newDraft, installationId)
    window.scrollTo(0, 0)
    toast.success('New daily inspection started')
  }

  // ── Save current tab's draft to DB ──
  const handleSave = async () => {
    if (!draft || !currentHalf) return
    setSaving(true)

    const isCmJm = activeTab === 'construction_meeting' || activeTab === 'joint_monthly'

    const secs = activeTab === 'airfield'
      ? (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
      : activeTab === 'lighting'
      ? (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
      : []
    const { items, passed, failed, na, total } = isCmJm
      ? { items: [], passed: 0, failed: 0, na: 0, total: 0 }
      : halfDraftToItems(currentHalf, secs)

    const { data: saved, error } = await saveInspectionDraft({
      id: currentHalf.dbRowId,
      inspection_type: activeTab,
      draft_data: currentHalf,
      items,
      total_items: total,
      passed_count: passed,
      failed_count: failed,
      na_count: na,
      bwc_value: isCmJm ? null : currentHalf.bwcValue,
      notes: isCmJm ? (currentHalf.specialComment || null) : (currentHalf.notes || null),
      daily_group_id: draft.id,
      construction_meeting: activeTab === 'construction_meeting',
      joint_monthly: activeTab === 'joint_monthly',
      base_id: installationId,
    })

    if (error) {
      toast.error(`Failed to save: ${error}`)
      setSaving(false)
      return
    }

    // Store the DB row ID back into the draft so future saves update the same row
    if (saved && !currentHalf.dbRowId) {
      updateHalf(activeTab, (h) => ({ ...h, dbRowId: saved.id }))
    }

    const tabLabels: Record<TabType, string> = { airfield: 'Airfield', lighting: 'Lighting', construction_meeting: 'Construction Meeting', joint_monthly: 'Joint Monthly' }
    setSaving(false)
    toast.success(`${tabLabels[activeTab]} progress saved`)
    await loadHistory()
  }

  // ── Resume an in-progress inspection from DB ──
  const handleResume = async (report: { id: string; type: string; airfield?: { daily_group_id?: string } | null; lighting?: { daily_group_id?: string } | null }) => {
    const groupId = report.type === 'daily'
      ? report.id
      : (report.airfield?.daily_group_id || report.lighting?.daily_group_id || report.id)

    // Fetch the group members from DB
    const members = await fetchDailyGroup(groupId)
    if (members.length === 0) {
      // Try fetching as a single inspection
      const { fetchInspection } = await import('@/lib/supabase/inspections')
      const single = await fetchInspection(report.id)
      if (single) members.push(single)
    }

    if (members.length === 0) {
      toast.error('Could not load inspection data')
      return
    }

    // Reconstruct a DailyInspectionDraft from draft_data
    const newDraft = createNewDraft()
    newDraft.id = groupId

    for (const member of members) {
      const tab = member.inspection_type as TabType
      if (tab !== 'airfield' && tab !== 'lighting' && tab !== 'construction_meeting' && tab !== 'joint_monthly') continue
      if (member.draft_data) {
        // Restore saved draft data
        newDraft[tab] = { ...member.draft_data, dbRowId: member.id }
      } else {
        // No draft_data (shouldn't happen for in-progress, but handle gracefully)
        newDraft[tab] = { ...newDraft[tab], dbRowId: member.id }
      }
    }

    setDraft(newDraft)
    saveDraftToStorage(newDraft, installationId)
    setShowHistory(false)

    // Switch to the first tab that has data
    const afMember = members.find((m) => m.inspection_type === 'airfield')
    const ltMember = members.find((m) => m.inspection_type === 'lighting')
    if (afMember) setActiveTab('airfield')
    else if (ltMember) setActiveTab('lighting')

    logActivity('resumed', 'inspection', members[0].id, members[0].display_id, { inspection_type: members[0].inspection_type }, installationId)
    window.scrollTo(0, 0)
    toast.success('Inspection resumed')
  }

  // ── Complete current tab (auto-captures weather + inspector) ──
  const handleComplete = async (tab?: TabType) => {
    const targetTab = tab || activeTab
    const half = draft?.[targetTab]
    if (!draft || !half) return
    setSaving(true)

    const isCmJm = targetTab === 'construction_meeting' || targetTab === 'joint_monthly'

    // Auto-fetch weather
    const weather = await fetchCurrentWeather(baseLat, baseLon)

    // Auto-fetch inspector name from auth
    const inspector = await getInspectorName()
    const fallbackName = usingDemo ? 'Demo Inspector' : null

    const completedHalf: InspectionHalfDraft = {
      ...half,
      inspectorName: inspector.name || fallbackName,
      inspectorId: inspector.id,
      savedAt: new Date().toISOString(),
      weatherConditions: weather?.conditions || half.weatherConditions || null,
      temperatureF: weather?.temperature_f ?? half.temperatureF ?? null,
    }

    updateHalf(targetTab, () => completedHalf)

    // Also save to DB
    const secs = targetTab === 'airfield'
      ? (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
      : targetTab === 'lighting'
      ? (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
      : []
    const { items, passed, failed, na, total } = isCmJm
      ? { items: [], passed: 0, failed: 0, na: 0, total: 0 }
      : halfDraftToItems(completedHalf, secs)

    const { data: saved } = await saveInspectionDraft({
      id: half.dbRowId,
      inspection_type: targetTab,
      draft_data: completedHalf,
      items,
      total_items: total,
      passed_count: passed,
      failed_count: failed,
      na_count: na,
      bwc_value: isCmJm ? null : completedHalf.bwcValue,
      notes: isCmJm ? (completedHalf.specialComment || null) : (completedHalf.notes || null),
      daily_group_id: draft.id,
      construction_meeting: targetTab === 'construction_meeting',
      joint_monthly: targetTab === 'joint_monthly',
      base_id: installationId,
    })

    // Store the DB row ID back into the draft
    if (saved && !half.dbRowId) {
      updateHalf(targetTab, (h) => ({ ...h, dbRowId: saved.id }))
    }

    if (saved) {
      logActivity('completed', 'inspection', saved.id, saved.display_id, { inspection_type: targetTab }, installationId)
    }

    const tabLabels: Record<TabType, string> = { airfield: 'Airfield', lighting: 'Lighting', construction_meeting: 'Construction Meeting', joint_monthly: 'Joint Monthly' }
    setSaving(false)
    toast.success(`${tabLabels[targetTab]} inspection completed`, {
      description: weather
        ? `${weather.conditions}, ${weather.temperature_f}°F`
        : 'Weather data unavailable',
    })

    await loadHistory()

    // Auto-switch to lighting tab after completing airfield (only if lighting not started)
    if (targetTab === 'airfield' && !draft.lighting.savedAt) {
      setActiveTab('lighting')
    }
  }

  // ── Helper: file a single CM/JM half ──
  const fileCmJmHalf = async (
    half: InspectionHalfDraft,
    type: 'construction_meeting' | 'joint_monthly',
    filerName: string,
    filerId: string | null,
  ): Promise<{ id: string | null; error: string | null }> => {
    const personnel = (half.selectedPersonnel || []).map((p) => {
      const name = half.personnelNames?.[p]
      return name ? `${p} — ${name}` : p
    })
    const payload = {
      items: [],
      total_items: 0,
      passed_count: 0,
      failed_count: 0,
      na_count: 0,
      bwc_value: null,
      weather_conditions: half.weatherConditions,
      temperature_f: half.temperatureF,
      notes: half.specialComment || null,
      inspector_name: half.inspectorName || 'Unknown',
      completed_by_name: half.inspectorName || 'Unknown',
      completed_by_id: half.inspectorId,
      completed_at: half.savedAt || new Date().toISOString(),
      filed_by_name: filerName,
      filed_by_id: filerId,
      personnel,
      construction_meeting: type === 'construction_meeting',
      joint_monthly: type === 'joint_monthly',
      base_id: installationId,
    }

    if (half.dbRowId) {
      const { data, error } = await fileInspection({ id: half.dbRowId, ...payload })
      return { id: data?.id || null, error: error || null }
    } else {
      const { data, error } = await createInspection({ inspection_type: type, ...payload })
      return { id: data?.id || null, error: error || null }
    }
  }

  // ── File a standalone CM/JM inspection (one-step: complete + file + navigate) ──
  const handleFileCmJm = async () => {
    if (!draft || !currentHalf) return
    const type = activeTab as 'construction_meeting' | 'joint_monthly'
    setFiling(true)

    // Auto-capture weather + inspector
    const weather = await fetchCurrentWeather(baseLat, baseLon)
    const inspector = await getInspectorName()
    const fallbackName = usingDemo ? 'Demo Inspector' : null
    const filer = inspector

    const completedHalf: InspectionHalfDraft = {
      ...currentHalf,
      inspectorName: inspector.name || fallbackName,
      inspectorId: inspector.id,
      savedAt: new Date().toISOString(),
      weatherConditions: weather?.conditions || currentHalf.weatherConditions || null,
      temperatureF: weather?.temperature_f ?? currentHalf.temperatureF ?? null,
    }

    const { id, error } = await fileCmJmHalf(
      completedHalf,
      type,
      filer.name || (usingDemo ? 'Demo Inspector' : 'Unknown'),
      filer.id,
    )

    if (error) {
      toast.error(`Failed to file: ${error}`)
      setFiling(false)
      return
    }

    // Upload photos
    if (id && specialPhotos.length > 0) {
      for (const photo of specialPhotos) {
        await uploadInspectionPhoto(id, photo.file, null, null, null, installationId)
      }
    }

    // Clean up
    specialPhotos.forEach((p) => URL.revokeObjectURL(p.url))
    setSpecialPhotos([])

    // Reset the CM/JM half in the draft (don't clear the whole draft — airfield/lighting may be in progress)
    updateHalf(type, () => ({
      responses: {}, bwcValue: null, comments: {}, enabledConditionals: {},
      notes: '', inspectorName: null, inspectorId: null, savedAt: null,
      weatherConditions: null, temperatureF: null, specialComment: '',
      selectedPersonnel: [], personnelNames: {}, dbRowId: null,
    }))
    saveDraftToStorage(draft, installationId)

    if (id) {
      logActivity('filed', 'inspection', id, undefined, { inspection_type: type }, installationId)
    }

    setFiling(false)
    const label = type === 'construction_meeting' ? 'Pre/Post Construction' : 'Joint Monthly'
    toast.success(`${label} inspection filed`)

    if (id) {
      router.push(`/inspections/${id}`)
    } else {
      // Fallback for demo mode
      setActiveTab('airfield')
      await loadHistory()
    }
  }

  // ── File the daily inspection (write to Supabase) ──
  // Auto-completes the current tab first, then files all completed halves (airfield + lighting only).
  const handleFile = async (skipLightingWarning = false) => {
    if (!draft) return

    // Auto-complete the current tab if not already completed
    const currentDraftHalf = draft[activeTab]
    if (!currentDraftHalf.savedAt) {
      // Auto-fetch weather + inspector for the current tab
      const weather = await fetchCurrentWeather(baseLat, baseLon)
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

      // Need to use updated values since setState is async
      draft[activeTab] = {
        ...currentDraftHalf,
        inspectorName: inspector.name || fallbackName,
        inspectorId: inspector.id,
        savedAt: new Date().toISOString(),
        weatherConditions: weather?.conditions || currentDraftHalf.weatherConditions || null,
        temperatureF: weather?.temperature_f ?? currentDraftHalf.temperatureF ?? null,
      }
    }

    const airfieldHalf = draft.airfield
    const lightingHalf = draft.lighting
    const airfieldSaved = !!airfieldHalf.savedAt
    const lightingSaved = !!lightingHalf.savedAt

    if (!airfieldSaved && !lightingSaved) {
      toast.error('Complete at least one inspection (airfield or lighting) before filing')
      return
    }

    // Show warning if airfield is done but lighting is not
    if (airfieldSaved && !lightingSaved && !skipLightingWarning) {
      setShowLightingWarning(true)
      return
    }

    setFiling(true)

    // Get the filer's identity (the person clicking File)
    const filer = await getInspectorName()
    const filerName = filer.name || (usingDemo ? 'Demo Inspector' : 'Unknown')
    const filerId = filer.id

    const groupId = draft.id
    let filed = 0
    let filedId: string | null = null

    // ── File airfield half (normal) ──
    if (airfieldSaved) {
      const afSecs = (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
      const { items, passed, failed, na, total } = halfDraftToItems(airfieldHalf, afSecs)

      if (airfieldHalf.dbRowId) {
        const { data: filed_data, error } = await fileInspection({
          id: airfieldHalf.dbRowId,
          items,
          total_items: total,
          passed_count: passed,
          failed_count: failed,
          na_count: na,
          bwc_value: airfieldHalf.bwcValue,
          weather_conditions: airfieldHalf.weatherConditions,
          temperature_f: airfieldHalf.temperatureF,
          notes: airfieldHalf.notes || null,
          inspector_name: airfieldHalf.inspectorName || 'Unknown',
          completed_by_name: airfieldHalf.inspectorName || 'Unknown',
          completed_by_id: airfieldHalf.inspectorId,
          completed_at: airfieldHalf.savedAt || new Date().toISOString(),
          filed_by_name: filerName,
          filed_by_id: filerId,
          base_id: installationId,
        })
        if (error) {
          toast.error(`Failed to file airfield: ${error}`)
        } else {
          filed++
          if (filed_data && !filedId) filedId = filed_data.id
        }
      } else {
        const { data: created, error } = await createInspection({
          inspection_type: 'airfield',
          inspector_name: airfieldHalf.inspectorName || 'Unknown',
          items,
          total_items: total,
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
          completed_by_name: airfieldHalf.inspectorName || 'Unknown',
          completed_by_id: airfieldHalf.inspectorId,
          completed_at: airfieldHalf.savedAt,
          filed_by_name: filerName,
          filed_by_id: filerId,
          base_id: installationId,
        })
        if (error) {
          toast.error(`Failed to file airfield: ${error}`)
        } else {
          filed++
          if (created && !filedId) filedId = created.id
        }
      }
    }

    // ── File lighting half ──
    if (lightingSaved) {
      const ltSecs = dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS
      const { items, passed, failed, na, total } = halfDraftToItems(lightingHalf, ltSecs)

      if (lightingHalf.dbRowId) {
        const { data: filed_data, error } = await fileInspection({
          id: lightingHalf.dbRowId,
          items,
          total_items: total,
          passed_count: passed,
          failed_count: failed,
          na_count: na,
          bwc_value: lightingHalf.bwcValue,
          weather_conditions: lightingHalf.weatherConditions,
          temperature_f: lightingHalf.temperatureF,
          notes: lightingHalf.notes || null,
          inspector_name: lightingHalf.inspectorName || 'Unknown',
          completed_by_name: lightingHalf.inspectorName || 'Unknown',
          completed_by_id: lightingHalf.inspectorId,
          completed_at: lightingHalf.savedAt || new Date().toISOString(),
          filed_by_name: filerName,
          filed_by_id: filerId,
          base_id: installationId,
        })
        if (error) {
          toast.error(`Failed to file lighting: ${error}`)
        } else {
          filed++
          if (filed_data && !filedId) filedId = filed_data.id
        }
      } else {
        const { data: created, error } = await createInspection({
          inspection_type: 'lighting',
          inspector_name: lightingHalf.inspectorName || 'Unknown',
          items,
          total_items: total,
          passed_count: passed,
          failed_count: failed,
          na_count: na,
          construction_meeting: false,
          joint_monthly: false,
          bwc_value: lightingHalf.bwcValue,
          weather_conditions: lightingHalf.weatherConditions,
          temperature_f: lightingHalf.temperatureF,
          notes: lightingHalf.notes || null,
          daily_group_id: groupId,
          completed_by_name: lightingHalf.inspectorName || 'Unknown',
          completed_by_id: lightingHalf.inspectorId,
          completed_at: lightingHalf.savedAt,
          filed_by_name: filerName,
          filed_by_id: filerId,
          base_id: installationId,
        })
        if (error) {
          toast.error(`Failed to file lighting: ${error}`)
        } else {
          filed++
          if (created && !filedId) filedId = created.id
        }
      }
    }

    if (filed > 0 || usingDemo) {
      // Upload photos for fail items (keyed by item ID)
      if (filedId && Object.keys(itemPhotos).length > 0) {
        for (const [itemId, photos] of Object.entries(itemPhotos)) {
          const loc = itemLocations[itemId] || null
          for (const photo of photos) {
            await uploadInspectionPhoto(filedId, photo.file, itemId, loc?.lat, loc?.lon, installationId)
          }
        }
      }

      // Upload photos for special inspections (no item ID)
      if (filedId && specialPhotos.length > 0) {
        for (const photo of specialPhotos) {
          await uploadInspectionPhoto(filedId, photo.file, null, null, null, installationId)
        }
      }

      // Clean up object URLs
      Object.values(itemPhotos).flat().forEach((p) => URL.revokeObjectURL(p.url))
      specialPhotos.forEach((p) => URL.revokeObjectURL(p.url))
      setItemPhotos({})
      setSpecialPhotos([])
      setItemLocations({})

      clearDraft(installationId)
      setDraft(null)
      toast.success(`Inspection${filed !== 1 ? 's' : ''} filed`, {
        description: `${filed} record${filed !== 1 ? 's' : ''} saved to history`,
      })
      if (filedId) {
        router.push(`/inspections/${filedId}`)
        return
      }
      await loadHistory()
    }
    setFiling(false)
  }

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
    status: 'in_progress' | 'completed'
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
      const anyInProgress = members.some((m: typeof rawInspections[0]) => m.status === 'in_progress')
      reports.push({
        id: groupId,
        type: 'daily',
        airfield: af,
        lighting: lt,
        date: primary.inspection_date,
        inspectorName: primary.inspector_name || primary.saved_by_name || 'Unknown',
        totalPassed: (af?.passed_count || 0) + (lt?.passed_count || 0),
        totalFailed: (af?.failed_count || 0) + (lt?.failed_count || 0),
        totalNa: (af?.na_count || 0) + (lt?.na_count || 0),
        totalItems: (af?.total_items || 0) + (lt?.total_items || 0),
        bwcValue: af?.bwc_value || lt?.bwc_value || null,
        weatherConditions: primary.weather_conditions,
        temperatureF: primary.temperature_f,
        completedAt: primary.completed_at,
        status: anyInProgress ? 'in_progress' : 'completed',
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
        inspectorName: insp.inspector_name || insp.saved_by_name || 'Unknown',
        totalPassed: isSpecialType ? 0 : insp.passed_count,
        totalFailed: isSpecialType ? 0 : insp.failed_count,
        totalNa: isSpecialType ? 0 : insp.na_count,
        totalItems: isSpecialType ? 0 : insp.total_items,
        bwcValue: insp.bwc_value,
        weatherConditions: insp.weather_conditions,
        temperatureF: insp.temperature_f,
        completedAt: insp.completed_at,
        personnel: insp.personnel || [],
        status: insp.status || 'completed',
      })
    }

    // Sort: in-progress first, then by date descending
    reports.sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1
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
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  // ══  WORKSPACE VIEW (active draft exists)  ══
  // ══════════════════════════════════════════════
  if (draft && !showHistory) {

    return (
      <div style={{ padding: 16, paddingBottom: 120 }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Daily Inspection</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
              Started {new Date(draft.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => diagramUrl ? setShowDiagram(true) : toast.info('No airfield diagram uploaded — add one in Settings > Base Configuration')}
              style={{
                background: '#A78BFA14', border: '1px solid #A78BFA33', borderRadius: 8,
                padding: '8px 14px', color: 'var(--color-purple)', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              View Airfield Diagram
            </button>
            <button
              onClick={() => setShowHistory(true)}
              style={{
                background: '#0EA5E914', border: '1px solid #0EA5E933', borderRadius: 8,
                padding: '8px 14px', color: 'var(--color-accent-secondary)', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              View History
            </button>
          </div>
        </div>

        {/* ── Tab Bar (4 tabs) ── */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-text-4)', marginBottom: 12 }}>
          {([
            { key: 'airfield' as TabType, topLine: 'Airfield', bottomLine: null, wide: true },
            { key: 'lighting' as TabType, topLine: 'Lighting', bottomLine: null, wide: true },
            { key: 'construction_meeting' as TabType, topLine: 'Pre/Post', bottomLine: 'Construction', wide: false },
            { key: 'joint_monthly' as TabType, topLine: 'Joint Monthly', bottomLine: 'Inspection', wide: false },
          ]).map(({ key: type, topLine, bottomLine, wide }) => {
            const active = activeTab === type
            const half = draft[type]
            const saved = !!half.savedAt
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                style={{
                  flex: wide ? '1.3 0 0%' : '1 0 0%',
                  minWidth: 0,
                  padding: bottomLine ? '6px 4px' : '10px 8px',
                  border: 'none',
                  background: active ? 'var(--color-accent-secondary)' : 'transparent',
                  color: active ? '#FFF' : 'var(--color-text-2)',
                  fontSize: bottomLine ? 11 : 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0,
                  lineHeight: bottomLine ? 1.3 : 1,
                  position: 'relative',
                }}
              >
                <span>{topLine}</span>
                {bottomLine && <span>{bottomLine}</span>}
                {saved && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 14, height: 14, borderRadius: '50%',
                    background: '#22C55E', color: '#FFF', fontSize: 9,
                    fontWeight: 800, display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', lineHeight: 1, flexShrink: 0,
                  }}>
                    {'\u2713'}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Status Bar (airfield/lighting only) ── */}
        {!isCmJmTab && (
          <div className="card" style={{ marginBottom: 12, padding: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
              <div>
                <div style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9, marginBottom: 2 }}>
                  Airfield
                </div>
                {draft.airfield.savedAt ? (
                  <>
                    <div style={{ color: '#22C55E', fontWeight: 600 }}>
                      Completed {new Date(draft.airfield.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ color: 'var(--color-text-2)', fontSize: 10 }}>{draft.airfield.inspectorName}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--color-text-3)' }}>Not completed</div>
                )}
              </div>
              <div>
                <div style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9, marginBottom: 2 }}>
                  Lighting
                </div>
                {draft.lighting.savedAt ? (
                  <>
                    <div style={{ color: '#22C55E', fontWeight: 600 }}>
                      Completed {new Date(draft.lighting.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ color: 'var(--color-text-2)', fontSize: 10 }}>{draft.lighting.inspectorName}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--color-text-3)' }}>Not completed</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* ══ CM/JM STANDALONE FORM                               */}
        {/* ══════════════════════════════════════════════════════ */}
        {isCmJmTab ? (
          <>
            {/* CM/JM header */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-accent)' }}>
                {cmJmLabel}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                Fill out and file — this is a standalone record separate from the daily inspection.
              </div>
            </div>

            {/* ── Personnel Multi-Select ── */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
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
                          border: `1px solid ${selected ? 'rgba(56,189,248,0.5)' : 'var(--color-text-4)'}`,
                          borderBottom: selected ? 'none' : undefined,
                          background: selected ? 'var(--color-border-mid)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => togglePersonnel(person)}
                          style={{ accentColor: 'var(--color-accent)', width: 14, height: 14 }}
                        />
                        <span style={{ fontSize: 13, color: selected ? 'var(--color-accent)' : 'var(--color-text-2)', fontWeight: selected ? 600 : 400 }}>
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
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Comments
              </div>
              <textarea
                className="input-dark"
                rows={6}
                placeholder={`Enter ${cmJmLabel.toLowerCase()} comments...`}
                value={currentHalf?.specialComment || ''}
                onChange={(e) => setSpecialComment(e.target.value)}
                style={{ resize: 'vertical', fontSize: 13 }}
              />
            </div>

            {/* ── Photos for CM/JM Inspection ── */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Photos / Attachments
              </div>

              {/* Thumbnails */}
              {specialPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {specialPhotos.map((photo, idx) => (
                    <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-mid)' }}>
                      <img src={photo.url} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(photo.url)
                          setSpecialPhotos((prev) => prev.filter((_, i) => i !== idx))
                        }}
                        style={{
                          position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', cursor: 'pointer',
                          fontSize: 10, lineHeight: '18px', textAlign: 'center', padding: 0,
                        }}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Photo button */}
              <PhotoPickerButton
                onUpload={() => specialFileRef.current?.click()}
                onCapture={() => specialCameraRef.current?.click()}
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
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                  {answeredCount}/{totalItems} items
                </div>
              </div>
              <div
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: `conic-gradient(#22C55E ${progress * 3.6}deg, var(--color-bg-elevated) ${progress * 3.6}deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-surface-solid)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'var(--color-text-1)',
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: sectionComplete ? '#22C55E' : 'var(--color-text-2)' }}>
                      {section.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{done}/{section.items.length}</div>
                  </div>

                  {section.guidance && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 8, lineHeight: '14px', fontStyle: 'italic' }}>
                      {section.guidance}
                    </div>
                  )}

                  {section.items.map((item) => {
                    // BWC item
                    if (item.type === 'bwc') {
                      return (
                        <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-bg-elevated)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 600, minWidth: 22 }}>{item.itemNumber}.</span>
                            <span style={{ fontSize: 13, color: 'var(--color-text-1)', lineHeight: '18px' }}>{item.item}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, paddingLeft: 30 }}>
                            {BWC_OPTIONS.map((opt) => {
                              const selected = currentHalf?.bwcValue === opt
                              const colorMap: Record<string, string> = { LOW: '#22C55E', MOD: '#EAB308', SEV: '#F97316', PROHIB: '#EF4444' }
                              const color = colorMap[opt] || 'var(--color-text-2)'
                              return (
                                <button
                                  key={opt}
                                  onClick={() => setBwcValue(opt)}
                                  style={{
                                    padding: '6px 12px', borderRadius: 6,
                                    border: `2px solid ${selected ? color : 'var(--color-text-4)'}`,
                                    background: selected ? `${color}20` : 'transparent',
                                    color: selected ? color : 'var(--color-text-2)',
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
                    const borderColor = state === 'pass' ? '#22C55E' : state === 'fail' ? '#EF4444' : state === 'na' ? 'var(--color-text-3)' : 'var(--color-text-4)'
                    const bgColor = state === 'pass' ? 'rgba(34,197,94,0.1)' : state === 'fail' ? 'rgba(239,68,68,0.1)' : state === 'na' ? 'rgba(100,116,139,0.1)' : 'transparent'

                    return (
                      <div key={item.id} style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 0' }}>
                          <span style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 600, minWidth: 22, paddingTop: 5 }}>
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
                              color: state === 'pass' ? '#22C55E' : state === 'fail' ? '#EF4444' : state === 'na' ? 'var(--color-text-3)' : 'transparent',
                              fontFamily: 'inherit',
                            }}
                          >
                            {state === 'pass' ? '\u2713' : state === 'fail' ? '\u2717' : state === 'na' ? 'N/A' : ''}
                          </button>
                          <div
                            style={{
                              fontSize: 13, color: state === 'na' ? 'var(--color-text-3)' : 'var(--color-text-1)',
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
                                width: '100%', background: '#fff',
                                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
                                padding: '8px 10px', color: '#111', fontSize: 12,
                                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                              }}
                            />

                            {/* Photo thumbnails for this item */}
                            {itemPhotos[item.id] && itemPhotos[item.id].length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                                {itemPhotos[item.id].map((photo, pi) => (
                                  <div key={pi} style={{ position: 'relative', width: 56, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(239,68,68,0.3)' }}>
                                    <img src={photo.url} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        URL.revokeObjectURL(photo.url)
                                        setItemPhotos((prev) => ({
                                          ...prev,
                                          [item.id]: prev[item.id].filter((_, i) => i !== pi),
                                        }))
                                      }}
                                      style={{
                                        position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
                                        background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', cursor: 'pointer',
                                        fontSize: 10, lineHeight: '16px', textAlign: 'center', padding: 0,
                                      }}
                                    >
                                      x
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Photo button */}
                            <div style={{ marginTop: 6 }}>
                              <PhotoPickerButton
                                variant="compact"
                                onUpload={() => { setActivePhotoItemId(item.id); itemFileRef.current?.click() }}
                                onCapture={() => { setActivePhotoItemId(item.id); itemCameraRef.current?.click() }}
                              />
                            </div>

                            {/* Interactive map for location selection */}
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                                Pin Location on Map
                              </div>
                              <InspectionLocationMap
                                onPointSelected={(lat, lng) => handleItemPointSelected(item.id, lat, lng)}
                                selectedLat={itemLocations[item.id]?.lat ?? null}
                                selectedLng={itemLocations[item.id]?.lon ?? null}
                                flyToPoint={itemFlyTo[item.id] ?? null}
                              />
                            </div>

                            {/* Use My Location GPS button */}
                            <button
                              type="button"
                              onClick={() => captureLocation(item.id)}
                              disabled={gpsLoading === item.id}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                width: '100%', padding: '10px 16px', marginTop: 6, borderRadius: 8,
                                border: '1px solid var(--color-border-active)', background: 'var(--color-border)',
                                color: 'var(--color-accent)', fontSize: 13, fontWeight: 600,
                                cursor: gpsLoading === item.id ? 'wait' : 'pointer', fontFamily: 'inherit',
                                opacity: gpsLoading === item.id ? 0.6 : 1,
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                              </svg>
                              {gpsLoading === item.id ? 'Getting Location...' : 'Use My Location'}
                            </button>
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
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
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

        {/* ── Smart Action Buttons ── */}
        {isCmJmTab ? (
          /* CM/JM: single "Complete & File" button — standalone, one-step */
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={handleFileCmJm}
              disabled={filing}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                color: '#FFF', fontSize: 15, fontWeight: 700,
                cursor: filing ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: filing ? 0.7 : 1,
              }}
            >
              {filing ? 'Filing...' : 'Complete & File'}
            </button>
          </div>
        ) : (
          /* Airfield/Lighting: Save progress or Complete, then File */
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {!currentHalf?.savedAt && (
              progress >= 100 ? (
                <button
                  onClick={() => handleComplete()}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, var(--color-accent-secondary), var(--color-cyan))',
                    color: '#FFF', fontSize: 15, fontWeight: 700,
                    cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Completing...' : 'Complete'}
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                    color: '#FFF', fontSize: 15, fontWeight: 700,
                    cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )
            )}

            {/* File button: appears once at least one standard tab is completed */}
            {(draft.airfield.savedAt || draft.lighting.savedAt) && (
              <button
                onClick={() => handleFile()}
                disabled={filing}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 10,
                  border: '1px solid rgba(34,197,94,0.4)',
                  background: 'rgba(34,197,94,0.1)',
                  color: '#22C55E',
                  fontSize: 15, fontWeight: 700,
                  cursor: filing ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: filing ? 0.7 : 1,
                }}
              >
                {filing ? 'Filing...' : 'File'}
              </button>
            )}
          </div>
        )}

        {/* Hidden file inputs for photo capture */}
        <input ref={itemFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleItemPhoto} />
        <input ref={itemCameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleItemPhoto} />
        <input ref={specialFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleSpecialPhoto} />
        <input ref={specialCameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleSpecialPhoto} />

        {/* ── Lighting Incomplete Confirmation Dialog ── */}
        {showLightingWarning && (
          <div
            onClick={() => setShowLightingWarning(false)}
            style={{
              position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 340,
                border: '1px solid rgba(251,191,36,0.3)',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: '#FBBF24', marginBottom: 10 }}>Lighting Inspection Not Completed</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-1)', lineHeight: 1.5, marginBottom: 16 }}>
                Are you sure you want to file this inspection without the lighting inspection being completed?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setShowLightingWarning(false)
                    handleFile(true)
                  }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', border: '1px solid rgba(251,191,36,0.4)',
                    background: 'rgba(251,191,36,0.1)', color: '#FBBF24', fontFamily: 'inherit',
                  }}
                >File Without Lighting</button>
                <button
                  onClick={() => setShowLightingWarning(false)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                    background: 'var(--color-bg)', color: 'var(--color-text-2)', fontFamily: 'inherit',
                  }}
                >Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Airfield Diagram Fullscreen Overlay ── */}
        {showDiagram && diagramUrl && (
          <div
            onClick={() => setShowDiagram(false)}
            onTouchEnd={(e) => { if (e.target === e.currentTarget) setShowDiagram(false) }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '60px 12px 24px',
              overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setShowDiagram(false) }}
              style={{
                position: 'fixed', top: 12, right: 12, zIndex: 10000,
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
                padding: '10px 18px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
            >Close</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={diagramUrl}
              alt="Airfield Diagram"
              onClick={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 100px)', objectFit: 'contain', borderRadius: 8 }}
            />
          </div>
        )}
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
          <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
            {dailyReports.length} report{dailyReports.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {draft && showHistory && (
            <button
              onClick={() => setShowHistory(false)}
              style={{
                background: '#0EA5E914', border: '1px solid #0EA5E933', borderRadius: 8,
                padding: '8px 14px', color: 'var(--color-accent-secondary)', fontSize: 12, fontWeight: 600,
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
          { key: 'all', label: `All (${dailyReports.length})`, color: 'var(--color-cyan)' },
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
                background: active ? `${chip.color}22` : 'var(--color-bg-elevated)',
                color: active ? chip.color : 'var(--color-text-3)',
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
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>
          {search || typeFilter !== 'all' ? 'No inspections match your filter.' : 'No inspections filed yet.'}
        </div>
      )}

      {/* Inspection Report Cards */}
      {!loading && filtered.map((report) => {
        const isDaily = report.type === 'daily'
        const isSpecialType = report.inspectionType === 'construction_meeting' || report.inspectionType === 'joint_monthly'
        const isInProgress = report.status === 'in_progress'
        // Link to the airfield inspection detail (which will fetch the full group)
        const linkId = isSpecialType ? report.id : (report.airfield?.id || report.lighting?.id)
        const displayIds = isSpecialType ? [] : [report.airfield?.display_id, report.lighting?.display_id].filter(Boolean)

        const specialLabel = report.inspectionType === 'construction_meeting'
          ? 'Construction Meeting Inspection'
          : report.inspectionType === 'joint_monthly'
          ? 'Joint Monthly Airfield Inspection'
          : ''
        const borderColor = isInProgress ? '#3B82F6' : isSpecialType ? '#A78BFA' : isDaily ? 'var(--color-cyan)' : report.airfield ? '#34D399' : '#FBBF24'

        const cardContent = (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                {isSpecialType ? (
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-purple)' }}>
                    {specialLabel}
                  </span>
                ) : isDaily ? (
                  <span style={{ fontSize: 13, fontWeight: 800, color: isInProgress ? '#3B82F6' : 'var(--color-cyan)' }}>
                    Airfield Inspection Report
                  </span>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: isInProgress ? '#3B82F6' : 'var(--color-cyan)' }}>
                    {displayIds[0]}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {isInProgress && (
                  <Badge label="In Progress" color="#3B82F6" />
                )}
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
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-2)' }}>
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
                      <span key={p} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(167,139,250,0.1)', color: 'var(--color-purple)', fontWeight: 600 }}>
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
                    <span style={{ color: 'var(--color-text-3)', fontWeight: 600 }}>{report.totalNa} N/A</span>
                  )}
                  <span style={{ color: 'var(--color-text-3)' }}>/ {report.totalItems} items</span>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--color-text-3)' }}>
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
          </>
        )

        // In-progress cards: click to resume instead of navigating to detail page
        if (isInProgress) {
          return (
            <div
              key={report.id}
              onClick={() => handleResume(report)}
              className="card"
              style={{
                display: 'block', marginBottom: 6, cursor: 'pointer',
                textDecoration: 'none', color: 'inherit',
                borderLeft: `3px solid ${borderColor}`,
              }}
            >
              {cardContent}
            </div>
          )
        }

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
            {cardContent}
          </Link>
        )
      })}
    </div>
  )
}
