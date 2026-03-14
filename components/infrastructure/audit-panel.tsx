'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { formatFeatureType, FEATURE_TYPE_ABBREV } from '@/lib/supabase/infrastructure-features'
import type { InfrastructureFeature } from '@/lib/supabase/types'

// ── Types ──

type ComponentInfo = {
  id: string
  system_id: string
  label: string
  system_name: string
  runway_or_taxiway: string | null
}

type GroupedSystem = {
  name: string
  components: ComponentInfo[]
}

type AuditPanelProps = {
  features: InfrastructureFeature[]
  allComponents: ComponentInfo[]
  groupedComponents: GroupedSystem[]
  onFeatureClick: (feature: InfrastructureFeature) => void
  onComponentGroupClick: (componentId: string, featureIds: string[]) => void
  onLabelUpdate: (featureId: string, newLabel: string) => Promise<boolean>
  onComponentReassign: (featureId: string, componentId: string | null) => Promise<boolean>
  onBulkPrefixApply: (featureIds: string[], prefix: string) => Promise<number>
  onBulkSequentialLabel: (features: { id: string; label: string }[]) => Promise<number>
  onBulkAssign: (featureIds: string[], componentId: string) => Promise<number>
  onBulkFixtureIds: (updates: { id: string; block: string }[]) => Promise<number>
  onBulkDelete: (featureIds: string[]) => Promise<number>
  onBulkTypeChange: (featureIds: string[], newType: string) => Promise<number>
  onHighlightFeatures: (featureIds: string[]) => void
  onClose: () => void
}

// ── Layer color lookup (simplified from page LAYERS config) ──

const TYPE_COLORS: Record<string, string> = {
  location_sign: '#FBBF24', directional_sign: '#FBBF24', informational_sign: '#60A5FA',
  mandatory_sign: '#EF4444', taxiway_light: '#3B82F6', taxiway_end_light: '#2563EB',
  approach_light: '#F472B6', runway_edge_light: '#FBBF24', runway_threshold: '#22C55E',
  threshold_light: '#22C55E', papi: '#F97316', reil: '#A78BFA', runway_distance_marker: '#FBBF24',
  pre_threshold_light: '#F59E0B', terminating_bar_light: '#EF4444', centerline_bar_light: '#F8FAFC',
  thousand_ft_bar_light: '#F8FAFC', sequenced_flasher: '#F8FAFC', obstruction_light: '#EF4444',
  windcone: '#FB923C', stadium_light: '#E2E8F0', rotating_beacon: '#22D3EE',
}

const SIGN_TYPES = new Set(['location_sign', 'directional_sign', 'informational_sign', 'mandatory_sign'])

// ── Inline-editable label ──

function EditableLabel({
  value,
  onSave,
}: {
  value: string
  onSave: (newVal: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setText(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const save = async () => {
    setEditing(false)
    if (text.trim() === value) return
    const ok = await onSave(text.trim())
    if (!ok) setText(value) // revert on failure
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') { setText(value); setEditing(false) }
        }}
        style={{
          width: '100%',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid var(--color-cyan)',
          borderRadius: 4,
          padding: '2px 6px',
          color: '#E2E8F0',
          fontSize: 11,
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setEditing(true) }}
      title="Click to edit label"
      style={{
        cursor: 'text',
        borderBottom: '1px dashed rgba(148,163,184,0.3)',
        padding: '1px 2px',
        minWidth: 20,
        display: 'inline-block',
      }}
    >
      {value || <span style={{ color: '#475569', fontStyle: 'italic' }}>no label</span>}
    </span>
  )
}

// ── Prefix modal ──

function PrefixForm({
  onApply,
  onApplySequential,
  featureCount,
  onCancel,
}: {
  onApply: (prefix: string) => void
  onApplySequential: (prefix: string, startAt: number) => void
  featureCount: number
  onCancel: () => void
}) {
  const [prefix, setPrefix] = useState('')
  const [sequential, setSequential] = useState(false)
  const [startAt, setStartAt] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const handleApply = () => {
    if (!prefix.trim()) return
    if (sequential) {
      onApplySequential(prefix.trim(), startAt)
    } else {
      onApply(prefix.trim())
    }
  }

  return (
    <div
      style={{ padding: '6px 0 4px 24px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Prefix text..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && prefix.trim()) handleApply()
            if (e.key === 'Escape') onCancel()
          }}
          style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: 4,
            padding: '3px 6px',
            color: '#E2E8F0',
            fontSize: 11,
            outline: 'none',
          }}
        />
        <button
          onClick={handleApply}
          disabled={!prefix.trim()}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: '1px solid rgba(6, 182, 212, 0.3)',
            background: prefix.trim() ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            color: prefix.trim() ? '#22D3EE' : '#475569',
            fontSize: 10,
            fontWeight: 600,
            cursor: prefix.trim() ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
          }}
        >
          Apply
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '3px 6px',
            borderRadius: 4,
            border: '1px solid rgba(148,163,184,0.2)',
            background: 'transparent',
            color: '#64748B',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      {/* Sequential numbering option */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, color: '#94A3B8' }}>
          <input
            type="checkbox"
            checked={sequential}
            onChange={() => setSequential(prev => !prev)}
            style={{ accentColor: '#22D3EE' }}
          />
          Append sequential #
        </label>
        {sequential && (
          <>
            <span style={{ fontSize: 10, color: '#64748B' }}>start at</span>
            <input
              type="number"
              min={1}
              value={startAt}
              onChange={(e) => setStartAt(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 40,
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: 4,
                padding: '2px 4px',
                color: '#E2E8F0',
                fontSize: 10,
                textAlign: 'center',
                outline: 'none',
              }}
            />
          </>
        )}
      </div>
      {sequential && prefix.trim() && (
        <div style={{ fontSize: 9, color: '#64748B', marginTop: 2, paddingLeft: 2 }}>
          Preview: &quot;{prefix.trim()} {startAt}&quot; ... &quot;{prefix.trim()} {startAt + featureCount - 1}&quot;
        </div>
      )}
    </div>
  )
}

