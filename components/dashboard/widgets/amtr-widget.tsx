'use client'
import { useState } from 'react'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'
import type { TableWidgetDescriptor } from '@/lib/dashboard/table/types'
import { TableWidget } from '@/components/dashboard/table/table-widget'
import { AmtrKpisWidget } from '@/components/dashboard/widgets/amtr-kpis-widget'
import { amtrDescriptor } from '@/lib/dashboard/table/descriptors/amtr'
import { amtrOverdueDescriptor, amtrDueSoonDescriptor } from '@/lib/dashboard/table/descriptors/amtr-due-items'
import { amtrInspectionsDescriptor } from '@/lib/dashboard/table/descriptors/amtr-inspections'
import { amtrMyTrainingDescriptor } from '@/lib/dashboard/table/descriptors/amtr-my-training'
import { amtrProgressDescriptor } from '@/lib/dashboard/table/descriptors/amtr-progress'
import { amtrComplianceDescriptor } from '@/lib/dashboard/table/descriptors/amtr-compliance'
import { amtrPendingSignaturesDescriptor } from '@/lib/dashboard/table/descriptors/amtr-pending-signatures'

const AMTR_REPORTS: Record<string, TableWidgetDescriptor<any>> = {
  currency: amtrDescriptor,
  overdue: amtrOverdueDescriptor,
  'due-soon': amtrDueSoonDescriptor,
  inspections: amtrInspectionsDescriptor,
  'my-training': amtrMyTrainingDescriptor,
  progress: amtrProgressDescriptor,
  compliance: amtrComplianceDescriptor,
  'pending-signatures': amtrPendingSignaturesDescriptor,
}

const REPORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'currency', label: 'Currency' },
  { value: 'kpis', label: 'Unit KPIs' },
  { value: 'overdue', label: 'Overdue Items' },
  { value: 'due-soon', label: 'Due Soon' },
  { value: 'inspections', label: 'Inspections' },
  { value: 'my-training', label: 'My Training Record' },
  { value: 'progress', label: 'Training Progress' },
  { value: 'compliance', label: 'Task Compliance' },
  { value: 'pending-signatures', label: 'Pending Signatures' },
]

export function AmtrWidget(props: WidgetProps) {
  const report = (props.config.report as string) ?? 'currency'
  if (report === 'kpis') return <AmtrKpisWidget />
  const descriptor = AMTR_REPORTS[report] ?? amtrDescriptor
  return <TableWidget descriptor={descriptor} config={props.config} onConfigChange={props.onConfigChange} />
}

export function AmtrReportConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const [title, setTitle] = useState((config.title as string) ?? '')
  const [report, setReport] = useState((config.report as string) ?? 'currency')

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = {
    fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={label}>Title</span>
        <input style={input} placeholder="Widget title (optional)" value={title}
          onChange={e => setTitle(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={label}>Report</span>
        <select style={input} value={report} onChange={e => setReport(e.target.value)}>
          {REPORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ ...config, title: title.trim() || undefined, report })}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
