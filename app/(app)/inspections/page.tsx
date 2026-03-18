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
import { fetchInspections, createInspection, saveInspectionDraft, fileInspection, fetchDailyGroup, getInspectorName, deleteInspection, type InspectionRow } from '@/lib/supabase/inspections'
import { logActivity } from '@/lib/supabase/activity'
import { updateAirfieldStatus } from '@/lib/supabase/airfield-status'
import { useInstallation } from '@/lib/installation-context'
import { formatZuluTime, formatZuluDate, formatZuluDateTime, formatZuluDateShort } from '@/lib/utils'
import { fetchCurrentWeather } from '@/lib/weather'
import { fetchInspectionTemplate, toInspectionSections } from '@/lib/supabase/inspection-templates'
import { fetchLinksForTemplate, fetchTemplateId, systemIdsFromLinks, componentIdsFromLinks, type ItemLink } from '@/lib/supabase/inspection-item-links'
import {
  loadTypeDraft,
  saveTypeDraft,
  clearTypeDraft,
  createSingleDraft,
  halfDraftToItems,
  itemsToDraftHalf,
  type SingleInspectionDraft,
  type InspectionHalfDraft,
} from '@/lib/inspection-draft'
import { DEMO_INSPECTIONS } from '@/lib/demo-data'
import { getAirfieldDiagram } from '@/lib/airfield-diagram'
import { uploadInspectionPhoto } from '@/lib/supabase/inspections'
import { createDiscrepancy, uploadDiscrepancyPhoto } from '@/lib/supabase/discrepancies'
import { bulkUpdateStatus, fetchInfrastructureFeatures, buildFeatureDisplayName } from '@/lib/supabase/infrastructure-features'
import { fetchAllComponentsForBase, fetchLightingSystems } from '@/lib/supabase/lighting-systems'
import { createOutageEvent } from '@/lib/supabase/outage-events'
import { calculateAllSystemHealth, getAlertTier } from '@/lib/outage-rules'
import type { InspectionItem, SimpleDiscrepancy, InfrastructureFeature } from '@/lib/supabase/types'
import { SimpleDiscrepancyPanelGroup } from '@/components/ui/simple-discrepancy-panel-group'
import { ExpandableTextarea } from '@/components/ui/expandable-textarea'

type BwcValue = null | (typeof BWC_OPTIONS)[number]
type FormType = 'airfield' | 'lighting'

