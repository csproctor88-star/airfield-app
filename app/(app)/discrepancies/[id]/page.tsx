'use client'

import { useRef, useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SeverityBadge, StatusBadge, Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/ui/button'
import { fetchDiscrepancy, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { createClient } from '@/lib/supabase/client'
import { DEMO_DISCREPANCIES, DEMO_NOTAMS } from '@/lib/demo-data'
import { isOverdue, slaTimeRemaining } from '@/lib/calculations/sla'
import { toast } from 'sonner'
import Link from 'next/link'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#FBBF24', low: '#38BDF8',
}

export default function DiscrepancyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([])
  const [liveData, setLiveData] = useState<DiscrepancyRow | null>(null)
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

      const data = await fetchDiscrepancy(params.id as string)
      setLiveData(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file)
      setPhotos((prev) => [...prev, { url, name: file.name }])
    })
    toast.success(`${files.length} photo(s) added`)
    e.target.value = ''
  }

  if (loading) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          Loading...
        </div>
      </div>
    )
  }

  // Resolve data source
  const demoData = DEMO_DISCREPANCIES.find((x) => x.id === params.id)
  const d = usingDemo ? demoData : liveData

  if (!d) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          Discrepancy not found
        </div>
      </div>
    )
  }

  const overdue = isOverdue(d.sla_deadline, d.status)
  const slaText = slaTimeRemaining(d.sla_deadline, d.status)

  // For demo data, resolve linked NOTAM from demo set
  const linkedNotam = usingDemo && 'linked_notam_id' in d && d.linked_notam_id
    ? DEMO_NOTAMS.find((n) => n.id === d.linked_notam_id)
    : null

  const daysOpen = usingDemo && 'days_open' in d
    ? (d as typeof DEMO_DISCREPANCIES[0]).days_open
    : (['resolved', 'closed'].includes(d.status)
      ? 0
      : Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000)))

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
        ← Back
      </button>

      <div className="card" style={{ border: `1px solid ${SEVERITY_COLORS[d.severity]}33`, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#22D3EE', fontFamily: 'monospace' }}>{d.display_id}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <SeverityBadge severity={d.severity} />
            <StatusBadge status={d.status} />
            {overdue && <Badge label="OVERDUE" color="#EF4444" />}
          </div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{d.title}</div>

        {slaText && (
          <div style={{ fontSize: 10, color: overdue ? '#EF4444' : '#FBBF24', marginBottom: 8, fontWeight: 600 }}>
            SLA: {slaText}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.6, marginBottom: 12 }}>{d.description}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
          {([
            ['Location', d.location_text],
            ['Type', d.type.charAt(0).toUpperCase() + d.type.slice(1)],
            ['Shop', d.assigned_shop || 'Unassigned'],
            ['Days Open', daysOpen > 0 ? `${daysOpen}` : 'Resolved'],
            ['Photos', `${d.photo_count}`],
            ['Work Order', d.work_order_number || 'None'],
          ] as const).map(([label, value], i) => (
            <div key={i}>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid #38BDF833' }}>
              <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#EF4444', fontSize: 12, width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <ActionButton color="#38BDF8" onClick={() => toast.success('Edit opened')}>✏️ Edit</ActionButton>
        <ActionButton color="#38BDF8" onClick={() => fileInputRef.current?.click()}>📸 Photo{photos.length > 0 ? ` (${photos.length})` : ''}</ActionButton>
        <ActionButton color="#FBBF24" onClick={() => toast.success('Status update opened')}>🔄 Status</ActionButton>
        <ActionButton color="#34D399" onClick={() => toast.success('Work order opened')}>📋 Work Order</ActionButton>
      </div>

      {linkedNotam && (
        <Link
          href={`/notams/${linkedNotam.id}`}
          className="card"
          style={{ marginTop: 8, cursor: 'pointer', borderLeft: '3px solid #A78BFA', display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="section-label">Linked NOTAM</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>{linkedNotam.notam_number}</span>
            </div>
            <Badge label="VIEW →" color="#22D3EE" />
          </div>
        </Link>
      )}
    </div>
  )
}
