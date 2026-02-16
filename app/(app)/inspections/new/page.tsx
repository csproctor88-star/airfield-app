'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AIRFIELD_INSPECTION_SECTIONS,
  LIGHTING_INSPECTION_SECTIONS,
  BWC_OPTIONS,
  type InspectionType,
  type InspectionSection,
} from '@/lib/constants'

type ItemState = null | 'pass' | 'fail' | 'na'
type BwcValue = null | (typeof BWC_OPTIONS)[number]

export default function NewInspectionPage() {
  const router = useRouter()
  const [inspectionType, setInspectionType] = useState<InspectionType>('airfield')

  // Conditional section toggles (airfield sections 8 & 9)
  const [enabledConditionals, setEnabledConditionals] = useState<Record<string, boolean>>({})

  // Per-item responses keyed by item id
  const [responses, setResponses] = useState<Record<string, ItemState>>({})
  // BWC value for item af-29
  const [bwcValue, setBwcValue] = useState<BwcValue>(null)
  // Per-item comments keyed by item id
  const [comments, setComments] = useState<Record<string, string>>({})

  const sections =
    inspectionType === 'airfield' ? AIRFIELD_INSPECTION_SECTIONS : LIGHTING_INSPECTION_SECTIONS

  // Visible sections — filter out conditional sections that are not enabled
  const visibleSections = useMemo(() => {
    return sections.filter(
      (s) => !s.conditional || enabledConditionals[s.id]
    )
  }, [sections, enabledConditionals])

  // All visible items
  const visibleItems = useMemo(() => {
    return visibleSections.flatMap((s) => s.items)
  }, [visibleSections])

  const totalItems = visibleItems.length
  const answeredCount = visibleItems.filter((item) => {
    if (item.type === 'bwc') return bwcValue !== null
    return responses[item.id] != null
  }).length
  const progress = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0
  const allDone = answeredCount === totalItems && totalItems > 0

  const toggle = (id: string) => {
    setResponses((prev) => {
      const current = prev[id]
      let next: ItemState = null
      if (current === null || current === undefined) next = 'pass'
      else if (current === 'pass') next = 'fail'
      else if (current === 'fail') next = 'na'
      else next = null
      return { ...prev, [id]: next }
    })
  }

  const markAllPass = () => {
    setResponses((prev) => {
      const updated = { ...prev }
      visibleItems.forEach((item) => {
        if (item.type !== 'bwc') {
          updated[item.id] = 'pass'
        }
      })
      return updated
    })
  }

  const toggleConditional = (sectionId: string) => {
    setEnabledConditionals((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  const sectionDoneCount = (section: InspectionSection) =>
    section.items.filter((item) => {
      if (item.type === 'bwc') return bwcValue !== null
      return responses[item.id] != null
    }).length

  const handleSubmit = () => {
    const label = inspectionType === 'airfield' ? 'Airfield inspection' : 'Lighting inspection'
    toast.success(`${label} submitted`, {
      description: `${totalItems} items checked — ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
    })
    setTimeout(() => router.push('/'), 600)
  }

  // Conditional sections that exist but are not yet enabled
  const conditionalSections = sections.filter((s) => s.conditional)

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: '#22D3EE',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 12,
          fontFamily: 'inherit',
        }}
      >
        &larr; Back
      </button>

      {/* Inspection type toggle */}
      <div
        style={{
          display: 'flex',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #334155',
          marginBottom: 16,
        }}
      >
        {(['airfield', 'lighting'] as InspectionType[]).map((type) => (
          <button
            key={type}
            onClick={() => setInspectionType(type)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: inspectionType === type ? '#0EA5E9' : 'transparent',
              color: inspectionType === type ? '#FFF' : '#94A3B8',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            {type === 'airfield' ? 'Airfield Inspection' : 'Lighting Inspection'}
          </button>
        ))}
      </div>

      {/* Header row with progress */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {inspectionType === 'airfield' ? 'Airfield Inspection' : 'Lighting Inspection'}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            {answeredCount}/{totalItems} items
          </div>
        </div>

        {/* Progress ring */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `conic-gradient(#22C55E ${progress * 3.6}deg, #1E293B ${progress * 3.6}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#F1F5F9',
            }}
          >
            {progress}%
          </div>
        </div>
      </div>

      {/* Mark All Pass button */}
      <button
        onClick={markAllPass}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: '1px solid rgba(34,197,94,0.3)',
          background: 'rgba(34,197,94,0.08)',
          color: '#22C55E',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: 16,
        }}
      >
        Mark All Items as Pass
      </button>

      {/* Conditional section toggles (airfield only) */}
      {conditionalSections.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(10,16,28,0.92)',
            border: '1px solid rgba(56,189,248,0.06)',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Optional Sections
          </div>
          {conditionalSections.map((s) => (
            <label
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '6px 0',
              }}
            >
              <input
                type="checkbox"
                checked={!!enabledConditionals[s.id]}
                onChange={() => toggleConditional(s.id)}
                style={{ accentColor: '#0EA5E9', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 12, color: '#CBD5E1' }}>{s.conditional}</span>
            </label>
          ))}
        </div>
      )}

      {/* Sections */}
      {visibleSections.map((section) => {
        const done = sectionDoneCount(section)
        const sectionComplete = done === section.items.length

        return (
          <div key={section.id} style={{ marginBottom: 20 }}>
            {/* Section header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: sectionComplete ? '#22C55E' : '#94A3B8',
                }}
              >
                {section.title}
              </div>
              <div style={{ fontSize: 10, color: '#64748B' }}>
                {done}/{section.items.length}
              </div>
            </div>

            {/* Section guidance */}
            {section.guidance && (
              <div
                style={{
                  fontSize: 10,
                  color: '#64748B',
                  marginBottom: 8,
                  lineHeight: '14px',
                  fontStyle: 'italic',
                }}
              >
                {section.guidance}
              </div>
            )}

            {/* Items */}
            {section.items.map((item) => {
              // BWC item has a special selector
              if (item.type === 'bwc') {
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: '1px solid #1E293B',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, minWidth: 22 }}>
                        {item.itemNumber}.
                      </span>
                      <span style={{ fontSize: 12, color: '#CBD5E1', lineHeight: '18px' }}>
                        {item.item}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, paddingLeft: 30 }}>
                      {BWC_OPTIONS.map((opt) => {
                        const selected = bwcValue === opt
                        const colorMap: Record<string, string> = {
                          LOW: '#22C55E',
                          MOD: '#EAB308',
                          SEV: '#F97316',
                          PROHIB: '#EF4444',
                        }
                        const color = colorMap[opt] || '#94A3B8'
                        return (
                          <button
                            key={opt}
                            onClick={() => setBwcValue(selected ? null : opt)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: `2px solid ${selected ? color : '#334155'}`,
                              background: selected ? `${color}20` : 'transparent',
                              color: selected ? color : '#94A3B8',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all 0.15s',
                            }}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              }

              // Standard pass/fail/na item
              const state = responses[item.id] ?? null
              const borderColor =
                state === 'pass'
                  ? '#22C55E'
                  : state === 'fail'
                    ? '#EF4444'
                    : state === 'na'
                      ? '#64748B'
                      : '#334155'
              const bgColor =
                state === 'pass'
                  ? 'rgba(34,197,94,0.1)'
                  : state === 'fail'
                    ? 'rgba(239,68,68,0.1)'
                    : state === 'na'
                      ? 'rgba(100,116,139,0.1)'
                      : 'transparent'

              return (
                <div key={item.id} style={{ borderBottom: '1px solid #1E293B' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '10px 0',
                    }}
                  >
                    {/* Item number */}
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, minWidth: 22, paddingTop: 5 }}>
                      {item.itemNumber}.
                    </span>

                    {/* Checkbox button */}
                    <button
                      onClick={() => toggle(item.id)}
                      style={{
                        width: 28,
                        height: 28,
                        minWidth: 28,
                        borderRadius: 6,
                        border: `2px solid ${borderColor}`,
                        background: bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                        fontSize: state === 'na' ? 9 : 14,
                        fontWeight: 700,
                        color:
                          state === 'pass'
                            ? '#22C55E'
                            : state === 'fail'
                              ? '#EF4444'
                              : state === 'na'
                                ? '#64748B'
                                : 'transparent',
                        fontFamily: 'inherit',
                      }}
                    >
                      {state === 'pass'
                        ? '\u2713'
                        : state === 'fail'
                          ? '\u2717'
                          : state === 'na'
                            ? 'N/A'
                            : ''}
                    </button>

                    {/* Item text */}
                    <div
                      style={{
                        fontSize: 12,
                        color: state === 'na' ? '#64748B' : '#CBD5E1',
                        lineHeight: '18px',
                        paddingTop: 4,
                        textDecoration: state === 'na' ? 'line-through' : 'none',
                      }}
                    >
                      {item.item}
                    </div>
                  </div>

                  {/* Comment field for failed items */}
                  {state === 'fail' && (
                    <div style={{ paddingLeft: 58, paddingBottom: 10 }}>
                      <textarea
                        placeholder="Describe the discrepancy..."
                        value={comments[item.id] || ''}
                        onChange={(e) =>
                          setComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        rows={2}
                        style={{
                          width: '100%',
                          background: 'rgba(4,8,14,0.9)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          color: '#F1F5F9',
                          fontSize: 11,
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Submit button — only when 100% */}
      {allDone && (
        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #0EA5E9, #22D3EE)',
            color: '#FFF',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 8,
            fontFamily: 'inherit',
          }}
        >
          Submit Inspection
        </button>
      )}
    </div>
  )
}
