'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { createDefaultTemplate } from '@/lib/supabase/inspection-templates'

type SetupTab = 'runways' | 'navaids' | 'areas' | 'shops' | 'templates'

export default function BaseSetupPage() {
  const { installationId, currentInstallation, runways, areas, ceShops, userRole } = useInstallation()
  const [activeTab, setActiveTab] = useState<SetupTab>('runways')

  const canEdit = userRole === 'airfield_manager' || userRole === 'sys_admin'

  if (!canEdit) {
    return (
      <div style={{ padding: 24 }}>
        <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 13, textDecoration: 'none' }}>
          &larr; Settings
        </Link>
        <h1 style={{ marginTop: 16, fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)' }}>Base Configuration</h1>
        <p style={{ color: 'var(--color-text-3)', marginTop: 8 }}>
          Only Airfield Managers and System Admins can configure base settings.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 13, textDecoration: 'none' }}>
        &larr; Settings
      </Link>
      <h1 style={{ marginTop: 12, fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)' }}>
        Base Configuration
      </h1>
      <p style={{ color: 'var(--color-text-3)', fontSize: 13, marginTop: 4 }}>
        {currentInstallation?.name ?? 'Current Base'} ({currentInstallation?.icao ?? '—'})
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
        {([
          { key: 'runways' as const, label: 'Runways' },
          { key: 'navaids' as const, label: 'NAVAIDs' },
          { key: 'areas' as const, label: 'Areas' },
          { key: 'shops' as const, label: 'CE Shops' },
          { key: 'templates' as const, label: 'Templates' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              background: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-surface-2)',
              color: activeTab === tab.key ? '#fff' : 'var(--color-text-2)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        marginTop: 16,
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 16,
      }}>
        {activeTab === 'runways' && <RunwayTab runways={runways} />}
        {activeTab === 'navaids' && <SimpleListTab title="NAVAIDs" items={[]} tableName="base_navaids" fieldName="navaid_name" installationId={installationId} />}
        {activeTab === 'areas' && <SimpleListTab title="Airfield Areas" items={areas} tableName="base_areas" fieldName="area_name" installationId={installationId} />}
        {activeTab === 'shops' && <ShopsTab shops={ceShops} installationId={installationId} />}
        {activeTab === 'templates' && <TemplatesTab installationId={installationId} />}
      </div>
    </div>
  )
}

// ── Runway Tab (read-only view for now — runways are complex to edit) ──
function RunwayTab({ runways }: { runways: ReturnType<typeof useInstallation>['runways'] }) {
  if (runways.length === 0) {
    return <p style={{ color: 'var(--color-text-3)', fontSize: 13 }}>No runways configured.</p>
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>Runways</h3>
      {runways.map(rwy => (
        <div key={rwy.id} style={{
          padding: 12,
          background: 'var(--color-surface-2)',
          borderRadius: 8,
          marginBottom: 8,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-1)' }}>
            {rwy.runway_id} — {rwy.runway_class === 'Army_B' ? 'Army Class B' : `Class ${rwy.runway_class}`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4 }}>
            {rwy.length_ft} ft x {rwy.width_ft} ft | {rwy.surface} | Heading {rwy.true_heading}°
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4, fontFamily: 'monospace' }}>
            {rwy.end1_designator}: {rwy.end1_latitude?.toFixed(5)}°N, {rwy.end1_longitude ? Math.abs(rwy.end1_longitude).toFixed(5) : '—'}°W
            {rwy.end1_approach_lighting && ` (${rwy.end1_approach_lighting})`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2, fontFamily: 'monospace' }}>
            {rwy.end2_designator}: {rwy.end2_latitude?.toFixed(5)}°N, {rwy.end2_longitude ? Math.abs(rwy.end2_longitude).toFixed(5) : '—'}°W
            {rwy.end2_approach_lighting && ` (${rwy.end2_approach_lighting})`}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 8 }}>
        Runway configuration is managed via database migrations. Contact your system administrator to add or modify runways.
      </p>
    </div>
  )
}

// ── Simple list tab for NAVAIDs and Areas ──
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
    const { error } = await (supabase as any)
      .from(tableName)
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
    const { error } = await (supabase as any)
      .from(tableName)
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
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>{title}</h3>
      {list.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 13, marginBottom: 8 }}>No items configured.</p>
      )}
      {list.map(item => (
        <div key={item} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 0',
          borderBottom: '1px solid var(--color-border)',
          fontSize: 13,
        }}>
          <span style={{ color: 'var(--color-text-1)' }}>{item}</span>
          <button
            onClick={() => handleDelete(item)}
            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 14 }}
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
            flex: 1, padding: '6px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-1)', fontSize: 13,
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── CE Shops tab ──
function ShopsTab({ shops, installationId }: { shops: string[]; installationId: string | null }) {
  const [list, setList] = useState<string[]>(shops)
  const [newShop, setNewShop] = useState('')

  const saveToDb = async (updatedList: string[]) => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('bases')
      .update({ ce_shops: updatedList })
      .eq('id', installationId)
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
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>CE Shops</h3>
      {list.map(shop => (
        <div key={shop} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13,
        }}>
          <span style={{ color: 'var(--color-text-1)' }}>{shop}</span>
          <button
            onClick={() => handleDelete(shop)}
            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 14 }}
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
            flex: 1, padding: '6px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-1)', fontSize: 13,
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Templates tab (link + clone action) ──
function TemplatesTab({ installationId }: { installationId: string | null }) {
  const [cloning, setCloning] = useState(false)

  const handleCloneDefaults = async () => {
    if (!installationId) return
    setCloning(true)
    const af = await createDefaultTemplate(installationId, 'airfield')
    const lt = await createDefaultTemplate(installationId, 'lighting')
    if (af && lt) {
      toast.success('Default templates created from Selfridge template')
    } else {
      toast.error('Some templates failed to create')
    }
    setCloning(false)
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
        Inspection Templates
      </h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 12 }}>
        Manage checklist items for airfield and lighting inspections.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href="/settings/templates"
          style={{
            display: 'inline-block', padding: '8px 16px', borderRadius: 8,
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Edit Templates
        </a>
        <button
          onClick={handleCloneDefaults}
          disabled={cloning}
          style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-1)',
            fontSize: 13, fontWeight: 600, cursor: cloning ? 'wait' : 'pointer',
          }}
        >
          {cloning ? 'Creating...' : 'Initialize from Default Template'}
        </button>
      </div>
    </div>
  )
}
