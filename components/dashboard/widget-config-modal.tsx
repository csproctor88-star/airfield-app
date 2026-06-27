'use client'
import type { WidgetInstance } from '@/lib/dashboard/layout'
import { getWidgetDef } from '@/lib/dashboard/registry'

export function WidgetConfigModal({
  widget, onSave, onClose,
}: {
  widget: WidgetInstance
  onSave: (config: Record<string, unknown>) => void
  onClose: () => void
}) {
  const def = getWidgetDef(widget.type)
  if (!def?.ConfigForm) return null
  const Form = def.ConfigForm
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>
          Configure {def.title}
        </div>
        <Form config={widget.config} onSave={(c) => { onSave(c); onClose() }} onCancel={onClose} />
      </div>
    </div>
  )
}