export default function InspectionsPage() {
  const router = useRouter()
  const { installationId, runways, areas: installationAreas, facilities } = useInstallation()

  // Base coordinates for weather (midpoint of first runway)
  const rwy0 = runways[0]
  const baseLat = rwy0 ? ((rwy0.end1_latitude ?? 0) + (rwy0.end2_latitude ?? 0)) / 2 : undefined
  const baseLon = rwy0 ? ((rwy0.end1_longitude ?? 0) + (rwy0.end2_longitude ?? 0)) / 2 : undefined

  // ── DB-driven templates (fall back to constants if not in DB) ──
  const [dbAirfieldSections, setDbAirfieldSections] = useState<InspectionSection[] | null>(null)
  const [dbLightingSections, setDbLightingSections] = useState<InspectionSection[] | null>(null)

  // ── Item → system/component links (for lighting inspections w/ infrastructure feature picker) ──
  const [itemKeyLinks, setItemKeyLinks] = useState<Record<string, ItemLink[]>>({})

  useEffect(() => {
    if (!installationId) return
    async function loadTemplates() {
      const [af, lt] = await Promise.all([
        fetchInspectionTemplate(installationId!, 'airfield'),
        fetchInspectionTemplate(installationId!, 'lighting'),
      ])
      if (af.length > 0) {
        const afSections = toInspectionSections(af)
        const hasRsc = afSections.some(s => s.items.some(i => i.type === 'rsc'))
        if (!hasRsc) {
          const rwySection = AIRFIELD_INSPECTION_SECTIONS.find(s => s.items.some(i => i.type === 'rsc'))
          if (rwySection) afSections.push(rwySection)
        }
        setDbAirfieldSections(afSections)
      }
      if (lt.length > 0) {
        const ltSections = toInspectionSections(lt)
        const hasRsc = ltSections.some(s => s.items.some(i => i.type === 'rsc'))
        if (!hasRsc) {
          const rwySection = LIGHTING_INSPECTION_SECTIONS.find(s => s.items.some(i => i.type === 'rsc'))
          if (rwySection) ltSections.push(rwySection)
        }
        setDbLightingSections(ltSections)

        const tmplId = await fetchTemplateId(installationId!, 'lighting')
        if (tmplId) {
          const links = await fetchLinksForTemplate(tmplId)
          const keyMap: Record<string, ItemLink[]> = {}
          for (const sec of lt) {
            for (const item of sec.items) {
              if (links[item.id] && links[item.id].length > 0) {
                keyMap[item.item_key] = links[item.id]
              }
            }
          }
          setItemKeyLinks(keyMap)
        }
      }
    }
    loadTemplates()
  }, [installationId])

  // ── Core state: separate drafts per type ──
  const [airfieldDraft, setAirfieldDraft] = useState<SingleInspectionDraft | null>(null)
  const [lightingDraft, setLightingDraft] = useState<SingleInspectionDraft | null>(null)
  const [activeForm, setActiveForm] = useState<FormType | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const autoBeginHandled = useRef(false)

  // ── History state ──
  const [liveInspections, setLiveInspections] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showHistory, setShowHistory] = useState(false)

  // ── User operating initials ──
  const [userOI, setUserOI] = useState('')
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('operating_initials').eq('id', user.id).single()
        .then(({ data }) => { if (data?.operating_initials) setUserOI(data.operating_initials) })
    })
  }, [])

  // ── Scroll to top on mount ──
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // ── Sync URL params ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'history') {
      setShowHistory(true)
    }
    const typeParam = params.get('type') as FormType | null
    if (typeParam && ['airfield', 'lighting'].includes(typeParam)) {
      setActiveForm(typeParam)
    }
  }, [])

  // ── Action state ──
  const [saving, setSaving] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  // ── Photo state for fail items ──
  const [itemPhotos, setItemPhotos] = useState<Record<string, { file: File; url: string; name: string }[]>>({})
  const [activePhotoItemId, setActivePhotoItemId] = useState<string | null>(null)
  const itemFileRef = useRef<HTMLInputElement>(null)

  // ── Discrepancy photos ──
  const [discPhotos, setDiscPhotos] = useState<Record<string, { file: File; url: string; name: string }[][]>>({})

  // ── GPS location state ──
  const [itemLocations, setItemLocations] = useState<Record<string, { lat: number; lon: number }>>({})
  const [gpsLoading, setGpsLoading] = useState<string | null>(null)
  const [itemFlyTo, setItemFlyTo] = useState<Record<string, { lat: number; lng: number }>>({})
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
        setItemLocations((prev) => ({ ...prev, [itemId]: { lat, lon } }))
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

  // ── Load drafts: localStorage per type + Supabase async ──
  useEffect(() => {
    // Migrate old coupled draft format to new per-type format
    const oldKey = installationId
      ? `airfield_daily_inspection_draft_${installationId}`
      : 'airfield_daily_inspection_draft'
    const oldRaw = typeof window !== 'undefined' ? localStorage.getItem(oldKey) : null
    if (oldRaw) {
      try {
        const oldDraft = JSON.parse(oldRaw)
        if (oldDraft.airfield && Object.keys(oldDraft.airfield.responses || {}).length > 0) {
          const afDraft: SingleInspectionDraft = {
            id: oldDraft.id || crypto.randomUUID(),
            createdAt: oldDraft.createdAt || new Date().toISOString(),
            type: 'airfield',
            half: oldDraft.airfield,
          }
          saveTypeDraft('airfield', afDraft, installationId)
        }
        if (oldDraft.lighting && Object.keys(oldDraft.lighting.responses || {}).length > 0) {
          const ltDraft: SingleInspectionDraft = {
            id: oldDraft.id || crypto.randomUUID(),
            createdAt: oldDraft.createdAt || new Date().toISOString(),
            type: 'lighting',
            half: oldDraft.lighting,
          }
          saveTypeDraft('lighting', ltDraft, installationId)
        }
        localStorage.removeItem(oldKey)
      } catch {
        localStorage.removeItem(oldKey)
      }
    }

    const afStored = loadTypeDraft('airfield', installationId)
    const ltStored = loadTypeDraft('lighting', installationId)

    if (afStored) {
      setAirfieldDraft(afStored)
    }

    if (ltStored) {
      setLightingDraft(ltStored)
    }

    setDraftLoaded(true)

    // Async: check Supabase for in-progress drafts
    fetchInspections(installationId, 'in_progress').then((dbDrafts) => {
      if (!dbDrafts.length) return

      for (const dbRow of dbDrafts) {
        const type = dbRow.inspection_type as FormType
        if (type !== 'airfield' && type !== 'lighting') continue

        if (dbRow.draft_data) {
          const dd = dbRow.draft_data as unknown as Record<string, unknown>
          const ddResponses = dd.responses as Record<string, unknown> | undefined
          if (ddResponses && Object.keys(ddResponses).length === 0 && !dd.savedAt) {
            deleteInspection(dbRow.id)
            continue
          }

          const stored = type === 'airfield' ? afStored : ltStored
          const localTime = stored?.half.savedAt ? new Date(stored.half.savedAt).getTime() : 0
          const dbTime = dbRow.saved_at ? new Date(dbRow.saved_at).getTime() : 0

          if (dbTime > localTime) {
            const newDraft: SingleInspectionDraft = {
              id: stored?.id || crypto.randomUUID(),
              createdAt: stored?.createdAt || new Date().toISOString(),
              type,
              half: { ...(dbRow.draft_data as unknown as InspectionHalfDraft), dbRowId: dbRow.id },
            }
            if (type === 'airfield') {
              setAirfieldDraft(newDraft)
              saveTypeDraft('airfield', newDraft, installationId)
            } else {
              setLightingDraft(newDraft)
              saveTypeDraft('lighting', newDraft, installationId)
            }
            toast.info(`${type === 'airfield' ? 'Airfield' : 'Lighting'} draft loaded from server`)
          }
        } else if (dbRow.items && dbRow.items.length > 0) {
          const half = itemsToDraftHalf(
            dbRow.items, dbRow.id,
            dbRow.inspector_name, dbRow.inspector_id || null,
            dbRow.rsc_condition, dbRow.rcr_value, dbRow.rcr_condition,
            dbRow.bwc_value, dbRow.weather_conditions, dbRow.temperature_f,
            dbRow.notes,
          )
          const newDraft: SingleInspectionDraft = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            type,
            half,
          }
          if (type === 'airfield') {
            setAirfieldDraft(newDraft)
            saveTypeDraft('airfield', newDraft, installationId)
          } else {
            setLightingDraft(newDraft)
            saveTypeDraft('lighting', newDraft, installationId)
          }
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId])

  // ── Auto-begin: if ?action=begin, show landing or auto-start type ──
  useEffect(() => {
    if (!draftLoaded || autoBeginHandled.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'begin') {
      autoBeginHandled.current = true
      const typeParam = params.get('type') as FormType | null
      if (typeParam && (typeParam === 'airfield' || typeParam === 'lighting')) {
        // If a draft exists for this type, resume it; otherwise start new
        const existingDraft = typeParam === 'airfield' ? airfieldDraft : lightingDraft
        if (existingDraft) {
          setActiveForm(typeParam)
          setShowHistory(false)
        } else {
          handleBeginNew(typeParam)
        }
      } else {
        setActiveForm(null)
        setShowHistory(false)
      }
      window.scrollTo(0, 0)
    }
    if (params.get('action') === 'reopen') {
      autoBeginHandled.current = true
      const groupId = params.get('groupId')
      if (groupId) {
        handleResume({ id: groupId, type: 'daily' })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded])

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
    if (draftLoaded && airfieldDraft) saveTypeDraft('airfield', airfieldDraft, installationId)
  }, [airfieldDraft, draftLoaded, installationId])

  useEffect(() => {
    if (draftLoaded && lightingDraft) saveTypeDraft('lighting', lightingDraft, installationId)
  }, [lightingDraft, draftLoaded, installationId])

  // ── Current form helpers ──
  const currentDraft = activeForm === 'airfield' ? airfieldDraft : activeForm === 'lighting' ? lightingDraft : null
  const currentHalf: InspectionHalfDraft | null = currentDraft?.half || null

  const sections = activeForm === 'airfield'
    ? (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
    : activeForm === 'lighting'
    ? (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
    : []

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
        if (item.type === 'rsc') return true
        if (item.type === 'rcr') return true
        return true
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
  const setCurrentDraft = useCallback((updater: (prev: SingleInspectionDraft) => SingleInspectionDraft) => {
    if (activeForm === 'airfield') {
      setAirfieldDraft((prev) => prev ? updater(prev) : prev)
    } else if (activeForm === 'lighting') {
      setLightingDraft((prev) => prev ? updater(prev) : prev)
    }
  }, [activeForm])

  const updateHalf = useCallback((updater: (h: InspectionHalfDraft) => InspectionHalfDraft) => {
    setCurrentDraft((prev) => ({ ...prev, half: updater(prev.half) }))
  }, [setCurrentDraft])

  const toggle = (id: string) => {
    updateHalf((h) => {
      const current = h.responses[id] ?? 'pass'
      let next: 'pass' | 'fail' | 'na' = 'pass'
      if (current === 'pass') next = 'fail'
      else if (current === 'fail') next = 'na'
      else if (current === 'na') next = 'pass'

      const newDiscs = { ...h.discrepancies }
      if (next === 'fail' && !newDiscs[id]) {
        newDiscs[id] = [{ comment: '', location: null, photo_ids: [] }]
      } else if (next !== 'fail') {
        delete newDiscs[id]
      }

      return { ...h, responses: { ...h.responses, [id]: next }, discrepancies: newDiscs }
    })
  }

  const setBwcValue = (val: BwcValue) => {
    updateHalf((h) => ({ ...h, bwcValue: h.bwcValue === val ? null : val }))
  }

  const setRscCondition = (val: string) => {
    updateHalf((h) => ({ ...h, rscCondition: h.rscCondition === val ? null : val }))
  }

  const setRcrValue = (val: string) => {
    updateHalf((h) => ({ ...h, rcrValue: val || null }))
  }

  const setRcrConditionType = (val: string) => {
    updateHalf((h) => ({ ...h, rcrConditionType: val || null }))
  }

  const toggleRcrReported = () => {
    updateHalf((h) => ({
      ...h,
      rcrReported: !h.rcrReported,
      ...(!h.rcrReported ? {} : { rcrValue: null, rcrConditionType: null }),
    }))
  }

  const setComment = (itemId: string, text: string) => {
    updateHalf((h) => ({ ...h, comments: { ...h.comments, [itemId]: text } }))
  }

  // ── Discrepancy handlers ──
  const handleDiscChange = (itemId: string, index: number, detail: SimpleDiscrepancy) => {
    updateHalf((h) => {
      const arr = [...(h.discrepancies[itemId] || [])]
      const prev = arr[index] || { comment: '', location: null, photo_ids: [] }
      arr[index] = { ...prev, ...detail }
      if (index === 0) {
        return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr }, comments: { ...h.comments, [itemId]: arr[index].comment } }
      }
      return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr } }
    })
  }

  const handleAddDisc = (itemId: string) => {
    updateHalf((h) => {
      const arr = [...(h.discrepancies[itemId] || [])]
      arr.push({ comment: '', location: null, photo_ids: [] })
      return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr } }
    })
    setDiscPhotos((prev) => {
      const arr = [...(prev[itemId] || [])]
      arr.push([])
      return { ...prev, [itemId]: arr }
    })
  }

  const handleRemoveDisc = (itemId: string, index: number) => {
    updateHalf((h) => {
      const arr = [...(h.discrepancies[itemId] || [])]
      if (arr.length <= 1) return h
      arr.splice(index, 1)
      return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr } }
    })
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

  // ── Auto-populate discrepancy fields when features are selected ──
  const handleFeaturesSelected = (itemId: string, discIndex: number, features: InfrastructureFeature[]) => {
    if (features.length === 0) return

    const avgLat = features.reduce((sum, f) => sum + f.latitude, 0) / features.length
    const avgLon = features.reduce((sum, f) => sum + f.longitude, 0) / features.length

    const featureNames = features.map(f => f.label || f.feature_type)
    const uniqueNames = Array.from(new Set(featureNames))
    const titleText = uniqueNames.length <= 3
      ? uniqueNames.join(', ')
      : `${uniqueNames.slice(0, 2).join(', ')} +${uniqueNames.length - 2} more`

    const featureDescriptions = features.map(f => buildFeatureDisplayName(f))
    const remarksText = `Lighting inspection: ${featureDescriptions.join('; ')} — marked inoperative.`

    const layers = Array.from(new Set(features.map(f => f.layer).filter(Boolean)))
    const locationText = layers.length > 0 ? layers.join(', ') : 'Airfield'

    const updates: Partial<SimpleDiscrepancy> = {
      location: { lat: avgLat, lon: avgLon },
      discrepancy_title: `${titleText} — Inoperative`,
      discrepancy_location_text: locationText,
    }

    updateHalf((h) => {
      const arr = [...(h.discrepancies[itemId] || [])]
      const prev = arr[discIndex] || { comment: '', location: null, photo_ids: [] }
      const merged = { ...prev, ...updates }
      if (!prev.comment || prev.comment.trim() === '') {
        merged.comment = remarksText
      }
      arr[discIndex] = merged as SimpleDiscrepancy
      return { ...h, discrepancies: { ...h.discrepancies, [itemId]: arr } }
    })
  }

  const setNotes = (text: string) => {
    updateHalf((h) => ({ ...h, notes: text }))
  }

  const sectionDoneCount = (section: InspectionSection) =>
    currentHalf
      ? section.items.filter((item) => {
          if (item.type === 'bwc') return currentHalf.bwcValue !== null
          if (item.type === 'rsc') return currentHalf.rscCondition !== null
          if (item.type === 'rcr') return currentHalf.rcrReported ? currentHalf.rcrValue !== null : currentHalf.rscCondition !== null
          return true
        }).length
      : 0

  // ── Begin new inspection of a specific type ──
  const handleBeginNew = async (type: FormType) => {
    const newDraft = createSingleDraft(type)
    if (type === 'airfield') {
      setAirfieldDraft(newDraft)
      saveTypeDraft('airfield', newDraft, installationId)
    } else {
      setLightingDraft(newDraft)
      saveTypeDraft('lighting', newDraft, installationId)
    }
    setActiveForm(type)
    setShowHistory(false)
    window.scrollTo(0, 0)

    const label = type === 'airfield' ? 'Daily Airfield Inspection' : 'Daily Lighting Inspection'
    toast.success(`${label} started`)

    // Fetch OI directly to avoid race with async profile load on mount
    let oi = userOI
    if (!oi) {
      const supabase = createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('operating_initials').eq('id', user.id).single()
          if (profile?.operating_initials) {
            oi = profile.operating_initials
            setUserOI(oi)
          }
        }
      }
    }
    const oiStr = oi ? `/${oi}` : ''
    logActivity(
      'started',
      'inspection',
      installationId || crypto.randomUUID(),
      undefined,
      { details: `AFLD3${oiStr} is on the airfield for the ${label}` },
      installationId,
    )

    // Save initial draft to DB so it persists across devices
    const secs = type === 'airfield'
      ? (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
      : (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
    const { items, passed, failed, na, total } = halfDraftToItems(newDraft.half, secs)
    const { data: saved } = await saveInspectionDraft({
      inspection_type: type,
      draft_data: newDraft.half,
      items,
      total_items: total,
      passed_count: passed,
      failed_count: failed,
      na_count: na,
      bwc_value: newDraft.half.bwcValue,
      rsc_condition: newDraft.half.rscCondition,
      notes: null,
      daily_group_id: newDraft.id,
      construction_meeting: false,
      joint_monthly: false,
      base_id: installationId,
    })
    if (saved) {
      const updateDraft = (prev: SingleInspectionDraft | null): SingleInspectionDraft | null => {
        if (!prev) return prev
        return { ...prev, half: { ...prev.half, dbRowId: saved.id } }
      }
      if (type === 'airfield') setAirfieldDraft(updateDraft)
      else setLightingDraft(updateDraft)
    }
  }

  // ── Discard current draft ──
  const handleDiscardDraft = async () => {
    if (!activeForm || !currentDraft) return
    if (currentDraft.half.dbRowId) {
      await deleteInspection(currentDraft.half.dbRowId)
    }
    clearTypeDraft(activeForm, installationId)
    if (activeForm === 'airfield') setAirfieldDraft(null)
    else setLightingDraft(null)
    setActiveForm(null)
    toast.success('Draft discarded')
    await loadHistory()
  }

  // ── Delete an in-progress inspection from history ──
  const handleDeleteInProgress = async (report: { id: string; airfield?: { id?: string } | null; lighting?: { id?: string } | null }) => {
    const ids = [report.airfield?.id, report.lighting?.id].filter(Boolean) as string[]
    if (ids.length === 0) ids.push(report.id)
    for (const id of ids) {
      await deleteInspection(id)
    }
    // Clear local draft if it matches
    if (airfieldDraft && ids.includes(airfieldDraft.half.dbRowId || '')) {
      clearTypeDraft('airfield', installationId)
      setAirfieldDraft(null)
    }
    if (lightingDraft && ids.includes(lightingDraft.half.dbRowId || '')) {
      clearTypeDraft('lighting', installationId)
      setLightingDraft(null)
    }
    toast.success('In-progress inspection deleted')
    await loadHistory()
  }

  // ── Save current draft to DB ──
  const handleSave = async () => {
    if (!activeForm || !currentDraft || !currentHalf) return
    setSaving(true)

    const secs = activeForm === 'airfield'
      ? (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
      : (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
    const { items, passed, failed, na, total } = halfDraftToItems(currentHalf, secs, itemLocations)

    const { data: saved, error } = await saveInspectionDraft({
      id: currentHalf.dbRowId,
      inspection_type: activeForm,
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
      daily_group_id: currentDraft.id,
      construction_meeting: false,
      joint_monthly: false,
      base_id: installationId,
    })

    if (error) {
      toast.error(`Failed to save: ${error}`)
      setSaving(false)
      return
    }

    if (saved && !currentHalf.dbRowId) {
      updateHalf((h) => ({ ...h, dbRowId: saved.id }))
    }

    const label = activeForm === 'airfield' ? 'Airfield' : 'Lighting'
    setSaving(false)
    toast.success(`${label} progress saved`)
    await loadHistory()
  }

  // ── Resume an in-progress inspection from DB ──
  const handleResume = async (report: { id: string; type: string; airfield?: { daily_group_id?: string } | null; lighting?: { daily_group_id?: string } | null }) => {
    const groupId = report.type === 'daily'
      ? report.id
      : (report.airfield?.daily_group_id || report.lighting?.daily_group_id || report.id)

    const members = await fetchDailyGroup(groupId)
    if (members.length === 0) {
      const { fetchInspection } = await import('@/lib/supabase/inspections')
      const single = await fetchInspection(report.id)
      if (single) members.push(single)
    }
    if (members.length === 0) {
      toast.error('Could not find inspection data')
      return
    }

    for (const member of members) {
      const type = member.inspection_type as FormType
      if (type !== 'airfield' && type !== 'lighting') continue

      let half: InspectionHalfDraft
      if (member.draft_data) {
        half = { ...(member.draft_data as unknown as InspectionHalfDraft), dbRowId: member.id }
      } else if (member.items && member.items.length > 0) {
        half = itemsToDraftHalf(
          member.items, member.id,
          member.inspector_name, member.inspector_id || null,
          member.rsc_condition, member.rcr_value, member.rcr_condition,
          member.bwc_value, member.weather_conditions, member.temperature_f,
          member.notes,
        )
      } else {
        half = { ...createSingleDraft(type).half, dbRowId: member.id }
      }

      const draft: SingleInspectionDraft = {
        id: groupId,
        createdAt: member.created_at || new Date().toISOString(),
        type,
        half,
      }

      if (type === 'airfield') {
        setAirfieldDraft(draft)
        saveTypeDraft('airfield', draft, installationId)
        setActiveForm('airfield')
      } else {
        setLightingDraft(draft)
        saveTypeDraft('lighting', draft, installationId)
        setActiveForm('lighting')
      }
    }

    setShowHistory(false)
    logActivity('resumed', 'inspection', members[0].id, members[0].display_id, { details: 'AFLD INSPECTION RESUMED' }, installationId)
    window.scrollTo(0, 0)
    toast.success('Inspection resumed')
  }

  // ── Complete & file the current form ──
  const handleComplete = async () => {
    if (!activeForm || !currentDraft || !currentHalf) return
    setSaving(true)

    const half = currentHalf

    // Auto-fetch weather
    const weather = await fetchCurrentWeather(baseLat, baseLon)

    // Auto-fetch inspector name
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

    // Build items for filing
    const secs = activeForm === 'airfield'
      ? (dbAirfieldSections ?? AIRFIELD_INSPECTION_SECTIONS).filter(s => !s.conditional)
      : (dbLightingSections ?? LIGHTING_INSPECTION_SECTIONS)
    const { items, passed, failed, na, total } = halfDraftToItems(completedHalf, secs, itemLocations)

    // Push BWC/RSC/RCR to dashboard
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('glidepath:local-status-update'))
    const nowIso = new Date().toISOString()
    const statusBatch: Record<string, unknown> = {}
    if (completedHalf.bwcValue) {
      statusBatch.bwc_value = completedHalf.bwcValue
      statusBatch.bwc_updated_at = nowIso
    }
    if (completedHalf.rscCondition) {
      statusBatch.rsc_condition = completedHalf.rscCondition
      statusBatch.rsc_updated_at = nowIso
    }
    if (completedHalf.rcrReported && completedHalf.rcrValue) {
      statusBatch.rcr_touchdown = completedHalf.rcrValue
      statusBatch.rcr_condition = completedHalf.rcrConditionType || null
      statusBatch.rcr_updated_at = nowIso
    } else if (completedHalf.rscCondition && !completedHalf.rcrReported) {
      statusBatch.rcr_touchdown = null
      statusBatch.rcr_midpoint = null
      statusBatch.rcr_rollout = null
      statusBatch.rcr_condition = null
      statusBatch.rcr_updated_at = null
    }
    if (Object.keys(statusBatch).length > 0) {
      await updateAirfieldStatus(statusBatch as any, installationId)
    }

    // ── Create discrepancies for any issues toggled "Log as Discrepancy" ──
    let discCreated = 0
    for (const [itemId, discs] of Object.entries(completedHalf.discrepancies || {})) {
      for (let discIdx = 0; discIdx < discs.length; discIdx++) {
        const d = discs[discIdx]
        if (!d.log_as_discrepancy) continue

        const hasLinkedFeatures = d.linked_feature_ids && d.linked_feature_ids.length > 0
        const discTitle = d.discrepancy_title || d.comment.slice(0, 100) || 'Untitled'
        const discType = hasLinkedFeatures ? 'lighting' : (d.discrepancy_type || 'other')
        const discLocation = d.discrepancy_location_text || d.location_text || 'Unknown'

        const { data: disc, error: discErr } = await createDiscrepancy({
          title: discTitle,
          description: d.comment,
          location_text: discLocation,
          type: discType,
          facility_number: d.facility_number || null,
          latitude: d.location?.lat ?? null,
          longitude: d.location?.lon ?? null,
          base_id: installationId,
          infrastructure_feature_id: hasLinkedFeatures ? d.linked_feature_ids![0] : undefined,
        })

        if (discErr || !disc) {
          toast.error(`Failed to create discrepancy: ${discErr}`)
          continue
        }

        d.generated_discrepancy_id = disc.id

        const photos = discPhotos[itemId]?.[discIdx] || []
        for (const photo of photos) {
          await uploadDiscrepancyPhoto(disc.id, photo.file, installationId)
        }
        discCreated++
      }
    }

    // Persist cleared flags back
    if (discCreated > 0) {
      // Already mutated `d.generated_discrepancy_id` in place
    }

    const label = activeForm === 'airfield' ? 'Airfield' : 'Lighting'

    // ── File to DB ──
    const filer = await getInspectorName()
    const filerName = filer.name || (usingDemo ? 'Demo Inspector' : 'Unknown')
    const filerId = filer.id
    let filedEntityId: string | null = completedHalf.dbRowId || null
    let filedDisplayId: string | null = null
    if (completedHalf.dbRowId) {
      const { data: filed_data } = await fileInspection({
        id: completedHalf.dbRowId,
        items,
        total_items: total,
        passed_count: passed,
        failed_count: failed,
        na_count: na,
        bwc_value: completedHalf.bwcValue,
        rsc_condition: completedHalf.rscCondition,
        rcr_value: completedHalf.rcrReported ? completedHalf.rcrValue : null,
        rcr_condition: completedHalf.rcrReported ? completedHalf.rcrConditionType : null,
        weather_conditions: completedHalf.weatherConditions,
        temperature_f: completedHalf.temperatureF,
        notes: completedHalf.notes || null,
        inspector_name: completedHalf.inspectorName || 'Unknown',
        completed_by_name: completedHalf.inspectorName || 'Unknown',
        completed_by_id: completedHalf.inspectorId,
        completed_at: completedHalf.savedAt || new Date().toISOString(),
        filed_by_name: filerName,
        filed_by_id: filerId,
        base_id: installationId,
      })
      if (filed_data) { filedEntityId = filed_data.id; filedDisplayId = filed_data.display_id }
    } else {
      const { data: created } = await createInspection({
        inspection_type: activeForm,
        inspector_name: completedHalf.inspectorName || 'Unknown',
        items,
        total_items: total,
        passed_count: passed,
        failed_count: failed,
        na_count: na,
        construction_meeting: false,
        joint_monthly: false,
        bwc_value: completedHalf.bwcValue,
        rsc_condition: completedHalf.rscCondition,
        rcr_value: completedHalf.rcrReported ? completedHalf.rcrValue : null,
        rcr_condition: completedHalf.rcrReported ? completedHalf.rcrConditionType : null,
        weather_conditions: completedHalf.weatherConditions,
        temperature_f: completedHalf.temperatureF,
        notes: completedHalf.notes || null,
        daily_group_id: currentDraft.id,
        completed_by_name: completedHalf.inspectorName || 'Unknown',
        completed_by_id: completedHalf.inspectorId,
        completed_at: completedHalf.savedAt,
        filed_by_name: filerName,
        filed_by_id: filerId,
        base_id: installationId,
      })
      if (created) {
        filedEntityId = created.id
        filedDisplayId = created.display_id
      }
    }

    // Upload photos
    if (filedEntityId && Object.keys(discPhotos).length > 0) {
      for (const [itemId, photoArrays] of Object.entries(discPhotos)) {
        for (let discIdx = 0; discIdx < photoArrays.length; discIdx++) {
          const photos = photoArrays[discIdx] || []
          const loc = currentHalf?.discrepancies[itemId]?.[discIdx]?.location || itemLocations[itemId] || null
          for (const photo of photos) {
            await uploadInspectionPhoto(filedEntityId, photo.file, itemId, loc?.lat, loc?.lon, installationId, discIdx)
          }
        }
      }
    }
    if (filedEntityId && Object.keys(itemPhotos).length > 0) {
      for (const [itemId, photos] of Object.entries(itemPhotos)) {
        const loc = itemLocations[itemId] || null
        for (const photo of photos) {
          await uploadInspectionPhoto(filedEntityId, photo.file, itemId, loc?.lat, loc?.lon, installationId)
        }
      }
    }

    // ── Auto-mark infrastructure features as inoperative ──
    let featuresMarkedInop = 0
    if (installationId) {
      const allLinkedFeatureIds: string[] = []
      const featureDiscMap: Record<string, { discrepancy_id?: string; comment?: string }> = {}

      for (const [, discs] of Object.entries(completedHalf.discrepancies || {})) {
        for (const d of discs) {
          if (d.linked_feature_ids && d.linked_feature_ids.length > 0) {
            allLinkedFeatureIds.push(...d.linked_feature_ids)
            for (const fid of d.linked_feature_ids) {
              featureDiscMap[fid] = {
                discrepancy_id: d.generated_discrepancy_id ?? undefined,
                comment: d.comment,
              }
            }
          }
        }
      }

      if (allLinkedFeatureIds.length > 0) {
        const uniqueIds = Array.from(new Set(allLinkedFeatureIds))
        const marked = await bulkUpdateStatus(uniqueIds, 'inoperative')

        for (const fid of uniqueIds) {
          const info = featureDiscMap[fid]
          await createOutageEvent({
            base_id: installationId,
            feature_id: fid,
            event_type: 'reported',
            discrepancy_id: info?.discrepancy_id || null,
            notes: info?.comment ? `INOP — ${info.comment.slice(0, 200)}` : 'INOP — Reported during lighting inspection',
          })
        }

        if (marked > 0) {
          featuresMarkedInop = marked
        }

        // Check DAFMAN thresholds
        try {
          const [systems, components, features] = await Promise.all([
            fetchLightingSystems(installationId),
            fetchAllComponentsForBase(installationId),
            fetchInfrastructureFeatures(installationId),
          ])
          const compMap = new Map<string, typeof components>()
          for (const c of components) {
            if (!compMap.has(c.system_id)) compMap.set(c.system_id, [])
            compMap.get(c.system_id)!.push(c)
          }
          const healths = calculateAllSystemHealth(systems, compMap, features)
          for (const h of healths) {
            const tier = getAlertTier(h)
            if (tier === 'red' || tier === 'black') {
              toast.warning(`${h.systemName}: DAFMAN threshold exceeded`, {
                description: h.exceededComponents.map(c => c.componentLabel).join(', '),
                duration: 8000,
              })
            } else if (tier === 'yellow') {
              toast.warning(`${h.systemName}: Approaching DAFMAN limit`, {
                description: h.approachingComponents.map(c => c.componentLabel).join(', '),
                duration: 6000,
              })
            }
          }
        } catch {
          // Non-critical
        }
      }
    }

    // ── Log completion ──
    const oiStr = userOI ? `/${userOI}` : ''
    const inspLabel = activeForm === 'lighting' ? 'Daily Lighting Inspection' : 'Daily Airfield Inspection'
    const failedItems = items.filter(i => i.response === 'fail')
    const discStr = failedItems.length > 0
      ? `DISCREPANCIES FOUND: ${failedItems.map(i => `${i.item.toUpperCase()}${i.notes ? ` - ${i.notes}` : ''}`).join('; ')}`
      : 'NO NEW DISCREPANCIES'
    let condStr = ''
    if (completedHalf.rscCondition && completedHalf.bwcValue) {
      condStr = `, RSC/${completedHalf.rscCondition.toUpperCase()}`
      if (completedHalf.rcrReported && completedHalf.rcrValue) condStr += ` RCR/${completedHalf.rcrValue}`
      condStr += ` & BWC/${completedHalf.bwcValue.toUpperCase()}`
    } else if (completedHalf.rscCondition) {
      condStr = `, RSC/${completedHalf.rscCondition.toUpperCase()}`
      if (completedHalf.rcrReported && completedHalf.rcrValue) condStr += ` RCR/${completedHalf.rcrValue}`
    } else if (completedHalf.bwcValue) {
      condStr = `, BWC/${completedHalf.bwcValue.toUpperCase()}`
    }
    const completeDetails = `AFLD3${oiStr} off the airfield, ${inspLabel} Complete${condStr}, ${discStr}`

    logActivity(
      'completed',
      'inspection',
      filedEntityId || installationId || crypto.randomUUID(),
      filedDisplayId || undefined,
      { details: completeDetails },
      installationId,
    )

    // Clean up
    Object.values(itemPhotos).flat().forEach((p) => URL.revokeObjectURL(p.url))
    Object.values(discPhotos).flat().flat().forEach((p) => URL.revokeObjectURL(p.url))
    setItemPhotos({})
    setDiscPhotos({})
    setItemLocations({})

    clearTypeDraft(activeForm, installationId)
    if (activeForm === 'airfield') setAirfieldDraft(null)
    else setLightingDraft(null)

    setSaving(false)
    const parts = [`${label} inspection completed & filed`]
    if (discCreated > 0) parts.push(`${discCreated} discrepanc${discCreated === 1 ? 'y' : 'ies'} logged`)
    if (featuresMarkedInop > 0) parts.push(`${featuresMarkedInop} feature${featuresMarkedInop !== 1 ? 's' : ''} marked inop`)
    toast.success(parts.join(' — '))

    setActiveForm(null)
    await loadHistory()
  }

  // ── History data — group by daily_group_id ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawInspections: any[] = usingDemo ? DEMO_INSPECTIONS : liveInspections

  type DailyReport = {
    id: string
    type: 'daily' | 'single'
    inspectionType?: string
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

  // ── Today's inspection status for KPI badges ──
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayAirfieldFiled = useMemo(() => {
    return liveInspections.some(i =>
      i.inspection_type === 'airfield' &&
      i.status === 'completed' &&
      i.inspection_date === todayStr
    )
  }, [liveInspections, todayStr])

  const todayLightingFiled = useMemo(() => {
    return liveInspections.some(i =>
      i.inspection_type === 'lighting' &&
      i.status === 'completed' &&
      i.inspection_date === todayStr
    )
  }, [liveInspections, todayStr])

  // ── Don't render until draft state is known ──
  if (!draftLoaded) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  // ══  FORM VIEW (active form selected)        ══
  // ══════════════════════════════════════════════
  if (activeForm && currentDraft && currentHalf) {
    const formLabel = activeForm === 'airfield' ? 'Airfield Inspection' : 'Lighting Inspection'

    return (
      <div className="page-container">
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>{formLabel}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
              Started {formatZuluDate(new Date(currentDraft.createdAt))}
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
              onClick={() => {
                setActiveForm(null)
                setShowHistory(false)
                window.scrollTo(0, 0)
              }}
              style={{
                background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8,
                padding: '8px 14px', color: 'var(--color-text-2)', fontSize: 'var(--fs-base)', fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              Back
            </button>
          </div>
        </div>

        {/* ── Progress ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700 }}>
              {formLabel}
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

                // RSC item
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
                              {opt === 'Dry' ? '\u2600\uFE0F' : '\uD83D\uDCA7'} {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                // RCR item
                if (item.type === 'rcr') {
                  const rcrOn = currentHalf?.rcrReported ?? false
                  return (
                    <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-bg-elevated)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontWeight: 600, minWidth: 22 }}>{item.itemNumber}.</span>
                        <span style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: '18px' }}>{item.item}</span>
                      </div>
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
                          {rcrOn && '\u2713'}
                        </div>
                        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: rcrOn ? 'var(--color-cyan, #22D3EE)' : 'var(--color-text-2)' }}>
                          Report RCR
                        </span>
                      </div>
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

                // Standard pass/fail/na item
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
                          linkedSystemIds={activeForm === 'lighting' && itemKeyLinks[item.id] ? systemIdsFromLinks(itemKeyLinks[item.id]) : undefined}
                          linkedComponentIds={activeForm === 'lighting' && itemKeyLinks[item.id] ? componentIdsFromLinks(itemKeyLinks[item.id]) : undefined}
                          linkedBaseId={activeForm === 'lighting' && itemKeyLinks[item.id] ? installationId ?? undefined : undefined}
                          onFeaturesSelected={(idx, features) => handleFeaturesSelected(item.id, idx, features)}
                          flyToPoints={(currentHalf.discrepancies[item.id] || []).map((_, i) => discFlyTo[`${item.id}:${i}`] || null)}
                          onSaveDraft={handleSave}
                          draftSaving={saving}
                          areaOptions={installationAreas}
                          facilityOptions={facilities}
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
          <ExpandableTextarea
            className="input-dark"
            rows={3}
            placeholder="Any additional notes..."
            value={currentHalf?.notes || ''}
            onChange={(val) => setNotes(val)}
            label="General Notes"
            style={{ resize: 'vertical', fontSize: 'var(--fs-md)', width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {progress >= 100 ? (
            <button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={saving}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, var(--color-accent-secondary), var(--color-cyan))',
                color: '#FFF', fontSize: 'var(--fs-xl)', fontWeight: 700,
                cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Completing...' : 'Complete & File'}
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
          )}
        </div>

        {/* Discard button */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button
            onClick={() => {
              if (confirm('Discard this inspection draft? This cannot be undone.')) {
                handleDiscardDraft()
              }
            }}
            style={{
              background: 'transparent', border: 'none', color: '#EF4444',
              fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              padding: '8px 16px',
            }}
          >
            Discard Draft
          </button>
        </div>

        {/* Hidden file inputs */}
        <input ref={itemFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleItemPhoto} />

        {/* ── Complete Confirmation Dialog ── */}
        {showCompleteConfirm && (
          <div
            onClick={() => setShowCompleteConfirm(false)}
            style={{
              position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--color-bg-surface-solid)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 380,
                border: '1px solid rgba(34,211,238,0.3)',
              }}
            >
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-cyan, #22D3EE)', marginBottom: 12 }}>Confirm Completion</div>
              <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.6, marginBottom: 16 }}>
                Before completing this inspection, confirm:
              </div>
              <ul style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', lineHeight: 1.8, margin: '0 0 16px 0', paddingLeft: 24, listStyleType: 'disc' }}>
                <li style={{ marginBottom: 6 }}>All discrepancies have been added</li>
                <li style={{ marginBottom: 6 }}>Discrepancies requiring CES submission are marked as such</li>
                <li style={{ marginBottom: 6 }}>All applicable photos have been attached to discrepancies</li>
                <li>Location identifiers have been added to identified discrepancies</li>
              </ul>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setShowCompleteConfirm(false)
                    handleComplete()
                  }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 700,
                    cursor: 'pointer', border: 'none',
                    background: 'linear-gradient(135deg, var(--color-accent-secondary), var(--color-cyan))',
                    color: '#FFF', fontFamily: 'inherit',
                  }}
                >Confirm & Complete</button>
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-md)', fontWeight: 700,
                    cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                    background: 'var(--color-bg)', color: 'var(--color-text-2)', fontFamily: 'inherit',
                  }}
                >Go Back</button>
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
  // ══  LANDING VIEW (KPI badges + history)     ══
  // ══════════════════════════════════════════════
  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Inspections</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
            Daily airfield &amp; lighting inspections
          </div>
        </div>
      </div>

      {/* ── KPI Badges ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {/* Airfield KPI */}
        <button
          onClick={() => {
            if (airfieldDraft) {
              setActiveForm('airfield')
              setShowHistory(false)
              window.scrollTo(0, 0)
            } else if (todayAirfieldFiled) {
              // Already filed — go to history
              setShowHistory(true)
              setTypeFilter('airfield')
            } else {
              handleBeginNew('airfield')
            }
          }}
          style={{
            background: todayAirfieldFiled
              ? 'rgba(34,197,94,0.08)'
              : airfieldDraft
              ? 'rgba(59,130,246,0.08)'
              : 'var(--color-bg-surface)',
            border: todayAirfieldFiled
              ? '2px solid rgba(34,197,94,0.4)'
              : airfieldDraft
              ? '2px solid rgba(59,130,246,0.4)'
              : '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '16px 12px',
            cursor: 'pointer',
            textAlign: 'center',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 6 }}>
            {todayAirfieldFiled ? '\u2705' : airfieldDraft ? '\uD83D\uDCDD' : '\u2600\uFE0F'}
          </div>
          <div style={{
            fontSize: 'var(--fs-md)', fontWeight: 700,
            color: todayAirfieldFiled ? '#22C55E' : airfieldDraft ? '#3B82F6' : 'var(--color-text-1)',
          }}>
            Airfield
          </div>
          <div style={{
            fontSize: 'var(--fs-xs)', marginTop: 2,
            color: todayAirfieldFiled ? '#22C55E' : airfieldDraft ? '#3B82F6' : 'var(--color-text-3)',
            fontWeight: 600,
          }}>
            {todayAirfieldFiled ? 'Complete' : airfieldDraft ? 'In Progress' : 'Start'}
          </div>
        </button>

        {/* Lighting KPI */}
        <button
          onClick={() => {
            if (lightingDraft) {
              setActiveForm('lighting')
              setShowHistory(false)
              window.scrollTo(0, 0)
            } else if (todayLightingFiled) {
              setShowHistory(true)
              setTypeFilter('lighting')
            } else {
              handleBeginNew('lighting')
            }
          }}
          style={{
            background: todayLightingFiled
              ? 'rgba(34,197,94,0.08)'
              : lightingDraft
              ? 'rgba(59,130,246,0.08)'
              : 'var(--color-bg-surface)',
            border: todayLightingFiled
              ? '2px solid rgba(34,197,94,0.4)'
              : lightingDraft
              ? '2px solid rgba(59,130,246,0.4)'
              : '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '16px 12px',
            cursor: 'pointer',
            textAlign: 'center',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 6 }}>
            {todayLightingFiled ? '\u2705' : lightingDraft ? '\uD83D\uDCDD' : '\uD83C\uDF19'}
          </div>
          <div style={{
            fontSize: 'var(--fs-md)', fontWeight: 700,
            color: todayLightingFiled ? '#22C55E' : lightingDraft ? '#3B82F6' : 'var(--color-text-1)',
          }}>
            Lighting
          </div>
          <div style={{
            fontSize: 'var(--fs-xs)', marginTop: 2,
            color: todayLightingFiled ? '#22C55E' : lightingDraft ? '#3B82F6' : 'var(--color-text-3)',
            fontWeight: 600,
          }}>
            {todayLightingFiled ? 'Complete' : lightingDraft ? 'In Progress' : 'Start'}
          </div>
        </button>
      </div>

      {/* ── History Section ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="section-label">History</span>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
          {dailyReports.length} report{dailyReports.length !== 1 ? 's' : ''}
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
        const linkId = isSpecialType ? report.id : (report.airfield?.id || report.lighting?.id)
        const displayIds = isSpecialType ? [] : [report.airfield?.display_id, report.lighting?.display_id].filter(Boolean)

        const specialLabel = report.inspectionType === 'construction_meeting'
          ? 'Construction Meeting Inspection'
          : report.inspectionType === 'joint_monthly'
          ? 'Joint Monthly Airfield Inspection'
          : ''
        const cardBorderColor = isInProgress ? '#3B82F6' : isSpecialType ? '#A78BFA' : isDaily ? 'var(--color-cyan)' : report.airfield ? '#34D399' : '#FBBF24'

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

            {isDaily && displayIds.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 'var(--fs-sm)', fontFamily: 'monospace', color: 'var(--color-text-2)' }}>
                {displayIds.map((did) => (
                  <span key={did}>{did}</span>
                ))}
              </div>
            )}

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
                    <span>{report.weatherConditions}{report.temperatureF != null ? ` ${report.temperatureF}\u00B0F` : ''}</span>
                  </>
                )}
              </div>
              <span>
                {report.completedAt
                  ? formatZuluDateTime(new Date(report.completedAt))
                  : report.date}
              </span>
            </div>
          </>
        )

        if (isInProgress) {
          return (
            <div
              key={report.id}
              className="card"
              style={{
                display: 'block', marginBottom: 6,
                textDecoration: 'none', color: 'inherit',
                borderLeft: `3px solid ${cardBorderColor}`,
              }}
            >
              <div onClick={() => handleResume(report)} style={{ cursor: 'pointer' }}>
                {cardContent}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => handleResume(report)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 6,
                    border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.08)',
                    color: '#3B82F6', fontSize: 'var(--fs-sm)', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Resume
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Delete this in-progress inspection? This cannot be undone.')) {
                      handleDeleteInProgress(report)
                    }
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 6,
                    border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)',
                    color: '#EF4444', fontSize: 'var(--fs-sm)', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Delete
                </button>
              </div>
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
              borderLeft: `3px solid ${cardBorderColor}`,
            }}
          >
            {cardContent}
          </Link>
        )
      })}
    </div>
  )
}
