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
  RSC_CONDITIONS,
  RCR_CONDITION_TYPES,
  type InspectionSection,
} from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { fetchInspections, createInspection, saveInspectionDraft, fileInspection, fetchDailyGroup, getInspectorName, type InspectionRow } from '@/lib/supabase/inspections'
import { logActivity } from '@/lib/supabase/activity'
import { updateAirfieldStatus } from '@/lib/supabase/airfield-status'
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
import { uploadInspectionPhoto } from '@/lib/supabase/inspections'
import type { InspectionItem, SimpleDiscrepancy } from '@/lib/supabase/types'
import { SimpleDiscrepancyPanelGroup } from '@/components/ui/simple-discrepancy-panel-group'

type BwcValue = null | (typeof BWC_OPTIONS)[number]
type TabType = 'airfield' | 'lighting'

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

  // ── Sync URL params (handles client-side navigation) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'history') {
      setShowHistory(true)
    }
    const typeParam = params.get('type') as TabType | null
    if (typeParam && ['airfield', 'lighting'].includes(typeParam)) {
      setActiveTab(typeParam)
    }
  }, [])

  // ── Action state ──
  const [saving, setSaving] = useState(false)
  const [filing, setFiling] = useState(false)
  const [showLightingWarning, setShowLightingWarning] = useState(false)

  // ── Photo state for fail items (keyed by itemId → discrepancy index → photos) ──
  const [itemPhotos, setItemPhotos] = useState<Record<string, { file: File; url: string; name: string }[]>>({})
  const [activePhotoItemId, setActivePhotoItemId] = useState<string | null>(null)
  const itemFileRef = useRef<HTMLInputElement>(null)


  // ── Discrepancy photos: Record<itemId, photos[][]> — one array per discrepancy ──
  const [discPhotos, setDiscPhotos] = useState<Record<string, { file: File; url: string; name: string }[][]>>({})

  // ── GPS location state for fail items ──
  const [itemLocations, setItemLocations] = useState<Record<string, { lat: number; lon: number }>>({})
  const [gpsLoading, setGpsLoading] = useState<string | null>(null)
  const [itemFlyTo, setItemFlyTo] = useState<Record<string, { lat: number; lng: number }>>({})
  // ── GPS state for discrepancy panels: "itemId:discIndex" ──
  const [discGpsLoading, setDiscGpsLoading] = useState<string | null>(null)
  const [discFlyTo, setDiscFlyTo] = useState<Record<string, { lat: number; lng: number }>>({})


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

  // ── Load draft: localStorage (instant) then Supabase (async, cross-device) ──
  useEffect(() => {
    // Phase 1: Sync — load from localStorage
    const stored = loadDraft(installationId)
    if (stored) setDraft(stored)
    setDraftLoaded(true)

    // Phase 2: Async — check Supabase for newer in-progress drafts
    fetchInspections(installationId, 'in_progress').then((dbDrafts) => {
      if (!dbDrafts.length) return
      let merged = false
      const current = stored || createNewDraft()

      for (const dbRow of dbDrafts) {
        if (!dbRow.draft_data) continue
        const tab = dbRow.inspection_type as 'airfield' | 'lighting' | 'construction_meeting' | 'joint_monthly'
        if (!current[tab]) continue

        const localTime = current[tab].savedAt ? new Date(current[tab].savedAt!).getTime() : 0
        const dbTime = dbRow.saved_at ? new Date(dbRow.saved_at).getTime() : 0
        if (dbTime > localTime) {
          current[tab] = { ...(dbRow.draft_data as unknown as InspectionHalfDraft), dbRowId: dbRow.id }
          merged = true
        } else if (!current[tab].dbRowId && dbRow.id) {
          // Link the DB row ID even if local is newer
          current[tab].dbRowId = dbRow.id
        }
      }

      if (merged) {
        setDraft({ ...current })
        saveDraftToStorage(current, installationId)
        toast.info('Draft loaded from server')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId])

  // ── Auto-begin: if ?action=begin and no draft, create one ──
  useEffect(() => {
    if (!draftLoaded || autoBeginHandled.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'begin') {
      autoBeginHandled.current = true
      const typeParam = params.get('type') as TabType | null
      const tab: TabType = (typeParam && ['airfield', 'lighting'].includes(typeParam))
        ? typeParam : 'airfield'
      if (!draft) {
        const newDraft = createNewDraft()
        setDraft(newDraft)
        saveDraftToStorage(newDraft, installationId)
        toast.success('New inspection started')
      }
      setActiveTab(tab)
      window.scrollTo(0, 0)
    }
  }, [draftLoaded, draft, installationId])

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
        if (item.type === 'rsc') return true // RSC is optional, doesn't block completion
        if (item.type === 'rcr') return true // RCR is optional, doesn't block completion
        return true // all items default to pass
      }).length
    : 0
  const progress = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0

  const passedCount = currentHalf
    ? visibleItems.filter((item) => {
        if (item.type === 'bwc') return currentHalf.bwcValue !== null
        return (currentHalf.responses[item.id] ?? 'pass') === 'pass'
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
      const current = h.responses[id] ?? 'pass' // default = pass
      let next: 'pass' | 'fail' | 'na' = 'pass'
      if (current === 'pass') next = 'fail'
      else if (current === 'fail') next = 'na'
      else if (current === 'na') next = 'pass'

      const newDiscs = { ...h.discrepancies }
      if (next === 'fail' && !newDiscs[id]) {
        // Auto-create first discrepancy when toggled to fail
        newDiscs[id] = [{ comment: '', location: null, photo_ids: [] }]
      } else if (next !== 'fail') {
        // Clean up discrepancies when toggled away from fail
        delete newDiscs[id]
      }

      return { ...h, responses: { ...h.responses, [id]: next }, discrepancies: newDiscs }
    })
  }


  const setBwcValue = (val: BwcValue) => {
    updateHalf(activeTab, (h) => ({ ...h, bwcValue: h.bwcValue === val ? null : val }))
  }

  const setRscCondition = (val: string) => {
    updateHalf(activeTab, (h) => ({ ...h, rscCondition: h.rscCondition === val ? null : val }))
  }

  const setRcrValue = (val: string) => {
    updateHalf(activeTab, (h) => ({ ...h, rcrValue: val || null }))
  }

  const setRcrConditionType = (val: string) => {
    updateHalf(activeTab, (h) => ({ ...h, rcrConditionType: val || null }))
  }

  const toggleRcrReported = () => {
    updateHalf(activeTab, (h) => ({
      ...h,
      rcrReported: !h.rcrReported,
      // Clear RCR values when toggling off
      ...(!h.rcrReported ? {} : { rcrValue: null, rcrConditionType: null }),
    }))
  }

  const setComment = (itemId: string, text: string) => {
    updateHalf(activeTab, (h) => ({ ...h, comments: { ...h.comments, [itemId]: text } }))
  }

  // ── Discrepancy handlers ──
  const handleDiscChange = (itemId: string, index: number, detail: SimpleDiscrepancy) => {
    updateHalf(activeTab, (h) => {
      const arr = [...(h.discrepancies[itemId] || [])]
      // Merge: preserve fields from state, overlay with passed detail
      // This prevents stale render props from overwriting locations/photos
      const prev = arr[index] || { comment: '', location: null, photo_ids: [] }
      arr[index] = { ...prev, ...detail }
      // Also sync first discrepancy comment to legacy comments
      if (index === 0) {
        return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr }, comments: { ...h.comments, [itemId]: arr[index].comment } }
      }
      return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr } }
    })
  }

  const handleAddDisc = (itemId: string) => {
    updateHalf(activeTab, (h) => {
      const arr = [...(h.discrepancies[itemId] || [])]
      arr.push({ comment: '', location: null, photo_ids: [] })
      return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr } }
    })
    // Add empty photo array for new discrepancy
    setDiscPhotos((prev) => {
      const arr = [...(prev[itemId] || [])]
      arr.push([])
      return { ...prev, [itemId]: arr }
    })
  }

  const handleRemoveDisc = (itemId: string, index: number) => {
    updateHalf(activeTab, (h) => {
      const arr = [...(h.discrepancies[itemId] || [])]
      if (arr.length <= 1) return h // Keep at least one
      arr.splice(index, 1)
      return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr } }
    })
    // Remove corresponding photos
    setDiscPhotos((prev) => {
      const arr = [...(prev[itemId] || [])]
      if (arr.length > 1) arr.splice(index, 1)
      return { ...prev, [itemId]: arr }
    })
  }

  const handleDiscAddPhotos = (itemId: string, discIndex: number, files: FileList) => {
    const newPhotos = Array.from(files).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }))
    setDiscPhotos((prev) => {
      const arr = [...(prev[itemId] || [])]
      while (arr.length <= discIndex) arr.push([])
      arr[discIndex] = [...arr[discIndex], ...newPhotos]
      return { ...prev, [itemId]: arr }
    })
    toast.success(`${files.length} photo(s) added`)
  }

  const handleDiscRemovePhoto = (itemId: string, discIndex: number, photoIdx: number) => {
    setDiscPhotos((prev) => {
      const arr = [...(prev[itemId] || [])]
      if (arr[discIndex]) {
        URL.revokeObjectURL(arr[discIndex][photoIdx].url)
        arr[discIndex] = arr[discIndex].filter((_, i) => i !== photoIdx)
      }
      return { ...prev, [itemId]: arr }
    })
  }

  const handleDiscPointSelected = (itemId: string, discIndex: number, lat: number, lng: number) => {
    // Only pass location — handleDiscChange merges with prev, preserving comment/photo_ids
    handleDiscChange(itemId, discIndex, { location: { lat, lon: lng } } as SimpleDiscrepancy)
    toast.success(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }

  const handleDiscCaptureGps = (itemId: string, discIndex: number) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    const key = `${itemId}:${discIndex}`
    setDiscGpsLoading(key)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        // Only pass location — handleDiscChange merges with prev, preserving comment/photo_ids
        handleDiscChange(itemId, discIndex, { location: { lat, lon } } as SimpleDiscrepancy)
        setDiscFlyTo((prev) => ({ ...prev, [key]: { lat, lng: lon } }))
        setDiscGpsLoading(null)
        toast.success('Location acquired')
      },
      (error) => {
        setDiscGpsLoading(null)
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
  }

  const setNotes = (text: string) => {
    updateHalf(activeTab, (h) => ({ ...h, notes: text }))
  }

  const sectionDoneCount = (section: InspectionSection) =>
    currentHalf
      ? section.items.filter((item) => {
          if (item.type === 'bwc') return currentHalf.bwcValue !== null
          if (item.type === 'rsc') return currentHalf.rscCondition !== null
          if (item.type === 'rcr') return currentHalf.rcrReported ? currentHalf.rcrValue !== null : currentHalf.rscCondition !== null
          return true // all items default to pass
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

    const secs = activeTab === 'airfield'
      ? (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
      : (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
    const { items, passed, failed, na, total } = halfDraftToItems(currentHalf, secs, itemLocations)

    const { data: saved, error } = await saveInspectionDraft({
      id: currentHalf.dbRowId,
      inspection_type: activeTab,
      draft_data: currentHalf,
      items,
      total_items: total,
      passed_count: passed,
      failed_count: failed,
      na_count: na,
      bwc_value: currentHalf.bwcValue,
      rsc_condition: currentHalf.rscCondition,
      rcr_value: currentHalf.rcrReported ? currentHalf.rcrValue : null,
      rcr_condition: currentHalf.rcrReported ? currentHalf.rcrConditionType : null,
      notes: currentHalf.notes || null,
      daily_group_id: draft.id,
      construction_meeting: false,
      joint_monthly: false,
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

    const tabLabels: Record<TabType, string> = { airfield: 'Airfield', lighting: 'Lighting' }
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
      if (tab !== 'airfield' && tab !== 'lighting') continue
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
      : (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
    const { items, passed, failed, na, total } = halfDraftToItems(completedHalf, secs, itemLocations)

    const { data: saved } = await saveInspectionDraft({
      id: half.dbRowId,
      inspection_type: targetTab,
      draft_data: completedHalf,
      items,
      total_items: total,
      passed_count: passed,
      failed_count: failed,
      na_count: na,
      bwc_value: completedHalf.bwcValue,
      rsc_condition: completedHalf.rscCondition,
      rcr_value: completedHalf.rcrReported ? completedHalf.rcrValue : null,
      rcr_condition: completedHalf.rcrReported ? completedHalf.rcrConditionType : null,
      notes: completedHalf.notes || null,
      daily_group_id: draft.id,
      construction_meeting: false,
      joint_monthly: false,
      base_id: installationId,
    })

    // Store the DB row ID back into the draft
    if (saved && !half.dbRowId) {
      updateHalf(targetTab, (h) => ({ ...h, dbRowId: saved.id }))
    }

    if (saved) {
      logActivity('completed', 'inspection', saved.id, saved.display_id, { inspection_type: targetTab }, installationId)
    }

    // Push BWC/RSC/RCR to dashboard on complete (always, even if draft save had issues)
    const nowIso = new Date().toISOString()
    if (completedHalf.bwcValue) {
      await updateAirfieldStatus({ bwc_value: completedHalf.bwcValue, bwc_updated_at: nowIso }, installationId)
    }
    if (completedHalf.rscCondition) {
      await updateAirfieldStatus({ rsc_condition: completedHalf.rscCondition, rsc_updated_at: nowIso }, installationId)
    }
    if (completedHalf.rcrReported && completedHalf.rcrValue) {
      // RCR reported — update dashboard with RCR (replaces RSC display)
      await updateAirfieldStatus({
        rcr_touchdown: completedHalf.rcrValue,
        rcr_condition: completedHalf.rcrConditionType || null,
        rcr_updated_at: nowIso,
      }, installationId)
    } else if (completedHalf.rscCondition && !completedHalf.rcrReported) {
      // RSC only — clear any existing RCR so dashboard shows RSC
      await updateAirfieldStatus({
        rcr_touchdown: null,
        rcr_midpoint: null,
        rcr_rollout: null,
        rcr_condition: null,
        rcr_updated_at: null,
      }, installationId)
    }

    const tabLabels: Record<TabType, string> = { airfield: 'Airfield', lighting: 'Lighting' }
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
      window.scrollTo(0, 0)
    }
  }

  // ── File the daily inspection (write to Supabase) ──
  // Auto-completes the current tab first, then files all completed halves (airfield + lighting only).
  const handleFile = async (skipLightingWarning = false) => {
    if (!draft) return

    // Auto-complete the current tab if not already completed AND has responses
    const currentDraftHalf = draft[activeTab]
    const hasResponses = Object.keys(currentDraftHalf.responses).length > 0 || currentDraftHalf.bwcValue !== null || currentDraftHalf.rscCondition !== null || currentDraftHalf.rcrValue !== null
    if (!currentDraftHalf.savedAt && hasResponses) {
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
      const { items, passed, failed, na, total } = halfDraftToItems(airfieldHalf, afSecs, itemLocations)

      if (airfieldHalf.dbRowId) {
        const { data: filed_data, error } = await fileInspection({
          id: airfieldHalf.dbRowId,
          items,
          total_items: total,
          passed_count: passed,
          failed_count: failed,
          na_count: na,
          bwc_value: airfieldHalf.bwcValue,
          rsc_condition: airfieldHalf.rscCondition,
          rcr_value: airfieldHalf.rcrReported ? airfieldHalf.rcrValue : null,
          rcr_condition: airfieldHalf.rcrReported ? airfieldHalf.rcrConditionType : null,
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
          rsc_condition: airfieldHalf.rscCondition,
          rcr_value: airfieldHalf.rcrReported ? airfieldHalf.rcrValue : null,
          rcr_condition: airfieldHalf.rcrReported ? airfieldHalf.rcrConditionType : null,
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
      const { items, passed, failed, na, total } = halfDraftToItems(lightingHalf, ltSecs, itemLocations)

      if (lightingHalf.dbRowId) {
        const { data: filed_data, error } = await fileInspection({
          id: lightingHalf.dbRowId,
          items,
          total_items: total,
          passed_count: passed,
          failed_count: failed,
          na_count: na,
          bwc_value: lightingHalf.bwcValue,
          rsc_condition: lightingHalf.rscCondition,
          rcr_value: lightingHalf.rcrReported ? lightingHalf.rcrValue : null,
          rcr_condition: lightingHalf.rcrReported ? lightingHalf.rcrConditionType : null,
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
          rsc_condition: lightingHalf.rscCondition,
          rcr_value: lightingHalf.rcrReported ? lightingHalf.rcrValue : null,
          rcr_condition: lightingHalf.rcrReported ? lightingHalf.rcrConditionType : null,
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
      // Push RSC/RCR/BWC to dashboard directly (belt-and-suspenders with create/fileInspection)
      const filedHalf = airfieldSaved ? airfieldHalf : lightingHalf
      const fileNow = new Date().toISOString()
      if (filedHalf.bwcValue) {
        await updateAirfieldStatus({ bwc_value: filedHalf.bwcValue, bwc_updated_at: fileNow }, installationId)
      }
      if (filedHalf.rscCondition) {
        await updateAirfieldStatus({ rsc_condition: filedHalf.rscCondition, rsc_updated_at: fileNow }, installationId)
      }
      if (filedHalf.rcrReported && filedHalf.rcrValue) {
        await updateAirfieldStatus({
          rcr_touchdown: filedHalf.rcrValue,
          rcr_condition: filedHalf.rcrConditionType || null,
          rcr_updated_at: fileNow,
        }, installationId)
      } else if (filedHalf.rscCondition && !filedHalf.rcrReported) {
        await updateAirfieldStatus({
          rcr_touchdown: null, rcr_midpoint: null, rcr_rollout: null,
          rcr_condition: null, rcr_updated_at: null,
        }, installationId)
      }

      // Upload photos per-discrepancy with their discrepancy index
      if (filedId && Object.keys(discPhotos).length > 0) {
        for (const [itemId, photoArrays] of Object.entries(discPhotos)) {
          for (let discIdx = 0; discIdx < photoArrays.length; discIdx++) {
            const photos = photoArrays[discIdx] || []
            const loc = draft?.[activeTab]?.discrepancies[itemId]?.[discIdx]?.location || itemLocations[itemId] || null
            for (const photo of photos) {
              await uploadInspectionPhoto(filedId, photo.file, itemId, loc?.lat, loc?.lon, installationId, discIdx)
            }
          }
        }
      }
      // Also upload any legacy itemPhotos
      if (filedId && Object.keys(itemPhotos).length > 0) {
        for (const [itemId, photos] of Object.entries(itemPhotos)) {
          const loc = itemLocations[itemId] || null
          for (const photo of photos) {
            await uploadInspectionPhoto(filedId, photo.file, itemId, loc?.lat, loc?.lon, installationId)
          }
        }
      }

      // Clean up object URLs
      Object.values(itemPhotos).flat().forEach((p) => URL.revokeObjectURL(p.url))
      Object.values(discPhotos).flat().flat().forEach((p) => URL.revokeObjectURL(p.url))
      setItemPhotos({})
      setDiscPhotos({})
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
    rscCondition: string | null
    rcrValue: string | null
    rcrCondition: string | null
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
        rscCondition: af?.rsc_condition || lt?.rsc_condition || null,
        rcrValue: af?.rcr_value || lt?.rcr_value || null,
        rcrCondition: af?.rcr_condition || lt?.rcr_condition || null,
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
        rscCondition: insp.rsc_condition || null,
        rcrValue: insp.rcr_value || null,
        rcrCondition: insp.rcr_condition || null,
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
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  // ══  WORKSPACE VIEW (active draft exists)  ══
  // ══════════════════════════════════════════════
  if (draft && !showHistory) {

    return (
      <div className="page-container">
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Daily Inspection</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
              Started {new Date(draft.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => diagramUrl ? setShowDiagram(true) : toast.info('No airfield diagram uploaded — add one in Settings > Base Configuration')}
              style={{
                background: '#A78BFA14', border: '1px solid #A78BFA33', borderRadius: 8,
                padding: '8px 14px', color: 'var(--color-purple)', fontSize: 'var(--fs-base)', fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              View Airfield Diagram
            </button>
            <button
              onClick={() => setShowHistory(true)}
              style={{
                background: '#0EA5E914', border: '1px solid #0EA5E933', borderRadius: 8,
                padding: '8px 14px', color: 'var(--color-accent-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              View History
            </button>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-text-4)', marginBottom: 12 }}>
          {([
            { key: 'airfield' as TabType, topLine: 'Airfield', bottomLine: null, wide: true },
            { key: 'lighting' as TabType, topLine: 'Lighting', bottomLine: null, wide: true },
          ]).map(({ key: type, topLine, bottomLine, wide }) => {
            const active = activeTab === type
            const half = draft[type]
            const saved = !!half.savedAt
            return (
              <button
                key={type}
                onClick={() => { setActiveTab(type); window.scrollTo(0, 0) }}
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
                    background: '#22C55E', color: '#FFF', fontSize: 'var(--fs-2xs)',
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

        {/* ── Status Bar ── */}
        <div className="card" style={{ marginBottom: 12, padding: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 'var(--fs-sm)' }}>
              <div>
                <div style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 'var(--fs-2xs)', marginBottom: 2 }}>
                  Airfield
                </div>
                {draft.airfield.savedAt ? (
                  <>
                    <div style={{ color: '#22C55E', fontWeight: 600 }}>
                      Completed {new Date(draft.airfield.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)' }}>{draft.airfield.inspectorName}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--color-text-3)' }}>Not completed</div>
                )}
              </div>
              <div>
                <div style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 'var(--fs-2xs)', marginBottom: 2 }}>
                  Lighting
                </div>
                {draft.lighting.savedAt ? (
                  <>
                    <div style={{ color: '#22C55E', fontWeight: 600 }}>
                      Completed {new Date(draft.lighting.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)' }}>{draft.lighting.inspectorName}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--color-text-3)' }}>Not completed</div>
                )}
              </div>
            </div>
          </div>


        {/* ── Progress + Mark All Pass ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700 }}>
                  {activeTab === 'airfield' ? 'Airfield Inspection' : 'Lighting Inspection'}
                </div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', marginTop: 2 }}>
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
                    fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)',
                  }}
                >
                  {progress}%
                </div>
              </div>
            </div>

            {/* ── Sections & Items ── */}
            {visibleSections.map((section) => {
              const done = sectionDoneCount(section)
              const sectionComplete = done === section.items.length

              return (
                <div key={section.id} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: sectionComplete ? '#22C55E' : 'var(--color-text-2)' }}>
                      {section.title}
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{done}/{section.items.length}</div>
                  </div>

                  {section.guidance && (
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 8, lineHeight: '14px', fontStyle: 'italic' }}>
                      {section.guidance}
                    </div>
                  )}

                  {section.items.map((item) => {
                    // BWC item
                    if (item.type === 'bwc') {
                      return (
                        <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-bg-elevated)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontWeight: 600, minWidth: 22 }}>{item.itemNumber}.</span>
                            <span style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: '18px' }}>{item.item}</span>
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
                                    fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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

                    // RSC item — shows Dry/Wet buttons + Report RCR toggle
                    if (item.type === 'rsc') {
                      return (
                        <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-bg-elevated)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontWeight: 600, minWidth: 22 }}>{item.itemNumber}.</span>
                            <span style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: '18px' }}>{item.item}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, paddingLeft: 30 }}>
                            {RSC_CONDITIONS.map((opt) => {
                              const selected = currentHalf?.rscCondition === opt
                              const color = opt === 'Dry' ? '#22C55E' : '#3B82F6'
                              return (
                                <button
                                  key={opt}
                                  onClick={() => setRscCondition(opt)}
                                  style={{
                                    padding: '6px 12px', borderRadius: 6,
                                    border: `2px solid ${selected ? color : 'var(--color-text-4)'}`,
                                    background: selected ? `${color}20` : 'transparent',
                                    color: selected ? color : 'var(--color-text-2)',
                                    fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                  }}
                                >
                                  {opt === 'Dry' ? '☀️' : '💧'} {opt}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }

                    // RCR item — toggle to report, with value + condition inputs
                    if (item.type === 'rcr') {
                      const rcrOn = currentHalf?.rcrReported ?? false
                      return (
                        <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-bg-elevated)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontWeight: 600, minWidth: 22 }}>{item.itemNumber}.</span>
                            <span style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: '18px' }}>{item.item}</span>
                          </div>
                          {/* Report RCR toggle */}
                          <div
                            onClick={toggleRcrReported}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginLeft: 30,
                              borderRadius: 8, cursor: 'pointer',
                              background: rcrOn ? 'rgba(34,211,238,0.08)' : 'var(--color-bg-elevated)',
                              border: rcrOn ? '1.5px solid var(--color-cyan, #22D3EE)' : '1.5px solid var(--color-text-4)',
                            }}
                          >
                            <div style={{
                              width: 20, height: 20, borderRadius: 4,
                              border: rcrOn ? '2px solid var(--color-cyan, #22D3EE)' : '2px solid var(--color-text-4)',
                              background: rcrOn ? 'var(--color-cyan, #22D3EE)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, color: 'var(--color-bg-surface-solid, #0F172A)', fontWeight: 700,
                            }}>
                              {rcrOn && '✓'}
                            </div>
                            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: rcrOn ? 'var(--color-cyan, #22D3EE)' : 'var(--color-text-2)' }}>
                              Report RCR
                            </span>
                          </div>
                          {/* RCR inputs (shown when toggle is on) */}
                          {rcrOn && (
                            <div style={{ display: 'flex', gap: 8, paddingLeft: 30, flexWrap: 'wrap', marginTop: 8 }}>
                              <input
                                type="number"
                                placeholder="RCR value"
                                value={currentHalf?.rcrValue || ''}
                                onChange={(e) => setRcrValue(e.target.value)}
                                style={{
                                  width: 100, padding: '6px 10px', borderRadius: 6,
                                  border: '2px solid var(--color-text-4)', background: 'var(--color-bg-surface)',
                                  color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', fontFamily: 'inherit',
                                }}
                              />
                              <select
                                value={currentHalf?.rcrConditionType || ''}
                                onChange={(e) => setRcrConditionType(e.target.value)}
                                style={{
                                  padding: '6px 10px', borderRadius: 6,
                                  border: '2px solid var(--color-text-4)', background: 'var(--color-bg-surface)',
                                  color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', fontFamily: 'inherit',
                                }}
                              >
                                <option value="">Condition type...</option>
                                {RCR_CONDITION_TYPES.map((ct) => (
                                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )
                    }

                    // Standard pass/fail/na item (default = pass)
                    const state = currentHalf?.responses[item.id] ?? 'pass'
                    const borderColor = state === 'pass' ? '#22C55E' : state === 'fail' ? '#EF4444' : state === 'na' ? 'var(--color-text-3)' : 'var(--color-text-4)'
                    const bgColor = state === 'pass' ? 'rgba(34,197,94,0.1)' : state === 'fail' ? 'rgba(239,68,68,0.1)' : state === 'na' ? 'rgba(100,116,139,0.1)' : 'transparent'

                    return (
                      <div key={item.id} style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 0' }}>
                          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontWeight: 600, minWidth: 22, paddingTop: 5 }}>
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
                              fontSize: 'var(--fs-md)', color: state === 'na' ? 'var(--color-text-3)' : 'var(--color-text-1)',
                              lineHeight: '18px', paddingTop: 4,
                              textDecoration: state === 'na' ? 'line-through' : 'none',
                            }}
                          >
                            {item.item}
                          </div>
                        </div>

                        {state === 'fail' && currentHalf?.discrepancies[item.id] && (
                          <div style={{ paddingLeft: 58, paddingBottom: 10 }}>
                            <SimpleDiscrepancyPanelGroup
                              discrepancies={currentHalf.discrepancies[item.id]}
                              onChange={(idx, detail) => handleDiscChange(item.id, idx, detail)}
                              onAdd={() => handleAddDisc(item.id)}
                              onRemove={(idx) => handleRemoveDisc(item.id, idx)}
                              localPhotos={discPhotos[item.id] || []}
                              onAddPhotos={(idx, files) => handleDiscAddPhotos(item.id, idx, files)}
                              onRemovePhoto={(idx, pIdx) => handleDiscRemovePhoto(item.id, idx, pIdx)}
                              onPointSelected={(idx, lat, lng) => handleDiscPointSelected(item.id, idx, lat, lng)}
                              onCaptureGps={(idx) => handleDiscCaptureGps(item.id, idx)}
                              gpsLoadingIndex={discGpsLoading?.startsWith(`${item.id}:`) ? parseInt(discGpsLoading.split(':')[1]) : null}
                              flyToPoints={(currentHalf.discrepancies[item.id] || []).map((_, i) => discFlyTo[`${item.id}:${i}`] || null)}
                              onSaveDraft={handleSave}
                              draftSaving={saving}
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
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                General Notes (Optional)
              </div>
              <textarea
                className="input-dark"
                rows={3}
                placeholder="Any additional notes..."
                value={currentHalf?.notes || ''}
                onChange={(e) => setNotes(e.target.value)}
                style={{ resize: 'vertical', fontSize: 'var(--fs-md)' }}
              />
            </div>

        {/* ── Smart Action Buttons ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {!currentHalf?.savedAt && (
            progress >= 100 ? (
              <button
                onClick={() => handleComplete()}
                disabled={saving}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, var(--color-accent-secondary), var(--color-cyan))',
                  color: '#FFF', fontSize: 'var(--fs-xl)', fontWeight: 700,
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
                  color: '#FFF', fontSize: 'var(--fs-xl)', fontWeight: 700,
                  cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Draft'}
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
                fontSize: 'var(--fs-xl)', fontWeight: 700,
                cursor: filing ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: filing ? 0.7 : 1,
              }}
            >
              {filing ? 'Filing...' : 'File'}
            </button>
          )}
        </div>

        {/* Hidden file inputs for photo capture */}
        <input ref={itemFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleItemPhoto} />


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
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: '#FBBF24', marginBottom: 10 }}>Lighting Inspection Not Completed</div>
              <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.5, marginBottom: 16 }}>
                Are you sure you want to file this inspection without the lighting inspection being completed?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setShowLightingWarning(false)
                    handleFile(true)
                  }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 700,
                    cursor: 'pointer', border: '1px solid rgba(251,191,36,0.4)',
                    background: 'rgba(251,191,36,0.1)', color: '#FBBF24', fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >File Without Lighting</button>
                <button
                  onClick={() => setShowLightingWarning(false)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
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
                padding: '10px 18px', color: '#fff', fontSize: 'var(--fs-xl)', fontWeight: 700, cursor: 'pointer',
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
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Inspections</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
            {dailyReports.length} report{dailyReports.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {draft && showHistory && (
            <button
              onClick={() => setShowHistory(false)}
              style={{
                background: '#0EA5E914', border: '1px solid #0EA5E933', borderRadius: 8,
                padding: '8px 14px', color: 'var(--color-accent-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600,
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
                padding: '8px 14px', color: '#22C55E', fontSize: 'var(--fs-base)', fontWeight: 600,
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
                padding: '6px 12px', borderRadius: 16, fontSize: 'var(--fs-sm)', fontWeight: 600,
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
        style={{ marginBottom: 10, fontSize: 'var(--fs-md)' }}
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
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-purple)' }}>
                    {specialLabel}
                  </span>
                ) : isDaily ? (
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: isInProgress ? '#3B82F6' : 'var(--color-cyan)' }}>
                    Airfield Inspection Report
                  </span>
                ) : (
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, fontFamily: 'monospace', color: isInProgress ? '#3B82F6' : 'var(--color-cyan)' }}>
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
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 'var(--fs-sm)', fontFamily: 'monospace', color: 'var(--color-text-2)' }}>
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
                      <span key={p} style={{ fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 4, background: 'rgba(167,139,250,0.1)', color: 'var(--color-purple)', fontWeight: 600 }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 'var(--fs-base)' }}>
                  <span style={{ color: '#22C55E', fontWeight: 700 }}>{report.totalPassed} Pass</span>
                  {report.totalFailed > 0 && (
                    <span style={{ color: '#EF4444', fontWeight: 700 }}>{report.totalFailed} Fail</span>
                  )}
                  {report.totalNa > 0 && (
                    <span style={{ color: 'var(--color-text-3)', fontWeight: 600 }}>{report.totalNa} N/A</span>
                  )}
                  <span style={{ color: 'var(--color-text-3)' }}>/ {report.totalItems} items</span>
                </div>

                {(report.bwcValue || report.rscCondition || report.rcrValue) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {report.bwcValue && (
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        color: report.bwcValue === 'LOW' ? '#22C55E' : report.bwcValue === 'MOD' ? '#EAB308' : report.bwcValue === 'SEV' ? '#F97316' : '#EF4444',
                        background: report.bwcValue === 'LOW' ? 'rgba(34,197,94,0.1)' : report.bwcValue === 'MOD' ? 'rgba(234,179,8,0.1)' : report.bwcValue === 'SEV' ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)',
                      }}>
                        BWC: {report.bwcValue}
                      </span>
                    )}
                    {report.rscCondition && (
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        color: report.rscCondition === 'Dry' ? '#22C55E' : '#3B82F6',
                        background: report.rscCondition === 'Dry' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                      }}>
                        RSC: {report.rscCondition}
                      </span>
                    )}
                    {report.rcrValue && (
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        color: '#8B5CF6',
                        background: 'rgba(139,92,246,0.1)',
                      }}>
                        RCR: {report.rcrValue}{report.rcrCondition ? ` (${report.rcrCondition})` : ''}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
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
