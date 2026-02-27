'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DiscrepancyCard } from '@/components/discrepancies/discrepancy-card'
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { DEMO_DISCREPANCIES } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { DISCREPANCY_TYPES, CURRENT_STATUS_OPTIONS } from '@/lib/constants'
import { fetchMapImageDataUrl } from '@/lib/utils'

const FILTERS = ['open', 'completed', 'cancelled', 'all'] as const
const FILTER_LABELS: Record<string, string> = {
  open: 'Open',
  completed: 'Completed',
  cancelled: 'Cancelled',
  all: 'All',
}

type KpiKey = 'afm' | 'ces' | 'amops'

const KPI_DEFS: { key: KpiKey; label: string; color: string; match: (cs: string) => boolean }[] = [
  { key: 'afm', label: 'AFM', color: '#3B82F6', match: (cs) => cs === 'submitted_to_afm' },
  { key: 'ces', label: 'CES', color: '#F97316', match: (cs) => cs === 'submitted_to_ces' || cs === 'awaiting_action_by_ces' },
  { key: 'amops', label: 'AMOPS', color: '#22C55E', match: (cs) => cs === 'work_completed_awaiting_verification' },
]

export default function DiscrepanciesPage() {
  const { installationId, currentInstallation } = useInstallation()
  const [filter, setFilter] = useState<string>('open')
  const [over30Only, setOver30Only] = useState(false)
  const [currentStatusFilter, setCurrentStatusFilter] = useState<KpiKey | null>(null)
  const [search, setSearch] = useState('')
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)

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
    }
    load()
  }, [installationId])

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

  const demoFiltered = DEMO_DISCREPANCIES
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => !over30Only || (d.status === 'open' && daysOpen(d.created_at) > 30))
    .filter(d => matchesCurrentStatus(d.current_status))
    .filter(matchesSearch)

  const liveFiltered = discrepancies
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => !over30Only || (d.status === 'open' && daysOpen(d.created_at) > 30))
    .filter(d => matchesCurrentStatus(d.current_status))
    .filter(matchesSearch)

  const filtered = usingDemo ? demoFiltered : liveFiltered

  // --- Export helpers ---

  const getTypeLabel = (typeVal: string) => {
    const t = DISCREPANCY_TYPES.find(dt => dt.value === typeVal)
    return t ? t.label : typeVal
  }

  const getCurrentStatusLabel = (cs: string) => {
    const opt = CURRENT_STATUS_OPTIONS.find(o => o.value === cs)
    return opt ? opt.label : cs
  }

  const handleExportExcel = async () => {
    const { createStyledWorkbook, addStyledSheet, saveWorkbook, titleCase } = await import('@/lib/excel-export')

    // Fetch photo counts (live mode only)
    const photoInfo: Record<string, { count: number; files: string[] }> = {}
    if (!usingDemo) {
      const supabase = createClient()
      if (supabase) {
        const ids = filtered.map(d => d.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: photoRows } = await (supabase as any)
          .from('photos')
          .select('entity_id, file_name')
          .eq('entity_type', 'discrepancy')
          .in('entity_id', ids)
        if (photoRows) {
          for (const row of photoRows) {
            if (!photoInfo[row.entity_id]) photoInfo[row.entity_id] = { count: 0, files: [] }
            photoInfo[row.entity_id].count++
            if (row.file_name) photoInfo[row.entity_id].files.push(row.file_name)
          }
        }
      }
    }

    const hasPhotos = Object.keys(photoInfo).length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasCoords = filtered.some(d => (d as any).latitude != null && (d as any).longitude != null)
    const columns = [
      { header: 'Display ID', key: 'display_id', width: 16 },
      { header: 'Title', key: 'title', width: 36 },
      { header: 'Type', key: 'type', width: 22 },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Current Status', key: 'current_status', width: 30 },
      { header: 'Location', key: 'location', width: 12 },
      ...(hasCoords ? [{ header: 'Coordinates', key: 'coordinates', width: 22 }] : []),
      { header: 'Assigned Shop', key: 'assigned_shop', width: 20 },
      { header: 'Work Order #', key: 'work_order', width: 16 },
      { header: 'Days Open', key: 'days_open', width: 10 },
      { header: 'Created At', key: 'created_at', width: 14 },
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
        severity: titleCase(d.severity),
        status: titleCase(d.status),
        current_status: getCurrentStatusLabel(d.current_status),
        location: d.location_text,
        ...(hasCoords ? {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          coordinates: (d as any).latitude != null && (d as any).longitude != null
            ? `${Number((d as any).latitude).toFixed(5)}, ${Number((d as any).longitude).toFixed(5)}`
            : '',
        } : {}),
        assigned_shop: d.assigned_shop || '',
        work_order: d.work_order_number || '',
        days_open: usingDemo ? (d as typeof DEMO_DISCREPANCIES[number]).days_open : daysOpen(d.created_at),
        created_at: new Date(d.created_at).toLocaleDateString('en-US'),
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

  const handleExportPdf = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 12
    let y = margin

    // ── Fetch photos + map images for all filtered discrepancies ──
    const PHOTO_THUMB_W = 20
    const PHOTO_THUMB_H = 15
    const PHOTO_GAP = 1.5
    const PHOTO_PAD = 2
    const PHOTO_COL_W = 48
    const photoMap: Record<string, string[]> = {} // discrepancy_id → data URL[]

    if (!usingDemo) {
      const supabase = createClient()
      if (supabase) {
        const ids = filtered.map(d => d.id)
        // Fetch uploaded photos
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: photoRows } = await (supabase as any)
          .from('photos')
          .select('entity_id, storage_path')
          .eq('entity_type', 'discrepancy')
          .in('entity_id', ids)
        if (photoRows && photoRows.length > 0) {
          for (const row of photoRows) {
            try {
              let dataUrl: string | null = null
              if (row.storage_path.startsWith('data:')) {
                dataUrl = row.storage_path
              } else {
                const { data: urlData } = supabase.storage.from('photos').getPublicUrl(row.storage_path)
                if (urlData?.publicUrl) {
                  const resp = await fetch(urlData.publicUrl)
                  if (resp.ok) {
                    const blob = await resp.blob()
                    dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onloadend = () => resolve(reader.result as string)
                      reader.onerror = reject
                      reader.readAsDataURL(blob)
                    })
                  }
                }
              }
              if (dataUrl) {
                if (!photoMap[row.entity_id]) photoMap[row.entity_id] = []
                photoMap[row.entity_id].push(dataUrl)
              }
            } catch { /* skip failed photo */ }
          }
        }
      }

      // Fetch Mapbox satellite map images for discrepancies with coordinates
      for (const d of filtered) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lat = (d as any).latitude != null ? Number((d as any).latitude) : null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lng = (d as any).longitude != null ? Number((d as any).longitude) : null
        if (lat != null && lng != null) {
          const mapDataUrl = await fetchMapImageDataUrl(lat, lng)
          if (mapDataUrl) {
            if (!photoMap[d.id]) photoMap[d.id] = []
            photoMap[d.id].push(mapDataUrl)
          }
        }
      }
    }

    const hasAnyPhotos = Object.keys(photoMap).length > 0

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
    doc.text(`Generated: ${now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin, y)
    y += 4
    doc.text(`Total: ${filtered.length} discrepancies`, margin, y)
    y += 7

    // Table columns
    const headRow = ['ID', 'Title', 'Type', 'Severity', 'Status', 'Location', 'Work Order', 'Days']
    if (hasAnyPhotos) headRow.push('Photos')

    const tableBody = filtered.map(d => {
      const row = [
        d.display_id,
        d.title,
        getTypeLabel(d.type),
        d.severity,
        d.status,
        d.location_text,
        d.work_order_number || '',
        String(usingDemo ? (d as typeof DEMO_DISCREPANCIES[number]).days_open : daysOpen(d.created_at)),
      ]
      if (hasAnyPhotos) {
        const count = photoMap[d.id]?.length || 0
        row.push(count > 0 ? `${count} photo${count > 1 ? 's' : ''}` : '')
      }
      return row
    })

    const photoColIdx = hasAnyPhotos ? 8 : -1

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [headRow],
      body: tableBody,
      styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 40 },
        7: { cellWidth: 12, halign: 'center' },
        ...(hasAnyPhotos ? { 8: { cellWidth: PHOTO_COL_W } } : {}),
      },
      didParseCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { minCellHeight?: number } } }) => {
        if (data.section === 'body' && data.column.index === photoColIdx) {
          const d = filtered[data.row.index]
          const photos = d ? (photoMap[d.id] || []) : []
          if (photos.length > 0) {
            const available = PHOTO_COL_W - PHOTO_PAD * 2
            const thumbsPerRow = Math.max(1, Math.floor(available / (PHOTO_THUMB_W + PHOTO_GAP)))
            const rows = Math.ceil(photos.length / thumbsPerRow)
            const needed = PHOTO_PAD * 2 + rows * PHOTO_THUMB_H + Math.max(0, rows - 1) * PHOTO_GAP
            data.cell.styles.minCellHeight = Math.max(needed, 8)
          }
        }
      },
      didDrawCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { x: number; y: number; width: number } }) => {
        if (data.section === 'body' && data.column.index === photoColIdx) {
          const d = filtered[data.row.index]
          const photos = d ? (photoMap[d.id] || []) : []
          if (photos.length === 0) return

          const cellX = data.cell.x
          const cellY = data.cell.y
          const cellW = data.cell.width
          const avail = cellW - PHOTO_PAD * 2
          const thumbsPerRow = Math.max(1, Math.floor(avail / (PHOTO_THUMB_W + PHOTO_GAP)))
          let xOff = cellX + PHOTO_PAD
          let yOff = cellY + PHOTO_PAD

          for (let i = 0; i < photos.length; i++) {
            if (i > 0 && i % thumbsPerRow === 0) {
              yOff += PHOTO_THUMB_H + PHOTO_GAP
              xOff = cellX + PHOTO_PAD
            }
            try {
              const fmt = photos[i].includes('image/png') ? 'PNG' : 'JPEG'
              doc.addImage(photos[i], fmt, xOff, yOff, PHOTO_THUMB_W, PHOTO_THUMB_H)
            } catch {
              doc.setDrawColor(180)
              doc.rect(xOff, yOff, PHOTO_THUMB_W, PHOTO_THUMB_H)
            }
            xOff += PHOTO_THUMB_W + PHOTO_GAP
          }
        }
      },
    })

    // Footer — page numbers
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' })
      doc.text(now.toLocaleDateString('en-US'), pageWidth - margin, pageHeight - 6, { align: 'right' })
    }

    const dateStr = now.toISOString().split('T')[0]
    doc.save(`Discrepancy_Report_${dateStr}.pdf`)
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Discrepancies</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={handleExportExcel}
            style={{
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.3)',
              borderRadius: 8,
              padding: '7px 10px',
              color: '#A855F7',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Excel
          </button>
          <button
            onClick={handleExportPdf}
            style={{
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.3)',
              borderRadius: 8,
              padding: '7px 10px',
              color: '#A855F7',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            PDF
          </button>
          <Link
            href="/discrepancies/new"
            style={{
              background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
              border: 'none',
              borderRadius: 8,
              padding: '7px 12px',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            + New
          </Link>
        </div>
      </div>

      {/* Row 1: OPEN + > 30 DAYS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        {[
          { label: 'OPEN', value: openCount, color: '#FBBF24', active: filter === 'open' && !over30Only && !currentStatusFilter,
            onClick: () => { setFilter('open'); setOver30Only(false); setCurrentStatusFilter(null) } },
          { label: '> 30 DAYS', value: over30Count, color: over30Count > 0 ? '#EF4444' : '#34D399', active: over30Only,
            onClick: () => { setFilter('open'); setOver30Only(!over30Only); setCurrentStatusFilter(null) } },
        ].map((k) => (
          <div
            key={k.label}
            onClick={k.onClick}
            style={{
              background: 'var(--color-bg-surface)',
              border: `1px solid ${k.active ? k.color + '44' : 'var(--color-border)'}`,
              borderRadius: 10,
              padding: '10px 6px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', letterSpacing: '0.08em', fontWeight: 600 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Row 2: AFM / CES / AMOPS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {KPI_DEFS.map((kpi) => {
          const active = currentStatusFilter === kpi.key
          return (
            <div
              key={kpi.key}
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
                background: 'var(--color-bg-surface)',
                border: `1px solid ${active ? kpi.color + '44' : 'var(--color-border)'}`,
                borderRadius: 10,
                padding: '10px 6px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', letterSpacing: '0.08em', fontWeight: 600 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpiCounts[kpi.key]}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map((v) => (
          <button
            key={v}
            onClick={() => { setFilter(v); setOver30Only(false); setCurrentStatusFilter(null) }}
            style={{
              background: filter === v ? 'rgba(34,211,238,0.12)' : 'transparent',
              border: `1px solid ${filter === v ? 'rgba(34,211,238,0.3)' : 'var(--color-border)'}`,
              borderRadius: 5,
              padding: '4px 8px',
              color: filter === v ? 'var(--color-cyan)' : 'var(--color-text-3)',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {FILTER_LABELS[v]}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search title, description, or work order..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: 12,
          background: 'var(--color-search-bg)',
          border: '1px solid var(--color-search-border)',
          borderRadius: 8,
          color: 'var(--color-text-1)',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 13 }}>
          Loading...
        </div>
      ) : usingDemo ? (
        <>
          {demoFiltered.map((d) => (
            <DiscrepancyCard
              key={d.id}
              id={d.id}
              displayId={d.display_id}
              title={d.title}
              severity={d.severity}
              status={d.status}
              locationText={d.location_text}
              assignedShop={d.assigned_shop}
              daysOpen={d.days_open}
              photoCount={d.photo_count}
              workOrderNumber={d.work_order_number}
            />
          ))}
        </>
      ) : (
        <>
          {(liveFiltered as DiscrepancyRow[]).map((d) => (
            <DiscrepancyCard
              key={d.id}
              id={d.id}
              displayId={d.display_id}
              title={d.title}
              severity={d.severity}
              status={d.status}
              locationText={d.location_text}
              assignedShop={d.assigned_shop}
              daysOpen={daysOpen(d.created_at)}
              photoCount={d.photo_count}
              workOrderNumber={d.work_order_number}
            />
          ))}
        </>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 13 }}>
          No discrepancies match this filter
        </div>
      )}
    </div>
  )
}
