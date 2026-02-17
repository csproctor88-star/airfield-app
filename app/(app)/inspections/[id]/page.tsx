'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DEMO_INSPECTIONS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { fetchInspection, type InspectionRow } from '@/lib/supabase/inspections'
import type { InspectionItem } from '@/lib/supabase/types'

export default function InspectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [liveData, setLiveData] = useState<InspectionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }
    const data = await fetchInspection(params.id as string)
    setLiveData(data)
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Loading...</div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inspection: any = usingDemo
    ? DEMO_INSPECTIONS.find((x) => x.id === params.id) || null
    : liveData

  if (!inspection) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Inspection not found</div>
      </div>
    )
  }

  const items: InspectionItem[] = inspection.items || []
  const isAirfield = inspection.inspection_type === 'airfield'
  const typeLabel = isAirfield ? 'Airfield Inspection' : 'Lighting Inspection'
  const typeColor = isAirfield ? '#34D399' : '#FBBF24'

  // Group items by section
  const sections = items.reduce<Record<string, InspectionItem[]>>((acc, item) => {
    const key = item.section || 'Uncategorized'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const failedItems = items.filter((i) => i.response === 'fail')

  const handleExportPdf = async () => {
    setGeneratingPdf(true)
    try {
      const { generateInspectionPdf } = await import('@/lib/pdf-export')
      generateInspectionPdf(inspection)
    } catch (e) {
      console.error('PDF export failed:', e)
    }
    setGeneratingPdf(false)
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
          <span style={{ fontSize: 16, fontWeight: 800, color: '#22D3EE', fontFamily: 'monospace' }}>
            {inspection.display_id}
          </span>
          <Badge label="COMPLETED" color="#22C55E" />
        </div>

        {/* Inspection Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>{isAirfield ? '📋' : '💡'}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: typeColor }}>{typeLabel}</span>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Inspector</div>
            <div style={{ fontWeight: 600, marginTop: 2, color: '#38BDF8' }}>{inspection.inspector_name || 'Unknown'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Date</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>
              {inspection.completed_at
                ? `${new Date(inspection.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(inspection.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                : inspection.inspection_date}
            </div>
          </div>
          {inspection.weather_conditions && (
            <div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Weather</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{inspection.weather_conditions}</div>
            </div>
          )}
          {inspection.temperature_f != null && (
            <div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Temperature</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{inspection.temperature_f}°F</div>
            </div>
          )}
        </div>

        {/* BWC Value */}
        {inspection.bwc_value && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Bird Watch Condition
            </div>
            <span style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              color: inspection.bwc_value === 'LOW' ? '#22C55E' : inspection.bwc_value === 'MOD' ? '#EAB308' : inspection.bwc_value === 'SEV' ? '#F97316' : '#EF4444',
              background: inspection.bwc_value === 'LOW' ? 'rgba(34,197,94,0.1)' : inspection.bwc_value === 'MOD' ? 'rgba(234,179,8,0.1)' : inspection.bwc_value === 'SEV' ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)',
            }}>
              {inspection.bwc_value}
            </span>
          </div>
        )}
      </div>

      {/* Results Card */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Results
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          <div style={{ textAlign: 'center', padding: 8, background: 'rgba(34,197,94,0.08)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#22C55E' }}>{inspection.passed_count}</div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>PASS</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>{inspection.failed_count}</div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>FAIL</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'rgba(100,116,139,0.08)', borderRadius: 8, border: '1px solid rgba(100,116,139,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#64748B' }}>{inspection.na_count}</div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>N/A</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'rgba(56,189,248,0.08)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#38BDF8' }}>{inspection.total_items}</div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>TOTAL</div>
          </div>
        </div>
      </div>

      {/* Failed Items Highlight */}
      {failedItems.length > 0 && (
        <div className="card" style={{ marginBottom: 8, borderLeft: '3px solid #EF4444' }}>
          <div style={{ fontSize: 9, color: '#EF4444', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Failed Items ({failedItems.length})
          </div>
          {failedItems.map((item) => (
            <div key={item.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #1E293B' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#F1F5F9' }}>
                {item.item}
              </div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                {item.section}
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

      {/* Section-by-Section Detail */}
      {items.length > 0 && Object.entries(sections).map(([sectionTitle, sectionItems]) => {
        const passCount = sectionItems.filter((i) => i.response === 'pass').length
        const failCount = sectionItems.filter((i) => i.response === 'fail').length
        const allPass = passCount === sectionItems.length
        return (
          <div key={sectionTitle} className="card" style={{ marginBottom: 6 }}>
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
      })}

      {/* Notes */}
      {inspection.notes && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Notes
          </div>
          <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.5 }}>{inspection.notes}</div>
        </div>
      )}

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
          href="/inspections/new"
          style={{
            flex: 1, padding: '12px', borderRadius: 10, textAlign: 'center',
            background: '#22C55E14', border: '1px solid #22C55E33',
            color: '#22C55E', fontSize: 12, fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          + New Inspection
        </Link>
      </div>
    </div>
  )
}
