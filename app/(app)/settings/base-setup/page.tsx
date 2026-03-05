'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { createDefaultTemplate, fetchInspectionTemplate } from '@/lib/supabase/inspection-templates'
import { fetchInstallationNavaids } from '@/lib/supabase/installations'
import { fetchNavaidStatuses, type NavaidStatus } from '@/lib/supabase/navaids'

type SetupTab = 'runways' | 'navaids' | 'areas' | 'shops' | 'templates'

export default function BaseSetupPage() {
  const { installationId, currentInstallation, runways, areas, ceShops, userRole } = useInstallation()
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
    { key: 'shops', label: 'CE Shops' },
    { key: 'templates', label: 'Templates' },
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
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                cursor: 'pointer',
                fontSize: 'var(--fs-md)',
                fontWeight: 700,
                fontFamily: 'inherit',
                background: isActive ? 'rgba(56,189,248,0.12)' : 'var(--color-surface-2)',
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
        {activeTab === 'shops' && <ShopsTab shops={ceShops} installationId={installationId} />}
        {activeTab === 'templates' && <TemplatesTab installationId={installationId} />}
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
    background: 'var(--color-surface-2)',
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
          background: 'var(--color-surface-2)',
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
          background: 'var(--color-surface-2)',
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
                background: 'var(--color-surface-2)',
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
    setLoading(true)
    const navaidData = await fetchInstallationNavaids(installationId)
    setNavaids(navaidData)
    const statusData = await fetchNavaidStatuses(installationId)
    setStatuses(statusData)
    setLoading(false)
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
            background: 'var(--color-surface-2)',
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
            background: 'var(--color-surface-2)',
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
            background: 'var(--color-surface-2)',
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
                  background: 'var(--color-surface-2)',
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
