'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/ui/button'
import { fetchDiscrepancy, fetchDiscrepancyPhotos, uploadDiscrepancyPhoto, deleteDiscrepancyPhoto, fetchStatusUpdates, deleteDiscrepancy, type DiscrepancyRow, type PhotoRow, type StatusUpdateRow } from '@/lib/supabase/discrepancies'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { DEMO_DISCREPANCIES, DEMO_NOTAMS } from '@/lib/demo-data'
import { CURRENT_STATUS_OPTIONS, LOCATION_OPTIONS, DISCREPANCY_TYPES, STATUS_CONFIG } from '@/lib/constants'

// Render a status_updates.notes value as plain language. Handles two
// shapes: the new "Status changed to: <Label>" prefix written by
// updateDiscrepancy / ces_update_discrepancy, and the legacy
// "CURRENT_STATUS: <enum>" rows already in the DB from before that fix.
function formatStatusUpdateNotes(notes: string | null | undefined): string {
  if (!notes) return ''
  const legacy = notes.match(/^CURRENT_STATUS:\s*(\S+)/)
  if (legacy) {
    const match = CURRENT_STATUS_OPTIONS.find(o => o.value === legacy[1])
    return `Status changed to: ${match ? match.label : legacy[1]}`
  }
  return notes
}

// Capitalize a discrepancy `status` enum (open / completed / cancelled)
// for display in the Notes History "Status: x → y" line.
function statusLabel(value: string | null | undefined): string {
  if (!value) return ''
  return STATUS_CONFIG[value as keyof typeof STATUS_CONFIG]?.label ?? value
}

import { fetchInfrastructureFeature, fetchSystemFeaturesForFeature, buildFeatureDisplayName, formatFeatureType } from '@/lib/supabase/infrastructure-features'
import type { InfrastructureFeature } from '@/lib/supabase/types'
import { EditDiscrepancyModal, StatusUpdateModal, PhotoViewerModal } from '@/components/discrepancies/modals'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { fetchMapImageDataUrl, fetchSystemMapImageDataUrl, formatZuluDateTime, compressImageForPdf } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import { DetailGrid } from '@/components/ui/detail-grid'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Pencil, Camera, FileUp, RefreshCw, FileText, Mail, Trash2,
  ArrowLeft, MapPin,
} from 'lucide-react'

// Centralized color map for the `current_status` enum. Used by the
// detail header pill and any other surface that renders the value.
// Pattern: rgba(_,0.10) bg + rgba(_,0.30) border + base color text.
const CURRENT_STATUS_COLORS: Record<string, { color: string; rgb: string }> = {
  submitted_to_afm:                    { color: 'var(--color-accent)',    rgb: '34,211,238'  },
  submitted_to_ces:                    { color: 'var(--color-accent)',    rgb: '34,211,238'  },
  awaiting_action_by_ces:              { color: 'var(--color-warning)',   rgb: '251,191,36'  },
  waiting_for_project:                 { color: 'var(--color-orange)',    rgb: '249,115,22'  },
  work_completed_awaiting_verification:{ color: 'var(--color-success)',   rgb: '52,211,153'  },
}

type ModalType = 'edit' | 'status' | null

