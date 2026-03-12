'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { createDefaultTemplate, fetchInspectionTemplate } from '@/lib/supabase/inspection-templates'
import { fetchInstallationNavaids } from '@/lib/supabase/installations'
import {
  fetchChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  type ShiftChecklistItem,
  type ShiftType,
  type FrequencyType,
} from '@/lib/supabase/shift-checklist'
import { fetchNavaidStatuses, type NavaidStatus } from '@/lib/supabase/navaids'
import {
  fetchLightingSystems,
  fetchLightingSystemWithComponents,
  createLightingSystem,
  updateLightingSystem,
  deleteLightingSystem,
  createSystemComponent,
  updateSystemComponent,
  deleteSystemComponent,
  fetchOutageRuleTemplates,
  cloneComponentsFromTemplates,
} from '@/lib/supabase/lighting-systems'
import { bulkAssignComponent, fetchInfrastructureFeatures } from '@/lib/supabase/infrastructure-features'
import { SYSTEM_TYPE_LABELS, SYSTEM_TYPES } from '@/lib/outage-rules'
import type { LightingSystem, LightingSystemComponent, OutageRuleTemplate, InfrastructureFeature } from '@/lib/supabase/types'

type SetupTab = 'runways' | 'navaids' | 'areas' | 'arff' | 'shops' | 'templates' | 'shiftchecklist' | 'qrc' | 'lighting'

