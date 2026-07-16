'use client'

import { useState, useCallback, useEffect, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { DISCREPANCY_TYPES, ALLOWED_TRANSITIONS, STATUS_CONFIG } from '@/lib/constants'
import { getDiscrepancyStatusOptions } from '@/lib/airport-mode'
import { useInstallation } from '@/lib/installation-context'
import UseMyLocationButton from '@/components/ui/use-my-location-button'

const LocationPickerMap = dynamic(
  () => import('@/components/ui/location-picker-map-google'),
  { ssr: false },
)

const InfraFeaturePicker = dynamic(
  () => import('@/components/ui/infrastructure-feature-picker-google').then(m => ({ default: m.InfrastructureFeaturePickerGoogle })),
  { ssr: false },
)

// ─── Generic overlay ────────────────────────────────────────────────

function ModalOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center',
        background: 'var(--color-overlay)', padding: 0,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', width: '100%', maxWidth: 480,
        maxHeight: '85vh', overflow: 'auto', padding: 20, border: '1px solid var(--color-border-mid)',
        borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>{title}</span>
          <button type="button" onClick={onClose} className="btn-ghost" style={{
            color: 'var(--color-text-3)', fontSize: 'var(--fs-3xl)', padding: 0, lineHeight: 1,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="section-label" style={{ display: 'block', marginBottom: 4 }}>{children}</span>
  )
}

function SaveButton({ saving, onClick, label = 'Save' }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn-primary" onClick={onClick} disabled={saving}
      style={{ opacity: saving ? 0.7 : 1, marginTop: 8, flex: 1 }}>
      {saving ? 'Saving...' : label}
    </button>
  )
}

// ─── Edit Discrepancy Modal ─────────────────────────────────────────

