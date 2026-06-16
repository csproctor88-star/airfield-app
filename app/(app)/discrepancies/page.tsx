'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import { fetchDiscrepancies, deleteDiscrepancy, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { photoUrl } from '@/lib/supabase/photos'
import { StatusBadge } from '@/components/ui/badge'
import { DEMO_DISCREPANCIES } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { DISCREPANCY_TYPES } from '@/lib/constants'
import { getDiscrepancyStatusLabel } from '@/lib/airport-mode'
import { fetchMapImageDataUrl, fetchSystemMapImageDataUrl, formatZuluDate, formatZuluDateTime, compressImageForPdf } from '@/lib/utils'
import { fetchSystemFeaturesForFeature } from '@/lib/supabase/infrastructure-features'
import {
  buildDiscrepancyTable,
  type DiscrepancyRowData,
} from '@/lib/pdf-config'
import PdfExportDialog from '@/components/ui/pdf-template-selector'
import { EditDiscrepancyModal } from '@/components/discrepancies/modals'
import {
  Map, List, Pencil, Trash2,
  Plus, Sheet, FileText, Mail, Search, SlidersHorizontal, X, AlertOctagon,
} from 'lucide-react'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { toast } from 'sonner'

const DiscrepancyMapView = lazy(() => import('@/components/discrepancies/discrepancy-map-view-google'))

const FILTERS = ['open', 'pending', 'completed', 'cancelled', 'all'] as const
const FILTER_LABELS: Record<string, string> = {
  open: 'Open',
  pending: 'Pending W/O',
  completed: 'Completed',
  cancelled: 'Cancelled',
  all: 'All',
}

type KpiKey = 'afm' | 'ces' | 'amops'

const KPI_DEFS: { key: KpiKey; label: string; color: string; match: (cs: string) => boolean }[] = [
  { key: 'afm', label: 'AFM', color: 'var(--color-status-inwork)', match: (cs) => cs === 'submitted_to_afm' },
  { key: 'ces', label: 'CES', color: 'var(--color-orange)', match: (cs) => cs === 'submitted_to_ces' || cs === 'awaiting_action_by_ces' || cs === 'waiting_for_project' },
  { key: 'amops', label: 'AMOPS', color: 'var(--color-status-pass)', match: (cs) => cs === 'work_completed_awaiting_verification' },
]

// Status colors mirror /ces page convention so a row's left rail and
// the right-side status pill speak the same visual language as the
// CES queue. Same five enum values as CURRENT_STATUS_OPTIONS.
const CURRENT_STATUS_COLORS: Record<string, string> = {
  submitted_to_afm: 'var(--color-status-inwork)',
  submitted_to_ces: 'var(--color-orange)',
  awaiting_action_by_ces: 'var(--color-warning)',
  waiting_for_project: 'var(--color-purple)',
  work_completed_awaiting_verification: 'var(--color-success)',
}

// Compact status labels for the row pill — full labels overflow the
// row at typical widths. AFM-side users still see the long form in
// the detail header + the audit log.
const CURRENT_STATUS_SHORT: Record<string, string> = {
  submitted_to_afm: 'TO AFM',
  submitted_to_ces: 'TO CES',
  awaiting_action_by_ces: 'AWAIT CES',
  waiting_for_project: 'PROJECT',
  work_completed_awaiting_verification: 'VERIFY',
}

