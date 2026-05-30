'use client'

import { useMemo, useState } from 'react'
import { Download, FileText, Sheet, Image as ImageIcon, MonitorPlay, Database } from 'lucide-react'
import { usePermissions, PERM } from '@/lib/permissions'
import { useInstallation } from '@/lib/installation-context'
import { EXPORT_MODULES, type ExportModule } from '@/lib/export/export-modules'
import { resolveQuickPeriod, type ExportPeriod, type QuickPeriod } from '@/lib/export/export-period'

type IncludeKey = 'pdf' | 'excel' | 'photos' | 'viewer' | 'json'

const QUICK: { key: QuickPeriod; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'this_fy', label: 'This FY' },
]

export default function ExportsPage() {
  const { has, loaded } = usePermissions()
  const { currentInstallation } = useInstallation()

  // Civilian airports expose SMS/AEP/§139.303 Training; military hide them.
  const isCivilian =
    (currentInstallation as { airport_type?: string } | null)?.airport_type === 'faa_part139'
  const modules = useMemo(
    () =>
      EXPORT_MODULES.filter((m) => {
        if (m.pdfStrategy === 'excluded') return false
        if (m.appliesTo === 'civilian') return isCivilian
        if (m.appliesTo === 'military') return !isCivilian
        return true
      }),
    [isCivilian],
  )

  const [periodKind, setPeriodKind] = useState<'all_time' | 'range'>('range')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [include, setInclude] = useState<Record<IncludeKey, boolean>>({
    pdf: true, excel: true, photos: true, viewer: true, json: false,
  })
  const [selected, setSelected] = useState<Set<string>>(() => new Set(modules.map((m) => m.key)))

  // Phase 1 builds the period object but does not yet generate. Referenced so
  // the type stays exercised; Phase 4 wires it into the engine.
  const period: ExportPeriod =
    periodKind === 'all_time' ? { kind: 'all_time' } : { kind: 'range', from, to }
  void period

  function applyQuick(kind: QuickPeriod) {
    const { from: f, to: t } = resolveQuickPeriod(kind, new Date())
    setPeriodKind('range')
    setFrom(f)
    setTo(t)
  }

  function toggleModule(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!loaded) {
    return <div className="page-container">Loading…</div>
  }
  if (!has(PERM.EXPORTS_READ)) {
    return (
      <div className="page-container">
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>Records Export</div>
        <p style={{ color: 'var(--color-text-3)' }}>
          You don't have access to Records Export. Contact your system or base administrator.
        </p>
      </div>
    )
  }

  const includeRows: { key: IncludeKey; label: string; icon: typeof FileText }[] = [
    { key: 'pdf', label: 'PDF documents', icon: FileText },
    { key: 'excel', label: 'Excel workbooks', icon: Sheet },
    { key: 'photos', label: 'Photos', icon: ImageIcon },
    { key: 'viewer', label: 'Interactive viewer', icon: MonitorPlay },
    { key: 'json', label: 'Raw data (JSON)', icon: Database },
  ]

  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 4 }}>Records Export</div>
      <p style={{ color: 'var(--color-text-3)', marginBottom: 20 }}>
        Produce filable, reviewable records (PDF, Excel, photos, viewer) you can use outside Glidepath.
      </p>

      {/* 1. Period */}
      <div className="section-label">1 · PERIOD</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0 20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="radio" name="period" checked={periodKind === 'all_time'} onChange={() => setPeriodKind('all_time')} />
          All time — full export (the &quot;leaving Glidepath&quot; grab)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="radio" name="period" checked={periodKind === 'range'} onChange={() => setPeriodKind('range')} />
          Date range
        </label>
        {periodKind === 'range' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 24 }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <span>→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            {QUICK.map((q) => (
              <button key={q.key} type="button" className="chip" onClick={() => applyQuick(q.key)}>{q.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Include */}
      <div className="section-label">2 · INCLUDE</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '8px 0 20px' }}>
        {includeRows.map(({ key, label, icon: Icon }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={include[key]}
              onChange={(e) => setInclude((p) => ({ ...p, [key]: e.target.checked }))}
            />
            <Icon size={14} color="var(--color-text-3)" />
            {label}
          </label>
        ))}
      </div>

      {/* 3. Modules */}
      <div className="section-label">3 · MODULES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 24px' }}>
        {modules.map((m: ExportModule) => (
          <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={selected.has(m.key)} onChange={() => toggleModule(m.key)} />
            {m.label}
          </label>
        ))}
      </div>

      <button
        type="button"
        className="btn-primary"
        disabled
        title="Generation is wired up in a later phase"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.5 }}
      >
        <Download size={16} /> Generate Export
      </button>
    </div>
  )
}
