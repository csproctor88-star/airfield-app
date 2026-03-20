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
import { Save, Trash2, X, Download, Mail } from 'lucide-react'

type ActionMode = 'download' | 'email'

interface Props {
  open: boolean
  mode: ActionMode
  onClose: () => void
  onExport: (columns: string[]) => void
  exporting?: boolean
  disabledColumns?: string[]
}

export default function PdfExportDialog({ open, mode, onClose, onExport, exporting = false, disabledColumns = [] }: Props) {
  const [templates, setTemplates] = useState<PdfReportTemplate[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([...BASIC_COLUMNS])
  const [activeTemplateName, setActiveTemplateName] = useState<string>('Basic')
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)

  useEffect(() => {
    if (open) {
      const loaded = loadPdfTemplates()
      setTemplates(loaded)
      // Load last-used template or default
      const lastUsed = loaded.find(t => t.name === activeTemplateName) || loaded[0] || getDefaultTemplate()
      const filtered = lastUsed.columns.filter(c => !disabledColumns.includes(c))
      setSelectedColumns(Array.from(new Set([...BASIC_COLUMNS, ...filtered])))
      setActiveTemplateName(lastUsed.name)
      setShowSave(false)
      setSaveName('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const handleSelectTemplate = (name: string) => {
    setActiveTemplateName(name)
    const tpl = templates.find(t => t.name === name)
    if (tpl) {
      const filtered = tpl.columns.filter(c => !disabledColumns.includes(c))
      setSelectedColumns(Array.from(new Set([...BASIC_COLUMNS, ...filtered])))
    }
  }

  const handleToggleColumn = (key: string) => {
    if (BASIC_COLUMNS.includes(key) || disabledColumns.includes(key)) return
    const next = selectedColumns.includes(key)
      ? selectedColumns.filter(c => c !== key)
      : [...selectedColumns, key]
    setSelectedColumns(next)
    setActiveTemplateName('')
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
      setSelectedColumns([...BASIC_COLUMNS])
    }
  }

  const getColumnLabel = (key: string) => {
    return COLUMN_DEFS.find(c => c.key === key)?.header || key
  }

  const handleExport = () => {
    onExport(selectedColumns)
  }

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !exporting) onClose() }}
    >
      <div style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {mode === 'download' ? 'Export PDF' : 'Email PDF'}
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            style={{
              background: 'none', border: 'none', color: 'var(--color-text-3)',
              cursor: exporting ? 'default' : 'pointer', padding: 4, display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Templates */}
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Templates
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {templates.map(t => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => handleSelectTemplate(t.name)}
                style={{
                  padding: '5px 12px', borderRadius: 'var(--radius-sm)',
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
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Columns
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px',
          marginBottom: 12,
          background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: 10,
        }}>
          {BASIC_COLUMNS.map(key => (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
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
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 'var(--fs-sm)',
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
              fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16,
            }}
          >
            <Save size={12} /> Save as template
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Template name"
              onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!saveName.trim()}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.1)',
                color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                cursor: saveName.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                opacity: saveName.trim() ? 1 : 0.5,
              }}
            >
              Save
            </button>
            <button
              onClick={() => { setShowSave(false); setSaveName('') }}
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 'var(--radius-md)',
            border: mode === 'download'
              ? '1px solid rgba(34,197,94,0.4)'
              : '1px solid rgba(168,85,247,0.4)',
            background: mode === 'download'
              ? 'rgba(34,197,94,0.1)'
              : 'rgba(168,85,247,0.1)',
            color: mode === 'download' ? 'var(--color-status-pass)' : '#A855F7',
            fontSize: 'var(--fs-md)', fontWeight: 700,
            cursor: exporting ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: exporting ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {mode === 'download' ? <Download size={16} /> : <Mail size={16} />}
          {exporting
            ? 'Generating...'
            : mode === 'download' ? 'Export PDF' : 'Email PDF'}
        </button>
      </div>
    </div>
  )
}