export default function BaseSetupPage() {
  const { installationId, currentInstallation, runways, areas, ceShops, arffAircraft, userRole } = useInstallation()
  const [activeTab, setActiveTab] = useState<SetupTab>('runways')
  const [showPreview, setShowPreview] = useState(false)

  const canEdit = userRole === 'airfield_manager' || userRole === 'sys_admin' || userRole === 'base_admin' || userRole === 'namo'

  if (!canEdit) {
    return (
      <div style={{ padding: 24 }}>
        <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
          &larr; Settings
        </Link>
        <h1 style={{ marginTop: 16, fontSize: 'var(--fs-4xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>Base Configuration</h1>
        <p style={{ color: 'var(--color-text-3)', marginTop: 8 }}>
          Only Airfield Managers and System Admins can configure base settings.
        </p>
      </div>
    )
  }

  const TABS: { key: SetupTab; label: string }[] = [
    { key: 'runways', label: 'Runways' },
    { key: 'navaids', label: 'NAVAIDs' },
    { key: 'areas', label: 'Areas' },
    { key: 'arff', label: 'ARFF Aircraft' },
    { key: 'shops', label: 'CE Shops' },
    { key: 'templates', label: 'Templates' },
    { key: 'shiftchecklist', label: 'Shift Checklist' },
    { key: 'qrc', label: 'QRC Templates' },
    { key: 'lighting', label: 'Lighting Systems' },
  ]

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
        &larr; Settings
      </Link>
      <h1 style={{ marginTop: 12, fontSize: 'var(--fs-4xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
        Base Configuration
      </h1>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginTop: 4 }}>
        {currentInstallation?.name ?? 'Current Base'} ({currentInstallation?.icao ?? '—'})
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); window.scrollTo(0, 0) }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                cursor: 'pointer',
                fontSize: 'var(--fs-md)',
                fontWeight: 700,
                fontFamily: 'inherit',
                background: isActive ? 'rgba(56,189,248,0.12)' : 'var(--color-bg-inset)',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-2)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{
        marginTop: 16,
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 16,
      }}>
        {activeTab === 'runways' && <RunwayTab runways={runways} installationId={installationId} />}
        {activeTab === 'navaids' && <NavaidTab installationId={installationId} />}
        {activeTab === 'areas' && <SimpleListTab title="Airfield Areas" items={areas} tableName="base_areas" fieldName="area_name" installationId={installationId} />}
        {activeTab === 'arff' && <SimpleListTab title="ARFF Aircraft" items={arffAircraft} tableName="base_arff_aircraft" fieldName="aircraft_name" installationId={installationId} />}
        {activeTab === 'shops' && <ShopsTab shops={ceShops} installationId={installationId} />}
        {activeTab === 'templates' && <TemplatesTab installationId={installationId} />}
        {activeTab === 'shiftchecklist' && <ShiftChecklistTab installationId={installationId} currentInstallation={currentInstallation} />}
        {activeTab === 'qrc' && <QrcTemplatesTab installationId={installationId} />}
        {activeTab === 'lighting' && <LightingSystemsTab installationId={installationId} />}
      </div>

      {/* Preview Dashboard Button */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        style={{
          marginTop: 16,
          width: '100%',
          padding: '12px 16px',
          borderRadius: 10,
          border: showPreview ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
          cursor: 'pointer',
          fontSize: 'var(--fs-lg)',
          fontWeight: 700,
          fontFamily: 'inherit',
          background: showPreview ? 'rgba(56,189,248,0.08)' : 'var(--color-surface-1)',
          color: showPreview ? 'var(--color-accent)' : 'var(--color-text-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {showPreview ? 'Hide Preview' : 'Preview Dashboard'}
      </button>

      {/* Dashboard Preview */}
      {showPreview && <DashboardPreview installationId={installationId} currentInstallation={currentInstallation} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Runway Tab — editable
// ═══════════════════════════════════════════════════════════════

function RunwayTab({
  runways: initialRunways,
  installationId,
}: {
  runways: ReturnType<typeof useInstallation>['runways']
  installationId: string | null
}) {
  const [runways, setRunways] = useState(initialRunways)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  // New runway form state
  const [newRunway, setNewRunway] = useState({
    runway_id: '',
    length_ft: '',
    width_ft: '',
    surface: 'Asphalt',
    true_heading: '',
    runway_class: 'B',
    end1_designator: '',
    end1_latitude: '',
    end1_longitude: '',
    end1_elevation_msl: '',
    end2_designator: '',
    end2_latitude: '',
    end2_longitude: '',
    end2_elevation_msl: '',
  })

  const handleAddRunway = async () => {
    if (!installationId || !newRunway.runway_id.trim()) return
    setSaving(true)
    const supabase = createClient()
    if (!supabase) { setSaving(false); return }

    const insert = {
      base_id: installationId,
      runway_id: newRunway.runway_id.trim(),
      length_ft: parseInt(newRunway.length_ft) || 0,
      width_ft: parseInt(newRunway.width_ft) || 0,
      surface: newRunway.surface,
      true_heading: parseFloat(newRunway.true_heading) || null,
      runway_class: newRunway.runway_class,
      end1_designator: newRunway.end1_designator.trim() || newRunway.runway_id.split('/')[0] || '',
      end1_latitude: parseFloat(newRunway.end1_latitude) || null,
      end1_longitude: parseFloat(newRunway.end1_longitude) || null,
      end1_heading: null,
      end1_approach_lighting: null,
      end1_elevation_msl: parseFloat(newRunway.end1_elevation_msl) || null,
      end2_designator: newRunway.end2_designator.trim() || newRunway.runway_id.split('/')[1] || '',
      end2_latitude: parseFloat(newRunway.end2_latitude) || null,
      end2_longitude: parseFloat(newRunway.end2_longitude) || null,
      end2_heading: null,
      end2_approach_lighting: null,
      end2_elevation_msl: parseFloat(newRunway.end2_elevation_msl) || null,
    }

    const { data, error } = await supabase
      .from('base_runways')
      .insert(insert)
      .select('*')
      .single()

    if (error) {
      toast.error(`Failed to add runway: ${error.message}`)
    } else {
      toast.success(`Runway ${newRunway.runway_id} added`)
      setRunways(prev => [...prev, data as typeof prev[number]])
      setAdding(false)
      setNewRunway({ runway_id: '', length_ft: '', width_ft: '', surface: 'Asphalt', true_heading: '', runway_class: 'B', end1_designator: '', end1_latitude: '', end1_longitude: '', end1_elevation_msl: '', end2_designator: '', end2_latitude: '', end2_longitude: '', end2_elevation_msl: '' })
    }
    setSaving(false)
  }

  const handleDeleteRunway = async (rwy: typeof runways[0]) => {
    if (!confirm(`Delete runway ${rwy.runway_id}? This cannot be undone.`)) return
    const supabase = createClient()
    if (!supabase) return

    const { error } = await supabase.from('base_runways').delete().eq('id', rwy.id)
    if (error) {
      toast.error(`Failed to delete: ${error.message}`)
    } else {
      toast.success(`Runway ${rwy.runway_id} deleted`)
      setRunways(prev => prev.filter(r => r.id !== rwy.id))
    }
  }

  const fieldStyle = {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-inset)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-md)',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>Runways</h3>

      {runways.length === 0 && !adding && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>No runways configured yet.</p>
      )}

      {runways.map(rwy => (
        <div key={rwy.id} style={{
          padding: 12,
          background: 'var(--color-bg-inset)',
          borderRadius: 8,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--color-text-1)' }}>
              {rwy.runway_id} — {rwy.runway_class === 'Army_B' ? 'Army Class B' : `Class ${rwy.runway_class}`}
            </div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginTop: 4 }}>
              {rwy.length_ft} ft x {rwy.width_ft} ft | {rwy.surface} | Heading {rwy.true_heading}°
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4, fontFamily: 'monospace' }}>
              {rwy.end1_designator}: {rwy.end1_latitude?.toFixed(5)}°N, {rwy.end1_longitude ? Math.abs(rwy.end1_longitude).toFixed(5) : '—'}°W{rwy.end1_elevation_msl != null ? ` | ${rwy.end1_elevation_msl} ft MSL` : ''}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2, fontFamily: 'monospace' }}>
              {rwy.end2_designator}: {rwy.end2_latitude?.toFixed(5)}°N, {rwy.end2_longitude ? Math.abs(rwy.end2_longitude).toFixed(5) : '—'}°W{rwy.end2_elevation_msl != null ? ` | ${rwy.end2_elevation_msl} ft MSL` : ''}
            </div>
          </div>
          <button
            onClick={() => handleDeleteRunway(rwy)}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-danger)', cursor: 'pointer',
              fontSize: 'var(--fs-3xl)', padding: '0 4px', flexShrink: 0,
            }}
            title="Delete runway"
          >
            &times;
          </button>
        </div>
      ))}

      {adding ? (
        <div style={{
          padding: 14,
          background: 'var(--color-bg-inset)',
          borderRadius: 8,
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>Add Runway</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Runway ID (e.g. 01/19)</label>
              <input value={newRunway.runway_id} onChange={e => setNewRunway(p => ({ ...p, runway_id: e.target.value }))} placeholder="01/19" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Runway Class</label>
              <select value={newRunway.runway_class} onChange={e => setNewRunway(p => ({ ...p, runway_class: e.target.value }))} style={fieldStyle}>
                <option value="B">Class B</option>
                <option value="Army_B">Army Class B</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Length (ft)</label>
              <input type="number" value={newRunway.length_ft} onChange={e => setNewRunway(p => ({ ...p, length_ft: e.target.value }))} placeholder="9000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Width (ft)</label>
              <input type="number" value={newRunway.width_ft} onChange={e => setNewRunway(p => ({ ...p, width_ft: e.target.value }))} placeholder="150" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>True Heading (°)</label>
              <input type="number" value={newRunway.true_heading} onChange={e => setNewRunway(p => ({ ...p, true_heading: e.target.value }))} placeholder="10" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Surface</label>
            <select value={newRunway.surface} onChange={e => setNewRunway(p => ({ ...p, surface: e.target.value }))} style={fieldStyle}>
              <option>Asphalt</option>
              <option>Concrete</option>
              <option>Asphalt/Concrete</option>
            </select>
          </div>

          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-2)', marginTop: 4 }}>End 1</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Designator</label>
              <input value={newRunway.end1_designator} onChange={e => setNewRunway(p => ({ ...p, end1_designator: e.target.value }))} placeholder="01" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input type="number" step="0.00001" value={newRunway.end1_latitude} onChange={e => setNewRunway(p => ({ ...p, end1_latitude: e.target.value }))} placeholder="42.61000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input type="number" step="0.00001" value={newRunway.end1_longitude} onChange={e => setNewRunway(p => ({ ...p, end1_longitude: e.target.value }))} placeholder="-82.83000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Elev (ft MSL)</label>
              <input type="number" step="0.1" value={newRunway.end1_elevation_msl} onChange={e => setNewRunway(p => ({ ...p, end1_elevation_msl: e.target.value }))} placeholder="580" style={fieldStyle} />
            </div>
          </div>

          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-2)', marginTop: 4 }}>End 2</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Designator</label>
              <input value={newRunway.end2_designator} onChange={e => setNewRunway(p => ({ ...p, end2_designator: e.target.value }))} placeholder="19" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input type="number" step="0.00001" value={newRunway.end2_latitude} onChange={e => setNewRunway(p => ({ ...p, end2_latitude: e.target.value }))} placeholder="42.62000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input type="number" step="0.00001" value={newRunway.end2_longitude} onChange={e => setNewRunway(p => ({ ...p, end2_longitude: e.target.value }))} placeholder="-82.84000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Elev (ft MSL)</label>
              <input type="number" step="0.1" value={newRunway.end2_elevation_msl} onChange={e => setNewRunway(p => ({ ...p, end2_elevation_msl: e.target.value }))} placeholder="580" style={fieldStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={handleAddRunway}
              disabled={saving || !newRunway.runway_id.trim()}
              style={{
                flex: 1,
                padding: '10px 16px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: saving || !newRunway.runway_id.trim() ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Runway'}
            </button>
            <button
              onClick={() => setAdding(false)}
              style={{
                padding: '10px 16px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-inset)',
                color: 'var(--color-text-2)',
                fontSize: 'var(--fs-md)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            marginTop: 8,
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px dashed var(--color-border)',
            background: 'none',
            color: 'var(--color-accent)',
            cursor: 'pointer',
            fontSize: 'var(--fs-md)',
            fontWeight: 600,
            fontFamily: 'inherit',
            width: '100%',
          }}
        >
          + Add Runway
        </button>
      )}

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 12 }}>
        Runway coordinates are used for obstruction evaluations and weather lookups.
        Ensure latitude/longitude values are accurate for your runway endpoints.
      </p>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  color: 'var(--color-text-3)',
  letterSpacing: '0.06em',
  marginBottom: 3,
}

// ═══════════════════════════════════════════════════════════════
// NAVAID Tab — loads from DB, creates navaid_statuses entries
// ═══════════════════════════════════════════════════════════════

