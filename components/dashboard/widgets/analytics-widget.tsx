'use client'
import { useEffect, useState, useRef } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions } from '@/lib/permissions'
import { runQuery, DATASETS } from '@/lib/dashboard/analytics/datasets'
import { isModuleEnabled } from '@/lib/modules-config'
import { ChartSwitch } from '@/components/dashboard/charts/chart-switch'
import type { QuerySpec, AggregateResult, ChartType, TimePreset } from '@/lib/dashboard/analytics/types'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'

// ── AnalyticsWidget ──────────────────────────────────────────────────────────

export function AnalyticsWidget({ config }: { config: Record<string, unknown> }) {
  const { installationId } = useInstallation()
  const spec = config as unknown as QuerySpec
  const [result, setResult] = useState<AggregateResult | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const specKey = JSON.stringify(spec)

  useEffect(() => {
    if (!installationId || !spec?.dataset || !spec?.measure || !spec?.chart) return
    let cancelled = false
    setState('loading')
    runQuery(spec, installationId)
      .then(r => { if (!cancelled) { setResult(r); setState('idle') } })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, specKey])

  if (!spec?.dataset || !spec?.measure || !spec?.chart) {
    return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Configure this widget to build a chart.</div>
  }
  if (state === 'error') return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Couldn&rsquo;t load analytics.</div>
  if (!result) return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
  if (result.values.length === 0) return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No data for this query.</div>
  return <ChartSwitch chart={spec.chart} result={result} label={spec.title} />
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
  background: 'var(--color-bg-surface)', color: 'var(--color-text-1)',
  fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'auto',
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600,
  color: 'var(--color-text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
}

// ── Chart + time preset options ──────────────────────────────────────────────

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'donut', label: 'Donut' },
  { value: 'table', label: 'Table' },
]

const TIME_OPTIONS: { value: TimePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
]

// ── AnalyticsConfigForm ──────────────────────────────────────────────────────

