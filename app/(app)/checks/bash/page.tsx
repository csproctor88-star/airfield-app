'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { toast } from 'sonner'

const AREAS = ['RWY 01/19', 'TWY A', 'TWY B', 'TWY C', 'Ramp/Apron', 'Full Airfield']

const CONDITION_CODES = [
  { value: 'LOW', label: 'LOW', color: '#34D399' },
  { value: 'MODERATE', label: 'MODERATE', color: '#FBBF24' },
  { value: 'SEVERE', label: 'SEVERE', color: '#EF4444' },
] as const

export default function BashCheckPage() {
  const router = useRouter()
  const [area, setArea] = useState('')
  const [leader, setLeader] = useState('')
  const [condition, setCondition] = useState('')
  const [species, setSpecies] = useState('')
  const [mitigation, setMitigation] = useState('')
  const [attractants, setAttractants] = useState('')

  const handleSubmit = () => {
    if (!area) {
      toast.error('Please select an area')
      return
    }
    if (!condition) {
      toast.error('Please select a condition code')
      return
    }
    toast.success('BASH assessment saved (demo)')
    router.push('/checks')
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="New BASH Assessment" backHref="/checks" />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">Area</div>
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

        <div className="section-label">Observer</div>
        <input
          className="input-dark"
          placeholder="Name / rank"
          value={leader}
          onChange={(e) => setLeader(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="section-label">Condition Code</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {CONDITION_CODES.map((cc) => (
            <button
              key={cc.value}
              type="button"
              onClick={() => setCondition(cc.value)}
              style={{
                flex: 1,
                background: condition === cc.value ? `${cc.color}22` : 'rgba(4, 8, 14, 0.9)',
                border: `2px solid ${condition === cc.value ? cc.color : 'rgba(56, 189, 248, 0.06)'}`,
                borderRadius: 8,
                padding: '10px 6px',
                color: condition === cc.value ? cc.color : '#64748B',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                minHeight: 44,
              }}
            >
              {cc.label}
            </button>
          ))}
        </div>

        <div className="section-label">Species Observed</div>
        <textarea
          className="input-dark"
          placeholder="Species, count, behavior&#10;e.g. Canada geese (4, grazing N side)"
          rows={3}
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
          style={{ marginBottom: 14, resize: 'vertical' }}
        />

        <div className="section-label">Mitigation Actions</div>
        <input
          className="input-dark"
          placeholder="Actions taken (e.g. Vehicle horn hazed geese)"
          value={mitigation}
          onChange={(e) => setMitigation(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="section-label">Habitat Attractants</div>
        <input
          className="input-dark"
          placeholder="Standing water, food sources, etc."
          value={attractants}
          onChange={(e) => setAttractants(e.target.value)}
          style={{ marginBottom: 14 }}
        />
      </div>

      <button className="btn-primary" onClick={handleSubmit}>
        Save BASH Assessment
      </button>
    </div>
  )
}
