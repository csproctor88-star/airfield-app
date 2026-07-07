'use client'

import { useState } from 'react'
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
  /** Response button labels. Defaults to Y/N/N-A (USAF ACSI); the FAA Part 139 civilian audit passes S/U/N-A. */
  responseLabels?: { pass: string; fail: string; na: string }
  /** CFR sub-paragraph this item audits, shown as a subtle muted suffix next to the item label, e.g. '§139.305(a)(1)'. Civilian (Part 139) only. */
  citation?: string
  /** Inspector guidance, shown in a collapsed-by-default disclosure under the item label. Civilian (Part 139) only. */
  guidance?: string
}

const DEFAULT_RESPONSE_LABELS = { pass: 'Y', fail: 'N', na: 'N/A' }

function ResponseButtons({
  id,
  response,
  onSetResponse,
  responseLabels,
}: {
  id: string
  response: AcsiItemResponse
  onSetResponse: (id: string, value: AcsiItemResponse) => void
  responseLabels: { pass: string; fail: string; na: string }
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0, paddingTop: 2 }}>
      {(['pass', 'fail', 'na'] as const).map((val) => {
        const active = response === val
        const colors: Record<string, { activeBg: string }> = {
          pass: { activeBg: 'var(--color-success)' },
          fail: { activeBg: 'var(--color-danger)' },
          na:   { activeBg: 'var(--color-text-3)' },
        }
        const c = colors[val]

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
            {responseLabels[val]}
          </button>
        )
      })}
    </div>
  )
}

/** Subtle muted CFR-citation suffix rendered next to an item's label. Civilian (Part 139) only. */
function ItemCitation({ citation }: { citation?: string }) {
  if (!citation) return null
  return (
    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}> · {citation}</span>
  )
}

/** Collapsed-by-default inspector-guidance disclosure. Civilian (Part 139) only. */
function GuidanceDisclosure({ guidance }: { guidance?: string }) {
  const [open, setOpen] = useState(false)

  if (!guidance) return null

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--color-cyan)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {open ? '▾ Guidance' : '▸ Guidance'}
      </button>
      {open && (
        <div style={{
          fontSize: 'var(--fs-sm)',
          color: 'var(--color-text-2)',
          marginTop: 6,
          padding: '10px 14px',
          background: 'var(--color-bg-sunken)',
          borderRadius: 6,
          lineHeight: 1.5,
        }}>
          {guidance}
        </div>
      )}
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
  responseLabels = DEFAULT_RESPONSE_LABELS,
  citation,
  guidance,
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
          color: 'var(--color-cyan)',
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
            ? 'color-mix(in srgb, var(--color-danger) 6%, transparent)'
            : isEven
              ? 'color-mix(in srgb, var(--color-text-1) 2%, transparent)'
              : 'color-mix(in srgb, var(--color-text-1) 6%, transparent)',
        }}>
          {subsection && (
            <div style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              color: 'var(--color-cyan)',
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
                <ItemCitation citation={citation} />
              </div>
              <GuidanceDisclosure guidance={guidance} />
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
                        background: subResp === 'fail'
                          ? 'color-mix(in srgb, var(--color-danger) 5%, transparent)'
                          : 'transparent',
                      }}>
                        <div style={{
                          flex: 1,
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--color-text-2)',
                          fontWeight: 500,
                        }}>
                          {sf.label}
                        </div>
                        <ResponseButtons id={subId} response={subResp} onSetResponse={onSetResponse} responseLabels={responseLabels} />
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
          ? 'color-mix(in srgb, var(--color-danger) 6%, transparent)'
          : isEven
            ? 'color-mix(in srgb, var(--color-text-1) 2%, transparent)'
            : 'color-mix(in srgb, var(--color-text-1) 6%, transparent)',
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
              color: 'var(--color-cyan)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 3,
            }}>
              {subsection}
            </div>
          )}
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.5 }}>
            {question}
            <ItemCitation citation={citation} />
          </div>
          <GuidanceDisclosure guidance={guidance} />
        </div>
        <ResponseButtons id={id} response={response} onSetResponse={onSetResponse} responseLabels={responseLabels} />
      </div>
      {response === 'fail' && children}
    </div>
  )
}
