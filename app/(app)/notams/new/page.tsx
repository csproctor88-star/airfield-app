'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { NOTAM_TYPES } from '@/lib/constants'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0F172A',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#F1F5F9',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#94A3B8',
  marginBottom: 6,
  display: 'block',
}

export default function NewNotamPage() {
  const router = useRouter()
  const [notamType, setNotamType] = useState('')
  const [title, setTitle] = useState('')
  const [fullText, setFullText] = useState('')
  const [effectiveStart, setEffectiveStart] = useState('')
  const [effectiveEnd, setEffectiveEnd] = useState('')

  const handleSave = () => {
    if (!notamType || !title) {
      toast.error('Type and title are required')
      return
    }
    toast.success('NOTAM draft saved', {
      description: title,
    })
    setTimeout(() => router.push('/notams'), 600)
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: '#22D3EE',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 12,
          fontFamily: 'inherit',
        }}
      >
        ← Back
      </button>

      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Draft NOTAM</div>

      {/* Type select */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Type</label>
        <select
          value={notamType}
          onChange={(e) => setNotamType(e.target.value)}
          style={{
            ...inputStyle,
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="" disabled>
            Select type...
          </option>
          {NOTAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. RWY 01/19 CLSD FOR MAINT"
          style={inputStyle}
        />
      </div>

      {/* Full Text */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Full Text</label>
        <textarea
          value={fullText}
          onChange={(e) => setFullText(e.target.value)}
          placeholder="NOTAM full text..."
          rows={5}
          style={{
            ...inputStyle,
            resize: 'vertical',
          }}
        />
      </div>

      {/* Effective date */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Effective Date</label>
        <input
          type="datetime-local"
          value={effectiveStart}
          onChange={(e) => setEffectiveStart(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Expires date */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Expires Date</label>
        <input
          type="datetime-local"
          value={effectiveEnd}
          onChange={(e) => setEffectiveEnd(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Save Draft button */}
      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 10,
          border: 'none',
          background: 'linear-gradient(135deg, #0EA5E9, #22D3EE)',
          color: '#FFF',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          marginTop: 8,
          fontFamily: 'inherit',
        }}
      >
        Save Draft
      </button>
    </div>
  )
}
