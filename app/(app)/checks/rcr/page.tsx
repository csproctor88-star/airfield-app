'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { toast } from 'sonner'

const AREAS = ['RWY 01/19', 'TWY A', 'TWY B', 'TWY C']
const EQUIPMENT = ['RT3 Flight', 'Bowmonk', 'Mu-Meter', 'Manual (Visual)']

export default function RcrCheckPage() {
  const router = useRouter()
  const [area, setArea] = useState('')
  const [equipment, setEquipment] = useState('')
  const [rollout, setRollout] = useState('')
  const [midpoint, setMidpoint] = useState('')
  const [departure, setDeparture] = useState('')
  const [surfaceCondition, setSurfaceCondition] = useState('')
  const [temperature, setTemperature] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    if (!area) {
      toast.error('Please select an area')
      return
    }
    if (!rollout || !midpoint || !departure) {
      toast.error('Please enter all Mu values')
      return
    }
    toast.success('RCR reading saved (demo)')
    router.push('/checks')
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="New RCR Reading" backHref="/checks" />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">Area / Runway</div>
        <select
          className="input-dark"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select area...</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <div className="section-label">Equipment</div>
        <select
          className="input-dark"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select equipment...</option>
          {EQUIPMENT.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <div className="section-label">Mu Values</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Rollout
            </div>
            <input
              className="input-dark"
              type="number"
              placeholder="0-99"
              value={rollout}
              onChange={(e) => setRollout(e.target.value)}
              style={{ textAlign: 'center' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Midpoint
            </div>
            <input
              className="input-dark"
              type="number"
              placeholder="0-99"
              value={midpoint}
              onChange={(e) => setMidpoint(e.target.value)}
              style={{ textAlign: 'center' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Departure
            </div>
            <input
              className="input-dark"
              type="number"
              placeholder="0-99"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              style={{ textAlign: 'center' }}
            />
          </div>
        </div>

        {rollout && midpoint && departure && (
          <div style={{
            background: 'rgba(34, 211, 238, 0.08)',
            border: '1px solid rgba(34, 211, 238, 0.15)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 14,
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              AVG Mu:{' '}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#22D3EE' }}>
              {Math.round((Number(rollout) + Number(midpoint) + Number(departure)) / 3)}
            </span>
          </div>
        )}

        <div className="section-label">Surface Condition</div>
        <input
          className="input-dark"
          placeholder="Dry, Wet, Ice, Snow..."
          value={surfaceCondition}
          onChange={(e) => setSurfaceCondition(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="section-label">Temperature (°F)</div>
        <input
          className="input-dark"
          type="number"
          placeholder="°F"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="section-label">Notes</div>
        <textarea
          className="input-dark"
          placeholder="Additional notes..."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ marginBottom: 14, resize: 'vertical' }}
        />
      </div>

      <button className="btn-primary" onClick={handleSubmit}>
        Save RCR Reading
      </button>
    </div>
  )
}
