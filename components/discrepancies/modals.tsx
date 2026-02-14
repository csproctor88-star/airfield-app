'use client'

import { useState, type ReactNode } from 'react'
import type { DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { DISCREPANCY_TYPES, INSTALLATION, ALLOWED_TRANSITIONS, STATUS_CONFIG } from '@/lib/constants'

// ─── Generic overlay ────────────────────────────────────────────────

function ModalOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', padding: 0,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#0F172A', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480,
        maxHeight: '85vh', overflow: 'auto', padding: 20, border: '1px solid #1E293B',
        borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{title}</span>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748B', fontSize: 18,
            cursor: 'pointer', padding: 0, lineHeight: 1,
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
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: discrepancy.title,
    description: discrepancy.description,
    location_text: discrepancy.location_text,
    type: discrepancy.type,
    severity: discrepancy.severity as string,
    assigned_shop: discrepancy.assigned_shop || '',
  })

  const handleSave = async () => {
    if (!form.title || !form.description || !form.location_text) return
    setSaving(true)
    const { updateDiscrepancy } = await import('@/lib/supabase/discrepancies')
    const { data, error } = await updateDiscrepancy(discrepancy.id, {
      title: form.title,
      description: form.description,
      location_text: form.location_text,
      type: form.type,
      severity: form.severity,
      assigned_shop: form.assigned_shop || null,
    })
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
        <FieldLabel>Title</FieldLabel>
        <input className="input-dark" maxLength={120} value={form.title}
          onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Location</FieldLabel>
        <input className="input-dark" value={form.location_text}
          onChange={(e) => setForm(p => ({ ...p, location_text: e.target.value }))} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Type</FieldLabel>
        <select className="input-dark" value={form.type}
          onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}>
          {DISCREPANCY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Severity</FieldLabel>
        <select className="input-dark" value={form.severity}
          onChange={(e) => setForm(p => ({ ...p, severity: e.target.value }))}>
          {['critical', 'high', 'medium', 'low'].map(s =>
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          )}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Assigned Shop</FieldLabel>
        <select className="input-dark" value={form.assigned_shop}
          onChange={(e) => setForm(p => ({ ...p, assigned_shop: e.target.value }))}>
          <option value="">Unassigned</option>
          {INSTALLATION.ce_shops.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Description</FieldLabel>
        <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }}
          value={form.description}
          onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
      </div>

      <SaveButton saving={saving} onClick={handleSave} />
    </ModalOverlay>
  )
}

// ─── Status Update Modal ────────────────────────────────────────────