export function EditDiscrepancyModal({
  discrepancy, onClose, onSaved,
}: {
  discrepancy: DiscrepancyRow
  onClose: () => void
  onSaved: (updated: DiscrepancyRow) => void
}) {
  const { areas: installationAreas, facilities, installationId, ceShops, currentInstallation } = useInstallation()
  const statusOptions = getDiscrepancyStatusOptions(currentInstallation)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: discrepancy.title,
    description: discrepancy.description,
    location_text: discrepancy.location_text,
    type: discrepancy.type,
    notam_reference: ((discrepancy as DiscrepancyRow & { notam_reference?: string }).notam_reference || '') as string,
    current_status: ((discrepancy as DiscrepancyRow & { current_status?: string }).current_status || 'submitted_to_afm') as string,
    facility_number: (discrepancy as DiscrepancyRow & { facility_number?: string | null }).facility_number || '',
    work_order_number: discrepancy.work_order_number || '',
    assigned_shop: (discrepancy as DiscrepancyRow & { assigned_shop?: string | null }).assigned_shop || '',
    estimated_completion_date: (discrepancy as DiscrepancyRow & { estimated_completion_date?: string | null }).estimated_completion_date || '',
    project_number: (discrepancy as DiscrepancyRow & { project_number?: string | null }).project_number || '',
    estimated_cost: (discrepancy as DiscrepancyRow & { estimated_cost?: string | null }).estimated_cost || '',
    risk_control_measure: (discrepancy as DiscrepancyRow & { risk_control_measure?: string | null }).risk_control_measure || '',
    latitude: discrepancy.latitude,
    longitude: discrepancy.longitude,
  })

  // ── Link to Visual NAVAID ──
  const [showFeaturePicker, setShowFeaturePicker] = useState(false)
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>(
    discrepancy.infrastructure_feature_id ? [discrepancy.infrastructure_feature_id] : []
  )
  const [lightingSystemIds, setLightingSystemIds] = useState<string[]>([])

  useEffect(() => {
    if (!installationId) return
    import('@/lib/supabase/lighting-systems').then(({ fetchLightingSystems }) =>
      fetchLightingSystems(installationId!).then(systems =>
        setLightingSystemIds(systems.map(s => s.id))
      )
    )
  }, [installationId])

  const handlePointSelected = useCallback((lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))
  }, [])

  const handleSave = async () => {
    if (!form.title || !form.description || !form.location_text) return
    setSaving(true)

    const newFeatureId = selectedFeatureIds.length > 0 ? selectedFeatureIds[0] : null
    const oldFeatureId = discrepancy.infrastructure_feature_id || null

    const { updateDiscrepancy } = await import('@/lib/supabase/discrepancies')
    const { data, error } = await updateDiscrepancy(discrepancy.id, {
      title: form.title,
      description: form.description,
      location_text: form.location_text,
      type: form.type,
      notam_reference: form.notam_reference || null,
      current_status: form.current_status,
      facility_number: form.facility_number || null,
      work_order_number: form.work_order_number || null,
      assigned_shop: form.assigned_shop || null,
      estimated_completion_date: form.estimated_completion_date || null,
      project_number: form.project_number || null,
      estimated_cost: form.estimated_cost || null,
      risk_control_measure: form.risk_control_measure || null,
      latitude: form.latitude,
      longitude: form.longitude,
      infrastructure_feature_id: newFeatureId,
    })

    // Handle feature status changes when link changed
    if (!error && installationId) {
      const { bulkUpdateStatus } = await import('@/lib/supabase/infrastructure-features')
      const { createOutageEvent } = await import('@/lib/supabase/outage-events')

      // If we linked new features that weren't linked before, mark inoperative
      if (newFeatureId && newFeatureId !== oldFeatureId) {
        const linkedCount = await bulkUpdateStatus([newFeatureId], 'inoperative')
        const evt = await createOutageEvent({
          base_id: installationId,
          feature_id: newFeatureId,
          event_type: 'reported',
          discrepancy_id: discrepancy.id,
          notes: `Linked to discrepancy ${discrepancy.display_id}`,
        })
        if (linkedCount < 1 || !evt) {
          const { toast } = await import('sonner')
          toast.warning('Discrepancy saved, but updating the linked NAVAID status/outage log failed — check it on the Infrastructure page.')
        }
      }
      // If we unlinked an old feature, mark it operational
      if (oldFeatureId && oldFeatureId !== newFeatureId) {
        const unlinkedCount = await bulkUpdateStatus([oldFeatureId], 'operational')
        if (unlinkedCount < 1) {
          const { toast } = await import('sonner')
          toast.warning('Discrepancy saved, but the unlinked NAVAID was not restored to operational — check it on the Infrastructure page.')
        }
      }
    }

    setSaving(false)
    if (error) {
      const { toast } = await import('sonner')
      toast.error(error)
      return
    }
    if (data) onSaved(data)
    onClose()
  }

  return (
    <ModalOverlay title="Edit Discrepancy" onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Location</FieldLabel>
        <select className="input-dark" value={form.location_text}
          onChange={(e) => setForm(p => ({ ...p, location_text: e.target.value }))}>
          <option value="">Select location...</option>
          {installationAreas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Type</FieldLabel>
        <select className="input-dark" value={form.type}
          onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}>
          {DISCREPANCY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Title</FieldLabel>
        <input className="input-dark" maxLength={120} value={form.title}
          onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Description</FieldLabel>
        <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }}
          value={form.description}
          onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Associated NOTAM if Applicable</FieldLabel>
        <input className="input-dark" placeholder="e.g., 01/003" value={form.notam_reference}
          onChange={(e) => setForm(p => ({ ...p, notam_reference: e.target.value }))} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Current Status</FieldLabel>
        <select className="input-dark" value={form.current_status}
          onChange={(e) => setForm(p => ({ ...p, current_status: e.target.value }))}>
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Assign to Facility #</FieldLabel>
        {facilities.length > 0 ? (
          <select className="input-dark" value={form.facility_number}
            onChange={(e) => setForm(p => ({ ...p, facility_number: e.target.value }))}>
            <option value="">— None —</option>
            {facilities.map(f => <option key={f.id} value={`${f.facility_number} — ${f.description}`}>{f.facility_number} — {f.description}</option>)}
          </select>
        ) : (
          <input className="input-dark" placeholder="e.g., 06010 — Runway" value={form.facility_number}
            onChange={(e) => setForm(p => ({ ...p, facility_number: e.target.value }))} />
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Work Order #</FieldLabel>
        <input className="input-dark" placeholder="e.g., WO-2026-0042"
          value={form.work_order_number}
          onChange={(e) => setForm(p => ({ ...p, work_order_number: e.target.value }))} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Assigned To</FieldLabel>
        {ceShops.length > 0 ? (
          <select className="input-dark" value={form.assigned_shop}
            onChange={(e) => setForm(p => ({ ...p, assigned_shop: e.target.value }))}>
            <option value="">— Unassigned —</option>
            {ceShops.map(shop => <option key={shop} value={shop}>{shop}</option>)}
          </select>
        ) : (
          <input className="input-dark" placeholder="e.g., Electrical Shop"
            value={form.assigned_shop}
            onChange={(e) => setForm(p => ({ ...p, assigned_shop: e.target.value }))} />
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Estimated Completion Date</FieldLabel>
        <input
          type="date"
          className="input-dark"
          value={form.estimated_completion_date}
          onChange={(e) => setForm(p => ({ ...p, estimated_completion_date: e.target.value }))}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Project # <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>(optional)</span></FieldLabel>
        <input className="input-dark" placeholder="e.g., MP-2026-ILS-01"
          value={form.project_number}
          onChange={(e) => setForm(p => ({ ...p, project_number: e.target.value }))} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Estimated Cost <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>(optional)</span></FieldLabel>
        <input className="input-dark" placeholder="e.g., $25,000 or TBD"
          value={form.estimated_cost}
          onChange={(e) => setForm(p => ({ ...p, estimated_cost: e.target.value }))} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Risk Control Measure <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>(optional)</span></FieldLabel>
        <textarea className="input-dark" rows={3}
          placeholder="Mitigation or interim control in place while the discrepancy is open"
          value={form.risk_control_measure}
          onChange={(e) => setForm(p => ({ ...p, risk_control_measure: e.target.value }))}
          style={{ resize: 'vertical' }} />
      </div>

      {/* Link to Visual NAVAID */}
      {lightingSystemIds.length > 0 && installationId && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowFeaturePicker(!showFeaturePicker)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700,
              width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
              border: showFeaturePicker ? '2px solid var(--color-cyan-bright)' : '2px solid var(--color-text-4)',
              background: showFeaturePicker ? 'rgba(34,211,238,0.08)' : 'transparent',
              color: showFeaturePicker ? 'var(--color-cyan-bright)' : 'var(--color-text-2)',
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 'var(--radius-sm)', flexShrink: 0,
              border: showFeaturePicker ? '2px solid var(--color-cyan-bright)' : '2px solid var(--color-text-3)',
              background: showFeaturePicker ? 'var(--color-cyan-bright)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#000',
            }}>
              {showFeaturePicker ? '\u2713' : ''}
            </span>
            Link to Visual NAVAID
            {selectedFeatureIds.length > 0 && (
              <span style={{ fontSize: 'var(--fs-xs)', background: 'rgba(34,211,238,0.2)', color: 'var(--color-cyan-bright)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
                {selectedFeatureIds.length} selected
              </span>
            )}
          </button>

          {showFeaturePicker && (
            <div style={{ marginTop: 8 }}>
              <InfraFeaturePicker
                systemIds={lightingSystemIds}
                baseId={installationId}
                selectedFeatureIds={selectedFeatureIds}
                onSelectionChange={setSelectedFeatureIds}
              />
            </div>
          )}
        </div>
      )}

      {/* Pin Location on Map */}
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Pin Location on Map</FieldLabel>
        <LocationPickerMap
          onPointSelected={handlePointSelected}
          selectedLat={form.latitude}
          selectedLng={form.longitude}
          flyToPoint={form.latitude != null && form.longitude != null ? { lat: form.latitude, lng: form.longitude } : null}
          aspectRatio="1 / 1"
          maxHeight="300px"
        />
      </div>

      {/* Use My Location */}
      <UseMyLocationButton
        variant="inline"
        onLocation={(c) =>
          setForm((prev) => ({ ...prev, latitude: c.lat, longitude: c.lng }))
        }
        style={{ marginBottom: 12 }}
      />

      <SaveButton saving={saving} onClick={handleSave} />
    </ModalOverlay>
  )
}

// ─── Status Update Modal ────────────────────────────────────────────

// Workflow step indicator
const WORKFLOW_STEPS = [
  { value: 'submitted_to_afm', short: 'AFM', color: 'var(--color-blue)' },
  { value: 'submitted_to_ces', short: 'CES', color: 'var(--color-orange)' },
  { value: 'awaiting_action_by_ces', short: 'In Work', color: 'var(--color-amber)' },
  { value: 'waiting_for_project', short: 'Project', color: 'var(--color-purple)' },
  { value: 'work_completed_awaiting_verification', short: 'Verify', color: 'var(--color-green)' },
] as const

function WorkflowProgressBar({ currentStatus }: { currentStatus: string }) {
  const activeIdx = WORKFLOW_STEPS.findIndex(s => s.value === currentStatus)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 14 }}>
      {WORKFLOW_STEPS.map((step, i) => {
        const isActive = i === activeIdx
        const isPast = i < activeIdx
        const stepColor = isActive ? step.color : isPast ? 'var(--color-green)' : 'var(--color-text-4)'
        return (
          <div key={step.value} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 'var(--fs-xs)', fontWeight: 800,
                background: isActive ? stepColor : isPast ? 'var(--color-green)' : 'transparent',
                border: `2px solid ${stepColor}`,
                color: isActive || isPast ? '#fff' : stepColor,
              }}>
                {isPast ? '\u2713' : i + 1}
              </div>
              <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: isActive ? 700 : 500, color: stepColor, marginTop: 2 }}>
                {step.short}
              </div>
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <div style={{
                height: 2, flex: '0 0 12px',
                background: i < activeIdx ? 'var(--color-green)' : 'var(--color-text-4)',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function StatusUpdateModal({
  discrepancy, onClose, onSaved, onDeleted,
}: {
  discrepancy: DiscrepancyRow
  onClose: () => void
  onSaved: (updated: DiscrepancyRow) => void
  onDeleted?: () => void
}) {
  const { ceShops, userRole, currentInstallation } = useInstallation()
  const isCes = userRole === 'ces'
  const allowed = isCes ? [] : (ALLOWED_TRANSITIONS[discrepancy.status] || [])
  const statusOptions = getDiscrepancyStatusOptions(currentInstallation)
  const [saving, setSaving] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [currentStatus, setCurrentStatus] = useState(
    ((discrepancy as DiscrepancyRow & { current_status?: string }).current_status || 'submitted_to_afm') as string
  )
  const [notes, setNotes] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState(discrepancy.resolution_notes || '')
  const [assignedShop, setAssignedShop] = useState(discrepancy.assigned_shop || '')

  // Determine if resolution/remarks notes should be required
  const needsResolutionNotes = currentStatus === 'work_completed_awaiting_verification' || currentStatus === 'waiting_for_project' || newStatus === 'completed'

  const handleSave = async () => {
    // Require notes when CES marks work completed or sends to project
    if (currentStatus === 'work_completed_awaiting_verification' && !resolutionNotes.trim() && !notes.trim()) {
      const { toast } = await import('sonner')
      toast.error('Please describe the work completed before marking as done')
      return
    }
    if (currentStatus === 'waiting_for_project' && !resolutionNotes.trim() && !notes.trim()) {
      const { toast } = await import('sonner')
      toast.error('Please provide remarks explaining why this requires a project')
      return
    }

    setSaving(true)

    // Cancelled = delete from DB entirely
    if (newStatus === 'cancelled') {
      // Mark linked infrastructure feature operational before deleting
      let featureRestoreFailed = false
      if (discrepancy.infrastructure_feature_id) {
        const { updateFeatureStatus } = await import('@/lib/supabase/infrastructure-features')
        const restored = await updateFeatureStatus(discrepancy.infrastructure_feature_id, 'operational')
        if (!restored) featureRestoreFailed = true
      }
      const { deleteDiscrepancy } = await import('@/lib/supabase/discrepancies')
      const { error } = await deleteDiscrepancy(discrepancy.id)
      setSaving(false)
      if (error) {
        const { toast } = await import('sonner')
        toast.error(error)
        return
      }
      const { toast } = await import('sonner')
      if (featureRestoreFailed) {
        toast.warning('Discrepancy removed, but the linked NAVAID was not restored to operational — check it on the Infrastructure page.')
      }
      toast.success('Discrepancy cancelled and removed')
      onClose()
      if (onDeleted) onDeleted()
      return
    }

    // Update assigned_shop, current_status, and/or resolution_notes if changed
    const origCurrentStatus = (discrepancy as DiscrepancyRow & { current_status?: string }).current_status || 'submitted_to_afm'
    const shopChanged = assignedShop !== (discrepancy.assigned_shop || '')
    const currentStatusChanged = currentStatus !== origCurrentStatus
    const resolutionChanged = resolutionNotes !== (discrepancy.resolution_notes || '')

    // Auto-advance current_status when closing
    let effectiveCurrentStatus = currentStatus
    if (newStatus === 'completed' && currentStatus !== 'work_completed_awaiting_verification') {
      effectiveCurrentStatus = 'work_completed_awaiting_verification'
    }
    const autoAdvanced = effectiveCurrentStatus !== currentStatus

    // CES users are blocked by RLS from writing discrepancies /
    // status_updates directly — route every CES save through the
    // SECURITY DEFINER RPC, which handles the update, the audit row,
    // and the optional note atomically. CES never reaches the
    // status-transition or assigned_shop branches further down.
    if (isCes) {
      const anyChange =
        currentStatusChanged || autoAdvanced || resolutionChanged || notes.trim().length > 0
      if (!anyChange) {
        setSaving(false)
        onClose()
        return
      }
      const { cesUpdateDiscrepancy } = await import('@/lib/supabase/discrepancies')
      const { error } = await cesUpdateDiscrepancy(discrepancy.id, {
        current_status: currentStatusChanged || autoAdvanced ? effectiveCurrentStatus : null,
        resolution_notes: resolutionChanged ? (resolutionNotes || null) : null,
        note: notes.trim() ? notes.trim() : null,
      })
      setSaving(false)
      if (error) {
        const { toast } = await import('sonner')
        toast.error(error)
        return
      }
      const { fetchDiscrepancy } = await import('@/lib/supabase/discrepancies')
      const fresh = await fetchDiscrepancy(discrepancy.id)
      if (fresh) onSaved(fresh)
      onClose()
      return
    }

    if (shopChanged || currentStatusChanged || autoAdvanced || resolutionChanged) {
      const { updateDiscrepancy } = await import('@/lib/supabase/discrepancies')
      const fields: Record<string, unknown> = {}
      if (shopChanged) fields.assigned_shop = assignedShop || null
      if (currentStatusChanged || autoAdvanced) fields.current_status = effectiveCurrentStatus
      if (resolutionChanged) fields.resolution_notes = resolutionNotes || null
      const { error: fieldsError } = await updateDiscrepancy(discrepancy.id, fields)
      if (fieldsError) {
        setSaving(false)
        const { toast } = await import('sonner')
        toast.error(fieldsError)
        return
      }
    }

    // Only update status if one was selected
    if (newStatus) {
      // Mark linked infrastructure feature operational when completing
      let featureRestoreFailed = false
      if (newStatus === 'completed' && discrepancy.infrastructure_feature_id) {
        const { updateFeatureStatus } = await import('@/lib/supabase/infrastructure-features')
        const restored = await updateFeatureStatus(discrepancy.infrastructure_feature_id, 'operational')
        if (!restored) featureRestoreFailed = true
      }
      const combinedNotes = [notes, resolutionNotes && `RESOLUTION: ${resolutionNotes}`].filter(Boolean).join('. ')
      const { updateDiscrepancyStatus } = await import('@/lib/supabase/discrepancies')
      const { data, error } = await updateDiscrepancyStatus(
        discrepancy.id,
        discrepancy.status,
        newStatus,
        combinedNotes || undefined,
        { resolution_notes: resolutionNotes || undefined },
      )
      setSaving(false)
      if (error) {
        const { toast } = await import('sonner')
        toast.error(error)
        return
      }
      if (featureRestoreFailed) {
        const { toast } = await import('sonner')
        toast.warning('Discrepancy completed, but the linked NAVAID was not restored to operational — check it on the Infrastructure page.')
      }
      if (data) onSaved(data)
      onClose()
      return
    }

    // No status change — just save notes/shop and refresh
    if (notes) {
      const { addStatusNote } = await import('@/lib/supabase/discrepancies')
      const { error: noteError } = await addStatusNote(discrepancy.id, notes)
      if (noteError) {
        const { toast } = await import('sonner')
        toast.error(`Failed to save note: ${noteError}`)
        setSaving(false)
        return
      }
    }
    // Refresh discrepancy to pick up assigned_shop change
    const { fetchDiscrepancy } = await import('@/lib/supabase/discrepancies')
    const fresh = await fetchDiscrepancy(discrepancy.id)
    setSaving(false)
    if (fresh) onSaved(fresh)
    onClose()
  }

  // Derive button label
  let saveLabel = 'Update Status'
  if (newStatus === 'cancelled') saveLabel = 'Cancel Discrepancy'
  else if (newStatus === 'completed') saveLabel = 'Close Discrepancy'

  /* Note: even if no primary status transitions are available, we still
     render the full modal so the user can change current_status, shop, etc. */

  return (
    <ModalOverlay title="Update Status" onClose={onClose}>
      {/* Workflow progress bar */}
      <WorkflowProgressBar currentStatus={currentStatus} />

      {allowed.length > 0 && (
        <>
          <div style={{ marginBottom: 12 }}>
            <FieldLabel>Open / Closed</FieldLabel>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: STATUS_CONFIG[discrepancy.status as keyof typeof STATUS_CONFIG]?.color || 'var(--color-text-3)' }}>
              {STATUS_CONFIG[discrepancy.status as keyof typeof STATUS_CONFIG]?.label || discrepancy.status}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <FieldLabel>Change To</FieldLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allowed.map(s => {
                const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]
                const active = s === newStatus
                return (
                  <button key={s} type="button" onClick={() => setNewStatus(active ? '' : s)} style={{
                    background: active ? `${cfg?.color || 'var(--color-text-3)'}22` : 'transparent',
                    border: `1px solid ${active ? cfg?.color || 'var(--color-text-3)' : 'var(--color-text-4)'}`,
                    borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--fs-base)', fontWeight: 600,
                    color: cfg?.color || 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {cfg?.label || s}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Current Status</FieldLabel>
        {isCes ? (
          // CES users: limited status options
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { value: 'awaiting_action_by_ces', label: 'In Work' },
              { value: 'waiting_for_project', label: 'Project' },
              { value: 'work_completed_awaiting_verification', label: 'Work Completed' },
            ].map(o => {
              const active = currentStatus === o.value
              const color = o.value === 'work_completed_awaiting_verification' ? 'var(--color-green)' : 'var(--color-amber)'
              return (
                <button key={o.value} type="button" onClick={() => setCurrentStatus(o.value)} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-base)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? `${color}18` : 'transparent',
                  border: `1.5px solid ${active ? color : 'var(--color-text-4)'}`,
                  color: active ? color : 'var(--color-text-3)',
                }}>
                  {o.label}
                </button>
              )
            })}
          </div>
        ) : (
          <select className="input-dark" value={currentStatus}
            onChange={(e) => setCurrentStatus(e.target.value)}>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>

      {!isCes && (
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>Assigned Shop</FieldLabel>
          <select className="input-dark" value={assignedShop}
            onChange={(e) => setAssignedShop(e.target.value)}>
            <option value="">Unassigned</option>
            {ceShops.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Resolution / remarks notes — shown when work completed, project, or closing */}
      {needsResolutionNotes && (() => {
        const isProject = currentStatus === 'waiting_for_project'
        const isComplete = currentStatus === 'work_completed_awaiting_verification' || newStatus === 'completed'
        const accentColor = isProject ? 'rgba(167,139,250,' : 'rgba(34,197,94,'
        const label = isProject
          ? 'Project Remarks — Why does this require a project?'
          : newStatus === 'completed'
            ? 'Resolution Summary'
            : 'Work Completed — Describe Actions Taken'
        const placeholder = isProject
          ? 'Describe the scope, project number if known, expected timeline...'
          : newStatus === 'completed'
            ? 'Summarize how this discrepancy was resolved...'
            : 'Describe the work performed, parts used, etc...'
        return (
          <div style={{
            marginBottom: 12, padding: 10, borderRadius: 'var(--radius-md)',
            background: `${accentColor}0.06)`, border: `1px solid ${accentColor}0.2)`,
          }}>
            <FieldLabel>
              {label}
              <span style={{ color: 'var(--color-red)', marginLeft: 4 }}>*</span>
            </FieldLabel>
            <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }}
              placeholder={placeholder}
              value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} />
          </div>
        )
      })()}

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Notes (optional)</FieldLabel>
        <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }}
          placeholder="Additional notes..."
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <SaveButton saving={saving} onClick={handleSave} label={saveLabel} />
    </ModalOverlay>
  )
}

// ─── Photo Viewer Modal ─────────────────────────────────────────────

import { ZoomableImage } from '@/components/ui/zoomable-image'

export function PhotoViewerModal({
  photos, initialIndex = 0, onClose,
}: {
  photos: { url: string; name: string }[]
  initialIndex?: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const photo = photos[index]

  if (!photo) return null

  return (
    <div
      className="modal-overlay"
      style={{
        flexDirection: 'column',
        background: 'rgba(0,0,0,0.9)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <button type="button" onClick={onClose} className="btn-ghost" style={{
        position: 'absolute', top: 12, right: 16,
        color: '#fff', fontSize: 'var(--fs-5xl)', padding: 0, zIndex: 10,
      }}>×</button>

      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 8, textAlign: 'center' }}>
        {photo.name} — {index + 1} of {photos.length}
      </div>

      <ZoomableImage src={photo.url} alt={photo.name} />

      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <button type="button" onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-md)', padding: '8px 16px', color: '#fff', fontSize: 'var(--fs-xl)', cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Prev
          </button>
          <button type="button" onClick={() => setIndex((i) => (i + 1) % photos.length)}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-md)', padding: '8px 16px', color: '#fff', fontSize: 'var(--fs-xl)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
