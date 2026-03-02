'use client'

import type { AcsiSignatureBlock } from '@/lib/supabase/types'

interface AcsiRiskCertProps {
  signatures: AcsiSignatureBlock[]
  onChange: (signatures: AcsiSignatureBlock[]) => void
  readOnly?: boolean
}

const CERT_TEXT = 'I have reviewed the results of the Airfield Compliance and Safety Inspection and have determined it to be accurate and the deficiencies noted have acceptable risk control measures and determined to be the minimum acceptable risk.'

export function AcsiRiskCert({ signatures, onChange, readOnly }: AcsiRiskCertProps) {
  const updateSig = (index: number, field: keyof AcsiSignatureBlock, value: string) => {
    const updated = [...signatures]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: readOnly ? 'transparent' : 'var(--color-bg-input)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-sm)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    color: 'var(--color-text-3)',
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: 16,
      background: 'var(--color-bg-surface)',
    }}>
      <div style={{
        fontSize: 'var(--fs-lg)',
        fontWeight: 600,
        color: 'var(--color-text-1)',
        marginBottom: 14,
      }}>
        Risk Management Certification
      </div>

      {/* Certification statement */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--color-bg-sunken)',
        borderRadius: 6,
        marginBottom: 16,
        fontSize: 'var(--fs-sm)',
        color: 'var(--color-text-2)',
        lineHeight: 1.5,
        fontStyle: 'italic',
        borderLeft: '3px solid var(--color-accent)',
      }}>
        &ldquo;{CERT_TEXT}&rdquo;
      </div>

      {/* Reviewed by heading */}
      <div style={{
        fontSize: 'var(--fs-sm)',
        fontWeight: 700,
        color: 'var(--color-text-2)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 12,
      }}>
        Reviewed By
      </div>

      {/* Reviewer blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {signatures.map((sig, i) => (
          <div key={i} style={{
            padding: '12px 14px',
            background: 'var(--color-bg-sunken)',
            borderRadius: 6,
          }}>
            {/* Editable role label */}
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Role / Position</label>
              <input
                type="text"
                value={sig.label || ''}
                onChange={(e) => updateSig(i, 'label', e.target.value)}
                placeholder="e.g. OG/CC, MSG/CC, WG/CC"
                readOnly={readOnly}
                style={{ ...inputStyle, fontWeight: 700, fontSize: 'var(--fs-sm)' }}
              />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
            }}>
              <div>
                <label style={labelStyle}>Organization</label>
                <input
                  type="text"
                  value={sig.organization}
                  onChange={(e) => updateSig(i, 'organization', e.target.value)}
                  placeholder="e.g. 127 OG"
                  readOnly={readOnly}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Rank</label>
                <input
                  type="text"
                  value={sig.rank}
                  onChange={(e) => updateSig(i, 'rank', e.target.value)}
                  placeholder="Rank"
                  readOnly={readOnly}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  value={sig.name}
                  onChange={(e) => updateSig(i, 'name', e.target.value)}
                  placeholder="Name"
                  readOnly={readOnly}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Title</label>
                <input
                  type="text"
                  value={sig.title}
                  onChange={(e) => updateSig(i, 'title', e.target.value)}
                  placeholder="Title"
                  readOnly={readOnly}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