export function StatusUpdateModal({
  discrepancy, onClose, onSaved,
}: {
  discrepancy: DiscrepancyRow
  onClose: () => void
  onSaved: (updated: DiscrepancyRow) => void
}) {
  const allowed = ALLOWED_TRANSITIONS[discrepancy.status] || []
  const [saving, setSaving] = useState(false)
  const [newStatus, setNewStatus] = useState(allowed[0] || '')
  const [notes, setNotes] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [assignedShop, setAssignedShop] = useState(discrepancy.assigned_shop || '')

  const needsShop = newStatus === 'assigned'
  const needsResolution = newStatus === 'resolved'

  const handleSave = async (statusOverride?: string) => {
    const targetStatus = statusOverride || newStatus
    if (!targetStatus) return
    if (!statusOverride && needsShop && !assignedShop) return
    if (!statusOverride && needsResolution && !resolutionNotes) return

    setSaving(true)
    const { updateDiscrepancyStatus } = await import('@/lib/supabase/discrepancies')
    const { data, error } = await updateDiscrepancyStatus(
      discrepancy.id,
      discrepancy.status,
      targetStatus,
      notes || undefined,
      {
        ...(needsShop && !statusOverride ? { assigned_shop: assignedShop } : {}),
        ...(needsResolution && !statusOverride ? { resolution_notes: resolutionNotes } : {}),
      },
    )
    setSaving(false)
    if (error) {
      const { toast } = await import('sonner')
      toast.error(error)
      return
    }
    if (data) onSaved(data)
    onClose()
  }

  if (allowed.length === 0) {
    return (
      <ModalOverlay title="Update Status" onClose={onClose}>
        <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: 16 }}>
          No status transitions available from &ldquo;{STATUS_CONFIG[discrepancy.status as keyof typeof STATUS_CONFIG]?.label}&rdquo;.
        </div>
      </ModalOverlay>
    )
  }

  return (
    <ModalOverlay title="Update Status" onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Current Status</FieldLabel>
        <div style={{ fontSize: 12, fontWeight: 600, color: STATUS_CONFIG[discrepancy.status as keyof typeof STATUS_CONFIG]?.color || '#94A3B8' }}>
          {STATUS_CONFIG[discrepancy.status as keyof typeof STATUS_CONFIG]?.label || discrepancy.status}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>New Status</FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {allowed.map(s => {
            const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]
            const active = s === newStatus
            return (
              <button key={s} type="button" onClick={() => setNewStatus(s)} style={{
                background: active ? `${cfg?.color || '#64748B'}22` : 'transparent',
                border: `1px solid ${active ? cfg?.color || '#64748B' : '#334155'}`,
                borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600,
                color: cfg?.color || '#94A3B8', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {cfg?.label || s}
              </button>
            )
          })}
        </div>
      </div>

      {needsShop && (
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>Assigned Shop (required)</FieldLabel>
          <select className="input-dark" value={assignedShop}
            onChange={(e) => setAssignedShop(e.target.value)}>
            <option value="">Select shop...</option>
            {INSTALLATION.ce_shops.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {needsResolution && (
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>Resolution Notes (required)</FieldLabel>
          <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }}
            placeholder="Describe how this was resolved..."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)} />
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Notes (optional)</FieldLabel>
        <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }}
          placeholder="Additional notes..."
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <SaveButton saving={saving} onClick={() => handleSave()} label="Update Status" />

      {allowed.includes('cancelled') && (
        <button type="button" disabled={saving} onClick={() => handleSave('cancelled')}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', marginTop: 6,
            background: 'transparent', border: '1px solid #334155', color: '#9CA3AF',
            opacity: saving ? 0.7 : 1,
          }}>
          Cancel Discrepancy
        </button>
      )}
    </ModalOverlay>
  )
}

// ─── Work Order Modal ───────────────────────────────────────────────

export function WorkOrderModal({
  discrepancy, onClose, onSaved,
}: {
  discrepancy: DiscrepancyRow
  onClose: () => void
  onSaved: (updated: DiscrepancyRow) => void
}) {
  const [saving, setSaving] = useState(false)
  const [workOrder, setWorkOrder] = useState(discrepancy.work_order_number || '')

  const handleSave = async () => {
    setSaving(true)
    const { updateDiscrepancy } = await import('@/lib/supabase/discrepancies')
    const { data, error } = await updateDiscrepancy(discrepancy.id, {
      work_order_number: workOrder || null,
    })
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
    <ModalOverlay title="Work Order" onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Work Order Number</FieldLabel>
        <input className="input-dark" placeholder="e.g., WO-2026-0042"
          value={workOrder} onChange={(e) => setWorkOrder(e.target.value)} />
      </div>

      <div style={{ fontSize: 10, color: '#64748B', marginBottom: 12 }}>
        {discrepancy.work_order_number
          ? `Current: ${discrepancy.work_order_number}`
          : 'No work order assigned yet.'}
      </div>

      <SaveButton saving={saving} onClick={handleSave} label={workOrder ? 'Save Work Order' : 'Clear Work Order'} />
    </ModalOverlay>
  )
}

// ─── Photo Viewer Modal ─────────────────────────────────────────────

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
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.9)', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <button type="button" onClick={onClose} style={{
        position: 'absolute', top: 12, right: 16, background: 'none',
        border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', zIndex: 10,
      }}>×</button>

      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8, textAlign: 'center' }}>
        {photo.name} — {index + 1} of {photos.length}
      </div>

      <img
        src={photo.url}
        alt={photo.name}
        style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
      />

      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <button type="button" onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
            style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Prev
          </button>
          <button type="button" onClick={() => setIndex((i) => (i + 1) % photos.length)}
            style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
