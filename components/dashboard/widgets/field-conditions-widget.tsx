'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchActiveByRunway, type FieldConditionReportWithThirds } from '@/lib/supabase/field-conditions'

const RWYCC_COLOR: Record<string, string> = {
  '6': 'var(--color-status-pass)',
  '5': 'var(--color-status-pass)',
  '4': 'var(--color-warning)',
  '3': 'var(--color-warning)',
  '2': 'var(--color-danger)',
  '1': 'var(--color-danger)',
  '0': 'var(--color-danger)',
}

/** Lowest RwyCC across all thirds for a report. */
function lowestRwycc(report: FieldConditionReportWithThirds): string | null {
  if (!report.thirds || report.thirds.length === 0) return null
  const codes = report.thirds.map((t) => Number(t.rwycc))
  const min = Math.min(...codes)
  return String(min)
}

function fmtZulu(iso: string): string {
  const d = new Date(iso)
  const hh = d.getUTCHours().toString().padStart(2, '0')
  const mm = d.getUTCMinutes().toString().padStart(2, '0')
  return `${hh}${mm}Z`
}

export function FieldConditionsWidget() {
  const { installationId } = useInstallation()
  const [reports, setReports] = useState<FieldConditionReportWithThirds[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchActiveByRunway(installationId).then((data) => {
      setReports(data)
      setLoading(false)
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Active FCRs
        </span>
        <span style={{
          fontSize: 'var(--fs-lg)', fontWeight: 800,
          color: reports.length > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)',
        }}>
          {loading ? '…' : reports.length}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && reports.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' }}>No active field condition reports.</div>
        )}
        {reports.map((r) => {
          const rwycc = lowestRwycc(r)
          return (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
            }}>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  RWY {r.runway_designator ?? r.runway_id.slice(0, 8)}
                </div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontFamily: 'var(--font-family-mono)' }}>
                  Valid until {fmtZulu(r.valid_until)}
                </div>
              </div>
              {rwycc && (
                <div style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', textTransform: 'uppercase' }}>RwyCC</span>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: RWYCC_COLOR[rwycc] ?? 'var(--color-text-1)', fontFamily: 'var(--font-family-mono)' }}>
                    {rwycc}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/field-conditions" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
      </div>
    </div>
  )
}
