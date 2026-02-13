'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { toast } from 'sonner'

const EMERGENCY_TYPES = ['IFE', 'Ground Emergency', 'Hijack', 'Crash', 'Hot Brake', 'Hung Ordnance', 'Other']
const RUNWAYS = ['01', '19', '01/19']

const AM_ACTIONS = [
  'Notified ATC/RAPCON',
  'Activated crash phone net',
  'Coordinated fire standby',
  'Swept runway clear',
  'Positioned AM vehicle',
  'Verified arresting gear',
  'Confirmed rescue route clear',
  'Coordinated Wing Safety',
  'Notified SOF/CP/MOC',
  'Issued NOTAM (if needed)',
  'Post: Inspected runway',
  'Post: Released to ATC',
]

const AGENCIES = [
  'SOF',
  'Fire Chief',
  'Wing Safety',
  'MOC',
  'Command Post',
  'ATC',
  'CE',
  'Security',
  'Medical',
]

export default function EmergencyPage() {
  const router = useRouter()
  const [emergencyType, setEmergencyType] = useState('')
  const [runway, setRunway] = useState('')
  const [aircraftType, setAircraftType] = useState('')
  const [callsign, setCallsign] = useState('')
  const [nature, setNature] = useState('')
  const [actions, setActions] = useState<string[]>([])
  const [agencies, setAgencies] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const toggleAction = (action: string) => {
    setActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    )
  }

  const toggleAgency = (agency: string) => {
    setAgencies((prev) =>
      prev.includes(agency) ? prev.filter((a) => a !== agency) : [...prev, agency]
    )
  }

  const handleSubmit = () => {
    if (!emergencyType) {
      toast.error('Please select an emergency type')
      return
    }
    if (!runway) {
      toast.error('Please select a runway')
      return
    }
    toast.success('Emergency response saved (demo)')
    router.push('/checks')
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="Emergency Response" backHref="/checks" />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">Emergency Type</div>
        <select
          className="input-dark"
          value={emergencyType}
          onChange={(e) => setEmergencyType(e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select type...</option>
          {EMERGENCY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="section-label">Runway</div>
        <select
          className="input-dark"
          value={runway}
          onChange={(e) => setRunway(e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select runway...</option>
          {RUNWAYS.map((r) => (
            <option key={r} value={r}>RWY {r}</option>
          ))}
        </select>

        <div className="section-label">Aircraft Type</div>
        <input
          className="input-dark"
          placeholder="e.g. KC-135R"
          value={aircraftType}
          onChange={(e) => setAircraftType(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="section-label">Callsign</div>
        <input
          className="input-dark"
          placeholder="e.g. BOLT 31"
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="section-label">Nature of Emergency</div>
        <input
          className="input-dark"
          placeholder="e.g. Hydraulic failure"
          value={nature}
          onChange={(e) => setNature(e.target.value)}
          style={{ marginBottom: 14 }}
        />
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">AM Action Checklist</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {AM_ACTIONS.map((action) => {
            const checked = actions.includes(action)
            return (
              <button
                key={action}
                type="button"
                onClick={() => toggleAction(action)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: checked ? 'rgba(34, 211, 238, 0.08)' : 'rgba(4, 8, 14, 0.9)',
                  border: `1px solid ${checked ? 'rgba(34, 211, 238, 0.25)' : 'rgba(56, 189, 248, 0.06)'}`,
                  borderRadius: 6,
                  padding: '10px 12px',
                  color: checked ? '#22D3EE' : '#94A3B8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  minHeight: 44,
                  width: '100%',
                }}
              >
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `2px solid ${checked ? '#22D3EE' : '#475569'}`,
                  background: checked ? '#22D3EE' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 10,
                  color: '#0A101C',
                  fontWeight: 800,
                }}>
                  {checked ? '✓' : ''}
                </span>
                {action}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">Agency Notifications</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AGENCIES.map((agency) => {
            const notified = agencies.includes(agency)
            return (
              <button
                key={agency}
                type="button"
                onClick={() => toggleAgency(agency)}
                style={{
                  background: notified ? 'rgba(52, 211, 153, 0.12)' : 'rgba(4, 8, 14, 0.9)',
                  border: `1px solid ${notified ? '#34D399' : 'rgba(56, 189, 248, 0.06)'}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: notified ? '#34D399' : '#64748B',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minHeight: 36,
                }}
              >
                {notified ? '✓ ' : ''}{agency}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">Notes</div>
        <textarea
          className="input-dark"
          placeholder="Outcome, post-incident actions..."
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>

      <button className="btn-primary" onClick={handleSubmit}>
        Save Emergency Response
      </button>
    </div>
  )
}
