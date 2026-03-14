'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { generateWildlifeReportPdf } from '@/lib/reports/wildlife-report-pdf'

type Props = {
  baseId?: string | null
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
        background: 'var(--color-bg-surface)', borderRadius: 12,
        border: '1px solid var(--color-border)', padding: 20,
      }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--fs-lg)', marginBottom: 14 }}>Monthly BASH Summary Report</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 16 }}>
          Generate a comprehensive PDF report of wildlife activity, strike data, BWC history,
          and dispersal effectiveness for the selected month. Compliant with DAFI 91-212 monthly
          documentation requirements.
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 4 }}>
              Report Month
            </label>
            <input
              type="month"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
              style={{
                padding: '8px 10px', borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface)', color: 'var(--color-text)',
                fontSize: 'var(--fs-base)',
              }}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: generating ? 'var(--color-text-4)' : '#3B82F6',
              color: '#fff', fontWeight: 700, cursor: 'pointer',
              fontSize: 'var(--fs-base)',
            }}
          >
            {generating ? 'Generating...' : 'Generate PDF'}
          </button>
        </div>

        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Report Contents:</div>
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
        background: 'var(--color-bg-surface)', borderRadius: 12,
        border: '1px solid var(--color-border)', padding: 20, marginTop: 14,
      }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--fs-lg)', marginBottom: 8 }}>Hazard Depiction Map</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 12 }}>
          Per DAFI 91-212, installations must maintain a depiction of local bird/wildlife hazards.
          Use the Heatmap tab to view the current hazard depiction, which is also included in the
          monthly PDF report.
        </div>
        <div style={{
          padding: 10, borderRadius: 8, background: '#F59E0B10', border: '1px solid #F59E0B30',
          fontSize: 'var(--fs-sm)', color: '#F59E0B', fontWeight: 600,
        }}>
          Tip: The heatmap visualization on the Heatmap tab serves as the DAFI 91-212 required
          wildlife hazard depiction for your installation.
        </div>
      </div>
    </div>
  )
}