export default function DiscrepanciesPage() {
  const { installationId, currentInstallation, defaultPdfEmail, ceShops, userRole } = useInstallation()
  const isCes = userRole === 'ces'
  const [filter, setFilter] = useState<string>('open')
  const [over30Only, setOver30Only] = useState(false)
  const [currentStatusFilter, setCurrentStatusFilter] = useState<KpiKey | null>(null)
  const [search, setSearch] = useState('')
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [shopFilter, setShopFilter] = useState<string | null>(null)
  const [discrepancyPhotoMap, setDiscrepancyPhotoMap] = useState<Record<string, string>>({})
  const [editingDiscrepancy, setEditingDiscrepancy] = useState<DiscrepancyRow | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfDialogMode, setPdfDialogMode] = useState<'download' | 'email'>('download')
  const [pdfExporting, setPdfExporting] = useState(false)
  // Filters dropdown — collapses status / shop / type chips into a
  // single Filters affordance with active-count badge. Click outside
  // (or the same button again) closes.
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setUsingDemo(true)
        setLoading(false)
        return
      }

      const data = await fetchDiscrepancies(installationId)
      if (data.length === 0) {
        // Could be empty table or fetch error — check if Supabase is reachable
        setDiscrepancies([])
      } else {
        setDiscrepancies(data)
      }
      setLoading(false)

      // Fetch first photo per discrepancy for map popups
      if (data.length > 0 && supabase) {
        try {
          const ids = data.map(d => d.id)
          const { data: photoRows } = await supabase
            .from('photos')
            .select('discrepancy_id, storage_path, thumbnail_path')
            .in('discrepancy_id', ids)
            .order('created_at', { ascending: true })
          if (photoRows && photoRows.length > 0) {
            const pMap: Record<string, string> = {}
            for (const row of photoRows) {
              const dId = row.discrepancy_id
              if (!dId) continue
              // Only keep the first photo per discrepancy
              if (pMap[dId]) continue
              // Prefer thumbnail for list views (much smaller). photoUrl()
              // routes through the authenticated proxy and passes data: through.
              pMap[dId] = photoUrl(row.thumbnail_path || row.storage_path)
            }
            setDiscrepancyPhotoMap(pMap)
          }
        } catch { /* photo fetch is best-effort */ }
      }
    }
    load()
  }, [installationId])

  const handleDeleteDiscrepancy = async (id: string) => {
    if (!confirm('Delete this discrepancy?')) return
    const ok = await deleteDiscrepancy(id)
    if (ok) {
      setDiscrepancies(prev => prev.filter(d => d.id !== id))
      toast.success('Discrepancy deleted')
    } else {
      toast.error('Failed to delete')
    }
  }

  const handleEditSaved = (updated: DiscrepancyRow) => {
    setDiscrepancies(prev => prev.map(d => d.id === updated.id ? updated : d))
    setEditingDiscrepancy(null)
  }

  // Compute days_open for live data
  const daysOpen = (createdAt: string) => {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))
  }

  // Use demo data as fallback when Supabase isn't configured
  const q = search.toLowerCase()
  const matchesSearch = (d: { title: string; description: string; work_order_number?: string | null }) =>
    !q || d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || (d.work_order_number?.toLowerCase().includes(q) ?? false)

  // Current status filter predicate
  const matchesCurrentStatus = (cs: string) => {
    if (!currentStatusFilter) return true
    const def = KPI_DEFS.find(k => k.key === currentStatusFilter)
    return def ? def.match(cs) : true
  }

  // Counters: open work orders and >30 days open
  const allItems = usingDemo ? DEMO_DISCREPANCIES : discrepancies
  const openCount = allItems.filter(d => d.status === 'open').length
  const over30Count = allItems.filter(d => {
    const days = Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000))
    return d.status === 'open' && days > 30
  }).length

  // AFM / CES / AMOPS counts (open discrepancies only)
  const kpiCounts: Record<KpiKey, number> = {
    afm: allItems.filter(d => d.status === 'open' && KPI_DEFS[0].match(d.current_status)).length,
    ces: allItems.filter(d => d.status === 'open' && KPI_DEFS[1].match(d.current_status)).length,
    amops: allItems.filter(d => d.status === 'open' && KPI_DEFS[2].match(d.current_status)).length,
  }

  const matchesType = (type: string) => {
    if (!typeFilter) return true
    return type.split(',').map(v => v.trim()).includes(typeFilter)
  }

  const matchesShop = (d: { assigned_shop: string | null }) => {
    if (!shopFilter) return true
    if (shopFilter === '__unassigned') return !d.assigned_shop
    return d.assigned_shop === shopFilter
  }

  const matchesFilter = (d: { status: string; work_order_number?: string | null }) => {
    if (filter === 'all') return true
    if (filter === 'pending') return d.status === 'open' && ((d.work_order_number || '').toLowerCase().includes('pending'))
    return d.status === filter
  }

  const demoFiltered = DEMO_DISCREPANCIES
    .filter(matchesFilter)
    .filter(d => !over30Only || (d.status === 'open' && daysOpen(d.created_at) > 30))
    .filter(d => matchesCurrentStatus(d.current_status))
    .filter(d => matchesType(d.type))
    .filter(matchesShop)
    .filter(matchesSearch)

  const liveFiltered = discrepancies
    .filter(matchesFilter)
    .filter(d => !over30Only || (d.status === 'open' && daysOpen(d.created_at) > 30))
    .filter(d => matchesCurrentStatus(d.current_status))
    .filter(d => matchesType(d.type))
    .filter(matchesShop)
    .filter(matchesSearch)

  const filtered = usingDemo ? demoFiltered : liveFiltered

  // --- Export helpers ---

  const getTypeLabel = (typeVal: string) => {
    // Handle multiple types stored as comma-separated values
    return typeVal.split(',').map(v => {
      const t = DISCREPANCY_TYPES.find(dt => dt.value === v.trim())
      return t ? t.label : v.trim()
    }).join(', ')
  }

  const getCurrentStatusLabel = (cs: string) => getDiscrepancyStatusLabel(cs, currentInstallation) || cs

  const handleExportExcel = async () => {
    const { createStyledWorkbook, addStyledSheet, saveWorkbook, titleCase } = await import('@/lib/excel-export')

    // Fetch photo counts (live mode only)
    const photoInfo: Record<string, { count: number; files: string[] }> = {}
    if (!usingDemo) {
      const supabase = createClient()
      if (supabase) {
        const ids = filtered.map(d => d.id)
        const { data: photoRows } = await supabase
          .from('photos')
          .select('discrepancy_id, file_name')
          .in('discrepancy_id', ids)
        if (photoRows) {
          for (const row of photoRows) {
            const dId = row.discrepancy_id
            if (!dId) continue
            if (!photoInfo[dId]) photoInfo[dId] = { count: 0, files: [] }
            photoInfo[dId].count++
            if (row.file_name) photoInfo[dId].files.push(row.file_name)
          }
        }
      }
    }

    const hasPhotos = Object.keys(photoInfo).length > 0
    const hasCoords = filtered.some(d => 'latitude' in d && d.latitude != null && 'longitude' in d && d.longitude != null)
    const columns = [
      { header: 'Display ID', key: 'display_id', width: 16 },
      { header: 'Title', key: 'title', width: 36 },
      { header: 'Type', key: 'type', width: 22 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Current Status', key: 'current_status', width: 30 },
      { header: 'Location', key: 'location', width: 12 },
      ...(hasCoords ? [{ header: 'Coordinates', key: 'coordinates', width: 22 }] : []),
      { header: 'Assigned Shop', key: 'assigned_shop', width: 20 },
      { header: 'Work Order #', key: 'work_order', width: 16 },
      { header: 'Days Open', key: 'days_open', width: 10 },
      { header: 'Created At', key: 'created_at', width: 14 },
      { header: 'Created By', key: 'created_by', width: 22 },
      ...(hasPhotos ? [
        { header: 'Photo Count', key: 'photo_count', width: 12 },
        { header: 'Photo Files', key: 'photo_files', width: 30 },
      ] : []),
    ]

    const rows = filtered.map(d => {
      const info = photoInfo[d.id]
      return {
        display_id: d.display_id,
        title: d.title,
        type: getTypeLabel(d.type),
        status: titleCase(d.status),
        current_status: getCurrentStatusLabel(d.current_status),
        location: d.location_text,
        ...(hasCoords ? {
          coordinates: 'latitude' in d && d.latitude != null && 'longitude' in d && d.longitude != null
            ? `${Number(d.latitude).toFixed(5)}, ${Number(d.longitude).toFixed(5)}`
            : '',
        } : {}),
        assigned_shop: d.assigned_shop || '',
        work_order: d.work_order_number || '',
        days_open: usingDemo ? (d as typeof DEMO_DISCREPANCIES[number]).days_open : daysOpen(d.created_at),
        created_at: formatZuluDate(new Date(d.created_at)),
        created_by: 'reporter' in d && d.reporter ? (d.reporter.rank ? `${d.reporter.rank} ${d.reporter.name}` : d.reporter.name || '') : '',
        ...(hasPhotos ? {
          photo_count: info?.count || 0,
          photo_files: info?.files.join(', ') || '',
        } : {}),
      }
    })

    const wb = await createStyledWorkbook()
    addStyledSheet(wb, 'Discrepancies', columns, rows)
    const dateStr = new Date().toISOString().split('T')[0]
    await saveWorkbook(wb, `Discrepancies_${dateStr}.xlsx`)
  }

  const handleExportPdf = async (selectedPdfColumns: string[]) => {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 12
    let y = margin

    const wantPhotos = selectedPdfColumns.includes('photos')

    // ── Fetch photos + map images only if photos column is selected ──
    const photoMap: Record<string, string[]> = {}

    if (wantPhotos && !usingDemo) {
      const supabase = createClient()
      if (supabase) {
        const ids = filtered.map(d => d.id)
        const { data: photoRows } = await supabase
          .from('photos')
          .select('discrepancy_id, storage_path, thumbnail_path')
          .in('discrepancy_id', ids)
        if (photoRows && photoRows.length > 0) {
          for (const row of photoRows) {
            try {
              let dataUrl: string | null = null
              const imgPath = row.thumbnail_path || row.storage_path
              if (imgPath.startsWith('data:')) {
                dataUrl = await compressImageForPdf(imgPath, 400, 0.6)
              } else {
                {
                  const resp = await fetch(photoUrl(imgPath))
                  if (resp.ok) {
                    const blob = await resp.blob()
                    const raw = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onloadend = () => resolve(reader.result as string)
                      reader.onerror = reject
                      reader.readAsDataURL(blob)
                    })
                    dataUrl = await compressImageForPdf(raw, 400, 0.6)
                  }
                }
              }
              if (dataUrl && row.discrepancy_id) {
                if (!photoMap[row.discrepancy_id]) photoMap[row.discrepancy_id] = []
                photoMap[row.discrepancy_id].push(dataUrl)
              }
            } catch { /* skip failed photo */ }
          }
        }
      }

      // Fetch map images: system overview for NAVAID-linked, pin map for others
      for (const d of filtered) {
        const featureId = 'infrastructure_feature_id' in d ? (d as DiscrepancyRow).infrastructure_feature_id : null
        if (featureId) {
          try {
            const systemFeatures = await fetchSystemFeaturesForFeature(featureId)
            if (systemFeatures.length > 0) {
              const mapFeatures = systemFeatures
                .filter(f => f.latitude != null && f.longitude != null)
                .map(f => ({ latitude: f.latitude, longitude: f.longitude, status: f.status, id: f.id }))
              const mapUrl = await fetchSystemMapImageDataUrl(mapFeatures, featureId)
              if (mapUrl) {
                if (!photoMap[d.id]) photoMap[d.id] = []
                photoMap[d.id].push(mapUrl)
              }
            }
          } catch { /* skip */ }
        } else {
          const lat = 'latitude' in d && d.latitude != null ? Number(d.latitude) : null
          const lng = 'longitude' in d && d.longitude != null ? Number(d.longitude) : null
          if (lat != null && lng != null) {
            const mapDataUrl = await fetchMapImageDataUrl(lat, lng)
            if (mapDataUrl) {
              if (!photoMap[d.id]) photoMap[d.id] = []
              photoMap[d.id].push(mapDataUrl)
            }
          }
        }
      }
    }

    // Header
    doc.setFontSize(8)
    doc.setTextColor(100)
    const headerLine = currentInstallation?.name && currentInstallation?.icao
      ? `${currentInstallation.name} (${currentInstallation.icao})`
      : 'GLIDEPATH'
    doc.text(headerLine, margin, y)
    y += 5

    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('DISCREPANCY REPORT', margin, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60)
    const now = new Date()
    doc.text(`Generated: ${formatZuluDateTime(now)}`, margin, y)
    y += 4
    doc.text(`Total: ${filtered.length} discrepancies`, margin, y)
    y += 7

    // Build row data for shared table builder
    const tableRows: DiscrepancyRowData[] = filtered.map(d => ({
      id: d.id,
      work_order: d.work_order_number || '',
      title: d.title,
      status_label: getCurrentStatusLabel(d.current_status),
      location: d.location_text,
      type_label: getTypeLabel(d.type),
      shop: d.assigned_shop || '',
      days_open: usingDemo ? (d as typeof DEMO_DISCREPANCIES[number]).days_open : daysOpen(d.created_at),
      reported_by: 'reporter' in d && d.reporter ? (d.reporter.rank ? `${d.reporter.rank} ${d.reporter.name}` : d.reporter.name || '') : '',
      last_update: '',
      comments: '',
      photos: photoMap[d.id] || [],
    }))

    const finalY = buildDiscrepancyTable({
      doc,
      startY: y,
      margin,
      selectedColumns: selectedPdfColumns,
      rows: tableRows,
      pageWidth,
    })

    // Footer — page numbers
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' })
      doc.text(formatZuluDate(now), pageWidth - margin, pageHeight - 6, { align: 'right' })
    }

    const dateStr = now.toISOString().split('T')[0]
    const filename = `Discrepancy_Report_${dateStr}.pdf`
    return { doc, filename }
  }

  const handleDownloadPdf = () => {
    setPdfDialogMode('download')
    setPdfDialogOpen(true)
  }

  const handleEmailPdf = () => {
    setPdfDialogMode('email')
    setPdfDialogOpen(true)
  }

  const handlePdfDialogExport = async (columns: string[]) => {
    setPdfExporting(true)
    const result = await handleExportPdf(columns)
    if (result) {
      if (pdfDialogMode === 'download') {
        result.doc.save(result.filename)
        setPdfDialogOpen(false)
      } else {
        setEmailPdfData(result)
        setPdfDialogOpen(false)
        setEmailModalOpen(true)
      }
    }
    setPdfExporting(false)
  }

  const handleSendEmail = async (email: string) => {
    if (!emailPdfData) return
    setSendingEmail(true)
    const result = await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, `Discrepancy Report: ${emailPdfData.filename.replace(/_/g, ' ').replace('.pdf', '')}`)
    if (result.success) {
      toast.success('Email sent successfully')
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } else {
      toast.error(result.error || 'Failed to send email')
    }
    setSendingEmail(false)
  }

  return (
    <div className="page-container">
      {/* Page header — small uppercase tertiary label + tiered action
          cluster on the right. Excel/PDF/Email read as a calm utility
          family; +New stays the cyan primary action. */}
      {(() => {
        const utilityBtn: React.CSSProperties = {
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '5px 10px',
          color: 'var(--color-text-2)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }
        return (
          <div data-tour="discrepancies-header" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12, flexWrap: 'wrap',
            marginBottom: 10, paddingBottom: 6,
            borderBottom: '1px solid var(--color-border-active)',
          }}>
            <span style={{
              fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Discrepancies</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleExportExcel} style={utilityBtn} title="Export to Excel">
                <Sheet size={12} color="var(--color-accent)" strokeWidth={2.25} />
                Excel
              </button>
              <button onClick={handleDownloadPdf} style={utilityBtn} title="Download PDF">
                <FileText size={12} color="var(--color-accent)" strokeWidth={2.25} />
                PDF
              </button>
              <button onClick={handleEmailPdf} style={utilityBtn} title="Email PDF">
                <Mail size={12} color="var(--color-accent)" strokeWidth={2.25} />
                Email
              </button>
              {!isCes && (
                <Link
                  href="/discrepancies/new"
                  data-tour="discrepancies-primary-action"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
                    borderRadius: 'var(--radius-md)',
                    padding: '5px 12px',
                    color: 'var(--color-accent)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                  }}
                >
                  <Plus size={12} strokeWidth={2.5} />
                  New
                </Link>
              )}
            </div>
          </div>
        )
      })()}

      {/* KPI band — primary pair (OPEN + > 30 DAYS) flush with the
          secondary triplet (AFM / CES / AMOPS) so the eye lands on
          OPEN/>30 first; the secondary tier recedes via smaller
          numerals + tertiary labels. > 30 DAYS gets an AlertOctagon
          prefix when non-zero so the alert reads at a glance. */}
      <div data-tour="discrepancies-kpi-band" style={{
        display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 8,
        marginBottom: 12, flexWrap: 'wrap',
      }}>
        {/* Primary pair */}
        {[
          { label: 'OPEN', value: openCount, color: 'var(--color-warning)', active: filter === 'open' && !over30Only && !currentStatusFilter, alert: false,
            onClick: () => { setFilter('open'); setOver30Only(false); setCurrentStatusFilter(null) } },
          { label: '> 30 DAYS', value: over30Count, color: over30Count > 0 ? 'var(--color-danger)' : 'var(--color-success)', active: over30Only, alert: over30Count > 0,
            onClick: () => { setFilter('open'); setOver30Only(!over30Only); setCurrentStatusFilter(null) } },
        ].map((k) => (
          <div
            key={k.label}
            className="kpi-badge kpi-badge-lg"
            onClick={k.onClick}
            style={{
              border: `1px solid ${k.active ? `color-mix(in srgb, ${k.color} 35%, transparent)` : 'var(--color-border)'}`,
              flex: '1 1 0',
              maxWidth: 260,
            }}
          >
            <div className="kpi-label kpi-label-lg" style={{
              color: 'var(--color-text-3)', fontSize: 'var(--fs-2xs)',
              fontWeight: 700, letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {k.alert && <AlertOctagon size={11} color={k.color} strokeWidth={2.5} />}
              {k.label}
            </div>
            <div className="kpi-value kpi-value-lg" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}

        {/* Subtle vertical separator between primary pair and triplet */}
        <div style={{
          width: 1, alignSelf: 'stretch',
          background: 'var(--color-border)', opacity: 0.5,
          minHeight: 40,
        }} />

        {/* Secondary triplet — AFM / CES / AMOPS */}
        {KPI_DEFS.map((kpi) => {
          const active = currentStatusFilter === kpi.key
          return (
            <div
              key={kpi.key}
              className="kpi-badge"
              onClick={() => {
                if (active) {
                  setCurrentStatusFilter(null)
                } else {
                  setCurrentStatusFilter(kpi.key)
                  setFilter('open')
                  setOver30Only(false)
                }
              }}
              style={{
                border: `1px solid ${active ? `color-mix(in srgb, ${kpi.color} 35%, transparent)` : 'var(--color-border)'}`,
                flex: '0 1 auto',
                minWidth: 70,
              }}
            >
              <div className="kpi-label" style={{
                color: 'var(--color-text-3)', fontSize: 'var(--fs-2xs)',
                fontWeight: 700, letterSpacing: '0.06em',
              }}>
                {kpi.label}
              </div>
              <div className="kpi-value kpi-value-sm" style={{ color: kpi.color }}>{kpiCounts[kpi.key]}</div>
            </div>
          )
        })}
      </div>

      {/* Search + Filters dropdown + view toggle.
          Search promoted to the top so the most-used control sits
          first. Filters button collapses status/shop/type chips
          into a single panel that opens on demand. The view-mode
          toggle (map/list) sits inline so it stays visible without
          adding another row. */}
      {(() => {
        const statusActive = filter !== 'open' || over30Only || currentStatusFilter !== null
        const shopActive = shopFilter !== null
        const typeActive = typeFilter !== null
        const activeCount = (statusActive ? 1 : 0) + (shopActive ? 1 : 0) + (typeActive ? 1 : 0)
        const clearAll = () => {
          setFilter('open')
          setOver30Only(false)
          setCurrentStatusFilter(null)
          setShopFilter(null)
          setTypeFilter(null)
        }
        // Type counts used by both the dropdown and (when no map)
        // contextual chips below. Match status + search filters but
        // not type itself.
        const baseForTypeCounts = (usingDemo ? DEMO_DISCREPANCIES : discrepancies)
          .filter(d => filter === 'all' || d.status === filter)
          .filter(d => !over30Only || (d.status === 'open' && daysOpen(d.created_at) > 30))
          .filter(d => matchesCurrentStatus(d.current_status))
          .filter(matchesSearch)
        const typeCountsAll: Record<string, number> = {}
        for (const d of baseForTypeCounts) {
          for (const v of d.type.split(',').map(t => t.trim())) {
            typeCountsAll[v] = (typeCountsAll[v] || 0) + 1
          }
        }
        const typesWithMatches = DISCREPANCY_TYPES.filter(t => typeCountsAll[t.value])

        return (
          <>
            {/* Top control row */}
            <div data-tour="discrepancies-filters" style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap',
            }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
                <Search size={14} color="var(--color-text-3)" style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none',
                }} />
                <input
                  type="text"
                  placeholder="Search title, description, or work order..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 12px 8px 32px',
                    background: 'var(--color-search-bg)',
                    border: '1px solid var(--color-search-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>

              {/* Filters button */}
              <button
                type="button"
                onClick={() => setFiltersOpen(!filtersOpen)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 'var(--radius-md)',
                  border: filtersOpen || activeCount > 0 ? '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)' : '1px solid var(--color-border)',
                  background: filtersOpen ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'var(--color-bg-surface)',
                  color: filtersOpen || activeCount > 0 ? 'var(--color-accent)' : 'var(--color-text-2)',
                  fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                <SlidersHorizontal size={13} strokeWidth={2.25} />
                Filters
                {activeCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 18, height: 18, padding: '0 5px',
                    borderRadius: 9, background: 'var(--color-accent)', color: '#fff',
                    fontSize: 'var(--fs-2xs)', fontWeight: 800, marginLeft: 2,
                  }}>{activeCount}</span>
                )}
              </button>

              {/* View toggle */}
              <div data-tour="discrepancies-view-toggle" style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => setViewMode('map')}
                  title="Map view"
                  style={{
                    background: viewMode === 'map' ? 'rgba(34,211,238,0.15)' : 'transparent',
                    border: 'none', borderRight: '1px solid var(--color-border)',
                    padding: '7px 9px',
                    color: viewMode === 'map' ? 'var(--color-cyan)' : 'var(--color-text-3)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}
                ><Map size={14} /></button>
                <button
                  onClick={() => setViewMode('list')}
                  title="List view"
                  style={{
                    background: viewMode === 'list' ? 'rgba(34,211,238,0.15)' : 'transparent',
                    border: 'none',
                    padding: '7px 9px',
                    color: viewMode === 'list' ? 'var(--color-cyan)' : 'var(--color-text-3)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}
                ><List size={14} /></button>
              </div>
            </div>

            {/* Filters dropdown panel */}
            {filtersOpen && (
              <div style={{
                marginBottom: 10, padding: 12, borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-mid)',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                {/* Status */}
                <div>
                  <div style={{
                    fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
                    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
                  }}>Status</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {FILTERS.map((v) => (
                      <button
                        key={v}
                        onClick={() => { setFilter(v); setOver30Only(false); setCurrentStatusFilter(null) }}
                        style={{
                          background: filter === v ? 'rgba(34,211,238,0.12)' : 'transparent',
                          border: `1px solid ${filter === v ? 'rgba(34,211,238,0.3)' : 'var(--color-border)'}`,
                          borderRadius: 'var(--radius-sm)', padding: '3px 8px',
                          color: filter === v ? 'var(--color-cyan)' : 'var(--color-text-3)',
                          fontSize: 'var(--fs-xs)', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}
                      >{FILTER_LABELS[v]}</button>
                    ))}
                  </div>
                </div>

                {/* Shop */}
                {ceShops.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
                      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
                    }}>Shop</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {ceShops.map(shop => {
                        const active = shopFilter === shop
                        const count = allItems.filter(d => d.status === 'open' && d.assigned_shop === shop).length
                        return (
                          <button
                            key={shop}
                            type="button"
                            onClick={() => {
                              setShopFilter(active ? null : shop)
                              if (!active) { setFilter('open'); setOver30Only(false); setCurrentStatusFilter(null) }
                            }}
                            style={{
                              padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                              border: active ? '1.5px solid var(--color-orange)' : '1px solid var(--color-border)',
                              background: active ? 'rgba(249,115,22,0.12)' : 'var(--color-bg-inset)',
                              color: active ? 'var(--color-orange)' : 'var(--color-text-2)',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {shop}
                            {count > 0 && (
                              <span style={{
                                fontSize: 'var(--fs-2xs)', fontWeight: 700,
                                background: active ? 'rgba(249,115,22,0.2)' : 'var(--color-border)',
                                color: active ? 'var(--color-orange)' : 'var(--color-text-3)',
                                padding: '0 4px', borderRadius: 'var(--radius-xs)', minWidth: 16, textAlign: 'center',
                              }}>{count}</span>
                            )}
                          </button>
                        )
                      })}
                      {allItems.some(d => d.status === 'open' && !d.assigned_shop) && (
                        <button
                          type="button"
                          onClick={() => {
                            const active = shopFilter === '__unassigned'
                            setShopFilter(active ? null : '__unassigned')
                            if (!active) { setFilter('open'); setOver30Only(false); setCurrentStatusFilter(null) }
                          }}
                          style={{
                            padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                            border: shopFilter === '__unassigned' ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border)',
                            background: shopFilter === '__unassigned' ? 'rgba(239,68,68,0.12)' : 'var(--color-bg-inset)',
                            color: shopFilter === '__unassigned' ? 'var(--color-danger)' : 'var(--color-text-3)',
                          }}
                        >Unassigned</button>
                      )}
                    </div>
                  </div>
                )}

                {/* Type */}
                {typesWithMatches.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
                      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
                    }}>Type</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {typesWithMatches.map((t) => {
                        const active = typeFilter === t.value
                        const Icon = t.icon
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setTypeFilter(active ? null : t.value)}
                            style={{
                              padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                              border: active ? '1.5px solid var(--color-cyan)' : '1px solid var(--color-border)',
                              background: active ? 'rgba(34,211,238,0.12)' : 'var(--color-bg-inset)',
                              color: active ? 'var(--color-cyan)' : 'var(--color-text-2)',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Icon size={12} strokeWidth={2.25} color={t.color} />
                            {t.label}
                            <span style={{
                              fontSize: 'var(--fs-2xs)', fontWeight: 600,
                              color: active ? 'var(--color-cyan)' : 'var(--color-text-4)',
                            }}>{typeCountsAll[t.value]}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active-filter chip strip */}
            {activeCount > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
                marginBottom: 10,
              }}>
                {statusActive && (() => {
                  const labelParts: string[] = []
                  if (filter !== 'open') labelParts.push(FILTER_LABELS[filter])
                  if (over30Only) labelParts.push('> 30 days')
                  if (currentStatusFilter) {
                    const def = KPI_DEFS.find(k => k.key === currentStatusFilter)
                    if (def) labelParts.push(def.label)
                  }
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 12,
                      background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.30)',
                      color: 'var(--color-cyan)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      Status: {labelParts.join(' · ') || FILTER_LABELS[filter]}
                      <button
                        onClick={() => { setFilter('open'); setOver30Only(false); setCurrentStatusFilter(null) }}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                      ><X size={11} strokeWidth={2.5} /></button>
                    </span>
                  )
                })()}
                {shopActive && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 12,
                    background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.30)',
                    color: 'var(--color-orange)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    Shop: {shopFilter === '__unassigned' ? 'Unassigned' : shopFilter}
                    <button
                      onClick={() => setShopFilter(null)}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                    ><X size={11} strokeWidth={2.5} /></button>
                  </span>
                )}
                {typeActive && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 12,
                    background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.30)',
                    color: 'var(--color-cyan)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    Type: {DISCREPANCY_TYPES.find(t => t.value === typeFilter)?.label || typeFilter}
                    <button
                      onClick={() => setTypeFilter(null)}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                    ><X size={11} strokeWidth={2.5} /></button>
                  </span>
                )}
                <button
                  onClick={clearAll}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-text-3)',
                    fontSize: 'var(--fs-2xs)', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', letterSpacing: '0.04em', textTransform: 'uppercase',
                    padding: '2px 4px',
                  }}
                >Clear all</button>
              </div>
            )}
          </>
        )
      })()}

      {loading ? (
        // Skeleton rows shaped like a discrepancy entry — title bar +
        // status pill stub + meta row. Reuses the .weather-skeleton
        // pulse keyframe added in the / polish pass.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            }}>
              <div className="weather-skeleton" style={{ width: 60, height: 12, borderRadius: 4, background: 'var(--color-bg-inset)', flexShrink: 0 }} />
              <div className="weather-skeleton" style={{ flex: 1, height: 12, borderRadius: 4, background: 'var(--color-bg-inset)' }} />
              <div className="weather-skeleton" style={{ width: 60, height: 16, borderRadius: 12, background: 'var(--color-bg-inset)', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Map — shown when viewMode is 'map' */}
          {viewMode === 'map' && (
            <Suspense
              fallback={
                <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
                  Loading map...
                </div>
              }
            >
              <DiscrepancyMapView
                discrepancies={filtered as DiscrepancyRow[]}
                daysOpenFn={daysOpen}
                photoMap={discrepancyPhotoMap}
                activeTypeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
              />
            </Suspense>
          )}

          {/* Type filters moved into the Filters dropdown above. */}

          {/* Card list — always shown (below map when in map mode) */}
          {viewMode === 'map' && filtered.length > 0 && (
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              All Discrepancies ({filtered.length})
            </div>
          )}
          <div data-tour="discrepancies-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map((d) => {
              const days = usingDemo ? (d as typeof DEMO_DISCREPANCIES[number]).days_open : daysOpen(d.created_at)
              const isOpen = d.status === 'open'
              const railColor = isOpen
                ? (CURRENT_STATUS_COLORS[d.current_status] || 'var(--color-text-4)')
                : d.status === 'completed'
                  ? 'var(--color-success)'
                  : 'var(--color-text-4)'
              const wo = (d.work_order_number || '').trim()
              const hasRealWo = wo && wo.toLowerCase() !== 'pending'
              const showStatusPill = isOpen && CURRENT_STATUS_SHORT[d.current_status]
              const showDays = isOpen && days > 0
              const overdue = isOpen && days > 30
              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px 8px 12px',
                    background: 'var(--color-bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${railColor}`,
                    fontSize: 'var(--fs-sm)',
                  }}
                >
                  <Link
                    href={`/discrepancies/${d.id}`}
                    style={{
                      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
                      textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <span style={{
                      fontWeight: 800, color: 'var(--color-cyan)',
                      fontFamily: 'monospace', flexShrink: 0,
                      fontSize: 'var(--fs-xs)', letterSpacing: '0.02em',
                    }}>
                      {d.display_id}
                    </span>
                    <span style={{
                      fontWeight: 600, color: 'var(--color-text-1)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      flex: 1, minWidth: 0,
                    }}>
                      {d.title}
                    </span>
                    {hasRealWo && (
                      <span style={{
                        fontSize: 'var(--fs-2xs)', fontFamily: 'monospace', fontWeight: 700,
                        color: 'var(--color-text-3)', flexShrink: 0,
                        padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-inset)',
                        whiteSpace: 'nowrap',
                      }}>
                        WO {wo}
                      </span>
                    )}
                    {showStatusPill && (
                      <span style={{
                        fontSize: 'var(--fs-2xs)', fontWeight: 800,
                        letterSpacing: '0.06em', flexShrink: 0,
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        color: railColor,
                        background: `color-mix(in srgb, ${railColor} 14%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${railColor} 32%, transparent)`,
                        whiteSpace: 'nowrap',
                      }}>
                        {CURRENT_STATUS_SHORT[d.current_status]}
                      </span>
                    )}
                    {showDays && (
                      <span style={{
                        fontSize: 'var(--fs-2xs)', fontWeight: 700,
                        color: overdue ? 'var(--color-danger)' : 'var(--color-text-3)',
                        flexShrink: 0, minWidth: 32, textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}>
                        {days}d
                      </span>
                    )}
                  </Link>
                  {!usingDemo && !isCes && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.preventDefault(); setEditingDiscrepancy(d as DiscrepancyRow) }}
                        title="Edit"
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', padding: 4 }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); handleDeleteDiscrepancy(d.id) }}
                        title="Delete"
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (() => {
            const hasFilter = filter !== 'open' || over30Only || currentStatusFilter !== null
              || shopFilter !== null || typeFilter !== null || search.trim() !== ''
            return (
              <div className="card" style={{
                textAlign: 'center', padding: 24,
                color: 'var(--color-text-3)', fontSize: 'var(--fs-md)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <div>{hasFilter ? 'No discrepancies match the current filters' : 'No discrepancies yet'}</div>
                {hasFilter && (
                  <button
                    onClick={() => {
                      setFilter('open'); setOver30Only(false); setCurrentStatusFilter(null)
                      setShopFilter(null); setTypeFilter(null); setSearch('')
                    }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--color-cyan)',
                      fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit', letterSpacing: '0.04em', textTransform: 'uppercase',
                      padding: '4px 8px',
                    }}
                  >Clear all filters</button>
                )}
                {!hasFilter && !isCes && (
                  <Link
                    href="/discrepancies/new"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
                      borderRadius: 'var(--radius-md)',
                      padding: '6px 14px',
                      color: 'var(--color-accent)',
                      fontSize: 'var(--fs-sm)', fontWeight: 800,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      textDecoration: 'none',
                    }}
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    Create Discrepancy
                  </Link>
                )}
              </div>
            )
          })()}
        </>
      )}

      {editingDiscrepancy && (
        <EditDiscrepancyModal
          discrepancy={editingDiscrepancy}
          onClose={() => setEditingDiscrepancy(null)}
          onSaved={handleEditSaved}
        />
      )}

      <PdfExportDialog
        open={pdfDialogOpen}
        mode={pdfDialogMode}
        onClose={() => setPdfDialogOpen(false)}
        onExport={handlePdfDialogExport}
        exporting={pdfExporting}
      />

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}
