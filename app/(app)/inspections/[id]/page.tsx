'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DEMO_INSPECTIONS } from '@/lib/demo-data'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { fetchInspection, fetchDailyGroup, fetchInspectionPhotos, deleteInspection, updateInspectionNotes, type InspectionRow, type InspectionPhotoRow } from '@/lib/supabase/inspections'
import type { InspectionItem } from '@/lib/supabase/types'
import { useInstallation } from '@/lib/installation-context'
import { ActionButton } from '@/components/ui/button'
import type { PdfBaseInfo, PdfPhotoMap, PdfGeneralPhotos } from '@/lib/pdf-export'
import { PhotoViewerModal } from '@/components/discrepancies/modals'

export default function InspectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { currentInstallation, userRole } = useInstallation()
  const isAdmin = userRole === 'base_admin' || userRole === 'sys_admin'
  const [inspections, setInspections] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesText, setNotesText] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ airfield: false, lighting: false })
  const [showFailedItems, setShowFailedItems] = useState(false)

  // Photo state
  const [photosByItem, setPhotosByItem] = useState<Record<string, InspectionPhotoRow[]>>({})
  const [generalPhotos, setGeneralPhotos] = useState<InspectionPhotoRow[]>([])
  const [viewerPhotos, setViewerPhotos] = useState<{ url: string; name: string }[] | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)

  const resolvePhotoUrl = (photo: InspectionPhotoRow): string => {
    if (photo.storage_path.startsWith('data:')) return photo.storage_path
    const supabase = createClient()
    if (!supabase) return photo.storage_path
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = (supabase as any).storage.from('photos').getPublicUrl(photo.storage_path)
    return data?.publicUrl || photo.storage_path
  }

  const openPhotoViewer = (photos: InspectionPhotoRow[], index: number) => {
    setViewerPhotos(photos.map((p, i) => ({ url: resolvePhotoUrl(p), name: p.file_name || `Photo ${i + 1}` })))
    setViewerIndex(index)
  }

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }
    const data = await fetchInspection(params.id as string)
    if (!data) {
      setLoading(false)
      return
    }
    let allInsps: InspectionRow[]
    if (data.daily_group_id) {
      const group = await fetchDailyGroup(data.daily_group_id)
      allInsps = group.length > 0 ? group : [data]
    } else {
      allInsps = [data]
    }
    setInspections(allInsps)

    // Fetch photos for all inspections in the group
    const byItem: Record<string, InspectionPhotoRow[]> = {}
    const general: InspectionPhotoRow[] = []
    for (const insp of allInsps) {
      const photos = await fetchInspectionPhotos(insp.id)
      for (const photo of photos) {
        if (photo.inspection_item_id) {
          if (!byItem[photo.inspection_item_id]) byItem[photo.inspection_item_id] = []
          byItem[photo.inspection_item_id].push(photo)
        } else {
          general.push(photo)
        }
      }
    }
    setPhotosByItem(byItem)
    setGeneralPhotos(general)
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const demoInspections = useMemo(() => {
    if (!usingDemo) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = DEMO_INSPECTIONS.find((x) => x.id === params.id) as any
    if (!found) return []
    if (found.daily_group_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const group = DEMO_INSPECTIONS.filter((x) => x.daily_group_id === found.daily_group_id) as any[]
      return group.length > 0 ? group : [found]
    }
    return [found]
  }, [usingDemo, params.id])

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
      </div>
    )
  }

  const hasInProgress = inspections.some((i) => i.status === 'in_progress')
  if (hasInProgress && !usingDemo) {
    return (
      <div className="page-container">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: '#3B82F6', marginBottom: 8 }}>Inspection In Progress</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginBottom: 16, lineHeight: 1.5 }}>
            This inspection has not been filed yet. You can resume it from the inspections page.
          </div>
          <button
            onClick={() => router.push('/inspections?view=history')}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              color: '#FFF', fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Resume Inspection
          </button>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allInspections: any[] = usingDemo ? demoInspections : inspections

  if (allInspections.length === 0) {
    return (
      <div className="page-container">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Inspection not found</div>
      </div>
    )
  }

  const isDaily = allInspections.length > 1
  const airfieldInsp = allInspections.find((i: { inspection_type: string }) => i.inspection_type === 'airfield')
  const lightingInsp = allInspections.find((i: { inspection_type: string }) => i.inspection_type === 'lighting')
  const primary = airfieldInsp || allInspections[0]
  const isSpecialType = primary.inspection_type === 'construction_meeting' || primary.inspection_type === 'joint_monthly'
  const specialLabel = primary.inspection_type === 'construction_meeting'
    ? 'Pre/Post Construction Inspection'
    : primary.inspection_type === 'joint_monthly'
    ? 'Joint Monthly Airfield Inspection'
    : ''

  const totalPassed = allInspections.reduce((s: number, i: { passed_count: number }) => s + i.passed_count, 0)
  const totalFailed = allInspections.reduce((s: number, i: { failed_count: number }) => s + i.failed_count, 0)
  const totalNa = allInspections.reduce((s: number, i: { na_count: number }) => s + i.na_count, 0)
  const totalItems = allInspections.reduce((s: number, i: { total_items: number }) => s + i.total_items, 0)
  const complianceRate = totalItems > 0 ? Math.round(((totalPassed + totalNa) / totalItems) * 100) : 0

  const allFailedItems: (InspectionItem & { fromType: string })[] = allInspections.flatMap(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (insp: any) => (insp.items || [])
      .filter((item: InspectionItem) => item.response === 'fail')
      .map((item: InspectionItem) => ({ ...item, fromType: insp.inspection_type }))
  )

  // Color helpers
  const typeColor = isSpecialType ? '#A78BFA' : '#22D3EE'
  const topBorderColor = isSpecialType
    ? '#A78BFA'
    : airfieldInsp && lightingInsp ? 'var(--color-cyan)' : airfieldInsp ? '#34D399' : '#FBBF24'

  const handleExportPdf = async () => {
    setGeneratingPdf(true)
    const bi: PdfBaseInfo | undefined = currentInstallation
      ? { name: currentInstallation.name, icao: currentInstallation.icao, unit: currentInstallation.unit ?? '' }
      : undefined

    // Prepare photo data for PDF embedding
    const photoMapForPdf: PdfPhotoMap = {}
    for (const [itemId, photos] of Object.entries(photosByItem)) {
      const dataUrls: string[] = []
      for (const photo of photos) {
        const url = resolvePhotoUrl(photo)
        if (url.startsWith('data:')) {
          dataUrls.push(url)
        } else {
          try {
            const resp = await fetch(url)
            if (resp.ok) {
              const blob = await resp.blob()
              const reader = new FileReader()
              const dataUrl = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(blob)
              })
              dataUrls.push(dataUrl)
            }
          } catch { /* skip failed photos */ }
        }
      }
      if (dataUrls.length > 0) photoMapForPdf[itemId] = dataUrls
    }

    const generalPhotoUrls: PdfGeneralPhotos = []
    for (const photo of generalPhotos) {
      const url = resolvePhotoUrl(photo)
      if (url.startsWith('data:')) {
        generalPhotoUrls.push(url)
      } else {
        try {
          const resp = await fetch(url)
          if (resp.ok) {
            const blob = await resp.blob()
            const reader = new FileReader()
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            generalPhotoUrls.push(dataUrl)
          }
        } catch { /* skip failed photos */ }
      }
    }

    // Merge photo location data into items for map embedding in PDF
    const locationByItem: Record<string, { lat: number; lon: number }> = {}
    for (const [itemId, photos] of Object.entries(photosByItem)) {
      const photoWithLoc = photos.find(p => p.latitude != null && p.longitude != null)
      if (photoWithLoc) {
        locationByItem[itemId] = { lat: photoWithLoc.latitude!, lon: photoWithLoc.longitude! }
      }
    }
    const inspectionsWithLocations = allInspections.map(insp => ({
      ...insp,
      items: (insp.items || []).map((item: InspectionItem) => ({
        ...item,
        location: item.location || locationByItem[item.id] || null,
      })),
    }))

    try {
      if (isSpecialType) {
        const { generateSpecialInspectionPdf } = await import('@/lib/pdf-export')
        await generateSpecialInspectionPdf(inspectionsWithLocations[0], bi, generalPhotoUrls.length > 0 ? generalPhotoUrls : undefined)
      } else if (isDaily) {
        const { generateCombinedInspectionPdf } = await import('@/lib/pdf-export')
        await generateCombinedInspectionPdf(inspectionsWithLocations, bi, Object.keys(photoMapForPdf).length > 0 ? photoMapForPdf : undefined)
      } else {
        const { generateInspectionPdf } = await import('@/lib/pdf-export')
        await generateInspectionPdf(inspectionsWithLocations[0], bi, Object.keys(photoMapForPdf).length > 0 ? photoMapForPdf : undefined)
      }
    } catch (e) {
      console.error('PDF export failed:', e)
    }
    setGeneratingPdf(false)
  }

  // Render item photos inline
  const renderItemPhotos = (itemId: string) => {
    const photos = photosByItem[itemId]
    if (!photos || photos.length === 0) return null
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
        {photos.map((photo, idx) => (
          <div
            key={photo.id}
            onClick={() => openPhotoViewer(photos, idx)}
            style={{
              width: 56, height: 56, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <img
              src={resolvePhotoUrl(photo)}
              alt={photo.file_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ))}
      </div>
    )
  }

  // Render a single inspection's sections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderInspectionSections = (inspection: any) => {
    const items: InspectionItem[] = inspection.items || []
    if (items.length === 0) return null

    const sections = items.reduce<Record<string, InspectionItem[]>>((acc, item) => {
      const key = item.section || 'Uncategorized'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {})

    return Object.entries(sections).map(([sectionTitle, sectionItems]) => {
      const passCount = sectionItems.filter((i) => i.response === 'pass').length
      const failCount = sectionItems.filter((i) => i.response === 'fail').length
      const sectionTotal = sectionItems.length
      const sectionProgress = sectionTotal > 0 ? (passCount / sectionTotal) * 100 : 0
      const borderColor = failCount > 0 ? '#EF4444' : passCount === sectionTotal ? '#22C55E' : 'var(--color-border)'

      return (
        <div
          key={`${inspection.id}-${sectionTitle}`}
          className="card"
          style={{
            marginBottom: 8,
            borderRadius: 12,
            borderLeft: `3px solid ${borderColor}`,
            padding: '14px 14px 10px',
          }}
        >
          {/* Section header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: failCount > 0 ? '#FBBF24' : passCount === sectionTotal ? '#22C55E' : 'var(--color-text-2)' }}>
              {sectionTitle}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {failCount > 0 && (
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                  {failCount} fail
                </span>
              )}
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 600 }}>
                {passCount}/{sectionTotal}
              </span>
            </div>
          </div>

          {/* Section progress bar */}
          <div style={{ height: 3, background: 'var(--color-border)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${sectionProgress}%`,
              background: failCount > 0 ? '#FBBF24' : '#22C55E',
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Items */}
          {sectionItems.map((item, idx) => {
            const color = item.response === 'pass' ? '#22C55E'
              : item.response === 'fail' ? '#EF4444'
              : item.response === 'na' ? 'var(--color-text-3)' : 'var(--color-text-4)'
            const symbol = item.response === 'pass' ? '\u2713'
              : item.response === 'fail' ? '\u2717'
              : item.response === 'na' ? 'N/A' : '\u2014'
            const isFail = item.response === 'fail'
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: isFail ? '6px 0 6px 8px' : '5px 0',
                  borderBottom: idx < sectionItems.length - 1 ? '1px solid rgba(30,41,59,0.4)' : 'none',
                  borderLeft: isFail ? '2px solid #EF4444' : '2px solid transparent',
                  marginLeft: isFail ? -2 : 0,
                  background: isFail ? 'rgba(239,68,68,0.03)' : 'transparent',
                  borderRadius: isFail ? 4 : 0,
                }}
              >
                <span style={{
                  fontSize: item.response === 'na' ? 8 : 13,
                  fontWeight: 700,
                  color,
                  minWidth: 22,
                  textAlign: 'center',
                  paddingTop: 2,
                }}>
                  {symbol}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 'var(--fs-base)',
                    color: item.response === 'na' ? 'var(--color-text-3)' : 'var(--color-text-1)',
                    textDecoration: item.response === 'na' ? 'line-through' : 'none',
                    lineHeight: 1.4,
                  }}>
                    {item.item}
                  </div>
                  {item.notes && isFail && (
                    <div style={{
                      fontSize: 'var(--fs-sm)', color: '#FBBF24', marginTop: 4, fontStyle: 'italic',
                      padding: '4px 8px', background: 'rgba(251,191,36,0.06)', borderRadius: 4,
                    }}>
                      {item.notes}
                    </div>
                  )}
                  {isFail && item.location && (() => {
                    const loc = item.location
                    const mapToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
                    const mapUrl = mapToken && mapToken !== 'your-mapbox-token-here'
                      ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+ef4444(${loc.lon},${loc.lat})/${loc.lon},${loc.lat},16,0/400x200@2x?access_token=${mapToken}`
                      : null
                    return (
                      <div style={{ marginTop: 4 }}>
                        {mapUrl && (
                          <img
                            src={mapUrl}
                            alt="Fail item location"
                            style={{
                              width: '100%', maxWidth: 400, height: 140, objectFit: 'cover',
                              borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 3,
                            }}
                          />
                        )}
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                          Location: {loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}
                        </div>
                      </div>
                    )
                  })()}
                  {isFail && renderItemPhotos(item.id)}
                </div>
              </div>
            )
          })}
        </div>
      )
    })
  }

  return (
    <div style={{ padding: '8px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <Link
          href="/inspections?view=history"
          style={{ color: 'var(--color-cyan)', fontSize: 'var(--fs-base)', fontWeight: 600, textDecoration: 'none' }}
        >
          All Inspections
        </Link>
      </div>

      {/* ═══ Summary Card ═══ */}
      <div
        className="card"
        style={{
          marginBottom: 10, borderRadius: 12, overflow: 'hidden',
          borderTop: `3px solid ${topBorderColor}`,
          padding: '16px 14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: typeColor }}>
            {isSpecialType ? specialLabel : isDaily ? 'Airfield Inspection Report' : primary.display_id}
          </span>
          <Badge label="COMPLETED" color="#22C55E" />
        </div>

        {/* Display IDs for daily report */}
        {isDaily && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {allInspections.map((insp: { id: string; display_id: string }) => (
              <span key={insp.id} style={{
                fontSize: 'var(--fs-sm)', fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6,
                background: 'var(--color-border)', color: 'var(--color-text-2)',
              }}>
                {insp.display_id}
              </span>
            ))}
          </div>
        )}

        {/* Display ID for special types */}
        {isSpecialType && (
          <div style={{
            marginBottom: 12, fontSize: 'var(--fs-sm)', fontFamily: 'monospace', padding: '3px 8px',
            borderRadius: 6, background: 'var(--color-border)', color: 'var(--color-text-2)',
            display: 'inline-block',
          }}>
            {primary.display_id}
          </div>
        )}

        {/* Type badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {isSpecialType ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8,
              background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
            }}>
              <span style={{ fontSize: 'var(--fs-lg)' }}>{primary.inspection_type === 'construction_meeting' ? '🏗️' : '📋'}</span>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: '#A78BFA' }}>
                {primary.inspection_type === 'construction_meeting' ? 'Construction Meeting' : 'Joint Monthly'}
              </span>
            </div>
          ) : (
            <>
              {airfieldInsp && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                }}>
                  <span style={{ fontSize: 'var(--fs-lg)' }}>📋</span>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: '#34D399' }}>Airfield</span>
                </div>
              )}
              {lightingInsp && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                }}>
                  <span style={{ fontSize: 'var(--fs-lg)' }}>💡</span>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: '#FBBF24' }}>Lighting</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Info Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 'var(--fs-base)', marginBottom: 14,
          padding: '12px', borderRadius: 10, background: 'var(--color-border)', border: '1px solid var(--color-border-mid)',
        }}>
          <div>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Filed By</div>
            <div style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{primary.filed_by_name || primary.inspector_name || 'Unknown'}</div>
            {primary.filed_at && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 1 }}>
                {new Date(primary.filed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Date</div>
            <div style={{ fontWeight: 500 }}>
              {primary.completed_at
                ? `${new Date(primary.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(primary.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                : primary.inspection_date}
            </div>
          </div>
          {primary.weather_conditions && (
            <div>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Weather</div>
              <div style={{ fontWeight: 500 }}>{primary.weather_conditions}</div>
            </div>
          )}
          {primary.temperature_f != null && (
            <div>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Temperature</div>
              <div style={{ fontWeight: 500 }}>{primary.temperature_f}°F</div>
            </div>
          )}
        </div>

        {/* BWC Value */}
        {(airfieldInsp?.bwc_value || primary.bwc_value) && (() => {
          const bwc = airfieldInsp?.bwc_value || primary.bwc_value
          const bwcColor = bwc === 'LOW' ? '#22C55E' : bwc === 'MOD' ? '#EAB308' : bwc === 'SEV' ? '#F97316' : '#EF4444'
          const bwcBg = bwc === 'LOW' ? 'rgba(34,197,94,0.12)' : bwc === 'MOD' ? 'rgba(234,179,8,0.12)' : bwc === 'SEV' ? 'rgba(249,115,22,0.12)' : 'rgba(239,68,68,0.12)'
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Bird Watch Condition
              </div>
              <span style={{
                padding: '4px 14px', borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 800,
                color: bwcColor, background: bwcBg, border: `1px solid ${bwcColor}33`,
              }}>
                {bwc}
              </span>
            </div>
          )
        })()}
      </div>

      {/* ═══ Special Type Content (Construction Meeting / Joint Monthly) ═══ */}
      {isSpecialType ? (
        <>
          {/* Personnel */}
          {primary.personnel && primary.personnel.length > 0 && (
            <div className="card" style={{ marginBottom: 10, borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                Personnel / Offices Present
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {primary.personnel.map((person: string) => (
                  <span key={person} style={{
                    fontSize: 'var(--fs-base)', padding: '5px 12px', borderRadius: 8, fontWeight: 600,
                    background: 'rgba(167,139,250,0.1)', color: '#A78BFA',
                    border: '1px solid rgba(167,139,250,0.2)',
                  }}>
                    {person}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {(primary.notes || (isAdmin && editingNotes)) && (
            <div className="card" style={{ marginBottom: 10, borderRadius: 12, padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Comments
                </div>
                {isAdmin && !editingNotes && (
                  <button
                    onClick={() => { setNotesText(primary.notes || ''); setEditingNotes(true) }}
                    style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div>
                  <textarea
                    className="input-dark"
                    rows={3}
                    style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <ActionButton
                      color="#10B981"
                      onClick={async () => {
                        if (usingDemo) {
                          toast.success('Notes updated (demo mode)')
                          setEditingNotes(false)
                          return
                        }
                        setActionLoading(true)
                        const { error } = await updateInspectionNotes(primary.id, notesText.trim() || null)
                        if (error) {
                          toast.error(error)
                        } else {
                          toast.success('Notes updated')
                          await loadData()
                        }
                        setActionLoading(false)
                        setEditingNotes(false)
                      }}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Saving...' : 'Save'}
                    </ActionButton>
                    <ActionButton color="#9CA3AF" onClick={() => setEditingNotes(false)}>
                      Cancel
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{primary.notes}</div>
              )}
            </div>
          )}

          {/* General photos for special types */}
          {generalPhotos.length > 0 && (
            <div className="card" style={{ marginBottom: 10, borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                Photos ({generalPhotos.length})
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {generalPhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    onClick={() => openPhotoViewer(generalPhotos, idx)}
                    style={{
                      width: 72, height: 72, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                      border: '1px solid var(--color-border-mid)',
                    }}
                  >
                    <img
                      src={resolvePhotoUrl(photo)}
                      alt={photo.file_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ═══ Results Card ═══ */}
          <div className="card" style={{ marginBottom: 10, borderRadius: 12, padding: '14px 14px 16px' }}>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              {isDaily ? 'Combined Results' : 'Results'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <div style={{
                textAlign: 'center', padding: '10px 6px', borderRadius: 10,
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: '#22C55E' }}>{totalPassed}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>PASS</div>
              </div>
              <button
                onClick={() => totalFailed > 0 && setShowFailedItems((p) => !p)}
                style={{
                  textAlign: 'center', padding: '10px 6px', borderRadius: 10,
                  background: showFailedItems ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${showFailedItems ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
                  cursor: totalFailed > 0 ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  boxShadow: totalFailed > 0 ? '0 0 8px rgba(239,68,68,0.15)' : 'none',
                }}
              >
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: '#EF4444' }}>{totalFailed}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>FAIL {totalFailed > 0 ? (showFailedItems ? '▴' : '▾') : ''}</div>
              </button>
              <div style={{
                textAlign: 'center', padding: '10px 6px', borderRadius: 10,
                background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)',
              }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-text-3)' }}>{totalNa}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>N/A</div>
              </div>
              <div style={{
                textAlign: 'center', padding: '10px 6px', borderRadius: 10,
                background: 'var(--color-border)', border: '1px solid var(--color-border-active)',
              }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-accent)' }}>{totalItems}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>TOTAL</div>
              </div>
            </div>

            {/* Compliance bar */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>Compliance Rate</span>
                <span style={{
                  fontSize: 'var(--fs-md)', fontWeight: 800,
                  color: complianceRate >= 95 ? '#22C55E' : complianceRate >= 80 ? '#FBBF24' : '#EF4444',
                }}>
                  {complianceRate}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, transition: 'width 0.5s ease',
                  width: `${complianceRate}%`,
                  background: complianceRate >= 95
                    ? 'linear-gradient(90deg, #22C55E, #34D399)'
                    : complianceRate >= 80
                    ? 'linear-gradient(90deg, #EAB308, #FBBF24)'
                    : 'linear-gradient(90deg, #DC2626, #EF4444)',
                }} />
              </div>
            </div>
          </div>

          {/* Combined Failed Items — toggled by Fail button */}
          {showFailedItems && allFailedItems.length > 0 && (
            <div className="card" style={{ marginBottom: 10, borderRadius: 12, borderLeft: '3px solid #EF4444', padding: '14px' }}>
              <div style={{ fontSize: 'var(--fs-2xs)', color: '#EF4444', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                Failed Items ({allFailedItems.length})
              </div>
              {allFailedItems.map((item, idx) => (
                <div key={item.id} style={{
                  marginBottom: idx < allFailedItems.length - 1 ? 10 : 0,
                  paddingBottom: idx < allFailedItems.length - 1 ? 10 : 0,
                  borderBottom: idx < allFailedItems.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', lineHeight: 1.4 }}>
                    {item.item}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.section}
                    {isDaily && (
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                        color: item.fromType === 'airfield' ? '#34D399' : '#FBBF24',
                        background: item.fromType === 'airfield' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                      }}>
                        {item.fromType === 'airfield' ? 'Airfield' : 'Lighting'}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <div style={{
                      fontSize: 'var(--fs-base)', color: '#FBBF24', marginTop: 4, fontStyle: 'italic',
                      padding: '4px 8px', background: 'rgba(251,191,36,0.06)', borderRadius: 4,
                    }}>
                      {item.notes}
                    </div>
                  )}
                  {renderItemPhotos(item.id)}
                </div>
              ))}
            </div>
          )}

          {/* Section-by-Section Detail — grouped by inspection type */}
          {allInspections.map((insp: { id: string; inspection_type: string; items: InspectionItem[]; notes: string | null; passed_count: number; failed_count: number; na_count: number; total_items: number; completed_by_name?: string | null; completed_at?: string | null; filed_by_name?: string | null; filed_at?: string | null; inspector_name?: string | null }) => {
            const items: InspectionItem[] = insp.items || []
            if (items.length === 0 && !insp.notes) return null
            const isExpanded = expandedSections[insp.inspection_type] !== false
            const completedBy = insp.completed_by_name || insp.inspector_name || 'Unknown'
            const completedTime = insp.completed_at
              ? new Date(insp.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              : null
            const color = insp.inspection_type === 'airfield' ? '#34D399' : '#FBBF24'
            const bgAlpha = insp.inspection_type === 'airfield' ? 'rgba(52,211,153,' : 'rgba(251,191,36,'

            return (
              <div key={insp.id}>
                {/* Type divider — collapsible toggle */}
                <button
                  onClick={() => setExpandedSections((prev) => ({
                    ...prev,
                    [insp.inspection_type]: !prev[insp.inspection_type],
                  }))}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', margin: '14px 0 8px', padding: '12px 14px', borderRadius: 12,
                    background: `${bgAlpha}0.06)`, border: `1px solid ${bgAlpha}0.2)`,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    fontSize: 'var(--fs-md)', fontWeight: 800, color,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span>{insp.inspection_type === 'airfield' ? '📋' : '💡'}</span>
                    {insp.inspection_type === 'airfield' ? 'Airfield Inspection' : 'Lighting Inspection'}
                    <span style={{
                      fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-3)', marginLeft: 2,
                      background: 'var(--color-border)', padding: '2px 8px', borderRadius: 6,
                    }}>
                      {insp.passed_count}/{insp.total_items}
                      {insp.failed_count > 0 && <span style={{ color: '#EF4444', marginLeft: 4 }}>{insp.failed_count} fail</span>}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 'var(--fs-xl)', color,
                    transition: 'transform 0.2s ease',
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    display: 'inline-block',
                  }}>
                    ▾
                  </span>
                </button>

                {/* Completed by info */}
                {isExpanded && (
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 8, paddingLeft: 6 }}>
                    Completed by <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{completedBy}</span>
                    {completedTime && <span> at {completedTime}</span>}
                  </div>
                )}

                {/* Collapsible content */}
                {isExpanded && (
                  <>
                    {renderInspectionSections(insp)}

                    {insp.notes && (
                      <div className="card" style={{ marginBottom: 10, borderRadius: 12, padding: '14px' }}>
                        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                          {isDaily ? `${insp.inspection_type === 'airfield' ? 'Airfield' : 'Lighting'} Notes` : 'Notes'}
                        </div>
                        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6 }}>{insp.notes}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ═══ Actions ═══ */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 8, display: 'flex', gap: 8 }}>
        <button
          onClick={handleExportPdf}
          disabled={generatingPdf}
          style={{
            flex: 1, padding: '12px', borderRadius: 12, textAlign: 'center',
            background: '#A78BFA14', border: '1px solid #A78BFA33',
            color: '#A78BFA', fontSize: 'var(--fs-md)', fontWeight: 700,
            fontFamily: 'inherit', cursor: generatingPdf ? 'default' : 'pointer',
            opacity: generatingPdf ? 0.7 : 1,
          }}
        >
          {generatingPdf ? 'Generating...' : 'Export PDF'}
        </button>
        <Link
          href="/inspections?view=history"
          style={{
            flex: 1, padding: '12px', borderRadius: 12, textAlign: 'center',
            background: '#22C55E14', border: '1px solid #22C55E33',
            color: '#22C55E', fontSize: 'var(--fs-md)', fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          All Inspections
        </Link>
      </div>

      {/* Admin Actions */}
      {isAdmin && (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 8, display: 'flex', gap: 8 }}>
          <ActionButton
            color="#3B82F6"
            onClick={() => { setNotesText(primary.notes || ''); setEditingNotes(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          >
            Edit Notes
          </ActionButton>
          <ActionButton
            color="#EF4444"
            onClick={async () => {
              if (usingDemo) {
                toast.success('Inspection deleted (demo mode)')
                router.push('/inspections?view=history')
                return
              }
              if (!confirm('Delete this inspection? This cannot be undone.')) return
              setActionLoading(true)
              const { error } = await deleteInspection(primary.id)
              if (error) {
                toast.error(error)
                setActionLoading(false)
              } else {
                toast.success('Inspection deleted')
                router.push('/inspections?view=history')
              }
            }}
            disabled={actionLoading}
          >
            Delete Record
          </ActionButton>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {viewerPhotos && (
        <PhotoViewerModal
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerPhotos(null)}
        />
      )}
    </div>
  )
}
