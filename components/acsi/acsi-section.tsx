'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import type { AcsiItemResponse } from '@/lib/supabase/types'

interface AcsiSectionProps {
  title: string
  number: number
  reference: string
  scope?: string
  preamble?: string
  totalItems: number
  responses: Record<string, AcsiItemResponse>
  itemIds: string[]
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function AcsiSection({
  title,
  number,
  reference,
  scope,
  preamble,
  totalItems,
  responses,
  itemIds,
  expanded,
  onToggle,
  children,
}: AcsiSectionProps) {
  const answered = itemIds.filter(id => responses[id] != null).length
  const passCount = itemIds.filter(id => responses[id] === 'pass').length
  const failCount = itemIds.filter(id => responses[id] === 'fail').length
  const naCount = itemIds.filter(id => responses[id] === 'na').length
  const allDone = answered === totalItems && totalItems > 0

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      overflow: 'hidden',
      background: 'var(--color-bg-surface)',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '16px 18px',
          background: allDone ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
          border: 'none',
          borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--color-text-1)',
        }}
      >
        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--fs-lg)',
            fontWeight: 600,
            color: allDone ? '#10B981' : 'var(--color-text-1)',
          }}>
            Section {number} — {title}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
            {reference}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: '#10B981', fontWeight: 600 }}>{passCount} Y</span>
          <span style={{ fontSize: 'var(--fs-xs)', color: '#EF4444', fontWeight: 600 }}>{failCount} N</span>
          <span style={{ fontSize: 'var(--fs-xs)', color: '#6B7280', fontWeight: 600 }}>{naCount} NA</span>
          <span style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
            color: allDone ? '#10B981' : 'var(--color-text-2)',
          }}>
            {answered}/{totalItems}
          </span>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '14px 18px' }}>
          {scope && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 8, fontStyle: 'italic' }}>
              Scope: {scope}
            </div>
          )}
          {preamble && (
            <div style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--color-text-2)',
              marginBottom: 14,
              padding: '10px 14px',
              background: 'var(--color-bg-sunken)',
              borderRadius: 6,
              lineHeight: 1.5,
            }}>
              {preamble}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
