'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Pencil, Trash2, Plus, RotateCcw } from 'lucide-react'
import { ACTIVITY_TEMPLATES, type ActivityTemplate, type TemplateCategory, type TemplateField } from '@/lib/activity-templates'
import { toast } from 'sonner'

function assembleText(template: ActivityTemplate, values: Record<string, string>): string {
  let text = template.text
  for (const field of template.fields) {
    const val = values[field.key] || ''
    text = text.replace(`{${field.key}}`, val)
  }
  return text
}

/** Deep-clone templates to avoid mutating the default constant */
function cloneTemplates(cats: TemplateCategory[]): TemplateCategory[] {
  return JSON.parse(JSON.stringify(cats))
}

/** Extract {placeholder} keys from a template text string */
function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{([^}]+)\}/g)
  if (!matches) return []
  return matches.map(m => m.slice(1, -1))
}

interface Props {
  onSubmit: (text: string) => Promise<void> | void
  onClose: () => void
  /** Whether this user can edit templates (admin/base_admin/sys_admin) */
  isAdmin?: boolean
  /** Installation ID for saving custom templates */
  installationId?: string | null
  /** Custom templates loaded from DB (pass null/undefined for defaults) */
  customTemplates?: TemplateCategory[] | null
  /** Callback after templates are saved to DB */
  onTemplatesSaved?: (templates: TemplateCategory[]) => void
}

