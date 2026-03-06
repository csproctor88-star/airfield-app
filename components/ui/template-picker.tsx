'use client'

import { useState, useEffect, useMemo } from 'react'
import { ACTIVITY_TEMPLATES, type ActivityTemplate, type TemplateCategory } from '@/lib/activity-templates'

const INITIALS_KEY = 'glidepath_user_initials'

function getStoredInitials(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(INITIALS_KEY) || ''
}

function storeInitials(val: string) {
  if (typeof window !== 'undefined' && val.trim()) {
    localStorage.setItem(INITIALS_KEY, val.trim())
  }
}

function assembleText(template: ActivityTemplate, values: Record<string, string>): string {
  let text = template.text
  for (const field of template.fields) {
    const val = values[field.key] || ''
    text = text.replace(`{${field.key}}`, val)
  }
  return text
}

export function TemplatePicker({ onSubmit, onClose }: { onSubmit: (text: string) => Promise<void> | void; onClose: () => void }) {
  const [selectedCat, setSelectedCat] = useState<string>(ACTIVITY_TEMPLATES[0].category)
  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Init field defaults when template is selected
  useEffect(() => {
    if (!selectedTemplate) return
    const defaults: Record<string, string> = {}
    const storedInitials = getStoredInitials()
    for (const f of selectedTemplate.fields) {
      if (f.key === 'initials') {
        defaults[f.key] = storedInitials || f.default || ''
      } else if (f.type === 'toggle-list' && f.options) {
        defaults[f.key] = f.options.join(' / ')
      } else {
        defaults[f.key] = f.default || ''
      }
    }
    setValues(defaults)
  }, [selectedTemplate])

  const currentCat = ACTIVITY_TEMPLATES.find(c => c.category === selectedCat)

  const preview = useMemo(() => {
    if (!selectedTemplate) return ''
    return assembleText(selectedTemplate, values)
  }, [selectedTemplate, values])

  async function handleSubmit() {
    if (!selectedTemplate || !preview.trim() || submitting) return
    const initialsVal = values['initials']
    if (initialsVal) storeInitials(initialsVal)
    setSubmitting(true)
    try {
      await onSubmit(preview)
    } finally {
      setSubmitting(false)
    }
  }

  function handleToggle(fieldKey: string, option: string) {
    const current = values[fieldKey] || ''
    const parts = current.split(' / ').filter(Boolean)
    const idx = parts.indexOf(option)
    if (idx >= 0) {
      parts.splice(idx, 1)
    } else {
      // Re-add in original order
      const field = selectedTemplate?.fields.find(f => f.key === fieldKey)
      const allOpts = field?.options || []
      const newParts = allOpts.filter(o => o === option || parts.includes(o))
      setValues(prev => ({ ...prev, [fieldKey]: newParts.join(' / ') }))
      return
    }
    setValues(prev => ({ ...prev, [fieldKey]: parts.join(' / ') }))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-base)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    color: 'var(--color-text-2)',
    marginBottom: 4,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {selectedTemplate ? selectedTemplate.label : 'Log Entry Templates'}
          </div>
          {selectedTemplate && (
            <button
              onClick={() => setSelectedTemplate(null)}
              style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Back to Templates
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {!selectedTemplate ? (
            /* Category + Template List */
            <div style={{ display: 'flex', minHeight: 300 }}>
              {/* Category sidebar */}
              <div style={{
                width: 200, flexShrink: 0, borderRight: '1px solid var(--color-border)',
                overflowY: 'auto', padding: '8px 0',
              }}>
                {ACTIVITY_TEMPLATES.map(cat => (
                  <button
                    key={cat.category}
                    onClick={() => setSelectedCat(cat.category)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 16px', border: 'none', cursor: 'pointer',
                      background: selectedCat === cat.category ? 'var(--color-accent-glow)' : 'transparent',
                      color: selectedCat === cat.category ? 'var(--color-accent)' : 'var(--color-text-2)',
                      fontSize: 'var(--fs-sm)', fontWeight: selectedCat === cat.category ? 700 : 500,
                      fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {cat.category}
                  </button>
                ))}
              </div>

              {/* Template list */}
              <div style={{ flex: 1, padding: '8px 16px', overflowY: 'auto' }}>
                {currentCat?.templates.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedTemplate(t)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 12px', marginBottom: 6, borderRadius: 8,
                      border: '1px solid var(--color-border)', cursor: 'pointer',
                      background: 'var(--color-bg-surface)', fontFamily: 'inherit',
                      color: 'var(--color-text-1)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, marginBottom: 2 }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.text}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Field form */
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedTemplate.fields.filter(f => f.key !== 'initials').map(f => (
                  <div key={f.key}>
                    <div style={labelStyle}>{f.label}</div>
                    {f.type === 'toggle-list' && f.options ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {f.options.map(opt => {
                          const active = (values[f.key] || '').split(' / ').includes(opt)
                          return (
                            <button
                              key={opt}
                              onClick={() => handleToggle(f.key, opt)}
                              style={{
                                padding: '6px 14px', borderRadius: 8, fontFamily: 'inherit',
                                fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
                                border: active ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
                                background: active ? 'rgba(34,211,238,0.12)' : 'var(--color-bg-surface)',
                                color: active ? 'var(--color-cyan)' : 'var(--color-text-3)',
                              }}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        value={values[f.key] || ''}
                        onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    ) : (
                      <input
                        value={values[f.key] || ''}
                        onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
                {/* Initials field always at bottom */}
                {selectedTemplate.fields.some(f => f.key === 'initials') && (
                  <div>
                    <div style={labelStyle}>Initials</div>
                    <input
                      value={values['initials'] || ''}
                      onChange={e => setValues(prev => ({ ...prev, initials: e.target.value }))}
                      style={{ ...inputStyle, maxWidth: 120 }}
                    />
                  </div>
                )}
              </div>

              {/* Preview */}
              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-cyan)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Preview
                </div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {preview || '—'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {selectedTemplate ? (
            <>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: submitting ? 'rgba(6,182,212,0.5)' : 'var(--color-cyan)', color: '#000',
                  fontSize: 'var(--fs-base)', fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {submitting ? 'Logging...' : 'Add to Log'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 20px', borderRadius: 8,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-2)', fontSize: 'var(--fs-base)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: '8px 20px', borderRadius: 8,
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text-2)', fontSize: 'var(--fs-base)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
