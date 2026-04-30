'use client'

import { useRouter, useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DEMO_NOTAMS } from '@/lib/demo-data'
import { formatZuluDateTime } from '@/lib/utils'
import { ArrowLeft, Megaphone, Pencil, X } from 'lucide-react'

const SOURCE_COLORS: Record<string, string> = {
  faa: 'var(--color-cyan)',
  local: 'var(--color-purple)',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--color-success)',
  expired: 'var(--color-text-3)',
}

function formatDate(iso: string) {
  return formatZuluDateTime(new Date(iso))
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 'var(--fs-2xs)',
  fontWeight: 600,
  color: 'var(--color-text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 2,
}

const TILE_VALUE: React.CSSProperties = {
  fontSize: 'var(--fs-md)',
  fontWeight: 500,
  color: 'var(--color-text-1)',
  lineHeight: 1.3,
}

export default function NotamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const notamId = params.id as string

  const notam = DEMO_NOTAMS.find((n) => n.id === notamId)

  if (!notam) {
    return (
      <div className="page-container">
        <button
          onClick={() => router.back()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: 0,
            marginBottom: 12, fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
          NOTAM not found.
        </div>
      </div>
    )
  }

  const isLocal = notam.source === 'local'
  const isExpired = notam.status === 'expired'
  const ruleColor = isExpired ? 'var(--color-text-4)' : (isLocal ? 'var(--color-purple)' : 'var(--color-cyan)')

  return (
    <div className="page-container">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: 0,
          marginBottom: 12, fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Page header — tertiary tier label + accent rule, color tracks
          source (cyan = FAA, purple = LOCAL) so the eye lands on the
          source before the body text. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, paddingBottom: 8, marginBottom: 14,
        borderBottom: `1px solid color-mix(in srgb, ${ruleColor} 35%, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Megaphone size={16} color={ruleColor} />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>NOTAM Detail</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Badge
            label={notam.source.toUpperCase()}
            color={SOURCE_COLORS[notam.source] || 'var(--color-text-3)'}
          />
          <Badge
            label={notam.status.toUpperCase()}
            color={STATUS_COLORS[notam.status] || 'var(--color-text-3)'}
          />
        </div>
      </div>

      {/* NOTAM number */}
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontFamily: 'monospace', marginBottom: 4 }}>
        {notam.notam_number}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)',
        marginBottom: 14, lineHeight: 1.3,
      }}>
        {notam.title}
      </div>

      {/* Full text in monospace dark box */}
      <div
        style={{
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid var(--color-border)',
          borderLeft: `3px solid ${ruleColor}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          marginBottom: 16,
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 'var(--fs-md)',
          color: 'var(--color-text-1)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {notam.full_text}
      </div>

      {/* Info grid — bordered tiles match the discrepancy detail
          recipe: tiny dim uppercase label, weight-500 value. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 20,
        }}
      >
        <div style={tileStyle}>
          <div style={SECTION_LABEL}>Type</div>
          <div style={TILE_VALUE}>{notam.notam_type}</div>
        </div>
        <div style={tileStyle}>
          <div style={SECTION_LABEL}>Source</div>
          <div style={TILE_VALUE}>{notam.source.toUpperCase()}</div>
        </div>
        <div style={tileStyle}>
          <div style={SECTION_LABEL}>Effective</div>
          <div style={TILE_VALUE}>{formatDate(notam.effective_start)}</div>
        </div>
        <div style={tileStyle}>
          <div style={SECTION_LABEL}>Expires</div>
          <div style={TILE_VALUE}>{formatDate(notam.effective_end)}</div>
        </div>
      </div>

      {/* Edit + Cancel buttons — only for LOCAL source */}
      {isLocal && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => router.push(`/notams/new`)}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, var(--color-accent-secondary), var(--color-cyan))',
              color: '#FFF',
              fontSize: 'var(--fs-lg)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Pencil size={16} /> Edit
          </button>
          <button
            onClick={() => router.push('/notams')}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-lg)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <X size={16} /> Cancel
          </button>
        </div>
      )}
    </div>
  )
}

const tileStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-bg-inset)',
  borderLeft: '2px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
}
