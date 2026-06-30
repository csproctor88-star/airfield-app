'use client'
import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLogPage, type ActivityEntry } from '@/lib/supabase/activity-queries'
import { logManualEntry } from '@/lib/supabase/activity'
import { loadCustomActivityTemplates } from '@/lib/supabase/activity-templates'
import type { TemplateCategory } from '@/lib/activity-templates'
import { TemplatePicker } from '@/components/ui/template-picker'
import { formatZuluTime } from '@/lib/utils'
import { formatAction, buildDetailsString, actionColor } from '@/lib/activity-format'
import { moduleLabel } from '@/lib/activity-labels'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const EXCLUDE = ['ppr_coordination', 'ppr_agency']
const empty = new Map<string, { title?: string; description?: string; notes?: string; extra?: string }>()
const labelFor = (e: ActivityEntry) =>
  buildDetailsString(e, empty) || formatAction(e.action, e.entity_type, e.entity_display_id ?? undefined, e.metadata)

function useRows(_c: TableWidgetConfig, reloadNonce?: number) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    fetchActivityLogPage({ baseId: installationId, limit: 30, excludeEntityTypes: EXCLUDE })
      .then(({ data }) => { setRows(data); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, reloadNonce])
  return { rows, loading }
}

// ── Quick-add Toolbar ──────────────────────────────────────────────────────────

function EventsLogToolbar({ reload }: { reload: () => void }) {
  const { installationId, currentInstallation } = useInstallation()
  // addOpen: the full-screen Add Entry dialog
  const [addOpen, setAddOpen] = useState(false)
  // templateOpen: the TemplatePicker layered on top
  const [templateOpen, setTemplateOpen] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<TemplateCategory[] | null>(null)
  const [manualText, setManualText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleOpen() {
    if (installationId) {
      const t = await loadCustomActivityTemplates(installationId)
      setCustomTemplates(t)
    }
    setManualText('')
    setAddOpen(true)
  }

  function handleClose() {
    setAddOpen(false)
    setTemplateOpen(false)
    setManualText('')
  }

  async function handleManualSubmit() {
    const text = manualText.trim()
    if (!text || submitting) return
    setSubmitting(true)
    const { error } = await logManualEntry(text, installationId)
    setSubmitting(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry logged')
      handleClose()
      reload()
    }
  }

  async function handleTemplateSubmit(text: string, category?: string, templateLabel?: string) {
    const { error } = await logManualEntry(text, installationId, category, templateLabel)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry logged')
      handleClose()
      reload()
    }
  }

  return (
    <>
      <div style={{ marginBottom: 6 }}>
        <button
          onClick={handleOpen}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)',
            background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
            color: 'var(--color-accent)',
            fontSize: 'var(--fs-xs)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          ＋ Add entry
        </button>
      </div>

      {/* Full-screen Add Entry dialog */}
      {addOpen && !templateOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div
            className="card"
            style={{
              width: '96vw', height: '92vh', maxWidth: 'none', maxHeight: 'none',
              display: 'flex', flexDirection: 'column', overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px 12px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                Add Events Log Entry
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-3)', fontSize: 20, lineHeight: 1,
                  padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Manual entry section */}
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 8 }}>
                  Manual Entry
                </div>
                <textarea
                  ref={textareaRef}
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  placeholder="Type a manual entry…"
                  rows={6}
                  style={{
                    width: '100%', padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-surface)',
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--fs-base)',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualText.trim() || submitting}
                    style={{
                      padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                      background: (!manualText.trim() || submitting)
                        ? 'rgba(6,182,212,0.3)'
                        : 'var(--color-cyan-btn-bg)',
                      color: 'var(--color-cyan-btn-text)',
                      fontSize: 'var(--fs-base)', fontWeight: 700,
                      cursor: (!manualText.trim() || submitting) ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {submitting ? 'Logging…' : 'Log Entry'}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-4)', fontWeight: 600 }}>— or —</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>

              {/* Use a Template */}
              <div>
                <button
                  onClick={() => setTemplateOpen(true)}
                  style={{
                    padding: '10px 24px', borderRadius: 'var(--radius-md)',
                    border: '1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)',
                    background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                    color: 'var(--color-accent)',
                    fontSize: 'var(--fs-base)', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Use a Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template picker overlays the Add Entry modal when open */}
      {addOpen && templateOpen && (
        <TemplatePicker
          onSubmit={handleTemplateSubmit}
          onClose={() => setTemplateOpen(false)}
          isAdmin={false}
          installationId={installationId}
          customTemplates={customTemplates}
          onTemplatesSaved={setCustomTemplates}
          icao={currentInstallation?.icao ?? null}
          fullScreen
        />
      )}
    </>
  )
}

export const eventsLogDescriptor: TableWidgetDescriptor<ActivityEntry> = {
  // Mirrors the main Events Log columns: a color-coded Action, the Details
  // string, Zulu time, OI, and the entity type/id. (Entity links + inline edit
  // come with the "real module views in widgets" work.)
  columns: [
    {
      key: 'action', label: 'Action',
      accessor: e => formatAction(e.action, e.entity_type, e.entity_display_id ?? undefined, e.metadata),
      format: (v, e) => <span style={{ color: actionColor(e.action, e.entity_type), fontWeight: 600 }}>{v as string}</span>,
      defaultVisible: true,
    },
    { key: 'label', label: 'Details', accessor: labelFor, wrap: true, defaultVisible: true },
    { key: 'time', label: 'Zulu', accessor: e => `${formatZuluTime(e.created_at)}Z`, mono: true, defaultVisible: true },
    { key: 'oi', label: 'OI', accessor: e => e.user_operating_initials ?? '—', mono: true, defaultVisible: true },
    { key: 'entity_type', label: 'Type', accessor: e => e.entity_type, format: v => moduleLabel(v as string) },
    { key: 'entity_display_id', label: 'Entity', accessor: e => e.entity_display_id ?? '—' },
  ],
  filters: [
    { key: 'entity_type', label: 'Entity type', kind: 'text',
      predicate: (e, sel) => e.entity_type.toLowerCase().includes((sel as string).toLowerCase()) },
  ],
  // Row click opens the full Events Log.
  row: { mode: 'deeplink', href: () => '/activity' },
  footerHref: '/activity',
  Toolbar: EventsLogToolbar,
  useRows,
}
