'use client'

import { ACSI_SUB_FIELD_LABELS } from '@/lib/constants'
import type { AcsiItemResponse } from '@/lib/supabase/types'

interface AcsiItemProps {
  id: string
  itemNumber: string
  question: string
  subsection?: string
  response: AcsiItemResponse
  onSetResponse: (id: string, value: AcsiItemResponse) => void
  index: number
  children?: React.ReactNode
  /** If true, item has A/B/C sub-fields */
  hasSubFields?: boolean
  /** Sub-field responses keyed by `{id}.a`, `{id}.b`, `{id}.c` */
  subFieldResponses?: Record<string, AcsiItemResponse>
  /** Render children for a specific sub-field (called with sub-field id) */
  renderSubFieldChildren?: (subId: string) => React.ReactNode
  /** Non-answerable heading row */
  isHeading?: boolean
}

function ResponseButtons({
  id,
  response,
  onSetResponse,
}: {
  id: string
  response: AcsiItemResponse
  onSetResponse: (id: string, value: AcsiItemResponse) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0, paddingTop: 2 }}>
      {(['pass', 'fail', 'na'] as const).map((val) => {
        const active = response === val
        const colors: Record<string, { activeBg: string }> = {
          pass: { activeBg: '#10B981' },
          fail: { activeBg: '#EF4444' },
          na:   { activeBg: '#6B7280' },
        }
        const c = colors[val]
        const labels: Record<string, string> = { pass: 'Y', fail: 'N', na: 'N/A' }

        return (
          <button
            key={val}
            onClick={() => onSetResponse(id, active ? null : val)}
            style={{
              padding: '6px 12px',
              borderRadius: 5,
              border: active ? 'none' : '1px solid var(--color-border)',
              background: active ? c.activeBg : 'transparent',
              color: active ? '#fff' : 'var(--color-text-3)',
              fontSize: 'var(--fs-base)',
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: val === 'na' ? 40 : 34,
              textAlign: 'center' as const,
              transition: 'background 0.1s, color 0.1s',
            }}
          >
            {labels[val]}
          </button>
        )
      })}
    </div>
  )
}

export function AcsiItem({
  id,
  itemNumber,
  question,
  subsection,
  response,
  onSetResponse,
  index,
  children,
  hasSubFields,
  subFieldResponses,
  renderSubFieldChildren,
  isHeading,
}: AcsiItemProps) {
  const isEven = index % 2 === 0

  // Non-answerable heading
  if (isHeading) {
    return (
      <div style={{
        padding: '10px 10px',
        background: 'var(--color-bg-sunken)',
        borderRadius: 6,
        marginTop: 4,
        marginBottom: 4,
      }}>
        <div style={{
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          color: 'var(--color-accent)',
          lineHeight: 1.5,
        }}>
          {question}
        </div>
      </div>
    )
  }

  // Item with A/B/C sub-fields
  if (hasSubFields) {
    const anyFail = ACSI_SUB_FIELD_LABELS.some(
      sf => (subFieldResponses?.[`${id}.${sf.key}`]) === 'fail'
    )

    return (
      <div>
        <div style={{
          padding: '12px 10px',
          borderRadius: 6,
          background: anyFail
            ? 'rgba(239, 68, 68, 0.06)'
            : isEven ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
        }}>
          {subsection && (
            <div style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 3,
              paddingLeft: 60,
            }}>
              {subsection}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              fontSize: 'var(--fs-base)',
              fontWeight: 700,
              color: 'var(--color-text-3)',
              minWidth: 64,
              paddingTop: 2,
            }}>
              {itemNumber}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.5, marginBottom: 8 }}>
                {question}
              </div>
              {/* A/B/C sub-fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 28 }}>
                {ACSI_SUB_FIELD_LABELS.map(sf => {
                  const subId = `${id}.${sf.key}`
                  const subResp = subFieldResponses?.[subId] ?? null
                  return (
                    <div key={sf.key}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: subResp === 'fail' ? 'rgba(239,68,68,0.05)' : 'transparent',
                      }}>
                        <div style={{
                          flex: 1,
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--color-text-2)',
                          fontWeight: 500,
                        }}>
                          {sf.label}
                        </div>
                        <ResponseButtons id={subId} response={subResp} onSetResponse={onSetResponse} />
                      </div>
                      {subResp === 'fail' && renderSubFieldChildren?.(subId)}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Standard item
  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 10px',
        borderRadius: 6,
        background: response === 'fail'
          ? 'rgba(239, 68, 68, 0.06)'
          : isEven ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
      }}>
        <div style={{
          fontSize: 'var(--fs-base)',
          fontWeight: 700,
          color: 'var(--color-text-3)',
          minWidth: 64,
          paddingTop: 2,
        }}>
          {itemNumber}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {subsection && (
            <div style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 3,
            }}>
              {subsection}
            </div>
          )}
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.5 }}>
            {question}
          </div>
        </div>
        <ResponseButtons id={id} response={response} onSetResponse={onSetResponse} />
      </div>
      {response === 'fail' && children}
    </div>
  )
}
