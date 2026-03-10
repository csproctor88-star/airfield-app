'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
import type { CheckType } from '@/lib/supabase/types'
import { createCheck, uploadCheckPhoto, fetchRecentChecks, saveCheckDraftToDb, loadCheckDraftFromDb, deleteCheckDraft, type CheckRow } from '@/lib/supabase/checks'
import { createDiscrepancy, uploadDiscrepancyPhoto } from '@/lib/supabase/discrepancies'
import { DEMO_CHECKS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { getAirfieldDiagram } from '@/lib/airfield-diagram'
import { SimpleDiscrepancyPanelGroup } from '@/components/ui/simple-discrepancy-panel-group'
import { formatZuluTime, formatZuluDate, formatZuluDateTime, formatZuluDateShort } from '@/lib/utils'
import type { SimpleDiscrepancy } from '@/lib/supabase/types'
import { loadCheckDraft, saveCheckDraft, clearCheckDraft, type CheckDraft } from '@/lib/check-draft'

type LocalComment = {
  id: string
  comment: string
  user_name: string
  created_at: string
}

export default function AirfieldChecksPage() {
  const router = useRouter()
  const { installationId, areas: installationAreas } = useInstallation()
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

  useEffect(() => {
    if (!installationId) return
    getAirfieldDiagram(installationId).then(setDiagramUrl).catch(() => setDiagramUrl(null))
  }, [installationId])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setCurrentUser('Demo User')
      setRecentChecks(DEMO_CHECKS.slice(0, 5) as unknown as CheckRow[])
      return
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('name, rank, first_name, last_name').eq('id', user.id).single()
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
    fetchRecentChecks(installationId, 5).then(setRecentChecks)
  }, [installationId])

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
    setBashSpecies(saved.bashSpecies)
    setAircraftType(saved.aircraftType)
    setCallsign(saved.callsign)
    setEmergencyNature(saved.emergencyNature)
    setCheckedActions(saved.checkedActions)
    setNotifiedAgencies(saved.notifiedAgencies)
    setHeavyAircraftType(saved.heavyAircraftType)
    if (saved.dbRowId) setDraftDbRowId(saved.dbRowId)
    if (saved.savedAt) setDraftSavedAt(saved.savedAt)
    if (saved.issueFound && saved.issues.length > 0) {
      setIssuePhotos(saved.issues.map(() => []))
      setIssueFlyTo(saved.issues.map(() => null))
    }
  }, [])

  // Two-phase draft load: localStorage (instant) then Supabase (async, cross-device)
  useEffect(() => {
    // Phase 1: Sync — load from localStorage
    const localDraft = loadCheckDraft(installationId)
    if (localDraft) {
      hydrateFormFromDraft(localDraft)
    }
    draftLoaded.current = true

    // Phase 2: Async — check Supabase for a newer draft
    loadCheckDraftFromDb(installationId).then((dbRow) => {
      if (!dbRow?.draft_data) return
      const localTime = localDraft?.savedAt ? new Date(localDraft.savedAt).getTime() : 0
      const dbTime = dbRow.saved_at ? new Date(dbRow.saved_at).getTime() : 0
      if (dbTime > localTime) {
        const dbDraft: CheckDraft = { ...dbRow.draft_data, dbRowId: dbRow.id, savedAt: dbRow.saved_at || '' }
        hydrateFormFromDraft(dbDraft)
        // Mirror to localStorage
        saveCheckDraft(dbDraft, installationId)
        toast.info('Draft loaded from server')
      } else if (dbRow.id && !localDraft?.dbRowId) {
        // Local is newer but link the DB row ID
        setDraftDbRowId(dbRow.id)
        setDraftSavedAt(dbRow.saved_at || null)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId])

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
  const [bashSpecies, setBashSpecies] = useState('')
  const [aircraftType, setAircraftType] = useState('')
  const [callsign, setCallsign] = useState('')
  const [emergencyNature, setEmergencyNature] = useState('')
  const [checkedActions, setCheckedActions] = useState<string[]>([])
  const [notifiedAgencies, setNotifiedAgencies] = useState<string[]>([])
  const [heavyAircraftType, setHeavyAircraftType] = useState('')

  // ── Save Draft handler (manual, not auto-save) ──
  const handleSaveDraft = async () => {
    if (!checkType) {
      toast.error('Select a check type first')
      return
    }
    setDraftSaving(true)
    const draft: CheckDraft = {
      checkType, areas, issueFound, issues, remarks, remarkText,
      rscCondition, reportRcr, rcrValue, rcrConditionType, bashCondition, bashSpecies,
      aircraftType, callsign, emergencyNature, checkedActions, notifiedAgencies,
      heavyAircraftType, savedAt: '', dbRowId: draftDbRowId,
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
        return { ...base, condition_code: bashCondition, species_observed: bashSpecies }
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

    const { data: created, error } = await createCheck({
      check_type: checkType,
      areas,
      data,
      completed_by: currentUser,
      comments,
      latitude: lat,
      longitude: lng,
      base_id: installationId,
    })

    if (error || !created) {
      toast.error(`Failed to save: ${error}`)
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
    if (discCreated > 0) {
      toast.success(`${discCreated} discrepanc${discCreated === 1 ? 'y' : 'ies'} logged`)
    }

    // Clean up draft (DB + localStorage)
    if (draftDbRowId) {
      await deleteCheckDraft(draftDbRowId)
      setDraftDbRowId(null)
      setDraftSavedAt(null)
    }
    clearCheckDraft(installationId)
    setSaving(false)
    toast.success(`Check ${created.display_id} completed`)
    router.push(`/checks/${created.id}`)
  }

  const resetTypeFields = () => {
    setRscCondition('')
    setReportRcr(false)
    setRcrValue('')
    setRcrConditionType('')
    setBashCondition('')
    setBashSpecies('')
    setAircraftType('')
    setCallsign('')
    setEmergencyNature('')
    setCheckedActions([])
    setNotifiedAgencies([])
    setHeavyAircraftType('')
    setSelectedLat(null)
    setSelectedLng(null)
    setIssueFound(false)
    issuePhotos.flat().forEach((p) => URL.revokeObjectURL(p.url))
    setIssues([])
    setIssuePhotos([])
    setIssueFlyTo([])
  }

  const typeConfig = checkType ? CHECK_TYPE_CONFIG[checkType as keyof typeof CHECK_TYPE_CONFIG] ?? null : null

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Airfield Check</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>DAFI 13-213 / UFC 3-260-01</div>
      </div>

      {/* Check Type Dropdown */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Check Type
        </div>
        <select
          className="input-dark"
          value={checkType}
          onChange={(e) => {
            const newType = e.target.value as CheckType | ''
            setCheckType(newType)
            resetTypeFields()
            // Auto-select areas based on type
            if (newType === 'rsc') {
              setAreas(installationAreas.filter(a => a.toUpperCase().startsWith('RWY')))
            } else if (newType) {
              setAreas(['Entire Airfield'])
            } else {
              setAreas(['Entire Airfield'])
            }
          }}
          style={{ fontSize: 'var(--fs-lg)' }}
        >
          <option value="">Select check type...</option>
          {Object.entries(CHECK_TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.icon} {cfg.label}
            </option>
          ))}
        </select>

        {typeConfig && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: typeConfig.color }} />
            <span style={{ fontSize: 'var(--fs-base)', color: typeConfig.color, fontWeight: 600 }}>{typeConfig.label}</span>
          </div>
        )}
      </div>

      {/* Recent Checks */}
      {!checkType && recentChecks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Recent Checks
          </div>
          {recentChecks.map((rc) => {
            const cfg = CHECK_TYPE_CONFIG[rc.check_type as keyof typeof CHECK_TYPE_CONFIG]
            return (
              <Link
                key={rc.id}
                href={`/checks/${rc.id}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', marginBottom: 4, borderRadius: 8,
                  background: 'var(--color-bg-surface-solid)', border: '1px solid var(--color-border-mid)',
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{cfg?.icon}</span>
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
                        flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-lg)', fontWeight: 700,
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
                      {c === 'Dry' ? '☀️' : '💧'} {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Report RCR toggle */}
              <div
                onClick={() => setReportRcr(!reportRcr)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 8, cursor: 'pointer',
                  background: reportRcr ? 'rgba(34,211,238,0.08)' : 'var(--color-bg-elevated)',
                  border: reportRcr ? '1.5px solid var(--color-cyan)' : '1.5px solid var(--color-border-mid)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 4,
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}>
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
                          flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 700,
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
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Species Observed</div>
                <textarea
                  className="input-dark"
                  rows={2}
                  placeholder="Species, count, behavior..."
                  value={bashSpecies}
                  onChange={(e) => setBashSpecies(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
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
                          borderRadius: 6, border: checked ? '1.5px solid var(--color-success)' : '1.5px solid var(--color-border-mid)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-base)', textAlign: 'left',
                          background: checked ? 'rgba(34,197,94,0.07)' : 'var(--color-bg-elevated)',
                          color: checked ? 'var(--color-success)' : 'var(--color-text-2)',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
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
                          borderRadius: 6, border: checked ? '1.5px solid var(--color-success)' : '1.5px solid var(--color-border-mid)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-base)', textAlign: 'left',
                          background: checked ? 'rgba(34,197,94,0.07)' : 'var(--color-bg-elevated)',
                          color: checked ? 'var(--color-success)' : 'var(--color-text-2)',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
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
        </div>
      )}

      {/* Areas auto-set: 'Entire Airfield' by default, runway areas for RSC */}

      {/* Airfield Diagram Button */}
      {checkType && (
        <button
          type="button"
          onClick={() => diagramUrl ? setShowDiagram(true) : toast.info('No airfield diagram uploaded — add one in Settings > Base Configuration')}
          style={{
            width: '100%', padding: '12px', marginBottom: 8, borderRadius: 10,
            border: '1px dashed var(--color-text-4)', background: 'var(--color-bg-surface-solid)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 'var(--fs-3xl)' }}>🗺️</span>
          View Airfield Diagram
        </button>
      )}

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
            }
          }}
          style={{
            width: '100%', padding: '12px 14px', marginBottom: 8, borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--fs-lg)', fontWeight: 700,
            border: issueFound ? '2px solid var(--color-danger)' : '2px solid var(--color-text-4)',
            background: issueFound ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-surface-solid)',
            color: issueFound ? 'var(--color-danger)' : 'var(--color-text-2)',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: issueFound ? '2px solid var(--color-danger)' : '2px solid var(--color-text-3)',
            background: issueFound ? 'var(--color-danger)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--fs-xl)', fontWeight: 800, color: '#FFFFFF',
          }}>
            {issueFound ? '✓' : ''}
          </span>
          Issue Found
        </button>
      )}

      {/* Issue Details — multi-issue panels */}
      {checkType && issueFound && issues.length > 0 && (
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
          />
        </div>
      )}

      {/* Remarks Section */}
      {checkType && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Remarks
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: remarks.length > 0 ? 12 : 0 }}>
            <textarea
              className="input-dark"
              rows={2}
              placeholder="Add a remark..."
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addRemark()
                }
              }}
              style={{ resize: 'vertical', flex: 1 }}
            />
            <button
              type="button"
              onClick={addRemark}
              disabled={!remarkText.trim()}
              style={{
                padding: '0 14px', borderRadius: 8, border: 'none',
                background: remarkText.trim() ? 'var(--color-cyan)' : 'var(--color-bg-elevated)',
                color: remarkText.trim() ? 'var(--color-bg-surface-solid)' : 'var(--color-text-4)',
                fontSize: 'var(--fs-base)', fontWeight: 700, cursor: remarkText.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', alignSelf: 'flex-end', height: 36,
              }}
            >
              Save
            </button>
          </div>

          {remarks.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-bg-elevated)', paddingTop: 10 }}>
              {remarks.map((remark) => (
                <div key={remark.id} style={{ borderLeft: '2px solid var(--color-text-4)', paddingLeft: 10, marginBottom: 10 }}>
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
      )}

      {/* Photos section removed — photos now inside issue panels */}

      {/* Save Draft Button */}
      {checkType && (
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={draftSaving}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              border: '1.5px solid rgba(59,130,246,0.5)',
              background: 'rgba(59,130,246,0.08)',
              color: 'var(--color-accent)', fontSize: 'var(--fs-xl)', fontWeight: 700,
              cursor: draftSaving ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: draftSaving ? 0.7 : 1,
            }}
          >
            {draftSaving ? 'Saving...' : draftDbRowId ? 'Update Draft' : 'Save Draft'}
          </button>
          {draftSavedAt && (
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              Last saved {formatZuluDateTime(new Date(draftSavedAt))}
            </div>
          )}
        </div>
      )}

      {/* Complete Check Button */}
      {checkType && (
        <button
          type="button"
          className="btn-primary"
          onClick={handleComplete}
          disabled={saving || !checkType}
          style={{
            width: '100%', opacity: saving ? 0.7 : 1,
            background: 'var(--color-success)', fontSize: 'var(--fs-xl)', fontWeight: 800,
            padding: '14px', borderRadius: 10,
          }}
        >
          {saving ? 'Saving...' : '✓ Complete Check'}
        </button>
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
