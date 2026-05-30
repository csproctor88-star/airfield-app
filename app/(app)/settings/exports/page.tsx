'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, Sheet, Image as ImageIcon, MonitorPlay, Database, Loader2 } from 'lucide-react'
import { usePermissions, PERM } from '@/lib/permissions'
import { useInstallation } from '@/lib/installation-context'
import { isCivilian } from '@/lib/airport-mode'
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
  const { installationId, currentInstallation } = useInstallation()

  // Civilian airports expose SMS/AEP/§139.303 Training; military hide them.
  const civilian = isCivilian(currentInstallation)
  const modules = useMemo(
    () =>
      EXPORT_MODULES.filter((m) => {
        if (m.pdfStrategy === 'excluded') return false
        if (m.appliesTo === 'civilian') return civilian
        if (m.appliesTo === 'military') return !civilian
        return true
      }),
    [civilian],
  )

  const [periodKind, setPeriodKind] = useState<'all_time' | 'range'>('range')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  // Interactive viewer arrives in a later phase; default off + disabled.
  const [include, setInclude] = useState<Record<IncludeKey, boolean>>({
    pdf: true, excel: true, photos: true, viewer: false, json: false,
  })
  const [selected, setSelected] = useState<Set<string>>(() => new Set(modules.map((m) => m.key)))
  const [generating, setGenerating] = useState(false)
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null)

  // Re-seed the selection when the visible module set changes (e.g. an
  // installation switch flips civilian/military), so stale module keys don't
  // linger in `selected`. `modules` is memoised on `civilian`, so this only
  // fires on an actual airport-type change, not on every render.
  useEffect(() => {
    setSelected(new Set(modules.map((m) => m.key)))
  }, [modules])

  const period: ExportPeriod =
    periodKind === 'all_time' ? { kind: 'all_time' } : { kind: 'range', from, to }

  async function handleGenerate() {
    if (periodKind === 'range' && (!from || !to)) {
      toast.error('Pick a from and to date, or choose All time')
      return
    }
    if (selected.size === 0) {
      toast.error('Select at least one module')
      return
    }
    if (!include.pdf && !include.excel && !include.json && !include.photos) {
      toast.error('Select at least one output: PDF, Excel, photos, or JSON')
      return
    }

    setGenerating(true)
    try {
      const inst = currentInstallation as { name?: string | null; icao?: string | null; timezone?: string | null } | null
      const base = { name: inst?.name ?? null, icao: inst?.icao ?? null }
      const airportType = civilian ? 'faa_part139' : 'usaf'

      const selectedKeys = Array.from(selected)
      const [{ fetchExportRecords }, { buildExportFiles }, { packageExport, downloadPackagedExport }] = await Promise.all([
        import('@/lib/export/export-data'),
        import('@/lib/export/run-export'),
        import('@/lib/export/export-packager'),
      ])

      const records = await fetchExportRecords(installationId ?? null, airportType, base)
      const built = await buildExportFiles(records, {
        selectedKeys,
        period,
        outputMode: 'aggregate',
        base,
        timezone: inst?.timezone ?? null,
        include: { pdf: include.pdf, excel: include.excel, json: include.json },
      })

      // Photos: browser-only download (network). Plan from the fetched rows,
      // fetch each with retry, append to the file list; failures are recorded
      // on the manifest, never abort the export.
      const allFiles = [...built.files]
      let photoFailures: { path: string; reason: string }[] = []
      if (include.photos) {
        const [{ planPhotos, downloadPhotos }, { getPublicUrl }] = await Promise.all([
          import('@/lib/export/export-photos'),
          import('@/lib/supabase/photos'),
        ])
        const planned = planPhotos(records.photos, { selectedKeys, period, resolver: records.photoResolver })
        if (planned.length > 0) {
          const result = await downloadPhotos(planned, {
            urlFor: getPublicUrl,
            onProgress: (d, t) => setPhotoProgress({ done: d, total: t }),
          })
          allFiles.push(...result.files)
          photoFailures = result.failures.map((f) => ({ path: f.path, reason: f.reason }))
        }
        setPhotoProgress(null)
      }

      if (allFiles.length === 0) {
        toast.message('No records matched the selected period — nothing to export')
        return
      }

      const pkg = await packageExport({
        files: allFiles,
        base,
        period,
        outputMode: 'aggregate',
        modules: built.modules,
        gaps: built.gaps,
        photoFailures,
        generatedAt: new Date().toISOString(),
      })
      downloadPackagedExport(pkg)
      const failNote = photoFailures.length > 0 ? ` (${photoFailures.length} photo(s) unavailable)` : ''
      toast.success(`Export ready — ${pkg.manifest.files.length} file(s) in ${pkg.filename}${failNote}`)
    } catch (e) {
      console.error('Records export failed:', e)
      toast.error('Export failed — see console for details')
    } finally {
      setGenerating(false)
    }
  }

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

  const includeRows: { key: IncludeKey; label: string; icon: typeof FileText; disabled?: boolean }[] = [
    { key: 'pdf', label: 'PDF documents', icon: FileText },
    { key: 'excel', label: 'Excel workbooks', icon: Sheet },
    { key: 'photos', label: 'Photos', icon: ImageIcon },
    { key: 'viewer', label: 'Interactive viewer (soon)', icon: MonitorPlay, disabled: true },
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
        {includeRows.map(({ key, label, icon: Icon, disabled }) => (
          <label
            key={key}
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            <input
              type="checkbox"
              checked={include[key]}
              disabled={disabled}
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
        disabled={generating}
        onClick={handleGenerate}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: generating ? 0.6 : 1 }}
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {generating
          ? (photoProgress ? `Photos ${photoProgress.done}/${photoProgress.total}…` : 'Generating…')
          : 'Generate Export'}
      </button>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 10 }}>
        Generation runs entirely in your browser — record data never leaves this device. The ZIP
        includes a START-HERE cover and a SHA-256 manifest of every file.
      </p>
    </div>
  )
}
