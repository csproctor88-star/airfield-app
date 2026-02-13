'use client'

import { useParams, useRouter } from 'next/navigation'
import { SeverityBadge, StatusBadge, Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/ui/button'
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
  const d = DEMO_DISCREPANCIES.find((x) => x.id === params.id)

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
  const linkedNotam = d.linked_notam_id ? DEMO_NOTAMS.find((n) => n.id === d.linked_notam_id) : null

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
            ['Days Open', d.days_open > 0 ? `${d.days_open}` : 'Resolved'],
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <ActionButton color="#38BDF8" onClick={() => toast.success('Edit opened')}>✏️ Edit</ActionButton>
        <ActionButton color="#38BDF8" onClick={() => toast.success('Camera opened')}>📸 Photo</ActionButton>
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
