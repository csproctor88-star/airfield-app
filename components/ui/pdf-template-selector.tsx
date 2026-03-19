'use client'

import { useState, useEffect } from 'react'
import {
  BASIC_COLUMNS,
  ALL_OPTIONAL_COLUMNS,
  COLUMN_DEFS,
  loadPdfTemplates,
  savePdfTemplates,
  getDefaultTemplate,
  type PdfReportTemplate,
} from '@/lib/pdf-config'
import { Save, Trash2 } from 'lucide-react'

interface Props {
  selectedColumns: string[]
  onColumnsChange: (cols: string[]) => void
  disabledColumns?: string[]  // optional columns that cannot be toggled (e.g., aging report disables photos/comments)
}

export default function PdfTemplateSelector({ selectedColumns, onColumnsChange, disabledColumns = [] }: Props) {
  const [templates, setTemplates] = useState<PdfReportTemplate[]>([])
  const [activeTemplateName, setActiveTemplateName] = useState<string>('Basic')
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)

  useEffect(() => {
    const loaded = loadPdfTemplates()
    setTemplates(loaded)
  }, [])

  const handleSelectTemplate = (name: string) => {
    setActiveTemplateName(name)
    const tpl = templates.find(t => t.name === name)
    if (tpl) {
      // Filter out any disabled columns from the template
      const filtered = tpl.columns.filter(c => !disabledColumns.includes(c))
      // Ensure basic columns are always present
      const withBasics = Array.from(new Set([...BASIC_COLUMNS, ...filtered]))
      onColumnsChange(withBasics)
    }
  }

  const handleToggleColumn = (key: string) => {
    if (BASIC_COLUMNS.includes(key) || disabledColumns.includes(key)) return
    const next = selectedColumns.includes(key)
      ? selectedColumns.filter(c => c !== key)
      : [...selectedColumns, key]
    onColumnsChange(next)
    setActiveTemplateName('')  // custom config = no named template
  }

  const handleSaveTemplate = () => {
    const name = saveName.trim()
    if (!name) return
    const newTpl: PdfReportTemplate = { name, columns: [...selectedColumns] }
    const updated = templates.filter(t => t.name !== name)
    updated.push(newTpl)
    setTemplates(updated)
    savePdfTemplates(updated)
    setActiveTemplateName(name)
    setSaveName('')
    setShowSave(false)
  }

  const handleDeleteTemplate = (name: string) => {
    if (name === 'Basic') return
    const updated = templates.filter(t => t.name !== name)
    if (updated.length === 0) updated.push(getDefaultTemplate())
    setTemplates(updated)
    savePdfTemplates(updated)
    if (activeTemplateName === name) {
      setActiveTemplateName('Basic')
      onColumnsChange([...BASIC_COLUMNS])
    }
  }

  const getColumnLabel = (key: string) => {
    return COLUMN_DEFS.find(c => c.key === key)?.header || key
  }

  return (
    <div style={{
      background: 'var(--color-bg-inset)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        PDF Columns
      </div>

      {/* Template Selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {templates.map(t => (
          <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => handleSelectTemplate(t.name)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: activeTemplateName === t.name ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
                background: activeTemplateName === t.name ? 'rgba(34,211,238,0.12)' : 'transparent',
                color: activeTemplateName === t.name ? 'var(--color-cyan)' : 'var(--color-text-2)',
                fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.name}
            </button>
            {t.name !== 'Basic' && (
              <button
                onClick={() => handleDeleteTemplate(t.name)}
                style={{
                  background: 'none', border: 'none', color: 'var(--color-text-3)',
                  cursor: 'pointer', padding: 2, display: 'flex',
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Column Toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {BASIC_COLUMNS.map(key => (
          <label key={key} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
            opacity: 0.5, cursor: 'default',
          }}>
            <input type="checkbox" checked disabled style={{ accentColor: 'var(--color-cyan)' }} />
            {getColumnLabel(key)}
          </label>
        ))}
        {ALL_OPTIONAL_COLUMNS.map(key => {
          const isDisabled = disabledColumns.includes(key)
          const isChecked = selectedColumns.includes(key)
          return (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 'var(--fs-xs)',
              color: isDisabled ? 'var(--color-text-3)' : 'var(--color-text-2)',
              opacity: isDisabled ? 0.35 : 1,
              cursor: isDisabled ? 'default' : 'pointer',
            }}>
              <input
                type="checkbox"
                checked={isChecked && !isDisabled}
                disabled={isDisabled}
                onChange={() => handleToggleColumn(key)}
                style={{ accentColor: 'var(--color-cyan)' }}
              />
              {getColumnLabel(key)}
            </label>
          )
        })}
      </div>

      {/* Save Template */}
      {!showSave ? (
        <button
          onClick={() => setShowSave(true)}
          style={{
            background: 'none', border: 'none', color: 'var(--color-text-3)',
            fontSize: 'var(--fs-2xs)', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Save size={11} /> Save as template
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="Template name"
            onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
            style={{
              flex: 1, padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
              color: 'var(--color-text-1)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSaveTemplate}
            disabled={!saveName.trim()}
            style={{
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.1)',
              color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 600,
              cursor: saveName.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
              opacity: saveName.trim() ? 1 : 0.5,
            }}
          >
            Save
          </button>
          <button
            onClick={() => { setShowSave(false); setSaveName('') }}
            style={{
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
