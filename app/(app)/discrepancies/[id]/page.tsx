'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SeverityBadge, StatusBadge, Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/ui/button'
import { fetchDiscrepancy, fetchDiscrepancyPhotos, uploadDiscrepancyPhoto, type DiscrepancyRow, type PhotoRow } from '@/lib/supabase/discrepancies'
import { createClient } from '@/lib/supabase/client'
import { DEMO_DISCREPANCIES, DEMO_NOTAMS } from '@/lib/demo-data'

import { EditDiscrepancyModal, StatusUpdateModal, WorkOrderModal, PhotoViewerModal } from '@/components/discrepancies/modals'
import { toast } from 'sonner'
import Link from 'next/link'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#FBBF24', low: '#38BDF8',
}

type ModalType = 'edit' | 'status' | 'workorder' | null

export default function DiscrepancyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dbPhotos, setDbPhotos] = useState<PhotoRow[]>([])
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

  const handleSaved = (updated: DiscrepancyRow) => {
    setLiveData(updated)
    toast.success('Discrepancy updated')
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
    : (['resolved', 'closed'].includes(d.status)
      ? 0
      : Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000)))

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

      <div className="card" style={{ border: `1px solid ${SEVERITY_COLORS[d.severity]}33`, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#22D3EE', fontFamily: 'monospace' }}>{d.display_id}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <SeverityBadge severity={d.severity} />
            <StatusBadge status={d.status} />
          </div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{d.title}</div>

        <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.6, marginBottom: 12 }}>{d.description}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
          {([
            ['Location', d.location_text],
            ['Type', d.type.charAt(0).toUpperCase() + d.type.slice(1)],
            ['Shop', d.assigned_shop || 'Unassigned'],
            ['Days Open', daysOpen > 0 ? `${daysOpen}` : 'Resolved'],
            ['Photos', `${d.photo_count}`],
            ['Work Order', d.work_order_number || 'None'],
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
