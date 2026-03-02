'use client'

import { Plus, X } from 'lucide-react'
import type { AcsiTeamMember } from '@/lib/supabase/types'

interface AcsiTeamEditorProps {
  team: AcsiTeamMember[]
  onChange: (team: AcsiTeamMember[]) => void
  readOnly?: boolean
}

export function AcsiTeamEditor({ team, onChange, readOnly }: AcsiTeamEditorProps) {
  const updateMember = (index: number, field: keyof AcsiTeamMember, value: string) => {
    const updated = [...team]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const addMember = () => {
    onChange([
      ...team,
      { id: crypto.randomUUID(), role: 'other', name: '', rank: '', title: '' },
    ])
  }

  const removeMember = (index: number) => {
    // Don't allow removing the 3 required roles
    if (index < 3) return
    const updated = team.filter((_, i) => i !== index)
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
        marginBottom: 12,
      }}>
        Inspection Team Coordination
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {team.map((member, i) => {
          const isRequired = i < 3
          const roleLabels: Record<string, string> = {
            afm: 'Airfield Manager (Required)',
            ce: 'CE Representative (Required)',
            safety: 'Safety (Required)',
          }
          const roleLabel = roleLabels[member.role] || `Additional Member ${i - 2}`

          return (
            <div key={member.id} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '14px 14px',
              background: 'var(--color-bg-sunken)',
              borderRadius: 6,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  color: isRequired ? 'var(--color-accent)' : 'var(--color-text-2)',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {roleLabel}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 8,
                }}>
                  <div>
                    <label style={labelStyle}>Rank</label>
                    <input
                      type="text"
                      value={member.rank}
                      onChange={(e) => updateMember(i, 'rank', e.target.value)}
                      placeholder="Rank"
                      readOnly={readOnly}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(i, 'name', e.target.value)}
                      placeholder="Name"
                      readOnly={readOnly}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Title</label>
                    <input
                      type="text"
                      value={member.title}
                      onChange={(e) => updateMember(i, 'title', e.target.value)}
                      placeholder="Title"
                      readOnly={readOnly}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
              {!readOnly && !isRequired && (
                <button
                  onClick={() => removeMember(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-3)',
                    padding: 4,
                    marginTop: 24,
                  }}
                  title="Remove member"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && (
        <button
          onClick={addMember}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            padding: '8px 14px',
            borderRadius: 6,
            border: '1px dashed var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-2)',
            fontSize: 'var(--fs-sm)',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Member
        </button>
      )}
    </div>
  )
}
