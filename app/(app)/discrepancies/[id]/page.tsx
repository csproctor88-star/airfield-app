'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/ui/button'
import { fetchDiscrepancy, fetchDiscrepancyPhotos, uploadDiscrepancyPhoto, deleteDiscrepancyPhoto, fetchStatusUpdates, deleteDiscrepancy, type DiscrepancyRow, type PhotoRow, type StatusUpdateRow } from '@/lib/supabase/discrepancies'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { DEMO_DISCREPANCIES, DEMO_NOTAMS } from '@/lib/demo-data'
import { CURRENT_STATUS_OPTIONS, LOCATION_OPTIONS, DISCREPANCY_TYPES } from '@/lib/constants'

import { fetchInfrastructureFeature, buildFeatureDisplayName, formatFeatureType } from '@/lib/supabase/infrastructure-features'
import type { InfrastructureFeature } from '@/lib/supabase/types'
import { EditDiscrepancyModal, StatusUpdateModal, WorkOrderModal, PhotoViewerModal } from '@/components/discrepancies/modals'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { fetchMapImageDataUrl, formatZuluDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'

type ModalType = 'edit' | 'status' | 'workorder' | null

export default function DiscrepancyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { installationId, userRole, defaultPdfEmail, currentInstallation } = useInstallation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dbPhotos, setDbPhotos] = useState<PhotoRow[]>([])
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdateRow[]>([])
  const [liveData, setLiveData] = useState<DiscrepancyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)
  const [linkedFeature, setLinkedFeature] = useState<InfrastructureFeature | null>(null)
  const [linkedSystemInfo, setLinkedSystemInfo] = useState<{ systemName: string; componentLabel: string } | null>(null)
  const isAdmin = userRole === 'base_admin' || userRole === 'sys_admin'

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

      // Fetch linked infrastructure feature
      if (data.infrastructure_feature_id) {
        const feat = await fetchInfrastructureFeature(data.infrastructure_feature_id)
        setLinkedFeature(feat)
        if (feat?.system_component_id) {
          const supabaseClient = createClient()
          if (supabaseClient) {
            const { data: comp } = await supabaseClient
              .from('lighting_system_components')
              .select('label, system_id, lighting_systems:system_id(name)')
              .eq('id', feat.system_component_id)
              .single() as { data: any }
            if (comp) {
              const sys = comp.lighting_systems as { name?: string } | null
              setLinkedSystemInfo({
                systemName: sys?.name || '',
                componentLabel: comp.label || '',
              })
            }
          }
        }
      }
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
      const { error } = await uploadDiscrepancyPhoto(liveData.id, file, installationId)
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

  const handleDeletePhoto = async (photo: PhotoRow) => {
    if (!liveData) return
    if (!confirm('Delete this photo?')) return
    setDeletingPhotoId(photo.id)
    const { error } = await deleteDiscrepancyPhoto(photo.id, liveData.id, photo.storage_path)
    if (error) {
      toast.error('Failed to delete photo')
    } else {
      toast.success('Photo deleted')
      const freshPhotos = await fetchDiscrepancyPhotos(liveData.id)
      setDbPhotos(freshPhotos)
      const freshDisc = await fetchDiscrepancy(liveData.id)
      if (freshDisc) setLiveData(freshDisc)
    }
    setDeletingPhotoId(null)
  }

  const handleSaved = async (_updated: DiscrepancyRow) => {
    toast.success('Discrepancy updated')
    // Full refresh — reload discrepancy, photos, and notes history
    await loadData()
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>
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
      <div className="page-container">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>
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
        ? `${supabaseUrl}/storage/v1/object/public/photos/${p.storage_path}`
        : p.storage_path,
    name: p.file_name,
  }))

  // Generate static map image URL from stored coordinates
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const lat = 'latitude' in d ? (d as DiscrepancyRow).latitude : null
  const lng = 'longitude' in d ? (d as DiscrepancyRow).longitude : null
  const staticMapUrl = lat != null && lng != null && mapboxToken && mapboxToken !== 'your-mapbox-token-here'
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+ef4444(${lng},${lat})/${lng},${lat},15,0/600x300@2x?access_token=${mapboxToken}&logo=false&attribution=false`
    : null

  const buildPdf = async () => {
    const photoDataUrls: string[] = []
    for (const p of allPhotos) {
      if (p.url.startsWith('data:')) {
        photoDataUrls.push(p.url)
      } else {
        try {
          const resp = await fetch(p.url)
          if (resp.ok) {
            const blob = await resp.blob()
            const reader = new FileReader()
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            photoDataUrls.push(dataUrl)
          }
        } catch { /* skip */ }
      }
    }
    let mapDataUrl: string | null = null
    if (lat != null && lng != null) {
      mapDataUrl = await fetchMapImageDataUrl(lat, lng)
    }
    const { generateDiscrepancyPdf } = await import('@/lib/discrepancy-pdf')
    return generateDiscrepancyPdf({
      discrepancy: d,
      photoDataUrls,
      mapDataUrl,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
    })
  }

  return (
    <div className="page-container">
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
        ← Back
      </button>

      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{d.work_order_number || 'Pending'}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <StatusBadge status={d.status} />
          </div>
        </div>

        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 8 }}>{d.title}</div>

        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: 12 }}>{d.description}</div>

        <div className="detail-grid-2" style={{ fontSize: 'var(--fs-base)' }}>
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
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {'resolution_notes' in d && d.resolution_notes && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#22C55E11', border: '1px solid #22C55E33', borderRadius: 8 }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: '#22C55E', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Resolution Notes</div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>{d.resolution_notes as string}</div>
          </div>
        )}

        {/* ── Notes History ── */}
        {statusUpdates.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--color-bg-elevated)', paddingTop: 12 }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Notes History</div>
            {statusUpdates.map((update) => (
              <div key={update.id} style={{ borderLeft: '2px solid var(--color-text-4)', paddingLeft: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{update.user_rank ? `${update.user_rank} ` : ''}{update.user_name || 'Unknown'}</span>
                  {' — '}
                  {formatZuluDateTime(new Date(update.created_at))}
                </div>
                {update.old_status && (
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 2 }}>
                    Status: {update.old_status} → {update.new_status}
                  </div>
                )}
                {update.notes && (
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{update.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pinned location map */}
      {staticMapUrl && (
        <div className="card" style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px 4px', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Pinned Location
          </div>
          <img
            src={staticMapUrl}
            alt="Discrepancy location on map"
            style={{ width: '100%', display: 'block', borderRadius: '0 0 10px 10px' }}
          />
          <div style={{ padding: '4px 12px 8px', fontSize: 'var(--fs-sm)', color: '#34D399', fontFamily: 'monospace', fontWeight: 600 }}>
            {lat!.toFixed(5)}, {lng!.toFixed(5)}
          </div>
        </div>
      )}

      {/* Linked Visual NAVAID */}
      {linkedFeature && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Linked Visual NAVAID
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {buildFeatureDisplayName(linkedFeature, linkedSystemInfo?.systemName, linkedSystemInfo?.componentLabel)}
            </span>
            <span style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              background: linkedFeature.status === 'inoperative' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              color: linkedFeature.status === 'inoperative' ? '#EF4444' : '#22C55E',
            }}>
              {linkedFeature.status === 'inoperative' ? 'INOP' : 'OP'}
            </span>
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 2 }}>
            Type: {formatFeatureType(linkedFeature.feature_type)}
          </div>
          {linkedSystemInfo && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 2 }}>
              System: {linkedSystemInfo.systemName}
              {linkedSystemInfo.componentLabel && linkedSystemInfo.componentLabel !== linkedSystemInfo.systemName
                ? ` \u2192 ${linkedSystemInfo.componentLabel}`
                : ''}
            </div>
          )}
          <Link
            href="/infrastructure"
            style={{ display: 'inline-block', marginTop: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', fontWeight: 600, textDecoration: 'none' }}
          >
            View on Infrastructure Map &rarr;
          </Link>
        </div>
      )}

      {/* Photo thumbnails — tap to view full screen, X to delete */}
      {allPhotos.length > 0 && (
        <div className="photo-grid" style={{ marginBottom: 8 }}>
          {allPhotos.map((p, i) => (
            <div
              key={i}
              style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-active)', cursor: 'pointer' }}
              onClick={() => setViewerIndex(i)}
            >
              <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {dbPhotos[i] && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePhoto(dbPhotos[i]) }}
                  disabled={deletingPhotoId === dbPhotos[i].id}
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'rgba(239,68,68,0.85)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    lineHeight: '1',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    opacity: deletingPhotoId === dbPhotos[i].id ? 0.5 : 1,
                  }}
                  title="Delete photo"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
        <ActionButton color="#38BDF8" onClick={() => setActiveModal('edit')}>✏️ Edit</ActionButton>
        <div>
          <PhotoPickerButton
            onUpload={() => fileInputRef.current?.click()}
            disabled={uploading}
            label={uploading ? 'Uploading...' : allPhotos.length > 0 ? `Add Photo (${allPhotos.length})` : undefined}
          />
        </div>
        <ActionButton color="#FBBF24" onClick={() => setActiveModal('status')}>🔄 Status</ActionButton>
        <ActionButton color="#34D399" onClick={() => setActiveModal('workorder')}>📋 Work Order</ActionButton>
        <ActionButton
          color="#A78BFA"
          onClick={async () => {
            setGeneratingPdf(true)
            try {
              const { doc, filename } = await buildPdf()
              doc.save(filename)
              toast.success('PDF exported')
            } catch (e) {
              console.error(e)
              toast.error('PDF export failed')
            }
            setGeneratingPdf(false)
          }}
        >
          {generatingPdf ? 'Generating...' : '📄 Export PDF'}
        </ActionButton>
        <ActionButton
          color="#A78BFA"
          onClick={async () => {
            setGeneratingPdf(true)
            try {
              const result = await buildPdf()
              setEmailPdfData(result)
              setEmailModalOpen(true)
            } catch (e) {
              console.error(e)
              toast.error('PDF generation failed')
            }
            setGeneratingPdf(false)
          }}
        >
          {generatingPdf ? 'Preparing...' : '✉️ Email PDF'}
        </ActionButton>
      </div>

      {/* Admin: Delete Discrepancy */}
      {isAdmin && !usingDemo && (
        <div style={{ marginBottom: 8 }}>
          <ActionButton
            color="#EF4444"
            onClick={async () => {
              if (!confirm('Permanently delete this discrepancy and all associated photos, status updates? This cannot be undone.')) return
              setActionLoading(true)
              const { error } = await deleteDiscrepancy(d.id)
              if (error) {
                toast.error(error)
                setActionLoading(false)
              } else {
                toast.success('Discrepancy deleted')
                router.push('/discrepancies')
              }
            }}
          >
            {actionLoading ? 'Deleting...' : '🗑️ Delete Discrepancy'}
          </ActionButton>
        </div>
      )}

      {linkedNotam && (
        <Link
          href={`/notams/${linkedNotam.id}`}
          className="card"
          style={{ marginTop: 8, cursor: 'pointer', borderLeft: '3px solid var(--color-purple)', display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="section-label">Linked NOTAM</span>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-purple)' }}>{linkedNotam.notam_number}</span>
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
      {emailModalOpen && emailPdfData && (
        <EmailPdfModal
          open={emailModalOpen}
          defaultEmail={defaultPdfEmail || ''}
          onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
          onSend={async (email) => {
            setSendingEmail(true)
            const { success, error } = await sendPdfViaEmail(
              emailPdfData.doc,
              emailPdfData.filename,
              email,
              `Discrepancy Report — ${d.work_order_number || d.title}`,
            )
            setSendingEmail(false)
            if (success) {
              toast.success('Email sent')
              setEmailModalOpen(false)
              setEmailPdfData(null)
            } else {
              toast.error(error || 'Failed to send email')
            }
          }}
          sending={sendingEmail}
        />
      )}
    </div>
  )
}