export function TemplatePicker({ onSubmit, onClose, isAdmin, installationId, customTemplates, onTemplatesSaved }: Props) {
  // Use custom templates if provided, otherwise hardcoded defaults
  const [templates, setTemplates] = useState<TemplateCategory[]>(
    () => customTemplates ? cloneTemplates(customTemplates) : cloneTemplates(ACTIVITY_TEMPLATES)
  )
  const [selectedCat, setSelectedCat] = useState<string>(templates[0]?.category || '')
  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Edit mode state
  const [editingIdx, setEditingIdx] = useState<number | null>(null) // index in current category
  const [editLabel, setEditLabel] = useState('')
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Init field defaults when template is selected
  useEffect(() => {
    if (!selectedTemplate) return
    const defaults: Record<string, string> = {}
    for (const f of selectedTemplate.fields) {
      if (f.type === 'toggle-list' && f.options) {
        defaults[f.key] = f.options.join(' / ')
      } else {
        defaults[f.key] = f.default || ''
      }
    }
    setValues(defaults)
  }, [selectedTemplate])

  const currentCat = templates.find(c => c.category === selectedCat)
  const currentCatIdx = templates.findIndex(c => c.category === selectedCat)

  const preview = useMemo(() => {
    if (!selectedTemplate) return ''
    return assembleText(selectedTemplate, values)
  }, [selectedTemplate, values])

  async function handleSubmit() {
    if (!selectedTemplate || !preview.trim() || submitting) return
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
      const field = selectedTemplate?.fields.find(f => f.key === fieldKey)
      const allOpts = field?.options || []
      const newParts = allOpts.filter(o => o === option || parts.includes(o))
      setValues(prev => ({ ...prev, [fieldKey]: newParts.join(' / ') }))
      return
    }
    setValues(prev => ({ ...prev, [fieldKey]: parts.join(' / ') }))
  }

  // ── Edit helpers ──

  function startEdit(templateIdx: number) {
    if (!currentCat) return
    const t = currentCat.templates[templateIdx]
    setEditingIdx(templateIdx)
    setEditLabel(t.label)
    setEditText(t.text)
  }

  function cancelEdit() {
    setEditingIdx(null)
    setEditLabel('')
    setEditText('')
  }

  function applyEdit() {
    if (editingIdx === null || currentCatIdx < 0) return
    const updated = cloneTemplates(templates)
    const tmpl = updated[currentCatIdx].templates[editingIdx]
    tmpl.label = editLabel.trim() || tmpl.label
    tmpl.text = editText.trim() || tmpl.text
    // Rebuild fields from placeholders in the text
    const placeholders = extractPlaceholders(tmpl.text)
    const existingFields = new Map(tmpl.fields.map(f => [f.key, f]))
    const newFields: TemplateField[] = placeholders.map(key => {
      if (existingFields.has(key)) return existingFields.get(key)!
      return { key, label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') }
    })
    // Ensure unique keys
    const seen = new Set<string>()
    tmpl.fields = newFields.filter(f => {
      if (seen.has(f.key)) return false
      seen.add(f.key)
      return true
    })
    setTemplates(updated)
    setEditingIdx(null)
    setHasChanges(true)
  }

  function deleteTemplate(templateIdx: number) {
    if (currentCatIdx < 0) return
    if (!confirm('Delete this template?')) return
    const updated = cloneTemplates(templates)
    updated[currentCatIdx].templates.splice(templateIdx, 1)
    // Remove empty categories
    if (updated[currentCatIdx].templates.length === 0) {
      updated.splice(currentCatIdx, 1)
      setSelectedCat(updated[0]?.category || '')
    }
    setTemplates(updated)
    setHasChanges(true)
  }

  function addTemplate() {
    if (currentCatIdx < 0) return
    const updated = cloneTemplates(templates)
    updated[currentCatIdx].templates.push({
      label: 'New Template',
      text: '{details}...{initials}',
      fields: [
        { key: 'details', label: 'Details' },
        { key: 'initials', label: 'Initials' },
      ],
    })
    setTemplates(updated)
    setHasChanges(true)
    // Start editing the new template
    startEdit(updated[currentCatIdx].templates.length - 1)
  }

  function addCategory() {
    const name = prompt('New category name:')
    if (!name?.trim()) return
    const updated = cloneTemplates(templates)
    updated.push({
      category: name.trim(),
      templates: [{
        label: 'New Template',
        text: '{details}...{initials}',
        fields: [
          { key: 'details', label: 'Details' },
          { key: 'initials', label: 'Initials' },
        ],
      }],
    })
    setTemplates(updated)
    setSelectedCat(name.trim())
    setHasChanges(true)
  }

  function resetToDefaults() {
    if (!confirm('Reset all templates to defaults? Custom changes will be lost.')) return
    setTemplates(cloneTemplates(ACTIVITY_TEMPLATES))
    setSelectedCat(ACTIVITY_TEMPLATES[0]?.category || '')
    setEditingIdx(null)
    setHasChanges(true)
  }

  const handleSaveTemplates = useCallback(async () => {
    if (!installationId) return
    setSaving(true)
    try {
      const { saveCustomActivityTemplates } = await import('@/lib/supabase/activity-templates')
      const { error } = await saveCustomActivityTemplates(installationId, templates)
      if (error) {
        toast.error(`Failed to save: ${error}`)
      } else {
        toast.success('Templates saved')
        setHasChanges(false)
        onTemplatesSaved?.(templates)
      }
    } finally {
      setSaving(false)
    }
  }, [installationId, templates, onTemplatesSaved])

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedTemplate && (
              <button
                onClick={() => setSelectedTemplate(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Back to Templates
              </button>
            )}
          </div>
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
                {templates.map(cat => (
                  <button
                    key={cat.category}
                    onClick={() => { setSelectedCat(cat.category); cancelEdit() }}
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
                {isAdmin && (
                  <button
                    onClick={addCategory}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, width: '100%', textAlign: 'left',
                      padding: '8px 16px', border: 'none', cursor: 'pointer',
                      background: 'transparent', color: 'var(--color-text-4)',
                      fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >
                    <Plus size={12} /> Add Category
                  </button>
                )}
              </div>

              {/* Template list */}
              <div style={{ flex: 1, padding: '8px 16px', overflowY: 'auto' }}>
                {currentCat?.templates.map((t, i) => (
                  editingIdx === i ? (
                    /* Inline edit form */
                    <div
                      key={i}
                      style={{
                        padding: '10px 12px', marginBottom: 6, borderRadius: 8,
                        border: '2px solid var(--color-cyan)', background: 'var(--color-bg-surface)',
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>Label</div>
                        <input
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>
                          Template Text
                          <span style={{ fontWeight: 400, marginLeft: 6, color: 'var(--color-text-4)' }}>
                            Use {'{field_name}'} for placeholders
                          </span>
                        </div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={3}
                          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 'var(--fs-sm)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={applyEdit}
                          style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none',
                            background: 'var(--color-cyan)', color: '#000',
                            fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Apply
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{
                            padding: '6px 14px', borderRadius: 6,
                            border: '1px solid var(--color-border)', background: 'transparent',
                            color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal template button */
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <button
                        onClick={() => setSelectedTemplate(t)}
                        style={{
                          flex: 1, display: 'block', textAlign: 'left',
                          padding: '10px 12px', borderRadius: 8,
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
                      {isAdmin && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => startEdit(i)}
                            title="Edit template"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--color-text-3)', padding: 4, borderRadius: 4,
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteTemplate(i)}
                            title="Delete template"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--color-text-4)', padding: 4, borderRadius: 4,
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ))}
                {isAdmin && (
                  <button
                    onClick={addTemplate}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      width: '100%', padding: '10px 12px', marginTop: 4, borderRadius: 8,
                      border: '1px dashed var(--color-border)', cursor: 'pointer',
                      background: 'transparent', fontFamily: 'inherit',
                      color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                    }}
                  >
                    <Plus size={14} /> Add Template
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Field form */
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedTemplate.fields.map(f => (
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
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left side — admin actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isAdmin && !selectedTemplate && hasChanges && (
              <>
                <button
                  onClick={handleSaveTemplates}
                  disabled={saving}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: 'var(--color-success)', color: '#fff',
                    fontSize: 'var(--fs-sm)', fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            {isAdmin && !selectedTemplate && (
              <button
                onClick={resetToDefaults}
                title="Reset to default templates"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', borderRadius: 6,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <RotateCcw size={12} /> Reset Defaults
              </button>
            )}
          </div>

          {/* Right side — submit / close */}
          <div style={{ display: 'flex', gap: 8 }}>
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
    </div>
  )
}
