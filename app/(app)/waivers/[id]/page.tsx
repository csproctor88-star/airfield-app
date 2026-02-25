'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/ui/button'
import { fetchWaiver, updateWaiverStatus, deleteWaiver, type WaiverRow } from '@/lib/supabase/waivers'
import { createClient } from '@/lib/supabase/client'
import { DEMO_WAIVERS, DEMO_DISCREPANCIES, DEMO_NOTAMS } from '@/lib/demo-data'
import { WAIVER_STATUS_CONFIG, WAIVER_TYPES, WAIVER_TRANSITIONS } from '@/lib/constants'
import { useInstallation } from '@/lib/installation-context'
import { toast } from 'sonner'
import type { WaiverStatus } from '@/lib/supabase/types'

type ModalType = 'approve' | 'deny' | null

export default function WaiverDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { userRole } = useInstallation()
  const [liveData, setLiveData] = useState<WaiverRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [denialReason, setDenialReason] = useState('')
  const [approveStart, setApproveStart] = useState('')
  const [approveEnd, setApproveEnd] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }

    const data = await fetchWaiver(params.id as string)
    setLiveData(data)
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isManager = !userRole || userRole === 'airfield_manager' || userRole === 'sys_admin'

  const handleStatusChange = async (newStatus: WaiverStatus, extra?: { denial_reason?: string; effective_start?: string; effective_end?: string }) => {
    if (usingDemo) {
      toast.success(`Status updated to ${newStatus} (demo mode)`)
      setActiveModal(null)
      return
    }

    setActionLoading(true)
    const { error } = await updateWaiverStatus(params.id as string, newStatus, extra)
    if (error) {
      toast.error(error)
    } else {
      toast.success(`Waiver ${newStatus}`)
      await loadData()
    }
    setActionLoading(false)
    setActiveModal(null)
  }

  const handleDelete = async () => {
    if (usingDemo) {
      toast.success('Waiver deleted (demo mode)')
      router.push('/waivers')
      return
    }

    if (!confirm('Delete this waiver? This cannot be undone.')) return
    setActionLoading(true)
    const { error } = await deleteWaiver(params.id as string)
    if (error) {
      toast.error(error)
      setActionLoading(false)
    } else {
      toast.success('Waiver deleted')
      router.push('/waivers')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>
          Loading...
        </div>
      </div>
    )
  }

  const demoData = DEMO_WAIVERS.find((x) => x.id === params.id)
  const w = usingDemo ? demoData : liveData

  if (!w) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>
          Waiver not found
        </div>
      </div>
    )
  }

  const statusConf = WAIVER_STATUS_CONFIG[w.status as keyof typeof WAIVER_STATUS_CONFIG]
  const typeInfo = WAIVER_TYPES.find(t => t.value === w.waiver_type)
  const allowedTransitions = WAIVER_TRANSITIONS[w.status] || []

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  }

  // Linked record lookups for demo mode
  const linkedDisc = usingDemo && w.linked_discrepancy_id
    ? DEMO_DISCREPANCIES.find(d => d.id === w.linked_discrepancy_id)
    : null
  const linkedNotam = usingDemo && w.linked_notam_id
    ? DEMO_NOTAMS.find(n => n.id === w.linked_notam_id)
    : null

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
        &larr; Back
      </button>

      {/* Main Card */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{w.display_id}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {statusConf && <Badge label={statusConf.label} color={statusConf.color} />}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {typeInfo && <Badge label={`${typeInfo.emoji} ${typeInfo.label}`} color="#64748B" />}
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{w.title}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: 12 }}>{w.description}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          {([
            ['Location', w.location_text || 'N/A'],
            ['Authority', w.authority_reference || 'N/A'],
            ['Effective Start', formatDate(w.effective_start)],
            ['Effective End', formatDate(w.effective_end)],
            ['Created', formatDateTime(w.created_at)],
            ['Updated', formatDateTime(w.updated_at)],
          ] as const).map(([label, value], i) => (
            <div key={i}>
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Conditions */}
        {w.conditions && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#8B5CF611', border: '1px solid #8B5CF633', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: '#8B5CF6', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Conditions / Limitations</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5 }}>{w.conditions}</div>
          </div>
        )}

        {/* Approval Info */}
        {w.approved_at && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#10B98111', border: '1px solid #10B98133', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Approved</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
              Approved on {formatDateTime(w.approved_at)}
            </div>
          </div>
        )}
      </div>

      {/* Denial Card */}
      {w.status === 'denied' && w.denial_reason && (
        <div className="card" style={{ marginBottom: 8, borderLeft: '3px solid #EF4444' }}>
          <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Denial Reason</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5, marginBottom: 4 }}>{w.denial_reason}</div>
          {w.denied_at && (
            <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Denied on {formatDateTime(w.denied_at)}</div>
          )}
        </div>
      )}

      {/* Linked Records */}
      {(linkedDisc || w.linked_discrepancy_id) && (
        <Link
          href={`/discrepancies/${w.linked_discrepancy_id}`}
          className="card"
          style={{ marginBottom: 8, cursor: 'pointer', borderLeft: '3px solid #FBBF24', display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="section-label">Linked Discrepancy</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FBBF24' }}>
                {linkedDisc ? linkedDisc.display_id : w.linked_discrepancy_id}
              </span>
              {linkedDisc && <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>{linkedDisc.title}</div>}
            </div>
            <Badge label="VIEW &rarr;" color="#22D3EE" />
          </div>
        </Link>
      )}

      {(linkedNotam || w.linked_notam_id) && (
        <Link
          href="/notams"
          className="card"
          style={{ marginBottom: 8, cursor: 'pointer', borderLeft: '3px solid var(--color-purple)', display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="section-label">Linked NOTAM</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-purple)' }}>
                {linkedNotam ? linkedNotam.notam_number : w.linked_notam_id}
              </span>
              {linkedNotam && <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>{linkedNotam.title}</div>}
            </div>
            <Badge label="VIEW &rarr;" color="#22D3EE" />
          </div>
        </Link>
      )}

      {w.linked_obstruction_id && (
        <Link
          href={`/obstructions/${w.linked_obstruction_id}`}
          className="card"
          style={{ marginBottom: 8, cursor: 'pointer', borderLeft: '3px solid #F97316', display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="section-label">Linked Obstruction Eval</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F97316' }}>{w.linked_obstruction_id}</span>
            </div>
            <Badge label="VIEW &rarr;" color="#22D3EE" />
          </div>
        </Link>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        {/* Draft actions */}
        {w.status === 'draft' && (
          <>
            <ActionButton color="#3B82F6" onClick={() => handleStatusChange('submitted')} disabled={actionLoading}>
              Submit for Review
            </ActionButton>
            <ActionButton color="#EF4444" onClick={handleDelete} disabled={actionLoading}>
              Delete Draft
            </ActionButton>
          </>
        )}

        {/* Submitted actions — manager only */}
        {w.status === 'submitted' && isManager && (
          <>
            <ActionButton color="#10B981" onClick={() => setActiveModal('approve')} disabled={actionLoading}>
              Approve
            </ActionButton>
            <ActionButton color="#EF4444" onClick={() => setActiveModal('deny')} disabled={actionLoading}>
              Deny
            </ActionButton>
            <ActionButton color="#9CA3AF" onClick={() => handleStatusChange('draft')} disabled={actionLoading}>
              Send Back to Draft
            </ActionButton>
          </>
        )}

        {/* Approved actions — manager only */}
        {w.status === 'approved' && isManager && allowedTransitions.includes('active') && (
          <ActionButton color="#8B5CF6" onClick={() => handleStatusChange('active')} disabled={actionLoading}>
            Activate Waiver
          </ActionButton>
        )}

        {/* Active actions — manager only */}
        {w.status === 'active' && isManager && allowedTransitions.includes('expired') && (
          <ActionButton color="#F59E0B" onClick={() => handleStatusChange('expired')} disabled={actionLoading}>
            Mark Expired
          </ActionButton>
        )}
      </div>

      {/* Approve Modal */}
      {activeModal === 'approve' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Approve Waiver</div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Effective Start</span>
              <input type="datetime-local" className="input-dark" value={approveStart} onChange={(e) => setApproveStart(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="section-label">Effective End</span>
              <input type="datetime-local" className="input-dark" value={approveEnd} onChange={(e) => setApproveEnd(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setActiveModal(null)}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => handleStatusChange('approved', {
                  effective_start: approveStart ? new Date(approveStart).toISOString() : undefined,
                  effective_end: approveEnd ? new Date(approveEnd).toISOString() : undefined,
                })}
                disabled={actionLoading}
              >
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deny Modal */}
      {activeModal === 'deny' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Deny Waiver</div>
            <div style={{ marginBottom: 16 }}>
              <span className="section-label">Denial Reason</span>
              <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }} placeholder="Provide reason for denial..." value={denialReason} onChange={(e) => setDenialReason(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setActiveModal(null)}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                style={{ padding: 10, borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: actionLoading ? 0.7 : 1 }}
                onClick={() => handleStatusChange('denied', { denial_reason: denialReason })}
                disabled={actionLoading || !denialReason.trim()}
              >
                {actionLoading ? 'Denying...' : 'Deny Waiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
