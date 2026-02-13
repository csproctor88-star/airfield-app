'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DAILY_INSPECTION_ITEMS } from '@/lib/constants'

type ItemState = null | 'pass' | 'fail'

export default function NewInspectionPage() {
  const router = useRouter()
  const [responses, setResponses] = useState<Record<string, ItemState>>(() => {
    const init: Record<string, ItemState> = {}
    DAILY_INSPECTION_ITEMS.forEach((item) => {
      init[item.id] = null
    })
    return init
  })

  const toggle = (id: string) => {
    setResponses((prev) => {
      const current = prev[id]
      let next: ItemState = null
      if (current === null) next = 'pass'
      else if (current === 'pass') next = 'fail'
      else next = null
      return { ...prev, [id]: next }
    })
  }

  const totalItems = DAILY_INSPECTION_ITEMS.length
  const answeredCount = Object.values(responses).filter((v) => v !== null).length
  const progress = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0
  const allDone = answeredCount === totalItems

  // Group items by section
  const sections = useMemo(() => {
    const map = new Map<string, typeof DAILY_INSPECTION_ITEMS[number][]>()
    DAILY_INSPECTION_ITEMS.forEach((item) => {
      const list = map.get(item.section) || []
      list.push(item)
      map.set(item.section, list)
    })
    return Array.from(map.entries())
  }, [])

  const sectionDoneCount = (sectionItems: typeof DAILY_INSPECTION_ITEMS[number][]) =>
    sectionItems.filter((item) => responses[item.id] !== null).length

  const handleSubmit = () => {
    toast.success('Daily inspection submitted', {
      description: `${totalItems} items checked — ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
    })
    setTimeout(() => router.push('/'), 600)
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
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 12,
          fontFamily: 'inherit',
        }}
      >
        ← Back
      </button>

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Daily Inspection</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            DAFI 13-213 &bull; {answeredCount}/{totalItems} items
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

      {/* Sections */}
      {sections.map(([sectionName, sectionItems]) => {
        const done = sectionDoneCount(sectionItems)
        const sectionComplete = done === sectionItems.length

        return (
          <div key={sectionName} style={{ marginBottom: 16 }}>
            {/* Section header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: sectionComplete ? '#22C55E' : '#94A3B8',
                }}
              >
                {sectionName}
              </div>
              <div style={{ fontSize: 10, color: '#64748B' }}>
                {done}/{sectionItems.length}
              </div>
            </div>

            {/* Items */}
            {sectionItems.map((item) => {
              const state = responses[item.id]
              const borderColor =
                state === 'pass' ? '#22C55E' : state === 'fail' ? '#EF4444' : '#334155'
              const bgColor =
                state === 'pass'
                  ? 'rgba(34,197,94,0.1)'
                  : state === 'fail'
                    ? 'rgba(239,68,68,0.1)'
                    : 'transparent'

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom: '1px solid #1E293B',
                  }}
                >
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
                      fontSize: 14,
                      fontWeight: 700,
                      color: state === 'pass' ? '#22C55E' : state === 'fail' ? '#EF4444' : 'transparent',
                      fontFamily: 'inherit',
                    }}
                  >
                    {state === 'pass' ? '✓' : state === 'fail' ? '✗' : ''}
                  </button>

                  {/* Item text */}
                  <div style={{ fontSize: 12, color: '#CBD5E1', lineHeight: '18px', paddingTop: 4 }}>
                    {item.item}
                  </div>
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
