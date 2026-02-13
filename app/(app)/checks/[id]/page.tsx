'use client'

import { useParams, useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DEMO_CHECKS } from '@/lib/demo-data'

const TYPE_COLORS: Record<string, string> = {
  fod: '#FBBF24',
  bash: '#A78BFA',
  rcr: '#22D3EE',
  rsc: '#38BDF8',
  emergency: '#EF4444',
}

const TYPE_LABELS: Record<string, string> = {
  fod: 'FOD',
  bash: 'BASH',
  rcr: 'RCR',
  rsc: 'RSC',
  emergency: 'Emergency',
}

const RESULT_COLORS: Record<string, string> = {
  LOW: '#34D399',
  MODERATE: '#FBBF24',
  SEVERE: '#EF4444',
  IFE: '#EF4444',
  GE: '#EF4444',
}

function FodDetail({ data }: { data: any }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Route</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.route}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Clear</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.clear ? 'Yes' : 'No'}</div>
        </div>
      </div>
      {data.items_found && data.items_found.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Items Found</div>
          {data.items_found.map((item: any, i: number) => (
            <div
              key={i}
              style={{
                background: 'rgba(4, 8, 14, 0.9)',
                border: '1px solid rgba(56, 189, 248, 0.06)',
                borderRadius: 6,
                padding: '8px 10px',
                marginBottom: 4,
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.description}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>
                Location: {item.location} {item.disposed ? ' -- Disposed' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function BashDetail({ data }: { data: any }) {
  const codeColor = data.condition_code === 'LOW' ? '#34D399' : data.condition_code === 'MODERATE' ? '#FBBF24' : '#EF4444'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
      <div>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Condition Code</div>
        <div style={{ fontWeight: 700, marginTop: 2, color: codeColor }}>{data.condition_code}</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Mitigation</div>
        <div style={{ fontWeight: 500, marginTop: 2 }}>{data.mitigation_actions || 'None'}</div>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Species Observed</div>
        <div style={{ fontWeight: 500, marginTop: 2, whiteSpace: 'pre-wrap' }}>{data.species_observed || 'None'}</div>
      </div>
      {data.habitat_attractants && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Habitat Attractants</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.habitat_attractants}</div>
        </div>
      )}
    </div>
  )
}

function RcrDetail({ data }: { data: any }) {
  const avg = data.readings
    ? Math.round((data.readings.rollout + data.readings.midpoint + data.readings.departure) / 3)
    : null
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Rollout</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#22D3EE', marginTop: 2 }}>{data.readings?.rollout}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Midpoint</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#22D3EE', marginTop: 2 }}>{data.readings?.midpoint}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Departure</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#22D3EE', marginTop: 2 }}>{data.readings?.departure}</div>
        </div>
      </div>
      {avg !== null && (
        <div style={{
          background: 'rgba(34, 211, 238, 0.08)',
          border: '1px solid rgba(34, 211, 238, 0.15)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            AVG Mu:{' '}
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#22D3EE' }}>{avg}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Equipment</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.equipment}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Surface</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.surface_condition}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Temperature</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.temperature_f}°F</div>
        </div>
      </div>
    </div>
  )
}

function RscDetail({ data }: { data: any }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
      <div>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Contaminant</div>
        <div style={{ fontWeight: 500, marginTop: 2 }}>{data.contaminant}</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Braking Action</div>
        <div style={{ fontWeight: 500, marginTop: 2 }}>{data.braking_action}</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Depth</div>
        <div style={{ fontWeight: 500, marginTop: 2 }}>{data.depth_inches}" </div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Coverage</div>
        <div style={{ fontWeight: 500, marginTop: 2 }}>{data.coverage_percent}%</div>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Treatment</div>
        <div style={{ fontWeight: 500, marginTop: 2 }}>{data.treatment_applied}</div>
      </div>
    </div>
  )
}

function EmergencyDetail({ data }: { data: any }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Type</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.emergency_type}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Runway</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>RWY {data.runway}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Aircraft</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.aircraft_type}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Callsign</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.callsign}</div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nature</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{data.nature}</div>
        </div>
        {data.duration_minutes && (
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Duration</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>{data.duration_minutes} min</div>
          </div>
        )}
      </div>
      {data.actions && data.actions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Actions Completed</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.actions.map((a: string, i: number) => (
              <Badge key={i} label={a} color="#22D3EE" />
            ))}
          </div>
        </div>
      )}
      {data.agencies_notified && data.agencies_notified.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Agencies Notified</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.agencies_notified.map((a: string, i: number) => (
              <Badge key={i} label={a} color="#34D399" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CheckDetailPage() {
  const params = useParams()
  const router = useRouter()
  const check = DEMO_CHECKS.find((c) => c.id === params.id)

  const backButtonStyle = {
    background: 'none' as const,
    border: 'none' as const,
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: 600 as const,
    cursor: 'pointer' as const,
    padding: 0,
    marginBottom: 12,
    fontFamily: 'inherit',
  }

  if (!check) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <button onClick={() => router.back()} style={backButtonStyle}>
          ← Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          Check not found
        </div>
      </div>
    )
  }

  const color = TYPE_COLORS[check.check_type] || '#94A3B8'
  const resultColor = RESULT_COLORS[check.result] || color

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <button onClick={() => router.back()} style={backButtonStyle}>
        ← Back
      </button>

      <div className="card" style={{ borderLeft: `3px solid ${color}`, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#22D3EE', fontFamily: 'monospace' }}>
            {check.display_id}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <Badge label={TYPE_LABELS[check.check_type] || check.check_type.toUpperCase()} color={color} />
            <Badge label={check.result} color={resultColor} />
          </div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{check.area}</div>

        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 12 }}>
          {new Date(check.check_date).toLocaleString()} &middot; {check.performed_by}
        </div>

        <div style={{
          background: 'rgba(4, 8, 14, 0.9)',
          border: '1px solid rgba(56, 189, 248, 0.06)',
          borderRadius: 8,
          padding: 12,
          marginBottom: check.notes ? 12 : 0,
        }}>
          {check.check_type === 'fod' && <FodDetail data={check.data} />}
          {check.check_type === 'bash' && <BashDetail data={check.data} />}
          {check.check_type === 'rcr' && <RcrDetail data={check.data} />}
          {check.check_type === 'rsc' && <RscDetail data={check.data} />}
          {check.check_type === 'emergency' && <EmergencyDetail data={check.data} />}
        </div>

        {check.notes && (
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.6 }}>{check.notes}</div>
          </div>
        )}
      </div>
    </div>
  )
}
