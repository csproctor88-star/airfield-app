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
  fontSize: 10,
  fontWeight: 600,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
}

const infoValueStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#CBD5E1',
}

export default function NotamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const notamId = params.id as string

  const notam = DEMO_NOTAMS.find((n) => n.id === notamId)

  if (!notam) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
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
        <div style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
          NOTAM not found.
        </div>
      </div>
    )
  }

  const isLocal = notam.source === 'local'

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
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>
        {notam.notam_number}
      </div>

      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9', marginBottom: 14 }}>
        {notam.title}
      </div>

      {/* Full text in monospace dark box */}
      <div
        style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 12,
          color: '#CBD5E1',
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
              background: 'linear-gradient(135deg, #0EA5E9, #22D3EE)',
              color: '#FFF',
              fontSize: 13,
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
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94A3B8',
              fontSize: 13,
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
