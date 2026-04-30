'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { generateWildlifeReportPdf } from '@/lib/reports/wildlife-report-pdf'
import { FileText, Map as MapIcon, FileDown, Info } from 'lucide-react'

type Props = {
  baseId?: string | null
}

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: 14, paddingBottom: 6,
  borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
  display: 'flex', alignItems: 'center', gap: 8,
}

export function WildlifeReport({ baseId }: Props) {
  const { currentInstallation, runways } = useInstallation()
  const [generating, setGenerating] = useState(false)
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  async function handleGenerate() {
    setGenerating(true)
    try {
      const [year, month] = reportMonth.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1).toISOString()
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

      const rwy = runways?.[0]
      const cLat = rwy ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2 : undefined
      const cLng = rwy ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2 : undefined

      const { doc, filename } = await generateWildlifeReportPdf({
        baseId,
        baseName: currentInstallation?.name || 'Unknown Base',
        icao: currentInstallation?.icao || '',
        startDate,
        endDate,
        reportMonth: reportMonth,
        centerLat: cLat,
        centerLng: cLng,
      })
      doc.save(filename)
      toast.success('Report generated')
    } catch (err) {
      console.error('Report generation failed:', err)
      toast.error('Failed to generate report')
    }
    setGenerating(false)
  }

  return (
    <div>
      <div style={{
        background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)', padding: 20,
      }}>
        <div style={SECTION_HEADER}><FileText size={13} /> Monthly BASH Summary Report</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 16 }}>
          Generate a comprehensive PDF report of wildlife activity, strike data, BWC history,
          and dispersal effectiveness for the selected month. Compliant with DAFI 91-212 monthly
          documentation requirements.
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{
              fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: 4,
            }}>
              Report Month
            </label>
            <input
              type="month"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
              style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface-solid)', color: 'var(--color-text-1)',
                fontSize: 'var(--fs-base)', fontFamily: 'inherit',
              }}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
              background: generating
                ? 'var(--color-bg-elevated)'
                : 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
              color: generating ? 'var(--color-text-4)' : 'var(--color-cyan)',
              fontWeight: 700, fontSize: 'var(--fs-sm)',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <FileDown size={14} />
            {generating ? 'Generating...' : 'Generate PDF'}
          </button>
        </div>

        <div style={{
          marginTop: 16, padding: 12, borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--color-text-2)' }}>Report Contents:</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Executive summary with KPIs</li>
            <li>BWC history timeline</li>
            <li>Top species activity table</li>
            <li>Strike detail log (date, species, aircraft, damage, cost)</li>
            <li>Dispersal action effectiveness</li>
            <li>Hazard zone hotspot summary</li>
          </ul>
        </div>
      </div>

      {/* Hazard Depiction Map export */}
      <div style={{
        background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)', padding: 20, marginTop: 14,
      }}>
        <div style={SECTION_HEADER}><MapIcon size={13} /> Hazard Depiction Map</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 12 }}>
          Per DAFI 91-212, installations must maintain a depiction of local bird/wildlife hazards.
          Use the Heatmap tab to view the current hazard depiction, which is also included in the
          monthly PDF report.
        </div>
        <div style={{
          padding: 10, borderRadius: 'var(--radius-md)',
          background: 'color-mix(in srgb, var(--color-amber) 8%, var(--color-bg-surface))',
          border: '1px solid color-mix(in srgb, var(--color-amber) 30%, transparent)',
          fontSize: 'var(--fs-sm)', color: 'var(--color-amber)', fontWeight: 600,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            Tip: The heatmap visualization on the Heatmap tab serves as the DAFI 91-212 required
            wildlife hazard depiction for your installation.
          </div>
        </div>
      </div>
    </div>
  )
}
