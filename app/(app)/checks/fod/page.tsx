'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { toast } from 'sonner'

const AREAS = ['RWY 01/19', 'TWY A', 'TWY B', 'TWY C', 'Ramp/Apron', 'Full Airfield']

export default function FodCheckPage() {
  const router = useRouter()
  const [area, setArea] = useState('')
  const [leader, setLeader] = useState('')
  const [items, setItems] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    if (!area) {
      toast.error('Please select an area')
      return
    }
    if (!leader.trim()) {
      toast.error('Please enter a team leader')
      return
    }
    toast.success('FOD check saved (demo)')
    router.push('/checks')
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="New FOD Check" backHref="/checks" />

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

        <div className="section-label">Team Leader</div>
        <input
          className="input-dark"
          placeholder="Name / rank"
          value={leader}
          onChange={(e) => setLeader(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="section-label">FOD Items Found</div>
        <textarea
          className="input-dark"
          placeholder="Describe items found (one per line)&#10;e.g. Metal bolt (1/4&quot;) near TWY A"
          rows={4}
          value={items}
          onChange={(e) => setItems(e.target.value)}
          style={{ marginBottom: 14, resize: 'vertical' }}
        />

        <div className="section-label">Notes</div>
        <textarea
          className="input-dark"
          placeholder="Weather, conditions, etc."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ marginBottom: 14, resize: 'vertical' }}
        />

        <button
          type="button"
          onClick={() => toast.success('Camera opened (demo)')}
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: 8,
            padding: '10px',
            color: '#38BDF8',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
            marginBottom: 14,
            minHeight: 44,
          }}
        >
          📸 Capture Photo
        </button>
      </div>

      <button className="btn-primary" onClick={handleSubmit}>
        Save FOD Check
      </button>
    </div>
  )
}