export function AnalyticsConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const { installationId, currentInstallation, enabledModules } = useInstallation()
  const { has } = usePermissions()
  const airportType = currentInstallation?.airport_type ?? null

  // Available datasets filtered by permission + module gate
  const availableDatasets = DATASETS.filter(ds =>
    has(ds.permission) &&
    (!ds.moduleHref || isModuleEnabled(ds.moduleHref, enabledModules, airportType)),
  )

  const initial = config as unknown as Partial<QuerySpec>

  // Resolve initial dataset — fall back to first available
  const resolveInitialDataset = () => {
    if (initial.dataset) {
      const found = availableDatasets.find(d => d.key === initial.dataset)
      if (found) return found.key
    }
    return availableDatasets[0]?.key ?? ''
  }

  const [dataset, setDataset] = useState<string>(resolveInitialDataset)
  const [measure, setMeasure] = useState<string>(initial.measure ?? '')
  const [groupBy, setGroupBy] = useState<string>(initial.groupBy ?? '')
  const [chart, setChart] = useState<ChartType>((initial.chart as ChartType) ?? 'bar')
  const [timePreset, setTimePreset] = useState<TimePreset>((initial.timePreset as TimePreset) ?? 'all')
  const [title, setTitle] = useState<string>(initial.title ?? '')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    if (initial.filters) {
      for (const f of initial.filters) init[f.field] = f.value
    }
    return init
  })

  // Preview state
  const [previewResult, setPreviewResult] = useState<AggregateResult | null>(null)
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'error'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentDs = availableDatasets.find(d => d.key === dataset)

  // availableDatasets is empty on the first render (permissions + enabled
  // modules load async), so the once-only useState initializer leaves `dataset`
  // = ''. The dataset <select> then shows its first option ("Discrepancies")
  // while state is '' → currentDs is undefined → the Measure/Group-by controls
  // never render and nothing is configurable until you toggle the dropdown.
  // Once the list resolves, snap to the saved dataset (when editing) or the
  // first available one. The measure effect below then fills the measure.
  const datasetKeys = availableDatasets.map(d => d.key).join(',')
  useEffect(() => {
    if (availableDatasets.length === 0) return
    if (availableDatasets.some(d => d.key === dataset)) return
    const saved = initial.dataset ? availableDatasets.find(d => d.key === initial.dataset) : undefined
    setDataset((saved ?? availableDatasets[0]).key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetKeys])

  // When dataset changes, reset measure + filters (keep chart)
  const handleDatasetChange = (newDs: string) => {
    setDataset(newDs)
    setFilterValues({})
    setGroupBy('')
    const ds = availableDatasets.find(d => d.key === newDs)
    setMeasure(ds?.measures[0]?.key ?? '')
  }

  // Ensure measure is valid for the current dataset
  useEffect(() => {
    if (!currentDs) return
    const valid = currentDs.measures.find(m => m.key === measure)
    if (!valid && currentDs.measures.length > 0) {
      setMeasure(currentDs.measures[0].key)
    }
  }, [currentDs, measure])

  // Build the current draft spec
  const buildSpec = (): QuerySpec | null => {
    if (!dataset || !measure || !chart) return null
    const builtFilters = Object.entries(filterValues)
      .filter(([, v]) => v !== '')
      .map(([field, value]) => ({ field, op: 'eq' as const, value }))
    return {
      dataset,
      measure,
      groupBy: groupBy || undefined,
      filters: builtFilters.length ? builtFilters : undefined,
      timePreset: currentDs?.timeField ? timePreset : undefined,
      chart,
      title: title.trim() || undefined,
    }
  }

  // Debounced preview
  const filterKey = JSON.stringify(filterValues)
  useEffect(() => {
    if (!installationId) return
    const spec = buildSpec()
    if (!spec) { setPreviewResult(null); setPreviewState('idle'); return }

    let cancelled = false
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPreviewState('loading')
      runQuery(spec, installationId)
        .then(r => { if (!cancelled) { setPreviewResult(r); setPreviewState('idle') } })
        .catch(() => { if (!cancelled) setPreviewState('error') })
    }, 400)

    return () => { cancelled = true; if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, measure, groupBy, chart, timePreset, filterKey, installationId])

  const handleSave = () => {
    const spec = buildSpec()
    if (spec) onSave(spec as unknown as Record<string, unknown>)
  }

  if (availableDatasets.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          No datasets are available for your role.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit',
          }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Dataset */}
      <div>
        <label style={labelStyle}>Dataset</label>
        <select style={selectStyle} value={dataset} onChange={e => handleDatasetChange(e.target.value)}>
          {availableDatasets.map(d => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Measure */}
      {currentDs && (
        <div>
          <label style={labelStyle}>Measure</label>
          <select style={selectStyle} value={measure} onChange={e => setMeasure(e.target.value)}>
            {currentDs.measures.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Group by */}
      {currentDs && currentDs.dimensions.length > 0 && (
        <div>
          <label style={labelStyle}>Group by</label>
          <select style={selectStyle} value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            <option value=''>None</option>
            {currentDs.dimensions.map(d => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
      {currentDs && currentDs.filters.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {currentDs.filters.map(f => (
            <div key={f.field}>
              <label style={labelStyle}>{f.label}</label>
              <select
                style={selectStyle}
                value={filterValues[f.field] ?? ''}
                onChange={e => setFilterValues(prev => ({ ...prev, [f.field]: e.target.value }))}
              >
                <option value=''>Any</option>
                {f.options.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Time range — only if dataset has a timeField */}
      {currentDs?.timeField && (
        <div>
          <label style={labelStyle}>Time range</label>
          <select style={selectStyle} value={timePreset} onChange={e => setTimePreset(e.target.value as TimePreset)}>
            {TIME_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Chart type */}
      <div>
        <label style={labelStyle}>Chart type</label>
        <select style={selectStyle} value={chart} onChange={e => setChart(e.target.value as ChartType)}>
          {CHART_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label style={labelStyle}>Title (optional)</label>
        <input
          style={inputStyle}
          placeholder='e.g. Open Discrepancies by Type'
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      {/* Live preview */}
      <div style={{
        height: 160, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
        background: 'var(--color-bg-surface)', padding: '10px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {previewState === 'error' && (
          <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Couldn&rsquo;t load preview.</span>
        )}
        {previewState === 'loading' && (
          <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</span>
        )}
        {previewState === 'idle' && !previewResult && (
          <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Preview will appear here.</span>
        )}
        {previewState === 'idle' && previewResult && previewResult.values.length === 0 && (
          <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No data for this query.</span>
        )}
        {previewState === 'idle' && previewResult && previewResult.values.length > 0 && (
          <div style={{ width: '100%', height: '100%' }}>
            <ChartSwitch chart={chart} result={previewResult} label={title.trim() || undefined} />
          </div>
        )}
      </div>

      {/* Save / Cancel */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={handleSave}
          disabled={!dataset || !measure || !chart}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none',
            cursor: (!dataset || !measure || !chart) ? 'not-allowed' : 'pointer',
            background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit',
            opacity: (!dataset || !measure || !chart) ? 0.5 : 1,
          }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
