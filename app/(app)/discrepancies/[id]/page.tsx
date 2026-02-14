'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/ui/button'
import { fetchDiscrepancy, fetchDiscrepancyPhotos, uploadDiscrepancyPhoto, fetchStatusUpdates, type DiscrepancyRow, type PhotoRow, type StatusUpdateRow } from '@/lib/supabase/discrepancies'
import { createClient } from '@/lib/supabase/client'
import { DEMO_DISCREPANCIES, DEMO_NOTAMS } from '@/lib/demo-data'
import { CURRENT_STATUS_OPTIONS, LOCATION_OPTIONS, DISCREPANCY_TYPES } from '@/lib/constants'

import { EditDiscrepancyModal, StatusUpdateModal, WorkOrderModal, PhotoViewerModal } from '@/components/discrepancies/modals'
import { toast } from 'sonner'
import Link from 'next/link'

type ModalType = 'edit' | 'status' | 'workorder' | null

export default function DiscrepancyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dbPhotos, setDbPhotos] = useState<PhotoRow[]>([])
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdateRow[]>([])
  const [liveData, setLiveData] = useState<DiscrepancyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }

    const data = await fetchDiscrepancy(params.id as string)
    setLiveData(data)

    if (data) {
      const photos = await fetchDiscrepancyPhotos(data.id)
      setDbPhotos(photos)
      const updates = await fetchStatusUpdates(data.id)
      setStatusUpdates(updates)
    }

    setLoading(false)
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const [uploading, setUploading] = useState(false)

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !liveData) return

    setUploading(true)
    let uploaded = 0
    for (const file of Array.from(files)) {
      const { error } = await uploadDiscrepancyPhoto(liveData.id, file)
      if (!error) uploaded++
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} photo(s) uploaded`)
      // Refresh photos and discrepancy data from DB
      const freshPhotos = await fetchDiscrepancyPhotos(liveData.id)
      setDbPhotos(freshPhotos)
      const freshDisc = await fetchDiscrepancy(liveData.id)
      if (freshDisc) setLiveData(freshDisc)
    }
    if (uploaded < files.length) {
      toast.error(`${files.length - uploaded} photo(s) failed to upload`)
    }

    setUploading(false)
    e.target.value = ''
  }

  const handleSaved = async (_updated: DiscrepancyRow) => {
    toast.success('Discrepancy updated')
    // Full refresh — reload discrepancy, photos, and notes history
    await loadData()
  }

  if (loading) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          Loading...
        </div>
      </div>
    )
  }

  // Resolve data source
  const demoData = DEMO_DISCREPANCIES.find((x) => x.id === params.id)
  const d = usingDemo ? demoData : liveData

  if (!d) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          Discrepancy not found
        </div>
      </div>
    )
  }

  // For demo data, resolve linked NOTAM from demo set
  const linkedNotam = usingDemo && 'linked_notam_id' in d && d.linked_notam_id
    ? DEMO_NOTAMS.find((n) => n.id === d.linked_notam_id)
    : null

  const daysOpen = usingDemo && 'days_open' in d
    ? (d as typeof DEMO_DISCREPANCIES[0]).days_open
    : Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000))

  // Build photo gallery from DB-stored photos
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const allPhotos: { url: string; name: string }[] = dbPhotos.map((p) => ({
    url: p.storage_path.startsWith('data:')
      ? p.storage_path
      : supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/${p.storage_path}`
        : p.storage_path,
    name: p.file_name,
  }))

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
        ← Back
      </button>

      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#22D3EE', fontFamily: 'monospace' }}>{d.work_order_number || 'Pending'}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <StatusBadge status={d.status} />
          </div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{d.title}</div>

        <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.6, marginBottom: 12 }}>{d.description}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
          {([
            ['Location', (() => { const loc = LOCATION_OPTIONS.find(l => l.value === d.location_text); return loc ? `${loc.emoji} ${loc.label}` : d.location_text })()],
            ['Type', (() => { return d.type.split(', ').map(v => { const t = DISCREPANCY_TYPES.find(dt => dt.value === v); return t ? `${t.emoji} ${t.label}` : v }).join(', ') })()],
            ['Current Status', (() => { const cs = (d as typeof d & { current_status?: string }).current_status; return CURRENT_STATUS_OPTIONS.find(o => o.value === cs)?.label || cs || 'N/A' })()],
            ['Work Order Currently Assigned to', d.assigned_shop || 'Unassigned'],
            ['NOTAM', (d as typeof d & { notam_reference?: string }).notam_reference || 'None'],
            ['Days Open', `${daysOpen}`],
            ['Photos', `${d.photo_count}`],
          ] as const).map(([label, value], i) => (
            <div key={i}>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {'resolution_notes' in d && d.resolution_notes && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#22C55E11', border: '1px solid #22C55E33', borderRadius: 8 }}>
            <div style={{ fontSize: 9, color: '#22C55E', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Resolution Notes</div>
            <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.5 }}>{d.resolution_notes as string}</div>
          </div>
        )}

        {/* ── Notes History ── */}
        {statusUpdates.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid #1E293B', paddingTop: 12 }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Notes History</div>
            {statusUpdates.map((update) => (
              <div key={update.id} style={{ borderLeft: '2px solid #334155', paddingLeft: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: '#38BDF8' }}>{update.user_name || 'Unknown'}</span>
                  {' — '}
                  {new Date(update.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' '}
                  {new Date(update.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                {update.old_status && (
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>
                    Status: {update.old_status} → {update.new_status}
                  </div>
                )}
                {update.notes && (
                  <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.4 }}>{update.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo thumbnails — tap to view full screen */}
      {allPhotos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {allPhotos.map((p, i) => (
            <div
              key={i}
              style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid #38BDF833', cursor: 'pointer' }}
              onClick={() => setViewerIndex(i)}
            >
              <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <ActionButton color="#38BDF8" onClick={() => setActiveModal('edit')}>✏️ Edit</ActionButton>
        <ActionButton color="#38BDF8" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? '⏳ Uploading...' : `📸 Photo${allPhotos.length > 0 ? ` (${allPhotos.length})` : ''}`}
        </ActionButton>
        <ActionButton color="#FBBF24" onClick={() => setActiveModal('status')}>🔄 Status</ActionButton>
        <ActionButton color="#34D399" onClick={() => setActiveModal('workorder')}>📋 Work Order</ActionButton>
      </div>

      {linkedNotam && (
        <Link
          href={`/notams/${linkedNotam.id}`}
          className="card"
          style={{ marginTop: 8, cursor: 'pointer', borderLeft: '3px solid #A78BFA', display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="section-label">Linked NOTAM</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>{linkedNotam.notam_number}</span>
            </div>
            <Badge label="VIEW →" color="#22D3EE" />
          </div>
        </Link>
      )}

      {/* ── Modals ── */}
      {activeModal === 'edit' && liveData && (
        <EditDiscrepancyModal discrepancy={liveData} onClose={() => setActiveModal(null)} onSaved={handleSaved} />
      )}
      {activeModal === 'status' && liveData && (
        <StatusUpdateModal discrepancy={liveData} onClose={() => setActiveModal(null)} onSaved={handleSaved} onDeleted={() => router.push('/discrepancies')} />
      )}
      {activeModal === 'workorder' && liveData && (
        <WorkOrderModal discrepancy={liveData} onClose={() => setActiveModal(null)} onSaved={handleSaved} />
      )}
      {viewerIndex !== null && allPhotos.length > 0 && (
        <PhotoViewerModal photos={allPhotos} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </div>
  )
}
