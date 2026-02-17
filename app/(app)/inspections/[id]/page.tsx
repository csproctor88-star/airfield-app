'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DEMO_INSPECTIONS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { fetchInspection, fetchDailyGroup, type InspectionRow } from '@/lib/supabase/inspections'
import type { InspectionItem } from '@/lib/supabase/types'

export default function InspectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [inspections, setInspections] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ airfield: true, lighting: true })

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }
    // Fetch the requested inspection
    const data = await fetchInspection(params.id as string)
    if (!data) {
      setLoading(false)
      return
    }
    // If it belongs to a daily group, fetch both halves
    if (data.daily_group_id) {
      const group = await fetchDailyGroup(data.daily_group_id)
      setInspections(group.length > 0 ? group : [data])
    } else {
      setInspections([data])
    }
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // For demo mode: find the inspection and its group
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
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Loading...</div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allInspections: any[] = usingDemo ? demoInspections : inspections

  if (allInspections.length === 0) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Inspection not found</div>
      </div>
    )
  }

  const isDaily = allInspections.length > 1
  const airfieldInsp = allInspections.find((i: { inspection_type: string }) => i.inspection_type === 'airfield')
  const lightingInsp = allInspections.find((i: { inspection_type: string }) => i.inspection_type === 'lighting')
  const primary = airfieldInsp || allInspections[0]

  // Combined totals
  const totalPassed = allInspections.reduce((s: number, i: { passed_count: number }) => s + i.passed_count, 0)
  const totalFailed = allInspections.reduce((s: number, i: { failed_count: number }) => s + i.failed_count, 0)
  const totalNa = allInspections.reduce((s: number, i: { na_count: number }) => s + i.na_count, 0)
  const totalItems = allInspections.reduce((s: number, i: { total_items: number }) => s + i.total_items, 0)

  // Combined failed items
  const allFailedItems: (InspectionItem & { fromType: string })[] = allInspections.flatMap(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (insp: any) => (insp.items || [])
      .filter((item: InspectionItem) => item.response === 'fail')
      .map((item: InspectionItem) => ({ ...item, fromType: insp.inspection_type }))
  )

  const handleExportPdf = async () => {
    setGeneratingPdf(true)
    try {
      if (isDaily) {
        const { generateCombinedInspectionPdf } = await import('@/lib/pdf-export')
        generateCombinedInspectionPdf(allInspections)
      } else {
        const { generateInspectionPdf } = await import('@/lib/pdf-export')
        generateInspectionPdf(allInspections[0])
      }
    } catch (e) {
      console.error('PDF export failed:', e)
    }
    setGeneratingPdf(false)
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
      const allPass = passCount === sectionItems.length
      return (
        <div key={`${inspection.id}-${sectionTitle}`} className="card" style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: allPass ? '#22C55E' : failCount > 0 ? '#FBBF24' : '#94A3B8' }}>
              {sectionTitle}
            </div>
            <div style={{ fontSize: 10, color: '#64748B' }}>
              {passCount}/{sectionItems.length}
            </div>
          </div>
          {sectionItems.map((item) => {
            const color = item.response === 'pass' ? '#22C55E'
              : item.response === 'fail' ? '#EF4444'
              : item.response === 'na' ? '#64748B' : '#334155'
            const symbol = item.response === 'pass' ? '\u2713'
              : item.response === 'fail' ? '\u2717'
              : item.response === 'na' ? 'N/A' : '—'
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(30,41,59,0.5)' }}>
                <span style={{
                  fontSize: item.response === 'na' ? 8 : 12,
                  fontWeight: 700,
                  color,
                  minWidth: 20,
                  textAlign: 'center',
                  paddingTop: 2,
                }}>
                  {symbol}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 11,
                    color: item.response === 'na' ? '#64748B' : '#CBD5E1',
                    textDecoration: item.response === 'na' ? 'line-through' : 'none',
                  }}>
                    {item.item}
                  </div>
                  {item.notes && item.response === 'fail' && (
                    <div style={{ fontSize: 10, color: '#FBBF24', marginTop: 2, fontStyle: 'italic' }}>
                      {item.notes}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )
    })
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <Link
          href="/inspections"
          style={{ color: '#22D3EE', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
        >
          All Inspections
        </Link>
      </div>

      {/* Summary Card */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#22D3EE' }}>
            {isDaily ? 'Airfield Inspection Report' : primary.display_id}
          </span>
          <Badge label="COMPLETED" color="#22C55E" />
        </div>

        {/* Show display IDs for daily report */}
        {isDaily && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>
            {allInspections.map((insp: { id: string; display_id: string }) => (
              <span key={insp.id}>{insp.display_id}</span>
            ))}
          </div>
        )}

        {/* Type badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {airfieldInsp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#34D399' }}>Airfield</span>
            </div>
          )}
          {lightingInsp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FBBF24' }}>Lighting</span>
            </div>
          )}
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Inspector</div>
            <div style={{ fontWeight: 600, marginTop: 2, color: '#38BDF8' }}>{primary.inspector_name || 'Unknown'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Date</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>
              {primary.completed_at
                ? `${new Date(primary.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(primary.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                : primary.inspection_date}
            </div>
          </div>
          {primary.weather_conditions && (
            <div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Weather</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{primary.weather_conditions}</div>
            </div>
          )}
          {primary.temperature_f != null && (
            <div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Temperature</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{primary.temperature_f}°F</div>
            </div>
          )}
        </div>

        {/* BWC Value */}
        {(airfieldInsp?.bwc_value || primary.bwc_value) && (() => {
          const bwc = airfieldInsp?.bwc_value || primary.bwc_value
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Bird Watch Condition
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                color: bwc === 'LOW' ? '#22C55E' : bwc === 'MOD' ? '#EAB308' : bwc === 'SEV' ? '#F97316' : '#EF4444',
                background: bwc === 'LOW' ? 'rgba(34,197,94,0.1)' : bwc === 'MOD' ? 'rgba(234,179,8,0.1)' : bwc === 'SEV' ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)',
              }}>
                {bwc}
              </span>
            </div>
          )
        })()}
      </div>

      {/* Combined Results Card */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {isDaily ? 'Combined Results' : 'Results'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          <div style={{ textAlign: 'center', padding: 8, background: 'rgba(34,197,94,0.08)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#22C55E' }}>{totalPassed}</div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>PASS</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>{totalFailed}</div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>FAIL</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'rgba(100,116,139,0.08)', borderRadius: 8, border: '1px solid rgba(100,116,139,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#64748B' }}>{totalNa}</div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>N/A</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'rgba(56,189,248,0.08)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#38BDF8' }}>{totalItems}</div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>TOTAL</div>
          </div>
        </div>
      </div>

      {/* Combined Failed Items */}
      {allFailedItems.length > 0 && (
        <div className="card" style={{ marginBottom: 8, borderLeft: '3px solid #EF4444' }}>
          <div style={{ fontSize: 9, color: '#EF4444', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Failed Items ({allFailedItems.length})
          </div>
          {allFailedItems.map((item) => (
            <div key={item.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #1E293B' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#F1F5F9' }}>
                {item.item}
              </div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                {item.section}
                {isDaily && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3,
                    color: item.fromType === 'airfield' ? '#34D399' : '#FBBF24',
                    background: item.fromType === 'airfield' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                  }}>
                    {item.fromType === 'airfield' ? 'Airfield' : 'Lighting'}
                  </span>
                )}
              </div>
              {item.notes && (
                <div style={{ fontSize: 11, color: '#FBBF24', marginTop: 4, fontStyle: 'italic' }}>
                  {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Section-by-Section Detail — grouped by inspection type */}
      {allInspections.map((insp: { id: string; inspection_type: string; items: InspectionItem[]; notes: string | null; passed_count: number; failed_count: number; na_count: number; total_items: number }) => {
        const items: InspectionItem[] = insp.items || []
        if (items.length === 0 && !insp.notes) return null
        const isExpanded = expandedSections[insp.inspection_type] !== false

        return (
          <div key={insp.id}>
            {/* Type divider — collapsible for combined reports */}
            {isDaily && (
              <button
                onClick={() => setExpandedSections((prev) => ({
                  ...prev,
                  [insp.inspection_type]: !prev[insp.inspection_type],
                }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  margin: '12px 0 8px',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: insp.inspection_type === 'airfield' ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)',
                  border: `1px solid ${insp.inspection_type === 'airfield' ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{
                  fontSize: 12, fontWeight: 800,
                  color: insp.inspection_type === 'airfield' ? '#34D399' : '#FBBF24',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{insp.inspection_type === 'airfield' ? '📋' : '💡'}</span>
                  {insp.inspection_type === 'airfield' ? 'Airfield Inspection' : 'Lighting Inspection'}
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginLeft: 4 }}>
                    {insp.passed_count}/{insp.total_items}
                    {insp.failed_count > 0 && <span style={{ color: '#EF4444', marginLeft: 4 }}>{insp.failed_count} fail</span>}
                  </span>
                </div>
                <span style={{
                  fontSize: 14,
                  color: insp.inspection_type === 'airfield' ? '#34D399' : '#FBBF24',
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  display: 'inline-block',
                }}>
                  ▾
                </span>
              </button>
            )}

            {/* Collapsible content (always visible for single inspections) */}
            {(!isDaily || isExpanded) && (
              <>
                {renderInspectionSections(insp)}

                {/* Notes for this half */}
                {insp.notes && (
                  <div className="card" style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                      {isDaily ? `${insp.inspection_type === 'airfield' ? 'Airfield' : 'Lighting'} Notes` : 'Notes'}
                    </div>
                    <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.5 }}>{insp.notes}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={handleExportPdf}
          disabled={generatingPdf}
          style={{
            flex: 1, padding: '12px', borderRadius: 10, textAlign: 'center',
            background: '#A78BFA14', border: '1px solid #A78BFA33',
            color: '#A78BFA', fontSize: 12, fontWeight: 700,
            fontFamily: 'inherit', cursor: generatingPdf ? 'default' : 'pointer',
            opacity: generatingPdf ? 0.7 : 1,
          }}
        >
          {generatingPdf ? 'Generating...' : 'Export PDF'}
        </button>
        <Link
          href="/inspections"
          style={{
            flex: 1, padding: '12px', borderRadius: 10, textAlign: 'center',
            background: '#22C55E14', border: '1px solid #22C55E33',
            color: '#22C55E', fontSize: 12, fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          All Inspections
        </Link>
      </div>
    </div>
  )
}