export default function DiscrepancyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { installationId, defaultPdfEmail, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

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
  const [systemMapUrl, setSystemMapUrl] = useState<string | null>(null)
  const canDeleteDiscrepancy = has(PERM.DISCREPANCIES_DELETE)

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

        // Fetch system map image (all features in the same component, color-coded)
        fetchSystemFeaturesForFeature(data.infrastructure_feature_id).then(async (systemFeatures) => {
          const mapFeatures = systemFeatures
            .filter(f => f.latitude != null && f.longitude != null)
            .map(f => ({ latitude: f.latitude, longitude: f.longitude, status: f.status, id: f.id }))
          // If component has features, show them with the linked feature highlighted
          if (mapFeatures.length > 0) {
            const mapUrl = await fetchSystemMapImageDataUrl(mapFeatures, data.infrastructure_feature_id!)
            if (mapUrl) {
              setSystemMapUrl(mapUrl)
              return
            }
          }
          // Fallback: show the single linked feature as a red dot (not a pin marker)
          if (feat && feat.latitude != null && feat.longitude != null) {
            const singleFeature = [{ latitude: feat.latitude, longitude: feat.longitude, status: 'inoperative', id: feat.id }]
            const mapUrl = await fetchSystemMapImageDataUrl(singleFeature, feat.id)
            if (mapUrl) setSystemMapUrl(mapUrl)
          }
        })
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
    return <LoadingState />
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
        <EmptyState message="Discrepancy not found" />
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
      let raw: string | null = null
      if (p.url.startsWith('data:')) {
        raw = p.url
      } else {
        try {
          const resp = await fetch(p.url)
          if (resp.ok) {
            const blob = await resp.blob()
            const reader = new FileReader()
            raw = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
          }
        } catch { /* skip */ }
      }
      if (raw) {
        photoDataUrls.push(await compressImageForPdf(raw))
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
      systemMapDataUrl: systemMapUrl,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
      notesHistory: statusUpdates.map((u) => ({
        created_at: u.created_at,
        user_name: u.user_name,
        user_rank: u.user_rank,
        old_status: u.old_status ? statusLabel(u.old_status) : u.old_status,
        new_status: u.new_status ? statusLabel(u.new_status) : u.new_status,
        notes: formatStatusUpdateNotes(u.notes),
      })),
    })
  }

  return (
    <div className="page-container">
      <button onClick={() => router.back()} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', color: 'var(--color-cyan)',
        fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer',
        padding: 0, marginBottom: 12, fontFamily: 'inherit',
      }}>
        <ArrowLeft size={14} strokeWidth={2.25} /> Back
      </button>

      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{d.work_order_number || 'Pending'}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* current_status pill — promoted from plain text in the
                metadata grid so the workflow stage reads at a glance
                next to the lifecycle status. */}
            {(() => {
              const cs = (d as typeof d & { current_status?: string }).current_status
              if (!cs) return null
              const meta = CURRENT_STATUS_COLORS[cs] || { color: 'var(--color-text-3)', rgb: '148,163,184' }
              const label = CURRENT_STATUS_OPTIONS.find(o => o.value === cs)?.label || cs
              return (
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                  fontSize: 'var(--fs-xs)', fontWeight: 700,
                  background: `rgba(${meta.rgb},0.10)`,
                  color: meta.color,
                  border: `1px solid rgba(${meta.rgb},0.30)`,
                  textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap',
                }}>{label}</span>
              )
            })()}
            <StatusBadge status={d.status} />
          </div>
        </div>

        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 8 }}>{d.title}</div>

        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: 12 }}>{d.description}</div>

        {/* Two-col row inside the card: detail items (left) sit
            alongside the map + photo thumbnails (right). Stacks to
            one column on narrow viewports via the responsive minmax.
            Detail items render inline with a stronger label/value
            tier than the shared DetailGrid: tiny dim uppercase
            labels, larger weight-600 text-1 values, generous vertical
            gap between pairs so the eye lands on each value. */}
        {(() => {
          const csValue = (d as typeof d & { current_status?: string }).current_status
          const csLabel = csValue ? (CURRENT_STATUS_OPTIONS.find(o => o.value === csValue)?.label || csValue) : '—'
          const createdBy = (d as typeof d & { created_by_name?: string | null; submitter_name?: string | null }).submitter_name
            || (d as typeof d & { created_by_name?: string | null }).created_by_name || null
          const detailItems: { label: string; value: React.ReactNode }[] = [
            { label: 'Location', value: (() => { const loc = LOCATION_OPTIONS.find(l => l.value === d.location_text); return loc ? `${loc.emoji} ${loc.label}` : d.location_text })() },
            { label: 'Type', value: (() => {
              const parts = d.type.split(', ')
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {parts.map((v, i) => {
                    const t = DISCREPANCY_TYPES.find(dt => dt.value === v)
                    if (!t) return <span key={`${v}-${i}`}>{v}{i < parts.length - 1 ? ',' : ''}</span>
                    const Icon = t.icon
                    return (
                      <span key={`${v}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon size={14} strokeWidth={2.25} />
                        {t.label}{i < parts.length - 1 ? ',' : ''}
                      </span>
                    )
                  })}
                </span>
              )
            })() },
            { label: 'Current Status', value: csLabel },
            { label: 'Facility #', value: (d as typeof d & { facility_number?: string | null }).facility_number || '—' },
            { label: 'Work Order Assigned to', value: d.assigned_shop || 'Unassigned' },
            { label: 'NOTAM', value: (d as typeof d & { notam_reference?: string }).notam_reference || 'None' },
            { label: 'Days Open', value: `${daysOpen}` },
            { label: 'ECD', value: (() => {
              const ecd = (d as typeof d & { estimated_completion_date?: string | null }).estimated_completion_date
              if (!ecd) return '—'
              const dt = new Date(ecd)
              return isNaN(dt.getTime()) ? '—' : dt.toISOString().slice(0, 10)
            })() },
            { label: 'Project #', value: (d as typeof d & { project_number?: string | null }).project_number || '—' },
            { label: 'Estimated Cost', value: (d as typeof d & { estimated_cost?: string | null }).estimated_cost || '—' },
            { label: 'Submitted', value: formatZuluDateTime(new Date(d.created_at)) },
            ...(createdBy ? [{ label: 'Submitted By', value: createdBy }] : []),
            { label: 'Photos', value: `${d.photo_count}` },
          ]
          const showSystemMap = Boolean(systemMapUrl)
          const showPinnedMap = Boolean(staticMapUrl) && !showSystemMap
          const hasMap = showSystemMap || showPinnedMap
          const hasRightContent = hasMap || allPhotos.length > 0

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: hasRightContent
                ? 'repeat(auto-fit, minmax(260px, 1fr))'
                : '1fr',
              gap: 16, alignItems: 'stretch',
            }}>
              {/* Detail items — fixed 2-column grid that stretches to
                  match the right column's height (map + photos). Each
                  cell is its own bordered tile; labels stay on a
                  single line; tile content centers vertically so
                  label/value pairs read balanced when rows are
                  stretched. */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gridAutoRows: '1fr',
                gap: 8,
                height: '100%',
              }}>
                {detailItems.map((item, i) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-inset)',
                    borderLeft: '2px solid rgba(56,189,248,0.35)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    minHeight: 0,
                  }}>
                    <div style={{
                      fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)',
                      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{item.label}</div>
                    <div style={{
                      fontSize: 'var(--fs-md)', fontWeight: 500, color: 'var(--color-text-1)',
                      lineHeight: 1.3,
                    }}>
                      {item.value ?? 'N/A'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right column — map + photo thumbnails. The map is
                  whichever is contextual (system overview if NAVAID
                  linked, otherwise pinned location). Photos stack
                  beneath. */}
              {hasRightContent && (
                <div>
                  {showSystemMap && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ padding: '8px 12px 4px', fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        System Overview
                      </div>
                      <img src={systemMapUrl!} alt="NAVAID system overview" style={{ width: '100%', aspectRatio: '4 / 3', maxHeight: 480, objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 10, fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-green)', display: 'inline-block' }} />
                          Operational
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-red)', display: 'inline-block' }} />
                          Inoperative
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-red)', display: 'inline-block', border: '2px solid #fff' }} />
                          This
                        </span>
                      </div>
                    </div>
                  )}
                  {showPinnedMap && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ padding: '8px 12px 4px', fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Pinned Location
                      </div>
                      <img src={staticMapUrl!} alt="Discrepancy location on map" style={{ width: '100%', aspectRatio: '4 / 3', maxHeight: 480, objectFit: 'cover', display: 'block', borderRadius: '0 0 10px 10px' }} />
                      <div style={{ padding: '4px 12px 8px', fontSize: 'var(--fs-xs)', color: 'var(--color-green)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {lat!.toFixed(5)}, {lng!.toFixed(5)}
                      </div>
                    </div>
                  )}
                  {allPhotos.length > 0 && (
                    <div className="photo-grid">
                      {allPhotos.map((p, i) => (
                        <div
                          key={i}
                          style={{ position: 'relative', width: 64, height: 64, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-active)', cursor: 'pointer' }}
                          onClick={() => setViewerIndex(i)}
                        >
                          <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {dbPhotos[i] && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeletePhoto(dbPhotos[i]) }}
                              disabled={deletingPhotoId === dbPhotos[i].id}
                              style={{
                                position: 'absolute', top: 2, right: 2,
                                width: 18, height: 18, borderRadius: '50%',
                                background: 'rgba(239,68,68,0.85)', color: '#fff',
                                border: 'none', fontSize: '11px', fontWeight: 700, lineHeight: '1',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0,
                                opacity: deletingPhotoId === dbPhotos[i].id ? 0.5 : 1,
                              }}
                              title="Delete photo"
                            >×</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {(() => {
          const rcm = (d as typeof d & { risk_control_measure?: string | null }).risk_control_measure
          if (!rcm) return null
          return (
            <div style={{ marginTop: 12, padding: '8px 10px', background: 'color-mix(in srgb, var(--color-amber) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-amber) 20%, transparent)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-amber)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Risk Control Measure</div>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>{rcm}</div>
            </div>
          )
        })()}

        {'resolution_notes' in d && d.resolution_notes && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: 'color-mix(in srgb, var(--color-green) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-green) 20%, transparent)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-green)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Resolution Notes</div>
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
                    Status: {statusLabel(update.old_status)} → {statusLabel(update.new_status)}
                  </div>
                )}
                {update.notes && (
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{formatStatusUpdateNotes(update.notes)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pinned location map moved into the actions/map/photos
          two-col cluster below. */}

      {/* Linked Visual NAVAID — text-only context card */}
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
              borderRadius: 'var(--radius-xs)',
              background: linkedFeature.status === 'inoperative' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              color: linkedFeature.status === 'inoperative' ? 'var(--color-red)' : 'var(--color-green)',
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

      {/* System overview map + photo thumbnails moved into the
          actions/map/photos two-col cluster below. */}

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: 'none' }} />
      {/* ===== Horizontal action toolbar =====
          Buttons grouped by intent so the toolbar reads as four
          related clusters rather than seven peer-level actions:
            - edit: Update + Status
            - media: Capture + Upload
            - output: Export PDF + Email PDF
            - destructive: Delete (right-aligned via marginLeft auto)
          Each group is a flex sub-row at gap 6; outer container at
          gap 14 puts visible breathing room between groups. When
          wrap kicks in on narrow viewports, each group wraps as a
          unit so related actions stay together. Color tokens are
          CSS vars (was raw hex); ActionButton's color-mix recipe
          handles both forms. */}
      {(() => {
        const compactStyle: React.CSSProperties = {
          padding: '6px 12px', minHeight: 32,
          fontSize: 'var(--fs-xs)', fontWeight: 700,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }
        const groupStyle: React.CSSProperties = {
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
        }
        // Vertical separator between intent groups so the four-cluster
        // grouping reads strongly even on wide viewports. The earlier
        // 14px columnGap was too subtle to differentiate from the in-
        // group 6px gap; an actual divider line makes the structure
        // explicit. Hidden when wrapped (no-op visually because gap
        // already separates rows) is acceptable.
        const Separator = () => (
          <div aria-hidden="true" style={{
            width: 1, alignSelf: 'stretch',
            minHeight: 24, marginInline: 4,
            background: 'var(--color-border)',
          }} />
        )

        return (
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            columnGap: 6, rowGap: 8,
            marginBottom: 8,
          }}>
            <div style={groupStyle}>
              <ActionButton color="var(--color-cyan)" onClick={() => setActiveModal('edit')} style={compactStyle}>
                <Pencil size={12} strokeWidth={2.25} />Update
              </ActionButton>
              <ActionButton color="var(--color-warning)" onClick={() => setActiveModal('status')} style={compactStyle}>
                <RefreshCw size={12} strokeWidth={2.25} />Status
              </ActionButton>
            </div>
            <Separator />
            <div style={groupStyle}>
              <ActionButton color="var(--color-accent-secondary)" onClick={() => cameraInputRef.current?.click()} disabled={uploading} style={compactStyle}>
                <Camera size={12} strokeWidth={2.25} />{uploading ? '...' : 'Capture'}
              </ActionButton>
              <ActionButton color="var(--color-cyan)" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={compactStyle}>
                <FileUp size={12} strokeWidth={2.25} />{uploading ? '...' : `Upload${allPhotos.length > 0 ? ` (${allPhotos.length})` : ''}`}
              </ActionButton>
            </div>
            <Separator />
            <div style={groupStyle}>
              <ActionButton
                color="var(--color-purple)"
                style={compactStyle}
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
                <FileText size={12} strokeWidth={2.25} />{generatingPdf ? '...' : 'Export PDF'}
              </ActionButton>
              <ActionButton
                color="var(--color-purple)"
                style={compactStyle}
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
                <Mail size={12} strokeWidth={2.25} />{generatingPdf ? '...' : 'Email PDF'}
              </ActionButton>
            </div>
            {canDeleteDiscrepancy && !usingDemo && (
              <div style={{ ...groupStyle, marginLeft: 'auto' }}>
                <ActionButton
                  color="var(--color-danger)"
                  style={compactStyle}
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
                  <Trash2 size={12} strokeWidth={2.25} />{actionLoading ? 'Deleting...' : 'Delete'}
                </ActionButton>
              </div>
            )}
          </div>
        )
      })()}

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