// ── Fixture ID generator form ──

function FixtureIdForm({
  comp,
  features,
  onGenerate,
  onCancel,
}: {
  comp: ComponentInfo
  features: InfrastructureFeature[]
  onGenerate: (customPrefix?: string) => void
  onCancel: () => void
}) {
  // Derive default prefix from system name
  const defaultPrefix = (() => {
    const sysName = comp.system_name
    const dashIdx = sysName.indexOf(' - ')
    const locationPart = dashIdx >= 0 ? sysName.substring(0, dashIdx) : sysName
    return locationPart.replace(/\s+/g, '')
  })()

  const [customPrefix, setCustomPrefix] = useState(defaultPrefix)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.select() }, [])

  // Build preview
  const byType: Record<string, number> = {}
  for (const f of features) {
    byType[f.feature_type] = (byType[f.feature_type] || 0) + 1
  }
  const previewLines = Object.entries(byType).map(([type, count]) => {
    const abbrev = FEATURE_TYPE_ABBREV[type] || type.substring(0, 3).toUpperCase()
    return `${customPrefix}-${abbrev}-001 ... ${customPrefix}-${abbrev}-${String(count).padStart(3, '0')}`
  })

  return (
    <div
      style={{ padding: '6px 0 4px 24px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={customPrefix}
          onChange={(e) => setCustomPrefix(e.target.value)}
          placeholder="Prefix..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customPrefix.trim()) onGenerate(customPrefix.trim())
            if (e.key === 'Escape') onCancel()
          }}
          style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: 4,
            padding: '3px 6px',
            color: '#E2E8F0',
            fontSize: 11,
            outline: 'none',
          }}
        />
        <button
          onClick={() => customPrefix.trim() && onGenerate(customPrefix.trim())}
          disabled={!customPrefix.trim()}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: '1px solid rgba(168, 85, 247, 0.3)',
            background: customPrefix.trim() ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
            color: customPrefix.trim() ? '#C084FC' : '#475569',
            fontSize: 10,
            fontWeight: 600,
            cursor: customPrefix.trim() ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
          }}
        >
          Generate
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '3px 6px',
            borderRadius: 4,
            border: '1px solid rgba(148,163,184,0.2)',
            background: 'transparent',
            color: '#64748B',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      {customPrefix.trim() && previewLines.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 9, color: '#64748B', marginBottom: 2 }}>Preview:</div>
          {previewLines.map((line, i) => (
            <div key={i} style={{ fontSize: 9, color: '#94A3B8', paddingLeft: 2 }}>{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ──

export default function AuditPanel({
  features,
  allComponents,
  groupedComponents,
  onFeatureClick,
  onComponentGroupClick,
  onLabelUpdate,
  onComponentReassign,
  onBulkPrefixApply,
  onBulkSequentialLabel,
  onBulkAssign,
  onBulkFixtureIds,
  onBulkDelete,
  onBulkTypeChange,
  onHighlightFeatures,
  onClose,
}: AuditPanelProps) {
  const [searchText, setSearchText] = useState('')
  const [expandedSystems, setExpandedSystems] = useState<Record<string, boolean>>({})
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({})
  const [prefixTarget, setPrefixTarget] = useState<string | null>(null) // component ID
  const [reassigning, setReassigning] = useState<string | null>(null) // feature ID showing dropdown
  const [fixtureIdTarget, setFixtureIdTarget] = useState<string | null>(null) // component ID
  const [generatingAllIds, setGeneratingAllIds] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [baLayer, setBaLayer] = useState<string>('')
  const [baType, setBaType] = useState<string>('')
  const [baComponentId, setBaComponentId] = useState<string>('')
  const [baAssigning, setBaAssigning] = useState(false)
  const [bulkRetypeOpen, setBulkRetypeOpen] = useState(false)
  const [brLayer, setBrLayer] = useState<string>('')
  const [brCurrentType, setBrCurrentType] = useState<string>('')
  const [brNewType, setBrNewType] = useState<string>('')
  const [brRetyping, setBrRetyping] = useState(false)

  // Build feature-to-component mapping
  const { byComponent, unassigned } = useMemo(() => {
    const map: Record<string, InfrastructureFeature[]> = {}
    const none: InfrastructureFeature[] = []
    const lowerSearch = searchText.toLowerCase()

    for (const f of features) {
      // Search filter
      if (lowerSearch) {
        const matchLabel = (f.label || '').toLowerCase().includes(lowerSearch)
        const matchType = formatFeatureType(f.feature_type).toLowerCase().includes(lowerSearch)
        const matchLayer = (f.layer || '').toLowerCase().includes(lowerSearch)
        if (!matchLabel && !matchType && !matchLayer) continue
      }

      if (f.system_component_id) {
        if (!map[f.system_component_id]) map[f.system_component_id] = []
        map[f.system_component_id].push(f)
      } else {
        none.push(f)
      }
    }

    return { byComponent: map, unassigned: none }
  }, [features, searchText])

  // Total counts
  const totalFiltered = Object.values(byComponent).reduce((s, arr) => s + arr.length, 0) + unassigned.length

  // Unique layers and types for bulk assign filters
  const uniqueLayers = useMemo(() =>
    Array.from(new Set(features.map(f => f.layer).filter(Boolean) as string[])).sort(),
    [features]
  )
  const uniqueTypes = useMemo(() =>
    Array.from(new Set(features.map(f => f.feature_type))).sort(),
    [features]
  )

  // Features matching bulk assign filters
  const baMatchedFeatures = useMemo(() => {
    if (!baLayer && !baType) return []
    return features.filter(f => {
      if (baLayer && f.layer !== baLayer) return false
      if (baType && f.feature_type !== baType) return false
      return true
    })
  }, [features, baLayer, baType])

  // Highlight matched features on map when filters change
  useEffect(() => {
    if (bulkAssignOpen && (baLayer || baType)) {
      onHighlightFeatures(baMatchedFeatures.map(f => f.id))
    } else {
      onHighlightFeatures([])
    }
  }, [bulkAssignOpen, baMatchedFeatures]) // eslint-disable-line react-hooks/exhaustive-deps

  // Features matching bulk re-type filters
  const brMatchedFeatures = useMemo(() => {
    if (!brLayer && !brCurrentType) return []
    return features.filter(f => {
      if (brLayer && f.layer !== brLayer) return false
      if (brCurrentType && f.feature_type !== brCurrentType) return false
      return true
    })
  }, [features, brLayer, brCurrentType])

  // Highlight matched features on map when re-type filters change
  useEffect(() => {
    if (bulkRetypeOpen && (brLayer || brCurrentType)) {
      onHighlightFeatures(brMatchedFeatures.map(f => f.id))
    } else if (bulkRetypeOpen) {
      onHighlightFeatures([])
    }
  }, [bulkRetypeOpen, brMatchedFeatures]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBulkRetype = async () => {
    if (!brNewType || brMatchedFeatures.length === 0) return
    setBrRetyping(true)
    const count = await onBulkTypeChange(brMatchedFeatures.map(f => f.id), brNewType)
    setBrRetyping(false)
    if (count > 0) {
      toast.success(`Re-typed ${count} feature${count !== 1 ? 's' : ''} to ${formatFeatureType(brNewType)}`)
      setBrLayer('')
      setBrCurrentType('')
      setBrNewType('')
      onHighlightFeatures([])
    }
  }

  const toggleSystem = (name: string) =>
    setExpandedSystems(prev => ({ ...prev, [name]: !prev[name] }))

  const toggleComponent = (id: string) =>
    setExpandedComponents(prev => ({ ...prev, [id]: !prev[id] }))

  const handlePrefixApply = async (componentId: string, prefix: string) => {
    const featureIds = (byComponent[componentId] || []).map(f => f.id)
    if (featureIds.length === 0) return
    const count = await onBulkPrefixApply(featureIds, prefix + ' ')
    if (count > 0) toast.success(`Prefixed ${count} label${count !== 1 ? 's' : ''} with "${prefix}"`)
    setPrefixTarget(null)
  }

  const handleBulkAssign = async () => {
    if (!baComponentId || baMatchedFeatures.length === 0) return
    setBaAssigning(true)
    const count = await onBulkAssign(baMatchedFeatures.map(f => f.id), baComponentId)
    setBaAssigning(false)
    if (count > 0) {
      const comp = allComponents.find(c => c.id === baComponentId)
      toast.success(`Assigned ${count} feature${count !== 1 ? 's' : ''} to ${comp?.label || 'component'}`)
      setBaLayer('')
      setBaType('')
      setBaComponentId('')
      onHighlightFeatures([])
    }
  }

  const handleSequentialApply = async (componentId: string, prefix: string, startAt: number) => {
    const compFeatures = (byComponent[componentId] || [])
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
    if (compFeatures.length === 0) return
    const updates = compFeatures.map((f, i) => ({
      id: f.id,
      label: `${prefix} ${startAt + i}`,
    }))
    const count = await onBulkSequentialLabel(updates)
    if (count > 0) toast.success(`Labeled ${count} feature${count !== 1 ? 's' : ''} sequentially`)
    setPrefixTarget(null)
  }

  const handleGenerateAllFixtureIds = async () => {
    setGeneratingAllIds(true)
    const updates: { id: string; block: string }[] = []

    // Process each component
    for (const comp of allComponents) {
      const compFeatures = (byComponent[comp.id] || [])
        .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
      if (compFeatures.length === 0) continue

      // Build prefix from system name
      const dashIdx = comp.system_name.indexOf(' - ')
      const sysPrefix = (dashIdx >= 0 ? comp.system_name.substring(0, dashIdx) : comp.system_name).replace(/\s+/g, '')

      // Group by type within component
      const byType: Record<string, InfrastructureFeature[]> = {}
      for (const f of compFeatures) {
        if (!byType[f.feature_type]) byType[f.feature_type] = []
        byType[f.feature_type].push(f)
      }

      for (const [type, feats] of Object.entries(byType)) {
        const abbrev = FEATURE_TYPE_ABBREV[type] || type.substring(0, 3).toUpperCase()
        feats.forEach((f, i) => {
          const num = String(i + 1).padStart(3, '0')
          updates.push({ id: f.id, block: `${sysPrefix}-${abbrev}-${num}` })
        })
      }
    }

    // Also handle unassigned features — use layer as prefix
    for (const f of unassigned) {
      const layerPrefix = (f.layer || 'UNK').replace(/\s+/g, '')
      const abbrev = FEATURE_TYPE_ABBREV[f.feature_type] || f.feature_type.substring(0, 3).toUpperCase()
      // Count position among same layer+type unassigned features
      const sameGroup = unassigned.filter(u => u.layer === f.layer && u.feature_type === f.feature_type)
        .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
      const idx = sameGroup.indexOf(f) + 1
      updates.push({ id: f.id, block: `${layerPrefix}-${abbrev}-${String(idx).padStart(3, '0')}` })
    }

    if (updates.length > 0) {
      const count = await onBulkFixtureIds(updates)
      if (count > 0) toast.success(`Generated ${count} Fixture ID${count !== 1 ? 's' : ''}`)
    }
    setGeneratingAllIds(false)
  }

  const handleGenerateFixtureIds = async (componentId: string, customPrefix?: string) => {
    const comp = allComponents.find(c => c.id === componentId)
    if (!comp) return
    const compFeatures = (byComponent[componentId] || [])
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
    if (compFeatures.length === 0) return

    // Build prefix from system name: "TWY K - Airfield Signage" → "TWYK"
    const sysPrefix = customPrefix || (() => {
      const sysName = comp.system_name
      const dashIdx = sysName.indexOf(' - ')
      const locationPart = dashIdx >= 0 ? sysName.substring(0, dashIdx) : sysName
      return locationPart.replace(/\s+/g, '')
    })()

    // Group by type and number within each type
    const byType: Record<string, InfrastructureFeature[]> = {}
    for (const f of compFeatures) {
      if (!byType[f.feature_type]) byType[f.feature_type] = []
      byType[f.feature_type].push(f)
    }

    const updates: { id: string; block: string }[] = []
    for (const [type, feats] of Object.entries(byType)) {
      const abbrev = FEATURE_TYPE_ABBREV[type] || type.substring(0, 3).toUpperCase()
      feats.forEach((f, i) => {
        const num = String(i + 1).padStart(3, '0')
        updates.push({ id: f.id, block: `${sysPrefix}-${abbrev}-${num}` })
      })
    }

    const count = await onBulkFixtureIds(updates)
    if (count > 0) toast.success(`Generated ${count} Fixture ID${count !== 1 ? 's' : ''}`)
    setFixtureIdTarget(null)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 380,
        height: '100%',
        zIndex: 20,
        background: 'rgba(15, 23, 42, 0.95)',
        borderLeft: '1px solid rgba(148, 163, 184, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#22D3EE', flex: 1 }}>
          Audit Mode
        </span>
        <span style={{ fontSize: 10, color: '#64748B' }}>
          {totalFiltered} feature{totalFiltered !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748B',
            fontSize: 16,
            cursor: 'pointer',
            padding: '2px 4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Filter by label, type, or layer..."
          style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: 6,
            padding: '6px 10px',
            color: '#E2E8F0',
            fontSize: 11,
            outline: 'none',
          }}
        />
      </div>

      {/* Generate All Fixture IDs */}
      <div style={{ padding: '0 12px 6px', flexShrink: 0 }}>
        <button
          onClick={handleGenerateAllFixtureIds}
          disabled={generatingAllIds || features.length === 0}
          style={{
            width: '100%',
            padding: '6px 0',
            borderRadius: 6,
            border: '1px solid rgba(168, 85, 247, 0.3)',
            background: 'rgba(168, 85, 247, 0.1)',
            color: '#C084FC',
            fontSize: 11,
            fontWeight: 600,
            cursor: features.length > 0 ? 'pointer' : 'default',
            opacity: generatingAllIds ? 0.6 : 1,
          }}
        >
          {generatingAllIds ? 'Generating...' : `Generate All Fixture IDs (${features.length})`}
        </button>
      </div>

      {/* Bulk Assign Tool */}
      <div style={{ padding: '0 12px', flexShrink: 0 }}>
        <button
          onClick={() => { setBulkAssignOpen(prev => !prev); if (bulkAssignOpen) onHighlightFeatures([]) }}
          style={{
            width: '100%',
            padding: '6px 0',
            borderRadius: 6,
            border: bulkAssignOpen ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(148, 163, 184, 0.15)',
            background: bulkAssignOpen ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
            color: bulkAssignOpen ? '#22D3EE' : '#94A3B8',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 6,
          }}
        >
          {bulkAssignOpen ? '▾ Bulk Assign' : '▸ Bulk Assign'}
        </button>

        {bulkAssignOpen && (
          <div style={{
            background: 'rgba(6, 182, 212, 0.05)',
            border: '1px solid rgba(6, 182, 212, 0.15)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>
              Filter features by layer + type, then assign to a component
            </div>

            {/* Layer filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94A3B8', width: 40, flexShrink: 0 }}>Layer</span>
              <select
                value={baLayer}
                onChange={(e) => setBaLayer(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0F172A',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 4,
                  color: '#E2E8F0',
                  fontSize: 10,
                  padding: '4px 6px',
                }}
              >
                <option value="">All layers</option>
                {uniqueLayers.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Type filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94A3B8', width: 40, flexShrink: 0 }}>Type</span>
              <select
                value={baType}
                onChange={(e) => setBaType(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0F172A',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 4,
                  color: '#E2E8F0',
                  fontSize: 10,
                  padding: '4px 6px',
                }}
              >
                <option value="">All types</option>
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{formatFeatureType(t)}</option>
                ))}
              </select>
            </div>

            {/* Match count */}
            {(baLayer || baType) && (
              <div style={{ fontSize: 10, color: baMatchedFeatures.length > 0 ? '#22D3EE' : '#64748B', fontWeight: 600 }}>
                {baMatchedFeatures.length} feature{baMatchedFeatures.length !== 1 ? 's' : ''} matched
                {baMatchedFeatures.length > 0 && (
                  <span style={{ fontWeight: 400, color: '#64748B' }}>
                    {' '}({baMatchedFeatures.filter(f => f.system_component_id).length} already assigned)
                  </span>
                )}
              </div>
            )}

            {/* Component selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94A3B8', width: 40, flexShrink: 0 }}>Assign</span>
              <select
                value={baComponentId}
                onChange={(e) => setBaComponentId(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0F172A',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 4,
                  color: '#E2E8F0',
                  fontSize: 10,
                  padding: '4px 6px',
                }}
              >
                <option value="">Select component...</option>
                {groupedComponents.map(sys => (
                  <optgroup key={sys.name} label={sys.name}>
                    {sys.components.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Apply button */}
            <button
              onClick={handleBulkAssign}
              disabled={!baComponentId || baMatchedFeatures.length === 0 || baAssigning}
              style={{
                padding: '6px 0',
                borderRadius: 6,
                border: '1px solid rgba(6, 182, 212, 0.3)',
                background: baComponentId && baMatchedFeatures.length > 0
                  ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                color: baComponentId && baMatchedFeatures.length > 0
                  ? '#22D3EE' : '#475569',
                fontSize: 11,
                fontWeight: 600,
                cursor: baComponentId && baMatchedFeatures.length > 0 ? 'pointer' : 'default',
                opacity: baAssigning ? 0.6 : 1,
              }}
            >
              {baAssigning ? 'Assigning...' : `Assign ${baMatchedFeatures.length} Feature${baMatchedFeatures.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Bulk Re-Type Tool */}
        <button
          onClick={() => { setBulkRetypeOpen(prev => !prev); if (bulkRetypeOpen) onHighlightFeatures([]) }}
          style={{
            width: '100%',
            padding: '6px 0',
            borderRadius: 6,
            border: bulkRetypeOpen ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(148, 163, 184, 0.15)',
            background: bulkRetypeOpen ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
            color: bulkRetypeOpen ? '#F97316' : '#94A3B8',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 6,
          }}
        >
          {bulkRetypeOpen ? '▾ Bulk Re-Type' : '▸ Bulk Re-Type'}
        </button>

        {bulkRetypeOpen && (
          <div style={{
            background: 'rgba(249, 115, 22, 0.05)',
            border: '1px solid rgba(249, 115, 22, 0.15)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>
              Filter features by layer + current type, then change to a new type
            </div>

            {/* Layer filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94A3B8', width: 40, flexShrink: 0 }}>Layer</span>
              <select
                value={brLayer}
                onChange={(e) => setBrLayer(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0F172A',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 4,
                  color: '#E2E8F0',
                  fontSize: 10,
                  padding: '4px 6px',
                }}
              >
                <option value="">All layers</option>
                {uniqueLayers.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Current Type filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94A3B8', width: 40, flexShrink: 0 }}>From</span>
              <select
                value={brCurrentType}
                onChange={(e) => setBrCurrentType(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0F172A',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 4,
                  color: '#E2E8F0',
                  fontSize: 10,
                  padding: '4px 6px',
                }}
              >
                <option value="">All types</option>
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{formatFeatureType(t)}</option>
                ))}
              </select>
            </div>

            {/* Match count */}
            {(brLayer || brCurrentType) && (
              <div style={{ fontSize: 10, color: brMatchedFeatures.length > 0 ? '#F97316' : '#64748B', fontWeight: 600 }}>
                {brMatchedFeatures.length} feature{brMatchedFeatures.length !== 1 ? 's' : ''} matched
              </div>
            )}

            {/* New Type selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94A3B8', width: 40, flexShrink: 0 }}>To</span>
              <select
                value={brNewType}
                onChange={(e) => setBrNewType(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0F172A',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 4,
                  color: '#E2E8F0',
                  fontSize: 10,
                  padding: '4px 6px',
                }}
              >
                <option value="">Select new type...</option>
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{formatFeatureType(t)}</option>
                ))}
              </select>
            </div>

            {/* Apply button */}
            <button
              onClick={handleBulkRetype}
              disabled={!brNewType || brMatchedFeatures.length === 0 || brRetyping}
              style={{
                padding: '6px 0',
                borderRadius: 6,
                border: '1px solid rgba(249, 115, 22, 0.3)',
                background: brNewType && brMatchedFeatures.length > 0
                  ? 'rgba(249, 115, 22, 0.2)' : 'transparent',
                color: brNewType && brMatchedFeatures.length > 0
                  ? '#F97316' : '#475569',
                fontSize: 11,
                fontWeight: 600,
                cursor: brNewType && brMatchedFeatures.length > 0 ? 'pointer' : 'default',
                opacity: brRetyping ? 0.6 : 1,
              }}
            >
              {brRetyping ? 'Re-typing...' : `Re-Type ${brMatchedFeatures.length} Feature${brMatchedFeatures.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {groupedComponents.map(system => {
          const systemCompIds = system.components.map(c => c.id)
          const systemFeatureCount = systemCompIds.reduce((s, cid) => s + (byComponent[cid]?.length || 0), 0)
          if (systemFeatureCount === 0 && searchText) return null

          const sysExpanded = expandedSystems[system.name] !== false // default open

          return (
            <div key={system.name} style={{ marginTop: 8 }}>
              {/* System header */}
              <div
                onClick={() => toggleSystem(system.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 0',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                }}
              >
                <span style={{ fontSize: 9, color: '#64748B', width: 10, textAlign: 'center' }}>
                  {sysExpanded ? '▼' : '▶'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', flex: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {system.name}
                </span>
                <span style={{ fontSize: 10, color: '#64748B' }}>
                  {systemFeatureCount}
                </span>
              </div>

              {sysExpanded && system.components.map(comp => {
                const compFeatures = byComponent[comp.id] || []
                if (compFeatures.length === 0 && searchText) return null
                const compExpanded = expandedComponents[comp.id] !== false

                return (
                  <div key={comp.id} style={{ marginLeft: 8 }}>
                    {/* Component header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 0',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        onClick={() => toggleComponent(comp.id)}
                        style={{ fontSize: 9, color: '#64748B', width: 10, textAlign: 'center' }}
                      >
                        {compExpanded ? '▼' : '▶'}
                      </span>
                      <span
                        onClick={() => {
                          toggleComponent(comp.id)
                          if (!compExpanded) {
                            onComponentGroupClick(comp.id, compFeatures.map(f => f.id))
                          }
                        }}
                        style={{ fontSize: 11, fontWeight: 600, color: '#CBD5E1', flex: 1, cursor: 'pointer' }}
                      >
                        {comp.label}
                      </span>
                      <span style={{ fontSize: 10, color: '#64748B', marginRight: 4 }}>
                        {compFeatures.length}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Fly to component features
                          if (compFeatures.length > 0) {
                            onComponentGroupClick(comp.id, compFeatures.map(f => f.id))
                          }
                        }}
                        title="Zoom to features"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748B',
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '0 2px',
                        }}
                      >
                        ◎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setPrefixTarget(prefixTarget === comp.id ? null : comp.id)
                        }}
                        title="Apply prefix to all labels"
                        style={{
                          background: prefixTarget === comp.id ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                          border: prefixTarget === comp.id ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
                          borderRadius: 4,
                          color: prefixTarget === comp.id ? '#22D3EE' : '#64748B',
                          fontSize: 10,
                          cursor: 'pointer',
                          padding: '1px 5px',
                          fontWeight: 600,
                        }}
                      >
                        Aa+
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setFixtureIdTarget(fixtureIdTarget === comp.id ? null : comp.id)
                        }}
                        title="Generate Fixture IDs"
                        style={{
                          background: fixtureIdTarget === comp.id ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                          border: fixtureIdTarget === comp.id ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                          borderRadius: 4,
                          color: fixtureIdTarget === comp.id ? '#C084FC' : '#64748B',
                          fontSize: 10,
                          cursor: 'pointer',
                          padding: '1px 5px',
                          fontWeight: 600,
                        }}
                      >
                        #ID
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm(`Delete all ${compFeatures.length} features in ${comp.label}?`)) return
                          const ids = compFeatures.map(f => f.id)
                          const count = await onBulkDelete(ids)
                          if (count > 0) toast.success(`Deleted ${count} features`)
                        }}
                        title="Delete all features in this component"
                        style={{
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: 4,
                          color: '#64748B',
                          fontSize: 10,
                          cursor: 'pointer',
                          padding: '1px 5px',
                          fontWeight: 600,
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Prefix form */}
                    {prefixTarget === comp.id && (
                      <PrefixForm
                        onApply={(prefix) => handlePrefixApply(comp.id, prefix)}
                        onApplySequential={(prefix, startAt) => handleSequentialApply(comp.id, prefix, startAt)}
                        featureCount={(byComponent[comp.id] || []).length}
                        onCancel={() => setPrefixTarget(null)}
                      />
                    )}

                    {/* Fixture ID generator */}
                    {fixtureIdTarget === comp.id && (
                      <FixtureIdForm
                        comp={comp}
                        features={compFeatures}
                        onGenerate={(customPrefix) => handleGenerateFixtureIds(comp.id, customPrefix)}
                        onCancel={() => setFixtureIdTarget(null)}
                      />
                    )}

                    {/* Feature rows */}
                    {compExpanded && compFeatures
                      .sort((a, b) => (a.block || a.label || '').localeCompare(b.block || b.label || ''))
                      .map(f => (
                        <div
                          key={f.id}
                          onClick={() => onFeatureClick(f)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 0 3px 24px',
                            cursor: 'pointer',
                            fontSize: 11,
                            color: '#94A3B8',
                            borderLeft: `2px solid ${TYPE_COLORS[f.feature_type] || '#475569'}`,
                            marginLeft: 4,
                          }}
                        >
                          {/* Status dot */}
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: f.status === 'inoperative' ? '#EF4444' : '#22C55E',
                              flexShrink: 0,
                            }}
                          />
                          {/* Type */}
                          <span style={{ fontSize: 10, color: '#64748B', minWidth: 50, flexShrink: 0 }}>
                            {formatFeatureType(f.feature_type).split(' ').slice(-1)[0]}
                          </span>
                          {/* Sign text (editable, signs only) */}
                          {SIGN_TYPES.has(f.feature_type) && (
                            <span style={{ minWidth: 0 }}>
                              <EditableLabel
                                value={f.label || ''}
                                onSave={(newLabel) => onLabelUpdate(f.id, newLabel)}
                              />
                            </span>
                          )}
                          {/* Fixture ID */}
                          <span style={{ flex: 1, fontSize: 9, color: '#64748B', fontFamily: 'monospace', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.block || <span style={{ color: '#475569', fontStyle: 'italic' }}>no ID</span>}
                          </span>
                          {/* Reassign button */}
                          {reassigning === f.id ? (
                            <select
                              autoFocus
                              value={f.system_component_id || ''}
                              onChange={async (e) => {
                                const val = e.target.value || null
                                await onComponentReassign(f.id, val)
                                setReassigning(null)
                              }}
                              onBlur={() => setReassigning(null)}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                background: '#0F172A',
                                border: '1px solid rgba(6, 182, 212, 0.4)',
                                borderRadius: 4,
                                color: '#E2E8F0',
                                fontSize: 10,
                                padding: '2px 4px',
                                maxWidth: 140,
                              }}
                            >
                              <option value="">Unassigned</option>
                              {groupedComponents.map(sys => (
                                <optgroup key={sys.name} label={sys.name}>
                                  {sys.components.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setReassigning(f.id) }}
                              title="Reassign component"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#475569',
                                fontSize: 10,
                                cursor: 'pointer',
                                padding: '0 2px',
                              }}
                            >
                              ⇄
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Unassigned features */}
        {unassigned.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div
              onClick={() => toggleSystem('__unassigned')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 0',
                cursor: 'pointer',
                borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              }}
            >
              <span style={{ fontSize: 9, color: '#64748B', width: 10, textAlign: 'center' }}>
                {expandedSystems['__unassigned'] !== false ? '▼' : '▶'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', flex: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Unassigned
              </span>
              <span style={{ fontSize: 10, color: '#F59E0B' }}>
                {unassigned.length}
              </span>
            </div>

            {expandedSystems['__unassigned'] !== false && (
              <div>
                {/* Group unassigned by layer */}
                {Array.from(new Set(unassigned.map(f => f.layer || 'Unknown'))).sort().map(layer => {
                  const layerFeatures = unassigned.filter(f => (f.layer || 'Unknown') === layer)
                  return (
                    <div key={layer} style={{ marginLeft: 8 }}>
                      <div
                        onClick={() => toggleComponent(`unassigned:${layer}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 9, color: '#64748B', width: 10, textAlign: 'center' }}>
                          {expandedComponents[`unassigned:${layer}`] !== false ? '▼' : '▶'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#CBD5E1', flex: 1 }}>
                          {layer}
                        </span>
                        <span style={{ fontSize: 10, color: '#64748B' }}>{layerFeatures.length}</span>
                      </div>

                      {expandedComponents[`unassigned:${layer}`] !== false && layerFeatures
                        .sort((a, b) => (a.block || a.label || '').localeCompare(b.block || b.label || ''))
                        .map(f => (
                          <div
                            key={f.id}
                            onClick={() => onFeatureClick(f)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 0 3px 24px',
                              cursor: 'pointer',
                              fontSize: 11,
                              color: '#94A3B8',
                              borderLeft: `2px solid ${TYPE_COLORS[f.feature_type] || '#475569'}`,
                              marginLeft: 4,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: f.status === 'inoperative' ? '#EF4444' : '#22C55E',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: 10, color: '#64748B', minWidth: 70, flexShrink: 0 }}>
                              {formatFeatureType(f.feature_type)}
                            </span>
                            {/* Sign text (editable, signs only) */}
                            {SIGN_TYPES.has(f.feature_type) && (
                              <span style={{ minWidth: 0 }}>
                                <EditableLabel
                                  value={f.label || ''}
                                  onSave={(newLabel) => onLabelUpdate(f.id, newLabel)}
                                />
                              </span>
                            )}
                            {/* Fixture ID */}
                            <span style={{ flex: 1, fontSize: 9, color: '#64748B', fontFamily: 'monospace', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {f.block || <span style={{ color: '#475569', fontStyle: 'italic' }}>no ID</span>}
                            </span>
                            {/* Assign to component */}
                            {reassigning === f.id ? (
                              <select
                                autoFocus
                                value=""
                                onChange={async (e) => {
                                  const val = e.target.value || null
                                  await onComponentReassign(f.id, val)
                                  setReassigning(null)
                                }}
                                onBlur={() => setReassigning(null)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  background: '#0F172A',
                                  border: '1px solid rgba(6, 182, 212, 0.4)',
                                  borderRadius: 4,
                                  color: '#E2E8F0',
                                  fontSize: 10,
                                  padding: '2px 4px',
                                  maxWidth: 140,
                                }}
                              >
                                <option value="">Select...</option>
                                {groupedComponents.map(sys => (
                                  <optgroup key={sys.name} label={sys.name}>
                                    {sys.components.map(c => (
                                      <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setReassigning(f.id) }}
                                title="Assign to component"
                                style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  borderRadius: 4,
                                  color: '#F59E0B',
                                  fontSize: 9,
                                  cursor: 'pointer',
                                  padding: '1px 6px',
                                  fontWeight: 600,
                                }}
                              >
                                Assign
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {totalFiltered === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, padding: '40px 0' }}>
            {searchText ? 'No features match filter' : 'No features found'}
          </div>
        )}
      </div>
    </div>
  )
}
