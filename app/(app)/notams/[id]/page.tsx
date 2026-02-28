'use client'

import { useRouter, useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DEMO_NOTAMS } from '@/lib/demo-data'

const SOURCE_COLORS: Record<string, string> = {
  faa: '#22D3EE',
  local: '#A78BFA',
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22C55E',
  expired: '#64748B',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const infoLabelStyle: React.CSSProperties = {
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  color: 'var(--color-text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
}

const infoValueStyle: React.CSSProperties = {
  fontSize: 'var(--fs-md)',
  fontWeight: 600,
  color: 'var(--color-text-1)',
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
            background: 'none',
            border: 'none',
            color: 'var(--color-cyan)',
            fontSize: 'var(--fs-md)',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 12,
            fontFamily: 'inherit',
          }}
        >
          ← Back
        </button>
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
          NOTAM not found.
        </div>
      </div>
    )
  }

  const isLocal = notam.source === 'local'

  return (
    <div className="page-container">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-cyan)',
          fontSize: 'var(--fs-md)',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 12,
          fontFamily: 'inherit',
        }}
      >
        ← Back
      </button>

      {/* Source + status badges */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <Badge
          label={notam.source.toUpperCase()}
          color={SOURCE_COLORS[notam.source] || '#94A3B8'}
        />
        <Badge
          label={notam.status.toUpperCase()}
          color={STATUS_COLORS[notam.status] || '#94A3B8'}
        />
      </div>

      {/* NOTAM number */}
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', marginBottom: 4 }}>
        {notam.notam_number}
      </div>

      {/* Title */}
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>
        {notam.title}
      </div>

      {/* Full text in monospace dark box */}
      <div
        style={{
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid var(--color-bg-elevated)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 'var(--fs-md)',
          color: 'var(--color-text-1)',
          lineHeight: '20px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {notam.full_text}
      </div>

      {/* Info grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={infoLabelStyle}>Type</div>
          <div style={infoValueStyle}>{notam.notam_type}</div>
        </div>
        <div>
          <div style={infoLabelStyle}>Source</div>
          <div style={infoValueStyle}>{notam.source.toUpperCase()}</div>
        </div>
        <div>
          <div style={infoLabelStyle}>Effective</div>
          <div style={infoValueStyle}>{formatDate(notam.effective_start)}</div>
        </div>
        <div>
          <div style={infoLabelStyle}>Expires</div>
          <div style={infoValueStyle}>{formatDate(notam.effective_end)}</div>
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
            }}
          >
            Edit
          </button>
          <button
            onClick={() => router.push('/notams')}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 10,
              border: '1px solid var(--color-text-4)',
              background: 'transparent',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-lg)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
