import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fetchWildlifeAnalytics, fetchStrikes, fetchBwcHistory, fetchHeatmapData } from '@/lib/supabase/wildlife'
import { formatZuluDateTime } from '@/lib/utils'

interface Options {
  baseId?: string | null
  baseName: string
  icao: string
  startDate: string
  endDate: string
  reportMonth: string
  centerLat?: number
  centerLng?: number
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

async function fetchHeatmapImageDataUrl(
  points: { lat: number; lng: number; weight: number; type: string }[],
  centerLat: number,
  centerLng: number,
): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token || token === 'your-mapbox-token-here') return null
  if (points.length === 0) return null

  try {
    // Build GeoJSON overlay with colored circles — limit to 100 points for URL length
    const sorted = [...points].sort((a, b) => b.weight - a.weight).slice(0, 100)

    const geojson = {
      type: 'FeatureCollection',
      features: sorted.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          'marker-color': p.type === 'strike' ? '#EF4444' : '#10B981',
          'marker-size': p.weight >= 5 ? 'medium' : 'small',
        },
      })),
    }

    const encoded = encodeURIComponent(JSON.stringify(geojson))
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/geojson(${encoded})/${centerLng},${centerLat},13,0/800x500@2x?access_token=${token}&logo=false&attribution=false`

    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generateWildlifeReportPdf(options: Options): Promise<{ doc: jsPDF; filename: string }> {
  const { baseId, baseName, icao, startDate, endDate, reportMonth, centerLat, centerLng } = options

  // Fetch data
  const [analytics, strikes, bwcHistory, heatmapPoints] = await Promise.all([
    fetchWildlifeAnalytics(baseId, startDate, endDate),
    fetchStrikes(baseId, { startDate, endDate }).then(r => r.data),
    fetchBwcHistory(baseId, startDate, endDate),
    fetchHeatmapData(baseId, startDate, endDate, 'all'),
  ])

  const [yearStr, monthStr] = reportMonth.split('-')
  const monthName = MONTH_NAMES[parseInt(monthStr) - 1] || monthStr
  const title = `BASH Monthly Summary — ${monthName} ${yearStr}`

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = margin

  // ── Header ──
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin, y)
  y += 18

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${baseName}${icao ? ` (${icao})` : ''}`, margin, y)
  y += 12
  doc.text(`Report Period: ${monthName} ${yearStr}`, margin, y)
  y += 12
  doc.text(`Generated: ${formatZuluDateTime(new Date().toISOString())}Z`, margin, y)
  y += 20

  // ── Executive Summary ──
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Executive Summary', margin, y)
  y += 14

  const dispersalPct = analytics.dispersalEffectiveness.total > 0
    ? Math.round((analytics.dispersalEffectiveness.effective / analytics.dispersalEffectiveness.total) * 100)
    : null

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value']],
    body: [
      ['Total Sightings', String(analytics.totalSightings)],
      ['Total Strikes', String(analytics.totalStrikes)],
      ['Dispersal Actions', String(analytics.totalDispersal)],
      ['Dispersal Effectiveness', dispersalPct !== null ? `${dispersalPct}%` : 'N/A'],
      ['Species Observed', String(analytics.topSpecies.length)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 160 } },
  })

  y = (doc as any).lastAutoTable.finalY + 18

  // ── BWC History ──
  if (bwcHistory.length > 0) {
    if (y > 650) { doc.addPage(); y = margin }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Bird Watch Condition History', margin, y)
    y += 14

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date/Time (Z)', 'BWC', 'Set By', 'Source']],
      body: bwcHistory.map(entry => [
        formatZuluDateTime(entry.set_at) + 'Z',
        entry.bwc_value,
        entry.set_by || '—',
        entry.source || '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
    })

    y = (doc as any).lastAutoTable.finalY + 18
  }

  // ── Top Species ──
  if (analytics.topSpecies.length > 0) {
    if (y > 600) { doc.addPage(); y = margin }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Species Activity', margin, y)
    y += 14

    const totalCount = analytics.topSpecies.reduce((sum, s) => sum + s.count, 0)

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Species', 'Count', '% of Total']],
      body: analytics.topSpecies.map((sp, i) => [
        String(i + 1),
        sp.species,
        String(sp.count),
        `${Math.round((sp.count / totalCount) * 100)}%`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 30 }, 3: { cellWidth: 70 } },
    })

    y = (doc as any).lastAutoTable.finalY + 18
  }

  // ── Strike Detail Log ──
  if (strikes.length > 0) {
    if (y > 550) { doc.addPage(); y = margin }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Strike Detail Log', margin, y)
    y += 14

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Species', 'Aircraft', 'Phase', 'Damage', 'Cost', 'Flight Effect']],
      body: strikes.map(s => [
        formatZuluDateTime(s.strike_date),
        s.species_common || 'Unknown',
        s.aircraft_type || '—',
        s.phase_of_flight?.replace(/_/g, ' ') || '—',
        s.damage_level || 'none',
        s.repair_cost ? `$${Number(s.repair_cost).toLocaleString()}` : '—',
        s.flight_effect?.replace(/_/g, ' ') || 'none',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
    })

    y = (doc as any).lastAutoTable.finalY + 18
  }

  // ── Species Group Breakdown ──
  if (analytics.speciesGroupBreakdown.length > 0) {
    if (y > 650) { doc.addPage(); y = margin }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Activity by Species Group', margin, y)
    y += 14

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Group', 'Total Observed']],
      body: analytics.speciesGroupBreakdown.map(g => [
        g.group.charAt(0).toUpperCase() + g.group.slice(1) + 's',
        String(g.count),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [100, 116, 139], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
    })

    y = (doc as any).lastAutoTable.finalY + 18
  }

  // ── Wildlife Hazard Depiction Map ──
  if (heatmapPoints.length > 0 && centerLat && centerLng) {
    doc.addPage()
    y = margin

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Wildlife Hazard Depiction Map', margin, y)
    y += 14

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${monthName} ${yearStr} — ${heatmapPoints.length} data point${heatmapPoints.length !== 1 ? 's' : ''} plotted`,
      margin, y,
    )
    y += 12

    const sightingCount = heatmapPoints.filter(p => p.type === 'sighting').length
    const strikeCount = heatmapPoints.filter(p => p.type === 'strike').length

    const mapDataUrl = await fetchHeatmapImageDataUrl(heatmapPoints, centerLat, centerLng)
    if (mapDataUrl) {
      try {
        const imgWidth = pageWidth - margin * 2
        const imgHeight = imgWidth * (500 / 800) // maintain 800x500 aspect ratio
        doc.addImage(mapDataUrl, 'PNG', margin, y, imgWidth, imgHeight)
        y += imgHeight + 8
      } catch {
        doc.setFontSize(8)
        doc.text('(Map image could not be rendered)', margin, y)
        y += 12
      }
    } else {
      doc.setFontSize(8)
      doc.text('(Mapbox not configured or no geo-tagged data available)', margin, y)
      y += 12
    }

    // Legend
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Legend:', margin, y)
    y += 10

    // Green dot — sightings
    doc.setFillColor(16, 185, 129)
    doc.circle(margin + 5, y - 3, 4, 'F')
    doc.setFont('helvetica', 'normal')
    doc.text(`Sightings (${sightingCount})`, margin + 14, y)

    // Red dot — strikes
    doc.setFillColor(239, 68, 68)
    doc.circle(margin + 120, y - 3, 4, 'F')
    doc.text(`Strikes (${strikeCount})`, margin + 129, y)
    y += 14

    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text('IAW DAFI 91-212 — Wildlife hazard depiction showing concentration of activity for the report period.', margin, y)
    doc.setTextColor(0)
    y += 18
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `BASH Monthly Summary — ${baseName} — ${monthName} ${yearStr} — Page ${i} of ${pageCount}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 20,
      { align: 'center' },
    )
    doc.text(
      'IAW DAFI 91-212 / DAFMAN 13-204V2',
      pageWidth / 2, doc.internal.pageSize.getHeight() - 12,
      { align: 'center' },
    )
  }

  const filename = `BASH_Monthly_${baseName.replace(/\s+/g, '_')}_${reportMonth}.pdf`
  return { doc, filename }
}
