'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { toast } from 'sonner'

const AREAS = ['RWY 01/19', 'TWY A', 'TWY B', 'TWY C']
const CONTAMINANTS = ['Frost', 'Ice', 'Snow (Dry)', 'Snow (Wet)', 'Slush', 'Standing Water', 'Mud/Sand']
const TREATMENTS = ['KAc (Potassium Acetate)', 'NaAc (Sodium Acetate)', 'Sand', 'Plowing', 'Brooming', 'None']
const BRAKING_ACTIONS = ['Good', 'Good to Medium', 'Medium', 'Medium to Poor', 'Poor', 'Nil']

export default function RscCheckPage() {
  const router = useRouter()
  const [area, setArea] = useState('')
  const [contaminant, setContaminant] = useState('')
  const [depth, setDepth] = useState('')
  const [coverage, setCoverage] = useState('')
  const [treatment, setTreatment] = useState('')
  const [brakingAction, setBrakingAction] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    if (!area) {
      toast.error('Please select an area')
      return
    }
    if (!contaminant) {
      toast.error('Please select a contaminant')
      return
    }
    toast.success('RSC report saved (demo)')
    router.push('/checks')
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="New RSC Report" backHref="/checks" />

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

        <div className="section-label">Contaminant</div>
        <select
          className="input-dark"
          value={contaminant}
          onChange={(e) => setContaminant(e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select contaminant...</option>
          {CONTAMINANTS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div>
            <div className="section-label">Depth (inches)</div>
            <input
              className="input-dark"
              type="number"
              placeholder="0.0"
              step="0.1"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
            />
          </div>
          <div>
            <div className="section-label">Coverage (%)</div>
            <input
              className="input-dark"
              type="number"
              placeholder="0-100"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
            />
          </div>
        </div>

        <div className="section-label">Treatment Applied</div>
        <select
          className="input-dark"
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select treatment...</option>
          {TREATMENTS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="section-label">Braking Action</div>
        <select
          className="input-dark"
          value={brakingAction}
          onChange={(e) => setBrakingAction(e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select braking action...</option>
          {BRAKING_ACTIONS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

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
        Save RSC Report
      </button>
    </div>
  )
}
