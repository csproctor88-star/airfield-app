'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { warnIfRealtimeDown } from '@/lib/realtime-subscribe'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  CHECK_TYPE_CONFIG,
  RSC_CONDITIONS,
  RCR_CONDITION_TYPES,
  BASH_CONDITION_CODES,
  EMERGENCY_ACTIONS,
} from '@/lib/constants'
import { getCheckIcon } from '@/lib/check-icons'
import { ConstructionChecklist } from '@/components/checks/construction-checklist'
import {
  DEFAULT_CONSTRUCTION_ITEM_STATE,
  type ConstructionItemStatus,
} from '@/lib/check-construction-items'
import {
  AlertTriangle, CheckCircle2, FileText, Trash2, Map as MapIcon,
} from 'lucide-react'
import type { CheckType } from '@/lib/supabase/types'
import { uploadCheckPhoto, fetchRecentChecks, saveCheckDraftToDb, loadCheckDraftFromDb, deleteCheckDraft, type CheckRow } from '@/lib/supabase/checks'
import { getWriteQueue, WRITE_COMMITTED_EVENT, type WriteCommittedDetail } from '@/lib/sync/write-queue'
import type { CheckFilePayload, CheckFileResult } from '@/lib/sync/handlers'
import { createDiscrepancy, uploadDiscrepancyPhoto } from '@/lib/supabase/discrepancies'
import { DEMO_CHECKS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { getAirfieldDiagram } from '@/lib/airfield-diagram'
import { SimpleDiscrepancyPanelGroup } from '@/components/ui/simple-discrepancy-panel-group'
import { ExpandableTextarea } from '@/components/ui/expandable-textarea'
import { formatZuluTime, formatZuluDate, formatZuluDateTime, formatZuluDateShort } from '@/lib/utils'
import type { SimpleDiscrepancy } from '@/lib/supabase/types'
import { loadCheckDraft, saveCheckDraft, clearCheckDraft, type CheckDraft } from '@/lib/check-draft'
import { logActivity } from '@/lib/supabase/activity'
import { SightingForm } from '@/components/wildlife/sighting-form'
import { StrikeForm } from '@/components/wildlife/strike-form'

type LocalComment = {
  id: string
  comment: string
  user_name: string
  created_at: string
}

export default function AirfieldChecksPage() {
  const router = useRouter()
  const { installationId, areas: installationAreas, facilities } = useInstallation()
  const [checkType, setCheckType] = useState<CheckType | ''>('')
  const [areas, setAreas] = useState<string[]>(['Entire Airfield'])
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState('Inspector')
  const [recentChecks, setRecentChecks] = useState<CheckRow[]>([])
  // ── Draft persistence state ──
  const [draftDbRowId, setDraftDbRowId] = useState<string | null>(null)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  // ── Airfield diagram state ──
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null)
  const [showDiagram, setShowDiagram] = useState(false)
  // ── Check lifecycle state ──
  const [checkStarted, setCheckStarted] = useState(false)
  const [checkStartedAt, setCheckStartedAt] = useState<string | null>(null)
  const [userOI, setUserOI] = useState('')
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<CheckDraft | null>(null)
  // ── Inline BASH wildlife form state ──
  const [bashFormType, setBashFormType] = useState<'sighting' | 'strike'>('sighting')
  const [bashFormSaved, setBashFormSaved] = useState(false)
  const [bashWildlifeDisplayId, setBashWildlifeDisplayId] = useState<string | null>(null)

  useEffect(() => {
    if (!installationId) return
    getAirfieldDiagram(installationId).then(setDiagramUrl).catch(() => setDiagramUrl(null))
  }, [installationId])

  const loadRecent = useCallback(() => {
    const supabase = createClient()
    if (!supabase) {
      setRecentChecks(DEMO_CHECKS.slice(0, 5) as unknown as CheckRow[])
      return
    }
    fetchRecentChecks(installationId, 5).then(setRecentChecks)
  }, [installationId])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setCurrentUser('Demo User')
      loadRecent()
      return
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('name, rank, first_name, last_name, operating_initials').eq('id', user.id).single()
      if (profile?.operating_initials) setUserOI(profile.operating_initials)
      if (profile?.first_name && profile?.last_name) {
        const displayName = `${profile.first_name} ${profile.last_name}`
        setCurrentUser(profile.rank ? `${profile.rank} ${displayName}` : displayName)
      } else if (profile?.name) {
        setCurrentUser(profile.rank ? `${profile.rank} ${profile.name}` : profile.name)
      } else if (user.user_metadata?.name) {
        setCurrentUser(user.user_metadata.name)
      } else if (user.email) {
        setCurrentUser(user.email.split('@')[0])
      }
    })
    loadRecent()
  }, [installationId, loadRecent])

  // Re-fetch recent checks when a check_file write drains from the offline
  // queue (realtime fires on INSERT for airfield_checks, but a queued
  // CREATE that lands later may still beat realtime on a slow connection).
  useEffect(() => {
    const onCommit = (e: Event) => {
      const detail = (e as CustomEvent<WriteCommittedDetail>).detail
      if (detail?.type === 'check_file') loadRecent()
    }
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)
    return () => window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
  }, [loadRecent])

  // ── Draft persistence ──
  const draftLoaded = useRef(false)

  // Hydrate form from a CheckDraft object
  const hydrateFormFromDraft = useCallback((saved: CheckDraft) => {
    setCheckType(saved.checkType)
    setAreas(saved.areas)
    setIssueFound(saved.issueFound)
    setIssues(saved.issues)
    setRemarks(saved.remarks)
    setRemarkText(saved.remarkText)
    setRscCondition(saved.rscCondition)
    setReportRcr(saved.reportRcr ?? false)
    setRcrValue((saved as any).rcrValue ?? (saved as any).rcrTouchdown ?? '')
    setRcrConditionType(saved.rcrConditionType)
    setBashCondition(saved.bashCondition)
    setAircraftType(saved.aircraftType)
    setCallsign(saved.callsign)
    setEmergencyNature(saved.emergencyNature)
    setCheckedActions(saved.checkedActions)
    setNotifiedAgencies(saved.notifiedAgencies)
    setHeavyAircraftType(saved.heavyAircraftType)
    setConstructionItems(saved.constructionItems ?? DEFAULT_CONSTRUCTION_ITEM_STATE)
    setOtherSubject(saved.otherSubject ?? '')
    if (saved.dbRowId) setDraftDbRowId(saved.dbRowId)
    if (saved.savedAt) setDraftSavedAt(saved.savedAt)
    if (saved.issueFound && saved.issues.length > 0) {
      setIssuePhotos(saved.issues.map(() => []))
      setIssueFlyTo(saved.issues.map(() => null))
    }
  }, [])

  // Two-phase draft load: check for existing draft and show resume prompt
  useEffect(() => {
    const localDraft = loadCheckDraft(installationId)

    // Phase 2: Async — check Supabase for a newer draft
    loadCheckDraftFromDb(installationId).then((dbRow) => {
      let bestDraft = localDraft
      if (dbRow?.draft_data) {
        const localTime = localDraft?.savedAt ? new Date(localDraft.savedAt).getTime() : 0
        const dbTime = dbRow.saved_at ? new Date(dbRow.saved_at).getTime() : 0
        if (dbTime > localTime) {
          bestDraft = { ...dbRow.draft_data, dbRowId: dbRow.id, savedAt: dbRow.saved_at || '' }
        } else if (dbRow.id && bestDraft && !bestDraft.dbRowId) {
          bestDraft.dbRowId = dbRow.id
        }
      }
      if (bestDraft && bestDraft.checkType) {
        setPendingDraft(bestDraft)
        setShowResumePrompt(true)
      }
      draftLoaded.current = true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId])

  // Resume or discard handlers
  const handleResumeDraft = () => {
    if (pendingDraft) {
      hydrateFormFromDraft(pendingDraft)
      setCheckStarted(true)
      setCheckStartedAt(pendingDraft.startedAt || new Date().toISOString())
    }
    setShowResumePrompt(false)
    setPendingDraft(null)
  }

  const handleDiscardDraft = async () => {
    if (pendingDraft?.dbRowId) {
      await deleteCheckDraft(pendingDraft.dbRowId)
    }
    clearCheckDraft(installationId)
    setShowResumePrompt(false)
    setPendingDraft(null)
  }

  // Issue Found toggle
  const [issueFound, setIssueFound] = useState(false)

  // ── Multi-issue state ──
  const [issues, setIssues] = useState<SimpleDiscrepancy[]>([])
  const [issuePhotos, setIssuePhotos] = useState<{ file: File; url: string; name: string }[][]>([])
  const [issueGpsLoading, setIssueGpsLoading] = useState<number | null>(null)
  const [issueFlyTo, setIssueFlyTo] = useState<({ lat: number; lng: number } | null)[]>([])

  // Legacy location (kept for backward compat in handleComplete)
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)

  // ── Issue handlers ──
  const handleIssueChange = useCallback((index: number, detail: SimpleDiscrepancy) => {
    setIssues((prev) => {
      const arr = [...prev]
      // Merge selectively — preserve location/photo_ids from state to prevent stale overwrites
      const merged = { ...arr[index] }
      if ('comment' in detail) merged.comment = detail.comment
      if ('location_text' in detail) merged.location_text = detail.location_text
      if ('log_as_discrepancy' in detail) merged.log_as_discrepancy = detail.log_as_discrepancy
      if ('discrepancy_title' in detail) merged.discrepancy_title = detail.discrepancy_title
      if ('discrepancy_location_text' in detail) merged.discrepancy_location_text = detail.discrepancy_location_text
      if ('discrepancy_type' in detail) merged.discrepancy_type = detail.discrepancy_type
      arr[index] = merged
      return arr
    })
  }, [])

  const handleAddIssue = useCallback(() => {
    setIssues((prev) => [...prev, { comment: '', location: null, photo_ids: [] }])
    setIssuePhotos((prev) => [...prev, []])
    setIssueFlyTo((prev) => [...prev, null])
  }, [])

  const handleRemoveIssue = useCallback((index: number) => {
    setIssues((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
    setIssuePhotos((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
    setIssueFlyTo((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleIssueAddPhotos = useCallback((index: number, files: FileList) => {
    const newPhotos = Array.from(files).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }))
    setIssuePhotos((prev) => {
      const arr = [...prev]
      while (arr.length <= index) arr.push([])
      arr[index] = [...arr[index], ...newPhotos]
      return arr
    })
    toast.success(`${files.length} photo(s) added`)
  }, [])

  const handleIssueRemovePhoto = useCallback((index: number, photoIdx: number) => {
    setIssuePhotos((prev) => {
      const arr = [...prev]
      if (arr[index]) {
        URL.revokeObjectURL(arr[index][photoIdx].url)
        arr[index] = arr[index].filter((_, i) => i !== photoIdx)
      }
      return arr
    })
  }, [])

  const handleIssuePointSelected = useCallback((index: number, lat: number, lng: number) => {
    setIssues((prev) => {
      const arr = [...prev]
      arr[index] = { ...arr[index], location: { lat, lon: lng } }
      return arr
    })
    toast.success(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }, [])

  const handleIssueCaptureGps = useCallback((index: number) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setIssueGpsLoading(index)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        setIssues((prev) => {
          const arr = [...prev]
          arr[index] = { ...arr[index], location: { lat, lon } }
          return arr
        })
        setIssueFlyTo((prev) => {
          const arr = [...prev]
          arr[index] = { lat, lng: lon }
          return arr
        })
        setIssueGpsLoading(null)
        toast.success('Location acquired')
      },
      (error) => {
        setIssueGpsLoading(null)
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

  // Remarks
  const [remarkText, setRemarkText] = useState('')
  const [remarks, setRemarks] = useState<LocalComment[]>([])

  // Type-specific fields
  const [rscCondition, setRscCondition] = useState('')
  const [reportRcr, setReportRcr] = useState(false)
  const [rcrValue, setRcrValue] = useState('')
  const [rcrConditionType, setRcrConditionType] = useState('')
  const [bashCondition, setBashCondition] = useState('')
  const [aircraftType, setAircraftType] = useState('')
  const [callsign, setCallsign] = useState('')
  const [emergencyNature, setEmergencyNature] = useState('')
  const [checkedActions, setCheckedActions] = useState<string[]>([])
  const [notifiedAgencies, setNotifiedAgencies] = useState<string[]>([])
  const [heavyAircraftType, setHeavyAircraftType] = useState('')
  const [constructionItems, setConstructionItems] = useState<Record<string, ConstructionItemStatus>>(DEFAULT_CONSTRUCTION_ITEM_STATE)
  const [otherSubject, setOtherSubject] = useState('')

  // ── Save Draft handler (manual, not auto-save) ──
  const handleSaveDraft = async () => {
    if (!checkType) {
      toast.error('Select a check type first')
      return
    }
    setDraftSaving(true)
    const draft: CheckDraft = {
      checkType, areas, issueFound, issues, remarks, remarkText,
      rscCondition, reportRcr, rcrValue, rcrConditionType, bashCondition,
      aircraftType, callsign, emergencyNature, checkedActions, notifiedAgencies,
      heavyAircraftType, constructionItems, otherSubject, savedAt: '', startedAt: checkStartedAt, dbRowId: draftDbRowId,
    }

    const { data: saved, error } = await saveCheckDraftToDb({
      id: draftDbRowId,
      draft_data: draft,
      base_id: installationId,
    })

    if (error || !saved) {
      toast.error(`Failed to save draft: ${error}`)
      setDraftSaving(false)
      return
    }

    const now = saved.saved_at || new Date().toISOString()
    setDraftDbRowId(saved.id)
    setDraftSavedAt(now)
    // Mirror to localStorage
    draft.dbRowId = saved.id
    draft.savedAt = now
    saveCheckDraft(draft, installationId)
    setDraftSaving(false)
    toast.success('Draft saved')
  }

  // ── Build current draft snapshot (for auto-save) ──
  const buildDraftSnapshot = useCallback((): CheckDraft => ({
    checkType, areas, issueFound, issues, remarks, remarkText,
    rscCondition, reportRcr, rcrValue, rcrConditionType, bashCondition,
    aircraftType, callsign, emergencyNature, checkedActions, notifiedAgencies,
    heavyAircraftType, constructionItems, otherSubject,
    savedAt: '', startedAt: checkStartedAt, dbRowId: draftDbRowId,
  }), [checkType, areas, issueFound, issues, remarks, remarkText,
    rscCondition, reportRcr, rcrValue, rcrConditionType, bashCondition,
    aircraftType, callsign, emergencyNature, checkedActions, notifiedAgencies,
    heavyAircraftType, constructionItems, otherSubject, checkStartedAt, draftDbRowId])

  // Keep a ref to the latest snapshot for beforeunload (can't use state in event handlers)
  const draftSnapshotRef = useRef<CheckDraft | null>(null)
  const checkStartedRef = useRef(false)
  useEffect(() => { draftSnapshotRef.current = buildDraftSnapshot() }, [buildDraftSnapshot])
  useEffect(() => { checkStartedRef.current = checkStarted }, [checkStarted])

  // ── Auto-save to localStorage continuously + on navigation away ──
  useEffect(() => {
    // Continuous auto-save: persist draft whenever form state changes
    if (checkStartedRef.current && draftSnapshotRef.current?.checkType) {
      saveCheckDraft(draftSnapshotRef.current, installationId)
    }
  }, [buildDraftSnapshot, installationId])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (checkStartedRef.current && draftSnapshotRef.current?.checkType) {
        saveCheckDraft(draftSnapshotRef.current, installationId)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      // Also auto-save on unmount (in-app navigation)
      if (checkStartedRef.current && draftSnapshotRef.current?.checkType) {
        saveCheckDraft(draftSnapshotRef.current, installationId)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [installationId])

  const toggleAction = (action: string) => {
    setCheckedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    )
  }

  const toggleAgency = (agency: string) => {
    setNotifiedAgencies((prev) =>
      prev.includes(agency) ? prev.filter((a) => a !== agency) : [...prev, agency]
    )
  }

  const addRemark = () => {
    if (!remarkText.trim()) return
    const newRemark: LocalComment = {
      id: `local-${Date.now()}`,
      comment: remarkText.trim(),
      user_name: currentUser,
      created_at: new Date().toISOString(),
    }
    setRemarks((prev) => [newRemark, ...prev])
    setRemarkText('')
  }

  const buildCheckData = (): Record<string, unknown> => {
    const base: Record<string, unknown> = {}
    // Include issues array if issue found
    if (issueFound && issues.length > 0) {
      base.issues = issues.map((iss) => ({
        comment: iss.comment,
        location: iss.location,
        location_text: iss.location_text,
        log_as_discrepancy: iss.log_as_discrepancy || false,
        discrepancy_title: iss.discrepancy_title,
        discrepancy_type: iss.discrepancy_type,
      }))
    }
    switch (checkType) {
      case 'rsc': {
        const rscData: Record<string, unknown> = { ...base, condition: rscCondition }
        if (reportRcr) {
          rscData.rcr_reported = true
          rscData.rcr_value = rcrValue
          rscData.rcr_condition = rcrConditionType
        }
        return rscData
      }
      case 'bash':
        return {
          ...base,
          condition_code: bashCondition,
          wildlife_form_type: bashFormSaved ? bashFormType : undefined,
          wildlife_display_id: bashWildlifeDisplayId || undefined,
        }
      case 'ife':
        return {
          ...base,
          aircraft_type: aircraftType,
          callsign,
          nature: emergencyNature,
          actions: checkedActions,
          agencies_notified: notifiedAgencies,
        }
      case 'ground_emergency':
        return {
          ...base,
          aircraft_type: aircraftType,
          nature: emergencyNature,
          actions: checkedActions,
          agencies_notified: notifiedAgencies,
        }
      case 'heavy_aircraft':
        return { ...base, aircraft_type: heavyAircraftType }
      case 'construction':
        return { ...base, construction_items: constructionItems }
      case 'other':
        return { ...base, other_subject: otherSubject.trim() }
      case 'fod':
      default:
        return base
    }
  }

  const handleComplete = async () => {
    if (!checkType) {
      toast.error('Select a check type')
      return
    }
    if (checkType === 'bash' && issueFound && !bashFormSaved) {
      toast.error('Complete the wildlife sighting or strike form before submitting')
      return
    }
    if (checkType === 'other' && !otherSubject.trim()) {
      toast.error('Enter a Reason for the Other check (what did you check?)')
      return
    }

    // No hard offline gate — checks queue cleanly when the user is fully
    // offline (e.g., walking the airfield without coverage). The queued
    // path below resets the form and shows a contextual toast that names
    // any photos / log-as-discrepancy issues that won't auto-sync, so
    // the user knows what to re-add after reconnecting.

    setSaving(true)

    // Auto-save any pending remark text
    const allRemarks = [...remarks]
    if (remarkText.trim()) {
      allRemarks.unshift({
        id: `local-${Date.now()}`,
        comment: remarkText.trim(),
        user_name: currentUser,
        created_at: new Date().toISOString(),
      })
      setRemarkText('')
      setRemarks(allRemarks)
    }

    const data = buildCheckData()
    const comments = allRemarks.map((r) => ({
      comment: r.comment,
      user_name: r.user_name,
      created_at: r.created_at,
    }))

    // Use first issue's location for backward compat
    const firstIssueLoc = issues[0]?.location
    const lat = firstIssueLoc?.lat ?? selectedLat
    const lng = firstIssueLoc?.lon ?? selectedLng

    // Route the check create through the offline queue. Transient
    // mid-call network failures are queued and drained automatically.
    // The hard-offline gate above prevents fully-disconnected starts —
    // queued path here only fires when the connection drops between
    // tap and round-trip. Photos / discrepancies cannot reference a
    // not-yet-created row, so the queued branch bails and the user
    // re-submits when the queue drains.
    const checkPayload: CheckFilePayload = {
      check_type: checkType,
      areas,
      data,
      completed_by: currentUser,
      comments,
      latitude: lat,
      longitude: lng,
      base_id: installationId,
      started_at: checkStartedAt,
    }
    let created: CheckFileResult = null
    try {
      const result = await getWriteQueue().enqueueOrExecute<
        CheckFilePayload,
        CheckFileResult
      >('check_file', checkPayload, {
        baseId: installationId || '',
        userId: currentUser || '',
      })
      if (result.status === 'committed') {
        created = result.data
      } else {
        // Queued — reset the form back to the type selector so the user
        // doesn't see a stuck "in progress" check after the queue drains.
        // The drain commits the check directly via the handler; the
        // recent-checks list refreshes via the WRITE_COMMITTED_EVENT
        // listener already wired on this page.
        const photoCount = issuePhotos.flat().length
        const logDiscCount = issues.filter((i) => i.log_as_discrepancy).length
        if (draftDbRowId) {
          await deleteCheckDraft(draftDbRowId)
          setDraftDbRowId(null)
          setDraftSavedAt(null)
        }
        clearCheckDraft(installationId)
        issuePhotos.flat().forEach((p) => URL.revokeObjectURL(p.url))
        setIssues([])
        setIssuePhotos([])
        setIssueFlyTo([])
        setRemarks([])
        setRemarkText('')
        setCheckStarted(false)
        setCheckStartedAt(null)
        setCheckType('')
        resetTypeFields()
        setSaving(false)
        const dataLoss: string[] = []
        if (photoCount > 0) dataLoss.push(`${photoCount} photo${photoCount === 1 ? '' : 's'}`)
        if (logDiscCount > 0) {
          dataLoss.push(`${logDiscCount} discrepanc${logDiscCount === 1 ? 'y' : 'ies'}`)
        }
        const message = dataLoss.length > 0
          ? `Check queued — will save automatically when the network returns. Re-add ${dataLoss.join(' and ')} once reconnected.`
          : 'Check queued — will save automatically when the network returns.'
        toast.success(message, { duration: 8000 })
        return
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to save: ${message}`)
      setSaving(false)
      return
    }
    if (!created) {
      toast.error('Failed to save')
      setSaving(false)
      return
    }

    // Upload photos per-issue with their issue index
    let totalPhotos = 0
    let uploadedPhotos = 0
    for (let issueIdx = 0; issueIdx < issuePhotos.length; issueIdx++) {
      const photos = issuePhotos[issueIdx] || []
      totalPhotos += photos.length
      for (const photo of photos) {
        const { error: photoErr } = await uploadCheckPhoto(created.id, photo.file, installationId, issueIdx)
        if (!photoErr) uploadedPhotos++
      }
    }
    if (uploadedPhotos < totalPhotos) {
      toast.error(`${totalPhotos - uploadedPhotos} photo(s) failed to upload`)
    }

    // ── Create discrepancies for issues with "Log as Discrepancy" toggled on ──
    let discCreated = 0
    for (let issueIdx = 0; issueIdx < issues.length; issueIdx++) {
      const iss = issues[issueIdx]
      if (!iss.log_as_discrepancy) continue

      const discTitle = iss.discrepancy_title || iss.comment.slice(0, 100) || 'Untitled'
      const discType = iss.discrepancy_type || 'other'
      const discLocation = iss.discrepancy_location_text || iss.location_text || areas[0] || 'Unknown'

      const { data: disc, error: discErr } = await createDiscrepancy({
        title: discTitle,
        description: iss.comment,
        location_text: discLocation,
        type: discType,
        facility_number: iss.facility_number || null,
        latitude: iss.location?.lat ?? null,
        longitude: iss.location?.lon ?? null,
        base_id: installationId,
      })

      if (discErr || !disc) {
        toast.error(`Failed to create discrepancy for issue ${issueIdx + 1}: ${discErr}`)
        continue
      }

      // Upload photos to the new discrepancy record (shared copies for fast loading)
      const photos = issuePhotos[issueIdx] || []
      for (const photo of photos) {
        await uploadDiscrepancyPhoto(disc.id, photo.file, installationId)
      }
      discCreated++
    }
    // Clean up draft (DB + localStorage)
    if (draftDbRowId) {
      await deleteCheckDraft(draftDbRowId)
      setDraftDbRowId(null)
      setDraftSavedAt(null)
    }
    clearCheckDraft(installationId)

    // Log "off the AFLD" activity entry
    const checkTypeMap: Record<string, string> = {
      fod: 'FOD', bash: 'BASH', construction: 'CONSTRUCTION',
      rsc: 'RSC/RCR', rcr: 'RSC/RCR', ife: 'IFE',
      ground_emergency: 'GROUND EMERGENCY', heavy_aircraft: 'HEAVY ACFT',
    }
    const cLabel = checkTypeMap[checkType] || checkType.toUpperCase()
    const dataIssues = Array.isArray(data?.issues) ? (data.issues as { comment?: string }[]) : []
    const issueDescs = dataIssues.map(i => i.comment).filter(Boolean) as string[]
    const wildlifeFormType = (data?.wildlife_form_type as string) || ''
    const wildlifeDisplayId = (data?.wildlife_display_id as string) || ''
    let cDiscStr: string
    if (checkType === 'bash' && wildlifeFormType && wildlifeDisplayId) {
      const wildlifeLabel = wildlifeFormType === 'strike' ? 'WILDLIFE STRIKE' : 'WILDLIFE SIGHTING'
      cDiscStr = `${wildlifeLabel} REPORTED — REF ${wildlifeDisplayId}`
    } else if (issueDescs.length > 0) {
      cDiscStr = `DISCREPANCIES FOUND: ${issueDescs.join('; ').toUpperCase()}`
    } else {
      cDiscStr = 'NO NEW DISCREPANCIES'
    }
    // For Other, drop the type label entirely on the off-airfield
    // entry — the Reason was named on the on-airfield entry, so the
    // off-airfield side just confirms completion + any findings.
    let cDetails = checkType === 'other'
      ? `CK CMPLT, ${cDiscStr}`
      : `${cLabel} CHECK CMPLT, ${cDiscStr}`
    const cBwc = (data.condition_code as string) || ''
    const cRsc = (data.condition as string) || (data.runway_condition as string) || ''
    if (cRsc && cBwc) cDetails += `. ADVISES RSC/${cRsc.toUpperCase()} & BWC/${cBwc.toUpperCase()}`
    else if (cRsc) cDetails += `. ADVISES RSC/${cRsc.toUpperCase()}`
    else if (cBwc) cDetails += `. ADVISES BWC/${cBwc.toUpperCase()}`

    const oiStr = userOI ? `/${userOI}` : ''
    logActivity(
      'completed',
      'airfield_check',
      created.id,
      created.display_id,
      { details: `AFLD3${oiStr} OFF THE AFLD. ${cDetails}` },
      installationId,
    )

    setCheckStarted(false)
    setCheckStartedAt(null)
    setSaving(false)
    const summary = discCreated > 0
      ? `Check ${created.display_id} filed — ${discCreated} discrepanc${discCreated === 1 ? 'y' : 'ies'} logged`
      : `Check ${created.display_id} completed`
    toast.success(summary)
    warnIfRealtimeDown()

    router.push(`/checks/${created.id}`)
  }

  const resetTypeFields = () => {
    setRscCondition('')
    setReportRcr(false)
    setRcrValue('')
    setRcrConditionType('')
    setBashCondition('')
    setAircraftType('')
    setCallsign('')
    setEmergencyNature('')
    setCheckedActions([])
    setNotifiedAgencies([])
    setHeavyAircraftType('')
    setConstructionItems(DEFAULT_CONSTRUCTION_ITEM_STATE)
    setOtherSubject('')
    setSelectedLat(null)
    setSelectedLng(null)
    setIssueFound(false)
    setBashFormSaved(false)
    setBashWildlifeDisplayId(null)
    issuePhotos.flat().forEach((p) => URL.revokeObjectURL(p.url))
    setIssues([])
    setIssuePhotos([])
    setIssueFlyTo([])
  }

  const typeConfig = checkType ? CHECK_TYPE_CONFIG[checkType as keyof typeof CHECK_TYPE_CONFIG] ?? null : null

  return (
    <div className="page-container">
      {/* Page header — tertiary "AIRFIELD CHECK" label + reg subtitle,
          accent underline below. */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 8, paddingBottom: 8, marginBottom: 12,
        borderBottom: '1px solid rgba(56,189,248,0.20)',
      }}>
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700,
          color: 'var(--color-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Airfield Check
        </div>
        <div style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 600,
          color: 'var(--color-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          DAFI 13-213 · UFC 3-260-01
        </div>
      </div>

      {/* Resume / Discard Prompt — banner-tier 4px warning left border. */}
      {showResumePrompt && pendingDraft && (
        <div className="card" style={{
          marginBottom: 8,
          borderLeft: '4px solid var(--color-warning, #D97706)',
          background: 'rgba(217, 119, 6, 0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <AlertTriangle size={20} color="var(--color-warning, #D97706)" />
            <div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-warning, #D97706)' }}>
                Check In Progress
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginTop: 2 }}>
                You have an unfinished <span style={{ fontWeight: 700 }}>
                  {CHECK_TYPE_CONFIG[pendingDraft.checkType as keyof typeof CHECK_TYPE_CONFIG]?.label || pendingDraft.checkType}
                </span>
                {pendingDraft.checkType === 'other' && pendingDraft.otherSubject && (
                  <span> — &ldquo;{pendingDraft.otherSubject}&rdquo;</span>
                )}
                {' '}check{pendingDraft.savedAt ? ` saved ${formatZuluDateShort(new Date(pendingDraft.savedAt))}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleResumeDraft}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--color-success)',
                background: 'rgba(34, 197, 94, 0.1)',
                color: 'var(--color-success)', fontSize: 'var(--fs-base)', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Resume Check
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                border: '1.5px solid rgba(239, 68, 68, 0.5)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: 'var(--color-danger)', fontSize: 'var(--fs-base)', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Check Type — tile grid (3-col desktop, 2-col tablet, 1-col
          mobile). Each tile: Lucide icon, type label, click selects.
          Disabled while a check is in progress so users don't switch
          types mid-walk. */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
          fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          Check Type
        </div>
        <div className="check-type-grid">
          {Object.entries(CHECK_TYPE_CONFIG).map(([key, cfg]) => {
            const Icon = getCheckIcon(cfg.icon)
            const selected = checkType === key
            return (
              <button
                key={key}
                type="button"
                disabled={checkStarted && !selected}
                onClick={async () => {
                  if (selected) return
                  const newType = key as CheckType
                  // Confirm before starting — clicking a tile silently
                  // logs the user "on the airfield" for an audited
                  // check, so make the consequence explicit.
                  // For 'other', the on-airfield Events Log entry needs
                  // a Reason. Capture it here rather than later so the
                  // first log entry is meaningful (back-filling would
                  // mean two log rows or rewriting one).
                  let otherReason = ''
                  if (!checkStarted) {
                    if (newType === 'other') {
                      const r = window.prompt(
                        'Reason for this Other Check?\n\n(Will appear in the Events Log as "AFLD3 ON THE AFLD. <REASON>".)',
                      )
                      if (r === null || !r.trim()) return
                      otherReason = r.trim()
                    } else if (!confirm(`Start ${cfg.label} and log yourself on the airfield?`)) {
                      return
                    }
                  }
                  setCheckType(newType)
                  resetTypeFields()
                  if (newType === 'other') {
                    // Pre-fill the inline Reason input so the user can
                    // edit it later without re-typing. Also force-save
                    // the draft to localStorage immediately so the
                    // reason persists even if the user navigates away
                    // before the auto-save useEffect flushes — React
                    // batches the setState calls and the snapshot ref
                    // doesn't update until the next render tick.
                    setOtherSubject(otherReason)
                    const immediateDraft: CheckDraft = {
                      checkType: newType,
                      // Other checks always default to 'Entire Airfield';
                      // the RSC runway-area defaulting only applies to
                      // RSC type. Inside this `newType === 'other'`
                      // branch we know it's not RSC.
                      areas: ['Entire Airfield'],
                      issueFound: false,
                      issues: [],
                      remarks: [],
                      remarkText: '',
                      rscCondition: '',
                      reportRcr: false,
                      rcrValue: '',
                      rcrConditionType: '',
                      bashCondition: '',
                      aircraftType: '',
                      callsign: '',
                      emergencyNature: '',
                      checkedActions: [],
                      notifiedAgencies: [],
                      heavyAircraftType: '',
                      constructionItems: DEFAULT_CONSTRUCTION_ITEM_STATE,
                      otherSubject: otherReason,
                      savedAt: '',
                      startedAt: new Date().toISOString(),
                      dbRowId: draftDbRowId,
                    }
                    saveCheckDraft(immediateDraft, installationId)
                  }
                  if (newType === 'rsc') {
                    setAreas(installationAreas.filter(a => a.toUpperCase().startsWith('RWY')))
                  } else {
                    setAreas(['Entire Airfield'])
                  }
                  if (!checkStarted) {
                    setCheckStarted(true)
                    setCheckStartedAt(new Date().toISOString())
                    const oiStr = userOI ? `/${userOI}` : ''
                    const checkLabel = CHECK_TYPE_CONFIG[newType as keyof typeof CHECK_TYPE_CONFIG]?.label?.toUpperCase() || newType.toUpperCase()
                    // For Other, the Reason itself is the descriptor —
                    // dropping the redundant "OTHER CHECK FOR" prefix
                    // and the leading "FOR" preposition keeps the
                    // Events Log line tight: "AFLD3/OI ON THE AFLD. <REASON>".
                    const startDetails = newType === 'other'
                      ? `AFLD3${oiStr} ON THE AFLD. ${otherReason.toUpperCase()}`
                      : `AFLD3${oiStr} ON THE AFLD FOR A ${checkLabel}`
                    logActivity(
                      'started',
                      'airfield_check',
                      installationId || crypto.randomUUID(),
                      undefined,
                      { details: startDetails },
                      installationId,
                    )
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: selected ? `2px solid ${cfg.color}` : '1px solid var(--color-border)',
                  background: selected
                    ? `color-mix(in srgb, ${cfg.color} 10%, transparent)`
                    : 'var(--color-bg)',
                  color: selected ? cfg.color : 'var(--color-text-2)',
                  cursor: (checkStarted && !selected) ? 'not-allowed' : 'pointer',
                  opacity: (checkStarted && !selected) ? 0.4 : 1,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  background: `color-mix(in srgb, ${cfg.color} 14%, transparent)`,
                  color: cfg.color,
                  flexShrink: 0,
                }}>
                  <Icon size={18} />
                </span>
                <span style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 700,
                  color: selected ? cfg.color : 'var(--color-text-1)',
                  letterSpacing: '0.02em',
                  lineHeight: 1.25,
                }}>
                  {cfg.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent Checks */}
      {!checkType && recentChecks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Recent Checks
          </div>
          {recentChecks.map((rc) => {
            const cfg = CHECK_TYPE_CONFIG[rc.check_type as keyof typeof CHECK_TYPE_CONFIG]
            const Icon = cfg ? getCheckIcon(cfg.icon) : null
            return (
              <Link
                key={rc.id}
                href={`/checks/${rc.id}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', marginBottom: 4, borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-surface-solid)', border: '1px solid var(--color-border-mid)',
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {Icon && <Icon size={14} color={cfg?.color} />}
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{rc.display_id}</span>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>{cfg?.label}</span>
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                  {rc.completed_at ? formatZuluDateShort(new Date(rc.completed_at)) : ''}
                </span>
              </Link>
            )
          })}
          <Link
            href="/checks/history"
            style={{
              display: 'block', textAlign: 'center', padding: '10px',
              fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-cyan)',
              textDecoration: 'none',
            }}
          >
            View Full Check History →
          </Link>
        </div>
      )}

      {/* Dynamic Fields Based on Check Type */}
      {checkType && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            {typeConfig?.label} Details
          </div>

          {/* RSC / RCR */}
          {checkType === 'rsc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Runway Surface Condition</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {RSC_CONDITIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRscCondition(c)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-lg)', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                        border: rscCondition === c
                          ? `1.5px solid ${c === 'Dry' ? 'var(--color-success)' : 'var(--color-accent)'}`
                          : '1.5px solid var(--color-border-mid)',
                        background: rscCondition === c
                          ? c === 'Dry' ? 'rgba(34,197,94,0.13)' : 'rgba(59,130,246,0.13)'
                          : 'var(--color-bg-elevated)',
                        color: rscCondition === c
                          ? c === 'Dry' ? 'var(--color-success)' : 'var(--color-accent)'
                          : 'var(--color-text-3)',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Report RCR toggle */}
              <div
                onClick={() => setReportRcr(!reportRcr)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  background: reportRcr ? 'rgba(34,211,238,0.08)' : 'var(--color-bg-elevated)',
                  border: reportRcr ? '1.5px solid var(--color-cyan)' : '1.5px solid var(--color-border-mid)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 'var(--radius-xs)',
                  border: reportRcr ? '2px solid var(--color-cyan)' : '2px solid var(--color-text-4)',
                  background: reportRcr ? 'var(--color-cyan)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: 'var(--color-bg-surface-solid)', fontWeight: 700,
                }}>
                  {reportRcr && '✓'}
                </div>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: reportRcr ? 'var(--color-cyan)' : 'var(--color-text-2)' }}>
                  Report RCR
                </span>
              </div>

              {/* RCR inputs (shown when toggle is on) */}
              {reportRcr && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>RWY RCR</div>
                    <input
                      className="input-dark"
                      type="number"
                      placeholder="RCR value"
                      value={rcrValue}
                      onChange={(e) => setRcrValue(e.target.value)}
                      style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Condition</div>
                    <select
                      className="input-dark"
                      value={rcrConditionType}
                      onChange={(e) => setRcrConditionType(e.target.value)}
                    >
                      <option value="">Select condition...</option>
                      {RCR_CONDITION_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BASH */}
          {checkType === 'bash' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Condition Code</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {BASH_CONDITION_CODES.map((code) => {
                    const colors: Record<string, string> = { LOW: 'var(--color-success)', MODERATE: 'var(--color-warning)', SEVERE: 'var(--color-danger)', PROHIBITED: '#DC2626' }
                    const bgColors: Record<string, string> = { LOW: 'rgba(34,197,94,0.13)', MODERATE: 'rgba(234,179,8,0.13)', SEVERE: 'rgba(239,68,68,0.13)', PROHIBITED: 'rgba(220,38,38,0.18)' }
                    const active = bashCondition === code
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setBashCondition(code)}
                        style={{
                          flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          border: active ? `1.5px solid ${colors[code]}` : '1.5px solid var(--color-border-mid)',
                          background: active ? bgColors[code] : 'var(--color-bg-elevated)',
                          color: active ? colors[code] : 'var(--color-text-3)',
                        }}
                      >
                        {code}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Remarks
                </div>
                <ExpandableTextarea
                  className="input-dark"
                  rows={6}
                  placeholder="Add a remark..."
                  value={remarkText}
                  onChange={(val) => setRemarkText(val)}
                  label="Remarks"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addRemark()
                    }
                  }}
                  style={{ resize: 'vertical', width: '100%', minHeight: 120, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={addRemark}
                    disabled={!remarkText.trim()}
                    style={{
                      padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                      background: remarkText.trim() ? 'var(--color-cyan-btn-bg)' : 'var(--color-bg-elevated)',
                      color: remarkText.trim() ? 'var(--color-cyan-btn-text)' : 'var(--color-text-4)',
                      fontSize: 'var(--fs-base)', fontWeight: 700, cursor: remarkText.trim() ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                    }}
                  >
                    Save Remark
                  </button>
                </div>
                {remarks.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--color-bg-elevated)', paddingTop: 8, marginTop: 8 }}>
                    {remarks.map((remark) => (
                      <div key={remark.id} style={{ borderLeft: '2px solid var(--color-text-4)', paddingLeft: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{remark.user_name}</span>
                          {' — '}
                          {formatZuluDateTime(new Date(remark.created_at))}
                        </div>
                        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{remark.comment}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IFE */}
          {checkType === 'ife' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-row">
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Aircraft Type</div>
                  <input className="input-dark" placeholder="e.g., KC-135R" value={aircraftType}
                    onChange={(e) => setAircraftType(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Callsign</div>
                  <input className="input-dark" placeholder="e.g., BOLT 31" value={callsign}
                    onChange={(e) => setCallsign(e.target.value)} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Nature of Emergency</div>
                <input className="input-dark" placeholder="Describe the emergency..."
                  value={emergencyNature} onChange={(e) => setEmergencyNature(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 6 }}>AM Action Checklist</div>
                <div className="checklist-grid">
                  {EMERGENCY_ACTIONS.map((action) => {
                    const checked = checkedActions.includes(action)
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => toggleAction(action)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)', border: checked ? '1.5px solid var(--color-success)' : '1.5px solid var(--color-border-mid)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-base)', textAlign: 'left',
                          background: checked ? 'rgba(34,197,94,0.07)' : 'var(--color-bg-elevated)',
                          color: checked ? 'var(--color-success)' : 'var(--color-text-2)',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 'var(--radius-xs)', flexShrink: 0,
                          border: checked ? '2px solid var(--color-success)' : '2px solid var(--color-text-4)',
                          background: checked ? 'rgba(34,197,94,0.13)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--fs-md)', fontWeight: 700,
                        }}>
                          {checked ? '✓' : ''}
                        </span>
                        {action}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Ground Emergency */}
          {checkType === 'ground_emergency' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Aircraft Type (if applicable)</div>
                <input className="input-dark" placeholder="e.g., A-10C" value={aircraftType}
                  onChange={(e) => setAircraftType(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Nature of Emergency</div>
                <input className="input-dark" placeholder="Describe the emergency..."
                  value={emergencyNature} onChange={(e) => setEmergencyNature(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 6 }}>AM Action Checklist</div>
                <div className="checklist-grid">
                  {EMERGENCY_ACTIONS.map((action) => {
                    const checked = checkedActions.includes(action)
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => toggleAction(action)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)', border: checked ? '1.5px solid var(--color-success)' : '1.5px solid var(--color-border-mid)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-base)', textAlign: 'left',
                          background: checked ? 'rgba(34,197,94,0.07)' : 'var(--color-bg-elevated)',
                          color: checked ? 'var(--color-success)' : 'var(--color-text-2)',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 'var(--radius-xs)', flexShrink: 0,
                          border: checked ? '2px solid var(--color-success)' : '2px solid var(--color-text-4)',
                          background: checked ? 'rgba(34,197,94,0.13)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--fs-md)', fontWeight: 700,
                        }}>
                          {checked ? '✓' : ''}
                        </span>
                        {action}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Heavy Aircraft */}
          {checkType === 'heavy_aircraft' && (
            <div>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Aircraft Type / MDS</div>
              <input className="input-dark" placeholder="e.g., C-17A Globemaster III"
                value={heavyAircraftType} onChange={(e) => setHeavyAircraftType(e.target.value)} />
            </div>
          )}

          {/* FOD */}
          {checkType === 'fod' && (
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
              Document FOD items found in the remarks section below.
            </div>
          )}

          {/* Other — required Reason so History rows are distinguishable
              and the Events Log entry reads meaningfully. Pre-filled
              from the start-check prompt; editable afterwards. */}
          {checkType === 'other' && (
            <div>
              <div style={{
                fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
                fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: 6,
              }}>
                Reason for Check <span style={{ color: 'var(--color-danger)' }}>*</span>
              </div>
              <input
                className="input-dark"
                placeholder="What did you check? (e.g., Perimeter fence walk after wind event)"
                value={otherSubject}
                onChange={(e) => setOtherSubject(e.target.value)}
                style={{ fontSize: 'var(--fs-md)' }}
              />
            </div>
          )}

          {/* Construction — FAA 11-item P/F/N/A checklist. Items
              default to P; user only flips items that aren't passing. */}
          {checkType === 'construction' && (
            <ConstructionChecklist
              state={constructionItems}
              onChange={setConstructionItems}
            />
          )}
        </div>
      )}

      {/* Areas auto-set: 'Entire Airfield' by default, runway areas for RSC */}

      {/* Airfield Diagram Button */}
      {checkType && (
        <button
          type="button"
          onClick={() => diagramUrl ? setShowDiagram(true) : toast.info('No airfield diagram uploaded — add one in Settings > Base Configuration')}
          style={{
            width: '100%', padding: '12px', marginBottom: 8, borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-text-4)', background: 'var(--color-bg-surface-solid)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <MapIcon size={18} color="var(--color-accent)" />
          View Airfield Diagram
        </button>
      )}

      {/* Standalone remarks box removed — if there's something worth
          recording on a check, it lives inside an Issue Found panel
          (which captures the comment, location, and photos together).
          BASH still has its own internal remarks card above. */}

      {/* Issue Found Toggle */}
      {checkType && (
        <button
          type="button"
          onClick={() => {
            const next = !issueFound
            setIssueFound(next)
            if (next) {
              setIssues([{ comment: '', location: null, photo_ids: [] }])
              setIssuePhotos([[]])
              setIssueFlyTo([null])
            } else {
              // Clean up
              issuePhotos.flat().forEach((p) => URL.revokeObjectURL(p.url))
              setIssues([])
              setIssuePhotos([])
              setIssueFlyTo([])
              setSelectedLat(null)
              setSelectedLng(null)
              setBashFormSaved(false)
              setBashWildlifeDisplayId(null)
            }
          }}
          style={{
            width: '100%', padding: '12px 14px', marginBottom: 8, borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--fs-lg)', fontWeight: 700,
            border: issueFound ? '2px solid var(--color-danger)' : '2px solid var(--color-text-4)',
            background: issueFound ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-surface-solid)',
            color: issueFound ? 'var(--color-danger)' : 'var(--color-text-2)',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: 'var(--radius-sm)', flexShrink: 0,
            border: issueFound ? '2px solid var(--color-danger)' : '2px solid var(--color-text-3)',
            background: issueFound ? 'var(--color-danger)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--fs-xl)', fontWeight: 800, color: '#FFFFFF',
          }}>
            {issueFound ? '✓' : ''}
          </span>
          {checkType === 'bash' ? 'Report Sighting and/or Strike' : 'Issue Found'}
        </button>
      )}

      {/* Issue Details — BASH uses inline wildlife forms, others use discrepancy panels */}
      {checkType === 'bash' && issueFound && (
        <div className="card" style={{ marginBottom: 8, padding: 16 }}>
          {bashFormSaved ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.3)',
            }}>
              <CheckCircle2 size={20} color="#10B981" />
              <div>
                <div style={{ fontWeight: 700, color: '#10B981' }}>
                  Wildlife {bashFormType === 'sighting' ? 'sighting' : 'strike'} logged
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                  You can now complete the check.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Form type selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setBashFormType('sighting')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', fontWeight: 700,
                    fontSize: 'var(--fs-md)', fontFamily: 'inherit', cursor: 'pointer',
                    border: bashFormType === 'sighting' ? '2px solid #10B981' : '2px solid var(--color-text-4)',
                    background: bashFormType === 'sighting' ? 'rgba(16,185,129,0.08)' : 'var(--color-bg-surface)',
                    color: bashFormType === 'sighting' ? '#10B981' : 'var(--color-text-2)',
                  }}
                >
                  Wildlife Sighting
                </button>
                <button
                  type="button"
                  onClick={() => setBashFormType('strike')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', fontWeight: 700,
                    fontSize: 'var(--fs-md)', fontFamily: 'inherit', cursor: 'pointer',
                    border: bashFormType === 'strike' ? '2px solid var(--color-danger)' : '2px solid var(--color-text-4)',
                    background: bashFormType === 'strike' ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-surface)',
                    color: bashFormType === 'strike' ? 'var(--color-danger)' : 'var(--color-text-2)',
                  }}
                >
                  Wildlife Strike
                </button>
              </div>

              <div style={{
                padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-md)',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                fontSize: 'var(--fs-sm)', color: 'var(--color-danger)', fontWeight: 600,
              }}>
                Complete the {bashFormType} form below before submitting the check.
              </div>

              {bashFormType === 'sighting' ? (
                <SightingForm
                  currentUser={currentUser}
                  baseId={installationId}
                  inline
                  onClose={() => {}}
                  onSaved={(displayId) => {
                    setBashFormSaved(true)
                    setBashWildlifeDisplayId(displayId || null)
                    toast.success('Wildlife sighting logged')
                  }}
                />
              ) : (
                <StrikeForm
                  currentUser={currentUser}
                  baseId={installationId}
                  inline
                  onClose={() => {}}
                  onSaved={(displayId) => {
                    setBashFormSaved(true)
                    setBashWildlifeDisplayId(displayId || null)
                    toast.success('Wildlife strike reported')
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
      {checkType && checkType !== 'bash' && issueFound && issues.length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <SimpleDiscrepancyPanelGroup
            discrepancies={issues}
            onChange={handleIssueChange}
            onAdd={handleAddIssue}
            onRemove={handleRemoveIssue}
            localPhotos={issuePhotos}
            onAddPhotos={handleIssueAddPhotos}
            onRemovePhoto={handleIssueRemovePhoto}
            onPointSelected={handleIssuePointSelected}
            onCaptureGps={handleIssueCaptureGps}
            gpsLoadingIndex={issueGpsLoading}
            flyToPoints={issueFlyTo}
            headerLabel="Issue Details"
            addLabel="Add Issue"
            onSaveDraft={handleSaveDraft}
            draftSaving={draftSaving}
            areaOptions={installationAreas}
            facilityOptions={facilities}
          />
        </div>
      )}


      {/* Photos section removed — photos now inside issue panels */}

      {/* Tiered action cluster: primary cyan Complete · utility Save
          Draft · blocking left-border Discard. Replaces the old
          stacked green/blue buttons. */}
      {checkType && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button
            type="button"
            onClick={handleComplete}
            disabled={saving || !checkType}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              flex: '2 1 200px', padding: '14px 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(56,189,248,0.40)',
              background: 'rgba(56,189,248,0.12)',
              color: 'var(--color-accent)',
              fontSize: 'var(--fs-md)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <CheckCircle2 size={18} />
            {saving ? 'Saving…' : 'Complete Check'}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={draftSaving}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              flex: '1 1 140px', padding: '14px 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-xs)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: draftSaving ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: draftSaving ? 0.5 : 1,
            }}
          >
            <FileText size={14} color="var(--color-accent)" />
            {draftSaving ? 'Saving…' : draftDbRowId ? 'Update Draft' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm('Discard this check? Unsaved progress will be lost.')) return
              if (draftDbRowId) deleteCheckDraft(draftDbRowId)
              clearCheckDraft(installationId)
              resetTypeFields()
              setCheckType('')
              setCheckStarted(false)
              setCheckStartedAt(null)
              setDraftDbRowId(null)
              setDraftSavedAt(null)
              toast.success('Check discarded')
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              flex: '0 1 110px', padding: '14px 12px', borderRadius: 'var(--radius-md)',
              borderLeft: '4px solid var(--color-danger)',
              border: '1px solid var(--color-border)',
              borderLeftWidth: 4, borderLeftColor: 'var(--color-danger)',
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-xs)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Trash2 size={14} color="var(--color-danger)" />
            Discard
          </button>
        </div>
      )}

      {checkType && draftSavedAt && (
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          Draft last saved {formatZuluDateTime(new Date(draftSavedAt))}
        </div>
      )}

      {checkType && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
          Will be recorded as completed by <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{currentUser}</span>
        </div>
      )}


      {/* ── Airfield Diagram Fullscreen Overlay ── */}
      {showDiagram && diagramUrl && (
        <div
          onClick={() => setShowDiagram(false)}
          onTouchEnd={(e) => { if (e.target === e.currentTarget) setShowDiagram(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 'var(--z-modal)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '60px 12px 24px',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowDiagram(false) }}
            style={{
              position: 'fixed', top: 12, right: 12, zIndex: 'var(--z-modal-nested)',
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 'var(--radius-md)',
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
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 100px)', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
          />
        </div>
      )}
    </div>
  )
}