function NavaidTab({ installationId }: { installationId: string | null }) {
  const [navaids, setNavaids] = useState<{ id: string; navaid_name: string; sort_order: number }[]>([])
  const [statuses, setStatuses] = useState<NavaidStatus[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)

  const loadNavaids = useCallback(async () => {
    if (!installationId) return
    const scrollY = window.scrollY
    setLoading(true)
    const navaidData = await fetchInstallationNavaids(installationId)
    setNavaids(navaidData)
    const statusData = await fetchNavaidStatuses(installationId)
    setStatuses(statusData)
    setLoading(false)
    requestAnimationFrame(() => window.scrollTo(0, scrollY))
  }, [installationId])

  useEffect(() => { loadNavaids() }, [loadNavaids])

  const handleAdd = async () => {
    if (!newItem.trim() || !installationId) return
    const supabase = createClient()
    if (!supabase) return

    const maxSort = navaids.length

    // Add to base_navaids config table
    const { data: navaidRow, error: navaidErr } = await supabase
      .from('base_navaids')
      .insert({ base_id: installationId, navaid_name: newItem.trim(), sort_order: maxSort })
      .select('*')
      .single()

    if (navaidErr) {
      toast.error(`Failed to add: ${navaidErr.message}`)
      return
    }

    // Also create a navaid_statuses entry so it appears on the dashboard
    await supabase
      .from('navaid_statuses')
      .insert({
        navaid_name: newItem.trim(),
        base_id: installationId,
        status: 'green',
        notes: null,
        updated_by: null,
      })

    toast.success(`Added "${newItem.trim()}"`)
    setNavaids(prev => [...prev, navaidRow as typeof prev[number]])
    setNewItem('')
    // Reload to get updated statuses
    await loadNavaids()
  }

  const handleDelete = async (navaid: { id: string; navaid_name: string }) => {
    if (!confirm(`Delete "${navaid.navaid_name}"?`) || !installationId) return
    const supabase = createClient()
    if (!supabase) return

    // Delete from base_navaids
    await supabase.from('base_navaids').delete().eq('id', navaid.id)

    // Also delete from navaid_statuses
    await supabase
      .from('navaid_statuses')
      .delete()
      .eq('base_id', installationId)
      .eq('navaid_name', navaid.navaid_name)

    toast.success(`Deleted "${navaid.navaid_name}"`)
    setNavaids(prev => prev.filter(n => n.id !== navaid.id))
    setStatuses(prev => prev.filter(s => s.navaid_name !== navaid.navaid_name))
  }

  if (loading) {
    return <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading NAVAIDs...</p>
  }

  // Build a lookup of status by name
  const statusMap: Record<string, NavaidStatus> = {}
  statuses.forEach(s => { statusMap[s.navaid_name] = s })

  const STATUS_COLORS: Record<string, string> = {
    green: 'var(--color-success)',
    yellow: 'var(--color-warning)',
    red: 'var(--color-danger)',
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>NAVAIDs</h3>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        NAVAIDs added here will appear on the dashboard for status tracking.
      </p>

      {navaids.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No NAVAIDs configured.</p>
      )}

      {navaids.map(navaid => {
        const status = statusMap[navaid.navaid_name]
        return (
          <div key={navaid.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 'var(--fs-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {status && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: STATUS_COLORS[status.status] ?? 'var(--color-text-3)',
                  flexShrink: 0,
                }} />
              )}
              <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{navaid.navaid_name}</span>
              {status && (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                  ({status.status})
                </span>
              )}
            </div>
            <button
              onClick={() => handleDelete(navaid)}
              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px' }}
            >
              &times;
            </button>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add NAVAID (e.g. ILS 01, TACAN, ASR-9)..."
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            color: '#fff',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: !newItem.trim() ? 0.5 : 1,
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Simple list tab for Areas
// ═══════════════════════════════════════════════════════════════

function SimpleListTab({
  title, items, tableName, fieldName, installationId,
}: {
  title: string
  items: string[]
  tableName: string
  fieldName: string
  installationId: string | null
}) {
  const [list, setList] = useState<string[]>(items)
  const [newItem, setNewItem] = useState('')

  const handleAdd = async () => {
    if (!newItem.trim() || !installationId) return
    const supabase = createClient()
    if (!supabase) return

    const maxSort = list.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)(tableName)
      .insert({ base_id: installationId, [fieldName]: newItem.trim(), sort_order: maxSort })

    if (error) {
      toast.error(`Failed to add: ${error.message}`)
    } else {
      toast.success(`Added "${newItem.trim()}"`)
      setList(prev => [...prev, newItem.trim()])
      setNewItem('')
    }
  }

  const handleDelete = async (item: string) => {
    if (!confirm(`Delete "${item}"?`) || !installationId) return
    const supabase = createClient()
    if (!supabase) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)(tableName)
      .delete()
      .eq('base_id', installationId)
      .eq(fieldName, item)

    if (error) {
      toast.error(`Failed to delete: ${error.message}`)
    } else {
      toast.success(`Deleted "${item}"`)
      setList(prev => prev.filter(i => i !== item))
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>{title}</h3>
      {list.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No items configured.</p>
      )}
      {list.map(item => (
        <div key={item} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid var(--color-border)',
          fontSize: 'var(--fs-md)',
        }}>
          <span style={{ color: 'var(--color-text-1)' }}>{item}</span>
          <button
            onClick={() => handleDelete(item)}
            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px' }}
          >
            &times;
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={`Add ${title.toLowerCase().replace(/s$/, '')}...`}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            color: '#fff',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: !newItem.trim() ? 0.5 : 1,
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CE Shops tab
// ═══════════════════════════════════════════════════════════════

function ShopsTab({ shops, installationId }: { shops: string[]; installationId: string | null }) {
  const [list, setList] = useState<string[]>(shops)
  const [newShop, setNewShop] = useState('')

  const saveToDb = async (updatedList: string[]) => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return

    const { error } = await supabase
      .from('bases')
      .update({ ce_shops: updatedList })
      .eq('id', installationId)

    if (error) {
      toast.error(`Failed to save: ${error.message}`)
    }
  }

  const handleAdd = async () => {
    if (!newShop.trim()) return
    const updated = [...list, newShop.trim()]
    setList(updated)
    setNewShop('')
    await saveToDb(updated)
    toast.success(`Added "${newShop.trim()}"`)
  }

  const handleDelete = async (shop: string) => {
    if (!confirm(`Delete "${shop}"?`)) return
    const updated = list.filter(s => s !== shop)
    setList(updated)
    await saveToDb(updated)
    toast.success(`Deleted "${shop}"`)
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>CE Shops</h3>
      {list.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No CE shops configured.</p>
      )}
      {list.map(shop => (
        <div key={shop} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-md)',
        }}>
          <span style={{ color: 'var(--color-text-1)' }}>{shop}</span>
          <button
            onClick={() => handleDelete(shop)}
            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px' }}
          >
            &times;
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={newShop}
          onChange={e => setNewShop(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add CE shop..."
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newShop.trim()}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            color: '#fff',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: !newShop.trim() ? 0.5 : 1,
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Templates tab
// ═══════════════════════════════════════════════════════════════

function TemplatesTab({ installationId }: { installationId: string | null }) {
  const [cloning, setCloning] = useState(false)
  const [hasAirfield, setHasAirfield] = useState<boolean | null>(null)
  const [hasLighting, setHasLighting] = useState<boolean | null>(null)

  useEffect(() => {
    async function check() {
      if (!installationId) return
      const af = await fetchInspectionTemplate(installationId, 'airfield')
      const lt = await fetchInspectionTemplate(installationId, 'lighting')
      setHasAirfield(af.length > 0)
      setHasLighting(lt.length > 0)
    }
    check()
  }, [installationId])

  const handleCloneDefaults = async () => {
    if (!installationId) return
    setCloning(true)
    const af = await createDefaultTemplate(installationId, 'airfield')
    const lt = await createDefaultTemplate(installationId, 'lighting')
    if (af && lt) {
      toast.success('Default inspection templates created')
      setHasAirfield(true)
      setHasLighting(true)
    } else {
      toast.error('Some templates failed to create — does a source template exist?')
    }
    setCloning(false)
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
        Inspection Templates
      </h3>
      <p style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginBottom: 12 }}>
        Manage checklist items for airfield and lighting inspections.
      </p>

      {/* Status indicators */}
      {hasAirfield !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-md)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasAirfield ? 'var(--color-success)' : 'var(--color-danger)' }} />
            <span style={{ color: 'var(--color-text-1)' }}>Airfield template</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              {hasAirfield ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-md)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasLighting ? 'var(--color-success)' : 'var(--color-danger)' }} />
            <span style={{ color: 'var(--color-text-1)' }}>Lighting template</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              {hasLighting ? 'Configured' : 'Not configured'}
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href="/settings/templates"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px 16px', borderRadius: 8,
            background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
            color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          Edit Templates
        </a>
        {(!hasAirfield || !hasLighting) && (
          <button
            onClick={handleCloneDefaults}
            disabled={cloning}
            style={{
              padding: '10px 16px', borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
              color: '#fff',
              fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
              cursor: cloning ? 'wait' : 'pointer',
              opacity: cloning ? 0.5 : 1,
            }}
          >
            {cloning ? 'Creating...' : 'Initialize from Default Template'}
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Dashboard Preview — shows live data without navigating away
// ═══════════════════════════════════════════════════════════════

function DashboardPreview({
  installationId,
  currentInstallation,
}: {
  installationId: string | null
  currentInstallation: ReturnType<typeof useInstallation>['currentInstallation']
}) {
  const [navaidStatuses, setNavaidStatuses] = useState<NavaidStatus[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [navaids, setNavaids] = useState<{ navaid_name: string }[]>([])
  const [runwayCount, setRunwayCount] = useState(0)
  const [templateStatus, setTemplateStatus] = useState<{ airfield: number; lighting: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!installationId) { setLoading(false); return }
      setLoading(true)

      const supabase = createClient()

      // Fetch all live data in parallel
      const [navaidData, navaidConfigData, areaData, runwayData, afTemplate, ltTemplate] = await Promise.all([
        fetchNavaidStatuses(installationId),
        fetchInstallationNavaids(installationId),
        supabase
          ? supabase.from('base_areas').select('area_name').eq('base_id', installationId).order('sort_order')
          : Promise.resolve({ data: [] }),
        supabase
          ? supabase.from('base_runways').select('id').eq('base_id', installationId)
          : Promise.resolve({ data: [] }),
        fetchInspectionTemplate(installationId, 'airfield'),
        fetchInspectionTemplate(installationId, 'lighting'),
      ])

      setNavaidStatuses(navaidData)
      setNavaids(navaidConfigData)
      setAreas(areaData?.data?.map((a: { area_name: string }) => a.area_name) ?? [])
      setRunwayCount(runwayData?.data?.length ?? 0)
      setTemplateStatus({
        airfield: afTemplate.reduce((sum: number, s: { items: unknown[] }) => sum + s.items.length, 0),
        lighting: ltTemplate.reduce((sum: number, s: { items: unknown[] }) => sum + s.items.length, 0),
      })

      setLoading(false)
    }
    load()
  }, [installationId])

  const STATUS_COLORS: Record<string, string> = {
    green: '#34D399',
    yellow: '#FBBF24',
    red: '#EF4444',
  }

  if (loading) {
    return (
      <div style={{ marginTop: 16, textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
        Loading preview...
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 16,
      border: '2px solid var(--color-accent)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Preview header */}
      <div style={{
        background: 'rgba(56,189,248,0.08)',
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-accent)' }}>
          Dashboard Preview
        </div>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>Live data from database</span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Base name */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {currentInstallation?.name ?? 'Unnamed Base'}
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', marginTop: 2 }}>
            {currentInstallation?.icao ?? 'No ICAO'} | {runwayCount} runway{runwayCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* NAVAIDs section — mirrors dashboard */}
        <div>
          <div style={{
            fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
            letterSpacing: '0.06em', marginBottom: 8,
          }}>
            NAVAID STATUS ({navaidStatuses.length})
          </div>
          {navaidStatuses.length === 0 ? (
            <div style={{
              padding: 12, borderRadius: 8,
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-base)', textAlign: 'center',
            }}>
              No NAVAIDs configured — add them in the NAVAIDs tab
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {navaidStatuses.map(n => (
                <div key={n.id} style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: `${STATUS_COLORS[n.status]}15`,
                  border: `1px solid ${STATUS_COLORS[n.status]}40`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                    {n.navaid_name}
                  </div>
                  <div style={{
                    fontSize: 'var(--fs-xs)', fontWeight: 600, marginTop: 2,
                    color: STATUS_COLORS[n.status],
                    textTransform: 'uppercase',
                  }}>
                    {n.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Areas section */}
        <div>
          <div style={{
            fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
            letterSpacing: '0.06em', marginBottom: 8,
          }}>
            AIRFIELD AREAS ({areas.length})
          </div>
          {areas.length === 0 ? (
            <div style={{
              padding: 12, borderRadius: 8,
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-base)', textAlign: 'center',
            }}>
              No areas configured — add them in the Areas tab
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {areas.map(a => (
                <span key={a} style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--color-bg-inset)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--fs-base)',
                  color: 'var(--color-text-1)',
                }}>
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Templates section */}
        <div>
          <div style={{
            fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
            letterSpacing: '0.06em', marginBottom: 8,
          }}>
            INSPECTION TEMPLATES
          </div>
          {templateStatus && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                flex: 1, padding: 10, borderRadius: 8,
                background: templateStatus.airfield > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${templateStatus.airfield > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
                  {templateStatus.airfield}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>Airfield items</div>
              </div>
              <div style={{
                flex: 1, padding: 10, borderRadius: 8,
                background: templateStatus.lighting > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${templateStatus.lighting > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
                  {templateStatus.lighting}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>Lighting items</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== Shift Checklist Configuration Tab =====

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'day', label: 'Day Shift' },
  { value: 'swing', label: 'Swing Shift' },
  { value: 'mid', label: 'Mid Shift' },
]

const FREQ_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const FREQ_TAG_COLORS: Record<string, string> = { daily: '#22D3EE', weekly: '#A78BFA', monthly: '#F59E0B' }

function ShiftChecklistTab({ installationId, currentInstallation }: { installationId: string | null; currentInstallation: any }) {
  const [items, setItems] = useState<ShiftChecklistItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetTime, setResetTime] = useState('06:00')
  const [savingReset, setSavingReset] = useState(false)

  const [formLabel, setFormLabel] = useState('')
  const [formShift, setFormShift] = useState<ShiftType>('day')
  const [formFreq, setFormFreq] = useState<FrequencyType>('daily')

  const [editLabel, setEditLabel] = useState('')
  const [editShift, setEditShift] = useState<ShiftType>('day')
  const [editFreq, setEditFreq] = useState<FrequencyType>('daily')

  useEffect(() => {
    if (currentInstallation?.checklist_reset_time) {
      setResetTime(currentInstallation.checklist_reset_time)
    }
  }, [currentInstallation])

  const load = useCallback(async () => {
    const data = await fetchChecklistItems(installationId)
    setItems(data)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  async function handleSaveResetTime(newTime: string) {
    if (!installationId) return
    setSavingReset(true)
    const supabase = createClient()
    if (supabase) {
      const { error } = await supabase
        .from('bases')
        .update({ checklist_reset_time: newTime, updated_at: new Date().toISOString() } as any)
        .eq('id', installationId)
      if (error) toast.error(error.message)
      else toast.success('Reset time updated')
    }
    setSavingReset(false)
  }

  async function handleCreate() {
    if (!formLabel.trim() || !installationId) return
    setSaving(true)
    const { error } = await createChecklistItem({
      base_id: installationId,
      label: formLabel.trim(),
      shift: formShift,
      frequency: formFreq,
      sort_order: items.length,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
    } else {
      setFormLabel('')
      setFormShift('day')
      setFormFreq('daily')
      setShowForm(false)
      await load()
      toast.success('Item added')
    }
  }

  async function handleUpdate() {
    if (!editingId || !editLabel.trim()) return
    setSaving(true)
    const { error } = await updateChecklistItem(editingId, {
      label: editLabel.trim(),
      shift: editShift,
      frequency: editFreq,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
    } else {
      setEditingId(null)
      await load()
      toast.success('Item updated')
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return
    const { error } = await deleteChecklistItem(id)
    if (error) toast.error(error)
    else { await load(); toast.success('Item deleted') }
  }

  async function handleToggleActive(item: ShiftChecklistItem) {
    const { error } = await updateChecklistItem(item.id, { is_active: !item.is_active })
    if (error) toast.error(error)
    else await load()
  }

  function startEdit(item: ShiftChecklistItem) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditShift(item.shift)
    setEditFreq(item.frequency)
  }

  const dayItems = items.filter(i => i.shift === 'day')
  const midItems = items.filter(i => i.shift === 'mid')
  const swingItems = items.filter(i => i.shift === 'swing')

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-sm)',
    fontFamily: 'inherit',
  }

  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  function renderItemList(label: string, list: ShiftChecklistItem[]) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 6 }}>
          {label} ({list.length})
        </div>
        {list.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '8px 0' }}>No items configured.</div>
        ) : (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            {list.map((item, i) => (
              <div key={item.id}>
                {editingId === item.id ? (
                  <div style={{ padding: '10px 12px', background: 'var(--color-bg-elevated)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8 }}>
                      <input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={inputStyle} placeholder="Item label" />
                      <select value={editShift} onChange={e => setEditShift(e.target.value as ShiftType)} style={selectStyle}>
                        {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <select value={editFreq} onChange={e => setEditFreq(e.target.value as FrequencyType)} style={selectStyle}>
                        {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)' }}>Cancel</button>
                      <button onClick={handleUpdate} disabled={saving || !editLabel.trim()} style={{ background: 'var(--color-cyan)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
                    opacity: item.is_active ? 1 : 0.5,
                  }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)' }}>{item.label}</div>
                    <span style={{
                      fontSize: 'var(--fs-xs)', fontWeight: 700, color: FREQ_TAG_COLORS[item.frequency],
                      background: `${FREQ_TAG_COLORS[item.frequency]}15`, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
                    }}>{item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}</span>
                    <button onClick={() => handleToggleActive(item)} title={item.is_active ? 'Disable' : 'Enable'} style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 'var(--fs-xs)', fontWeight: 600, color: item.is_active ? '#22C55E' : 'var(--color-text-4)',
                    }}>{item.is_active ? 'Active' : 'Inactive'}</button>
                    <button onClick={() => startEdit(item)} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => handleDelete(item.id, item.label)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const RESET_TIME_OPTIONS = [
    '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00',
  ]

  return (
    <div>
      {/* Reset Time Configuration */}
      <div style={{
        background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: 14, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Daily Reset Time</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            New checklists start at this time each day ({currentInstallation?.timezone || 'local time'}).
          </div>
        </div>
        <select
          value={resetTime}
          onChange={e => {
            setResetTime(e.target.value)
            handleSaveResetTime(e.target.value)
          }}
          disabled={savingReset}
          style={{ ...selectStyle, minWidth: 100 }}
        >
          {RESET_TIME_OPTIONS.map(t => {
            const hr = parseInt(t)
            const label = hr < 12 ? `${hr}:00 AM` : hr === 12 ? '12:00 PM' : `${hr - 12}:00 PM`
            return <option key={t} value={t}>{label}</option>
          })}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>Shift Checklist Items</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>Configure items for day and swing shift checklists.</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: 'var(--color-cyan)', color: '#fff', border: 'none', borderRadius: 8,
          padding: '8px 16px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
        }}>{showForm ? 'Cancel' : '+ Add Item'}</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 8 }}>
            <input value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="Checklist item label" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select value={formShift} onChange={e => setFormShift(e.target.value as ShiftType)} style={selectStyle}>
                {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={formFreq} onChange={e => setFormFreq(e.target.value as FrequencyType)} style={selectStyle}>
                {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving || !formLabel.trim()} style={{
            width: '100%', padding: '8px 0', borderRadius: 6, border: 'none',
            background: formLabel.trim() ? 'var(--color-cyan)' : 'var(--color-border)',
            color: formLabel.trim() ? '#000' : 'var(--color-text-3)',
            fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: formLabel.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>{saving ? 'Adding...' : 'Add Item'}</button>
        </div>
      )}

      {!loaded ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
      ) : (
        <>
          {renderItemList('Day Shift', dayItems)}
          {renderItemList('Swing Shift', swingItems)}
          {midItems.length > 0 && renderItemList('Mid Shift', midItems)}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// QRC Templates Tab
// ═══════════════════════════════════════════════════════════════

type QrcTemplateRow = { id: string; qrc_number: number; title: string; notes: string | null; is_active: boolean; steps: unknown[]; references: string | null; has_scn_form: boolean }

function QrcTemplatesTab({ installationId }: { installationId: string | null }) {
  const [templates, setTemplates] = useState<QrcTemplateRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showSeedPicker, setShowSeedPicker] = useState(false)
  const [seedSelected, setSeedSelected] = useState<Set<number>>(new Set())
  const [seeding, setSeeding] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<QrcTemplateRow | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!installationId) return
    const { fetchQrcTemplates } = await import('@/lib/supabase/qrc')
    const data = await fetchQrcTemplates(installationId)
    setTemplates(data as QrcTemplateRow[])
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  // Seed picker helpers
  async function openSeedPicker() {
    const { QRC_SEED_DATA } = await import('@/lib/qrc-seed-data')
    const existingNumbers = new Set(templates.map(t => t.qrc_number))
    const available = QRC_SEED_DATA.filter(q => !existingNumbers.has(q.qrc_number))
    if (available.length === 0) {
      toast.info('All 25 default QRCs are already added')
      return
    }
    setSeedSelected(new Set(available.map(q => q.qrc_number)))
    setShowSeedPicker(true)
  }

  async function handleSeedSelected() {
    if (!installationId || seedSelected.size === 0) return
    setSeeding(true)
    const { seedQrcTemplates } = await import('@/lib/supabase/qrc')
    const { count, error } = await seedQrcTemplates(installationId, Array.from(seedSelected))
    if (error) toast.error(error)
    else {
      toast.success(`Added ${count} QRC template${count !== 1 ? 's' : ''}`)
      setShowSeedPicker(false)
      await load()
    }
    setSeeding(false)
  }

  async function handleToggle(id: string, isActive: boolean) {
    const { updateQrcTemplate } = await import('@/lib/supabase/qrc')
    const { error } = await updateQrcTemplate(id, { is_active: !isActive })
    if (error) toast.error(error)
    else await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this QRC template and all its execution history? This cannot be undone.\n\nTo keep the template but hide it, use "Disable" instead.')) return
    const { deleteQrcTemplate } = await import('@/lib/supabase/qrc')
    const { error } = await deleteQrcTemplate(id)
    if (error) toast.error(error)
    else { toast.success('Template deleted'); await load() }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>QRC Templates</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>Configure Quick Reaction Checklists for this base.</div>
        </div>
        <button onClick={openSeedPicker} style={{
          background: 'var(--color-cyan)', color: '#fff', border: 'none', borderRadius: 8,
          padding: '8px 16px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
        }}>+ Add from Defaults</button>
      </div>

      {/* Seed Picker Dialog */}
      {showSeedPicker && (
        <SeedPickerDialog
          seedSelected={seedSelected}
          setSeedSelected={setSeedSelected}
          existingNumbers={new Set(templates.map(t => t.qrc_number))}
          seeding={seeding}
          onSeed={handleSeedSelected}
          onClose={() => setShowSeedPicker(false)}
        />
      )}

      {/* Edit Template Dialog */}
      {editingTemplate && (
        <EditQrcDialog
          template={editingTemplate}
          inputStyle={inputStyle}
          onClose={() => setEditingTemplate(null)}
          onSaved={async () => { setEditingTemplate(null); await load() }}
        />
      )}

      {!loaded ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          No QRC templates. Click &quot;+ Add from Defaults&quot; to select which QRCs to add.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {templates.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'var(--color-bg-elevated)', borderRadius: 8,
              border: '1px solid var(--color-border)',
              opacity: t.is_active ? 1 : 0.5,
            }}>
              <span style={{
                fontSize: 'var(--fs-xs)', fontWeight: 800,
                color: '#fff', background: t.is_active ? '#D97706' : 'var(--color-text-4)',
                padding: '2px 6px', borderRadius: 4, minWidth: 32, textAlign: 'center',
              }}>{t.qrc_number}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>{t.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{(t.steps as unknown[]).length} steps</div>
              </div>
              {/* Action menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === t.id ? null : t.id) }}
                  style={{
                    background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
                    padding: '3px 10px', fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer',
                    color: 'var(--color-text-2)', fontFamily: 'inherit',
                  }}
                >&#x22EE;</button>
                {menuOpen === t.id && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 20,
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: 140,
                    overflow: 'hidden',
                  }}>
                    <button onClick={() => { setMenuOpen(null); setEditingTemplate(t) }} style={{
                      display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                      fontWeight: 600, color: 'var(--color-text-1)',
                    }}>Edit</button>
                    <button onClick={() => { setMenuOpen(null); handleToggle(t.id, t.is_active) }} style={{
                      display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                      fontWeight: 600, color: t.is_active ? '#EAB308' : 'var(--color-success)',
                    }}>{t.is_active ? 'Disable' : 'Enable'}</button>
                    <div style={{ height: 1, background: 'var(--color-border)' }} />
                    <button onClick={() => { setMenuOpen(null); handleDelete(t.id) }} style={{
                      display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                      fontWeight: 600, color: 'var(--color-danger)',
                    }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Seed Picker Dialog ---

function SeedPickerDialog({
  seedSelected, setSeedSelected, existingNumbers, seeding, onSeed, onClose,
}: {
  seedSelected: Set<number>
  setSeedSelected: (s: Set<number>) => void
  existingNumbers: Set<number>
  seeding: boolean
  onSeed: () => void
  onClose: () => void
}) {
  const [allQrcs, setAllQrcs] = useState<{ qrc_number: number; title: string }[]>([])

  useEffect(() => {
    import('@/lib/qrc-seed-data').then(({ QRC_SEED_DATA }) => {
      setAllQrcs(QRC_SEED_DATA.filter(q => !existingNumbers.has(q.qrc_number)))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleAll() {
    if (seedSelected.size === allQrcs.length) setSeedSelected(new Set())
    else setSeedSelected(new Set(allQrcs.map(q => q.qrc_number)))
  }

  function toggle(n: number) {
    const next = new Set(seedSelected)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    setSeedSelected(next)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.6)',
    }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>Add QRC Templates</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>Select which QRCs to add to this base.</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
          {allQrcs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
              All default QRCs are already added.
            </div>
          ) : (
            <>
              <button onClick={toggleAll} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-cyan)', padding: '4px 0', marginBottom: 4,
              }}>{seedSelected.size === allQrcs.length ? 'Deselect All' : 'Select All'}</button>
              {allQrcs.map(q => (
                <button key={q.qrc_number} onClick={() => toggle(q.qrc_number)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 0',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', borderBottom: '1px solid var(--color-border)',
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: seedSelected.has(q.qrc_number) ? 'none' : '2px solid var(--color-border-mid)',
                    background: seedSelected.has(q.qrc_number) ? 'var(--color-cyan)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{seedSelected.has(q.qrc_number) && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>&#10003;</span>}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#fff', background: '#D97706', padding: '1px 5px', borderRadius: 4 }}>{q.qrc_number}</span>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', flex: 1 }}>{q.title}</span>
                </button>
              ))}
            </>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button onClick={onSeed} disabled={seeding || seedSelected.size === 0} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
            background: seedSelected.size > 0 ? 'var(--color-cyan)' : 'var(--color-border)',
            color: seedSelected.size > 0 ? '#000' : 'var(--color-text-3)',
            fontWeight: 700, fontSize: 'var(--fs-base)', cursor: seedSelected.size > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>{seeding ? 'Adding...' : `Add ${seedSelected.size} QRC${seedSelected.size !== 1 ? 's' : ''}`}</button>
          <button onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
            fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// --- Edit QRC Template Dialog ---

function EditQrcDialog({
  template, inputStyle, onClose, onSaved,
}: {
  template: QrcTemplateRow
  inputStyle: React.CSSProperties
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState(template.title)
  const [notes, setNotes] = useState(template.notes || '')
  const [refs, setRefs] = useState(template.references || '')
  const [steps, setSteps] = useState<{ id: string; label: string; type: string }[]>(
    (template.steps as { id: string; label: string; type: string }[]).map(s => ({ id: s.id, label: s.label, type: s.type }))
  )
  const [saving, setSaving] = useState(false)
  const [addingStep, setAddingStep] = useState(false)
  const [newStepLabel, setNewStepLabel] = useState('')

  async function handleSave() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const { updateQrcTemplate } = await import('@/lib/supabase/qrc')

    // Rebuild full steps — preserve original step data, update labels, add new steps
    const origSteps = template.steps as Record<string, unknown>[]
    const origMap = new Map(origSteps.map(s => [(s as { id: string }).id, s]))
    const fullSteps = steps.map(s => {
      const orig = origMap.get(s.id)
      if (orig) return { ...orig, label: s.label }
      return { id: s.id, type: s.type, label: s.label }
    })

    const { error } = await updateQrcTemplate(template.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      references: refs.trim() || null,
      steps: fullSteps as any,
    })
    if (error) toast.error(error)
    else { toast.success('Template updated'); await onSaved() }
    setSaving(false)
  }

  function handleAddStep() {
    if (!newStepLabel.trim()) return
    const nextNum = steps.length + 1
    setSteps([...steps, { id: String(nextNum), label: newStepLabel.trim(), type: 'checkbox' }])
    setNewStepLabel('')
    setAddingStep(false)
  }

  function handleRemoveStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx))
  }

  function handleMoveStep(idx: number, dir: -1 | 1) {
    const arr = [...steps]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    setSteps(arr)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.6)',
    }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            Edit QRC-{template.qrc_number}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {/* Title */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          </div>
          {/* Notes / Warning */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>Warning / Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          {/* References */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>References</label>
            <input value={refs} onChange={e => setRefs(e.target.value)} placeholder="e.g. AFI 13-204V3" style={inputStyle} />
          </div>
          {/* Steps */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Steps ({steps.length})</label>
            <button onClick={() => setAddingStep(true)} style={{
              background: 'none', border: '1px solid var(--color-cyan)', borderRadius: 6,
              padding: '2px 10px', color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>+ Add Step</button>
          </div>
          {steps.map((s, i) => (
            <div key={`${s.id}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', minWidth: 20 }}>{i + 1}.</span>
              <input
                value={s.label}
                onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], label: e.target.value }; setSteps(arr) }}
                style={{ ...inputStyle, padding: '4px 8px', flex: 1 }}
              />
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', whiteSpace: 'nowrap' }}>{s.type}</span>
              <button onClick={() => handleMoveStep(i, -1)} disabled={i === 0} style={{
                background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer',
                color: i === 0 ? 'var(--color-text-4)' : 'var(--color-text-2)', fontSize: 12, padding: '0 2px', fontFamily: 'inherit',
              }}>&uarr;</button>
              <button onClick={() => handleMoveStep(i, 1)} disabled={i === steps.length - 1} style={{
                background: 'none', border: 'none', cursor: i === steps.length - 1 ? 'default' : 'pointer',
                color: i === steps.length - 1 ? 'var(--color-text-4)' : 'var(--color-text-2)', fontSize: 12, padding: '0 2px', fontFamily: 'inherit',
              }}>&darr;</button>
              <button onClick={() => handleRemoveStep(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-danger)', fontSize: 'var(--fs-sm)', padding: '0 2px', fontFamily: 'inherit',
              }}>&times;</button>
            </div>
          ))}
          {addingStep && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                value={newStepLabel}
                onChange={e => setNewStepLabel(e.target.value)}
                placeholder="New step text"
                onKeyDown={e => { if (e.key === 'Enter') handleAddStep() }}
                style={{ ...inputStyle, flex: 1, padding: '4px 8px' }}
                autoFocus
              />
              <button onClick={handleAddStep} disabled={!newStepLabel.trim()} style={{
                background: newStepLabel.trim() ? 'var(--color-cyan)' : 'var(--color-border)',
                color: newStepLabel.trim() ? '#000' : 'var(--color-text-3)',
                border: 'none', borderRadius: 6, padding: '4px 12px',
                fontWeight: 700, fontSize: 'var(--fs-xs)', cursor: newStepLabel.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              }}>Add</button>
              <button onClick={() => { setAddingStep(false); setNewStepLabel('') }} style={{
                background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
                padding: '4px 10px', color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
            background: 'var(--color-cyan)', color: '#fff', fontWeight: 700,
            fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
          }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          <button onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
            fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Lighting Systems Tab — define systems + clone from DAFMAN templates
// ═══════════════════════════════════════════════════════════════

function LightingSystemsTab({ installationId }: { installationId: string | null }) {
  const [systems, setSystems] = useState<LightingSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [compsMap, setCompsMap] = useState<Record<string, LightingSystemComponent[]>>({})
  const [loadingComps, setLoadingComps] = useState<Record<string, boolean>>({})

  // New system form
  const [newSystemType, setNewSystemType] = useState('')
  const [newName, setNewName] = useState('')
  const [newRunwayOrTaxiway, setNewRunwayOrTaxiway] = useState('')
  const [newIsPrecision, setNewIsPrecision] = useState(false)

  // Clone from templates
  const [cloning, setCloning] = useState<string | null>(null)
  const [totalCounts, setTotalCounts] = useState<Record<string, string>>({})
  const [templatesList, setTemplatesList] = useState<OutageRuleTemplate[]>([])

  // Edit component
  const [editingComp, setEditingComp] = useState<string | null>(null)
  const [editCount, setEditCount] = useState('')

  // Bulk assign
  const [assigningComp, setAssigningComp] = useState<string | null>(null)
  const [assignLayer, setAssignLayer] = useState('')
  const [assignType, setAssignType] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [featureLayers, setFeatureLayers] = useState<string[]>([])
  const [featureTypes, setFeatureTypes] = useState<string[]>([])
  const [featureStats, setFeatureStats] = useState<{ total: number; assigned: number }>({ total: 0, assigned: 0 })

  const loadSystems = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const data = await fetchLightingSystems(installationId)
    setSystems(data)
    setLoading(false)
  }, [installationId])

  useEffect(() => { loadSystems() }, [loadSystems])

  // Load feature metadata for bulk assign filters
  useEffect(() => {
    if (!installationId) return
    fetchInfrastructureFeatures(installationId).then((features) => {
      const layers = Array.from(new Set(features.map(f => f.layer).filter(Boolean))) as string[]
      const types = Array.from(new Set(features.map(f => f.feature_type)))
      setFeatureLayers(layers.sort())
      setFeatureTypes(types.sort())
      const assigned = features.filter(f => f.system_component_id).length
      setFeatureStats({ total: features.length, assigned })
    })
  }, [installationId])

  const handleBulkAssign = async (compId: string) => {
    if (!installationId || (!assignLayer && !assignType)) return
    setAssigning(true)
    const count = await bulkAssignComponent(
      { baseId: installationId, layer: assignLayer || undefined, feature_type: assignType || undefined },
      compId,
    )
    if (count > 0) {
      toast.success(`Assigned ${count} feature(s) to component`)
      // Refresh stats
      const features = await fetchInfrastructureFeatures(installationId)
      const assigned = features.filter(f => f.system_component_id).length
      setFeatureStats({ total: features.length, assigned })
    } else {
      toast.error('No matching features found')
    }
    setAssigning(false)
    setAssigningComp(null)
    setAssignLayer('')
    setAssignType('')
  }

  const loadComps = async (systemId: string) => {
    setLoadingComps((prev) => ({ ...prev, [systemId]: true }))
    const result = await fetchLightingSystemWithComponents(systemId)
    if (result) setCompsMap((prev) => ({ ...prev, [systemId]: result.components }))
    setLoadingComps((prev) => ({ ...prev, [systemId]: false }))
  }

  const handleExpand = (systemId: string) => {
    if (expanded === systemId) { setExpanded(null); return }
    setExpanded(systemId)
    if (!compsMap[systemId]) loadComps(systemId)
  }

  const handleAddSystem = async () => {
    if (!installationId || !newSystemType || !newName.trim()) return
    setSaving(true)
    const result = await createLightingSystem({
      base_id: installationId, system_type: newSystemType, name: newName.trim(),
      runway_or_taxiway: newRunwayOrTaxiway.trim() || undefined, is_precision: newIsPrecision,
    })
    if (result) {
      toast.success(`Created "${result.name}"`)
      setSystems((prev) => [...prev, result])
      setNewSystemType(''); setNewName(''); setNewRunwayOrTaxiway(''); setNewIsPrecision(false); setAdding(false)
    } else { toast.error('Failed to create system') }
    setSaving(false)
  }

  const handleDeleteSystem = async (sys: LightingSystem) => {
    if (!confirm(`Delete "${sys.name}" and all its components?`)) return
    if (await deleteLightingSystem(sys.id)) {
      toast.success(`Deleted "${sys.name}"`)
      setSystems((prev) => prev.filter((s) => s.id !== sys.id))
      if (expanded === sys.id) setExpanded(null)
    } else { toast.error('Failed to delete system') }
  }

  const handleStartClone = async (systemId: string, systemType: string) => {
    setCloning(systemId)
    const t = await fetchOutageRuleTemplates(systemType)
    setTemplatesList(t)
    const counts: Record<string, string> = {}
    t.forEach((tmpl) => { counts[tmpl.component_type] = '0' })
    setTotalCounts(counts)
  }

  const handleClone = async () => {
    if (!cloning) return
    setSaving(true)
    const counts: Record<string, number> = {}
    for (const [key, val] of Object.entries(totalCounts)) counts[key] = parseInt(val) || 0
    const sys = systems.find((s) => s.id === cloning)
    const created = await cloneComponentsFromTemplates(cloning, sys?.system_type || '', counts)
    if (created.length > 0) {
      toast.success(`Cloned ${created.length} component(s)`)
      setCompsMap((prev) => ({ ...prev, [cloning]: [...(prev[cloning] || []), ...created] }))
    } else { toast.error('No components cloned') }
    setCloning(null); setTemplatesList([]); setTotalCounts({}); setSaving(false)
  }

  const handleDeleteComp = async (compId: string, systemId: string) => {
    if (!confirm('Delete this component?')) return
    if (await deleteSystemComponent(compId)) {
      toast.success('Component deleted')
      setCompsMap((prev) => ({ ...prev, [systemId]: (prev[systemId] || []).filter((c) => c.id !== compId) }))
    }
  }

  const handleSaveCount = async (compId: string, systemId: string) => {
    const count = parseInt(editCount)
    if (isNaN(count) || count < 0) return
    if (await updateSystemComponent(compId, { total_count: count })) {
      toast.success('Count updated')
      setCompsMap((prev) => ({
        ...prev, [systemId]: (prev[systemId] || []).map((c) => c.id === compId ? { ...c, total_count: count } : c),
      }))
      setEditingComp(null)
    }
  }

  useEffect(() => {
    if (newSystemType && !newName) {
      const label = SYSTEM_TYPE_LABELS[newSystemType] || newSystemType
      setNewName(newRunwayOrTaxiway ? `${label} ${newRunwayOrTaxiway}` : label)
    }
  }, [newSystemType, newRunwayOrTaxiway])

  if (loading) return <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading lighting systems...</p>

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
        Lighting Systems
      </h3>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Define lighting systems per DAFMAN 13-204v2. Each runway/taxiway is its own system instance.
        Components are cloned from DAFMAN Table A3.1 templates with your installation&apos;s actual light counts.
      </p>

      {systems.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No lighting systems configured.</p>
      )}

      {systems.map((sys) => {
        const isExp = expanded === sys.id
        const comps = compsMap[sys.id] || []
        const isLoadingC = loadingComps[sys.id]
        return (
          <div key={sys.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: isExp ? 'rgba(56,189,248,0.06)' : 'transparent', cursor: 'pointer' }}
              onClick={() => handleExpand(sys.id)}
            >
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>{'\u25BC'}</span>
              <span style={{ flex: 1, fontWeight: 600, color: 'var(--color-text-1)', fontSize: 'var(--fs-md)' }}>{sys.name}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', background: 'var(--color-bg-inset)', padding: '2px 8px', borderRadius: 4 }}>
                {SYSTEM_TYPE_LABELS[sys.system_type] || sys.system_type}
              </span>
              {sys.is_precision && (
                <span style={{ fontSize: 'var(--fs-xs)', color: '#F59E0B', background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: 4 }}>PRECISION</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleDeleteSystem(sys) }} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-xl)', padding: '0 4px' }}>&times;</button>
            </div>

            {isExp && (
              <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--color-border)' }}>
                {isLoadingC ? (
                  <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '8px 0' }}>Loading components...</p>
                ) : (
                  <>
                    {comps.length === 0 && <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '8px 0' }}>No components. Clone from DAFMAN templates to get started.</p>}
                    {comps.map((comp) => (
                      <div key={comp.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-sm)' }}>
                          <span style={{ flex: 1, color: 'var(--color-text-1)' }}>{comp.label}</span>
                          {editingComp === comp.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input type="number" value={editCount} onChange={(e) => setEditCount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveCount(comp.id, sys.id)}
                                style={{ width: 60, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)' }} autoFocus />
                              <button onClick={() => handleSaveCount(comp.id, sys.id)} style={{ background: 'var(--color-cyan)', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>Save</button>
                              <button onClick={() => setEditingComp(null)} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-3)', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingComp(comp.id); setEditCount(String(comp.total_count)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', fontVariantNumeric: 'tabular-nums' }} title="Click to edit count">
                              {comp.total_count} lights
                            </button>
                          )}
                          <button onClick={() => { setAssigningComp(assigningComp === comp.id ? null : comp.id); setAssignLayer(''); setAssignType('') }}
                            style={{ background: 'none', border: '1px solid var(--color-border)', color: assigningComp === comp.id ? 'var(--color-accent)' : 'var(--color-text-3)', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}
                            title="Bulk assign features to this component">
                            Link
                          </button>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', minWidth: 60 }}>
                            {comp.is_zero_tolerance ? 'None' : comp.allowable_outage_pct != null ? `${comp.allowable_outage_pct}%` : comp.allowable_outage_count != null ? `${comp.allowable_outage_count} max` : '—'}
                          </span>
                          <button onClick={() => handleDeleteComp(comp.id, sys.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-lg)', padding: '0 2px' }}>&times;</button>
                        </div>
                        {assigningComp === comp.id && (
                          <div style={{ padding: '8px 0 8px 12px', borderBottom: '1px solid var(--color-border)', background: 'rgba(56,189,248,0.04)' }}>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginBottom: 6, fontWeight: 600 }}>
                              Bulk assign features to &ldquo;{comp.label}&rdquo;
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <select value={assignLayer} onChange={(e) => setAssignLayer(e.target.value)}
                                style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>
                                <option value="">Any layer</option>
                                {featureLayers.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>
                              <select value={assignType} onChange={(e) => setAssignType(e.target.value)}
                                style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>
                                <option value="">Any type</option>
                                {featureTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                              </select>
                              <button onClick={() => handleBulkAssign(comp.id)} disabled={assigning || (!assignLayer && !assignType)}
                                style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--color-cyan)', color: '#fff', fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: assigning || (!assignLayer && !assignType) ? 0.5 : 1 }}>
                                {assigning ? 'Assigning...' : 'Assign'}
                              </button>
                              <button onClick={() => { setAssigningComp(null); setAssignLayer(''); setAssignType('') }}
                                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Cancel
                              </button>
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
                              {featureStats.assigned}/{featureStats.total} features currently assigned to components
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {cloning === sys.id ? (
                      <div style={{ marginTop: 8, padding: 10, background: 'var(--color-bg-inset)', borderRadius: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', marginBottom: 8 }}>
                          Clone from DAFMAN Table A3.1 &mdash; {SYSTEM_TYPE_LABELS[sys.system_type] || sys.system_type}
                        </div>
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 8 }}>Enter the actual light count for each component at your installation.</p>
                        {templatesList.map((t) => (
                          <div key={t.component_type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 'var(--fs-sm)' }}>
                            <span style={{ flex: 1, color: 'var(--color-text-2)' }}>{t.label}</span>
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', minWidth: 50 }}>
                              {t.is_zero_tolerance ? 'None' : t.allowable_outage_pct != null ? `${t.allowable_outage_pct}%` : `${t.allowable_outage_count} max`}
                            </span>
                            <input type="number" value={totalCounts[t.component_type] || ''} onChange={(e) => setTotalCounts((prev) => ({ ...prev, [t.component_type]: e.target.value }))} placeholder="Count"
                              style={{ width: 60, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)' }} />
                          </div>
                        ))}
                        {templatesList.length === 0 && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>No templates found for this system type.</p>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={handleClone} disabled={saving || templatesList.length === 0}
                            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}>
                            {saving ? 'Cloning...' : 'Clone Components'}
                          </button>
                          <button onClick={() => { setCloning(null); setTemplatesList([]); setTotalCounts({}) }}
                            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontWeight: 600, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => handleStartClone(sys.id, sys.system_type)}
                        style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-accent)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Clone from DAFMAN Templates
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div style={{ marginTop: 8, padding: 12, background: 'var(--color-bg-inset)', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', marginBottom: 8 }}>New Lighting System</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>System Type</label>
              <select value={newSystemType} onChange={(e) => { setNewSystemType(e.target.value); setNewName('') }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', fontFamily: 'inherit' }}>
                <option value="">Select type...</option>
                {SYSTEM_TYPES.map((t) => <option key={t} value={t}>{SYSTEM_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>Runway/Taxiway</label>
              <input value={newRunwayOrTaxiway} onChange={(e) => { setNewRunwayOrTaxiway(e.target.value.toUpperCase()); setNewName('') }} placeholder="e.g. RWY 01/19, TWY A"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-md)' }} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>System Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. ALSF-1 RWY 19"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-md)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="is-precision-new" checked={newIsPrecision} onChange={(e) => setNewIsPrecision(e.target.checked)} />
              <label htmlFor="is-precision-new" style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>Precision approach (affects threshold light allowable: 10% vs 25%)</label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={handleAddSystem} disabled={saving || !newSystemType || !newName.trim()}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-md)', cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !newSystemType || !newName.trim() ? 0.5 : 1 }}>
                {saving ? 'Creating...' : 'Create System'}
              </button>
              <button onClick={() => { setAdding(false); setNewSystemType(''); setNewName(''); setNewRunwayOrTaxiway(''); setNewIsPrecision(false) }}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontWeight: 600, fontSize: 'var(--fs-md)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ marginTop: 8, width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-accent)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Lighting System
        </button>
      )}
    </div>
  )
}
