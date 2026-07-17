'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import {
  fetchDrivingCheckItems,
  createDrivingCheckItem,
  updateDrivingCheckItem,
  reorderDrivingCheckItems,
  deleteDrivingCheckItem,
  seedDefaultDrivingCheckItems,
  fetchDriverLicenses,
  replaceDriverLicenses,
  clearDriverLicenses,
  type DrivingCheckItemRow,
} from '@/lib/supabase/driving-checks'
import { FieldHint } from '@/components/base-setup/FieldHint'
import type { WizardStepKey } from '@/lib/modules-config'

// ═══════════════════════════════════════════════════════════════
// Driving Check Items tab — Base Setup wizard step for the Airfield
// Driving Spot Check module. Modeled directly on FprChecklistTab
// (components/base-setup/fpr-checklist-tab.tsx): flat list, inline
// rename, reorder, active toggle, hard delete with confirm.
//
// Frozen-prop note: like FprChecklistTab, this fetches live via load()
// keyed on installationId — it does not capture a mount-time prop
// snapshot, so it does not carry the RunwayTab-class staleness bug
// (page.tsx:677-680, :2172-2173).
// ═══════════════════════════════════════════════════════════════

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-1)',
  fontSize: 'var(--fs-md)',
  fontFamily: 'inherit',
}

export function DrivingCheckItemsTab({
  installationId,
  markSaved,
}: {
  installationId: string | null
  markSaved?: (stepKey: WizardStepKey) => void
}) {
  const [items, setItems] = useState<DrivingCheckItemRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const [newLabel, setNewLabel] = useState('')
  const [newGuidance, setNewGuidance] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editGuidance, setEditGuidance] = useState('')

  const [seeding, setSeeding] = useState(false)

  const load = useCallback(async () => {
    if (!installationId) { setLoaded(true); return }
    const rows = await fetchDrivingCheckItems(installationId, false)
    setItems(rows)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  // ── Airfield Licenses roster (ADDx import) ──
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [licenseCount, setLicenseCount] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)

  const loadLicenses = useCallback(async () => {
    if (!installationId) { setLicenseCount(0); return }
    const rows = await fetchDriverLicenses(installationId)
    setLicenseCount(rows.length)
  }, [installationId])
  useEffect(() => { loadLicenses() }, [loadLicenses])

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file after a failed import
    if (!file || !installationId) return
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const { parseAirfieldLicensesXlsx } = await import('@/lib/driving-license-import')
      const result = await parseAirfieldLicensesXlsx(buffer)
      if (result.error) { toast.error(result.error); return }
      if (result.rows.length === 0) { toast.error('No driver rows found in the file.'); return }
      const current = licenseCount ?? 0
      const replaceNote = current > 0 ? ` This replaces the current roster of ${current.toLocaleString()}.` : ''
      const skipNote = result.skipped > 0
        ? ` (${result.skipped} row${result.skipped === 1 ? '' : 's'} without a surname skipped.)`
        : ''
      if (!confirm(`Import ${result.rows.length.toLocaleString()} driver${result.rows.length === 1 ? '' : 's'}?${replaceNote}${skipNote}`)) return
      const { count, error } = await replaceDriverLicenses(installationId, result.rows)
      if (error) { toast.error(error); return }
      toast.success(`Imported ${count.toLocaleString()} driver${count === 1 ? '' : 's'} into the Airfield Licenses roster.`)
      markSaved?.('drivingcheckitems')
      await loadLicenses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function handleClearRoster() {
    if (!installationId || !licenseCount) return
    if (!confirm(`Clear all ${licenseCount.toLocaleString()} drivers from the Airfield Licenses roster? Spot-check driver lookup will be empty until you re-import.`)) return
    const { error } = await clearDriverLicenses(installationId)
    if (error) { toast.error(error); return }
    toast.success('Airfield Licenses roster cleared.')
    await loadLicenses()
  }

  async function handleAdd() {
    const trimmed = newLabel.trim()
    if (!trimmed || !installationId) return
    setAdding(true)
    const { error } = await createDrivingCheckItem(installationId, trimmed, newGuidance.trim() || null)
    setAdding(false)
    if (error) {
      toast.error(error)
      return
    }
    setNewLabel('')
    setNewGuidance('')
    toast.success(`Added "${trimmed}"`)
    markSaved?.('drivingcheckitems')
    await load()
  }

  async function handleSeedDefaults() {
    if (!installationId) return
    setSeeding(true)
    const { error } = await seedDefaultDrivingCheckItems(installationId)
    setSeeding(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Default items loaded — edit items to match local procedures')
    markSaved?.('drivingcheckitems')
    await load()
  }

  async function handleToggleActive(item: DrivingCheckItemRow) {
    const { error } = await updateDrivingCheckItem(item.id, { is_active: !item.is_active })
    if (error) {
      toast.error(error)
      return
    }
    await load()
  }

  async function handleDelete(item: DrivingCheckItemRow) {
    if (!confirm(`Delete "${item.label}"? This cannot be undone.`)) return
    const { error } = await deleteDrivingCheckItem(item.id)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(`Deleted "${item.label}"`)
    await load()
  }

  function startEdit(item: DrivingCheckItemRow) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditGuidance(item.guidance || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditLabel('')
    setEditGuidance('')
  }

  async function saveEdit(item: DrivingCheckItemRow) {
    const trimmed = editLabel.trim()
    if (!trimmed) {
      toast.error('Item label cannot be empty')
      return
    }
    const { error } = await updateDrivingCheckItem(item.id, {
      label: trimmed,
      guidance: editGuidance.trim() || null,
    })
    if (error) {
      toast.error(error)
      return
    }
    cancelEdit()
    toast.success('Item updated')
    await load()
  }

  async function handleMove(item: DrivingCheckItemRow, direction: 'up' | 'down') {
    const idx = items.findIndex(i => i.id === item.id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || targetIdx < 0 || targetIdx >= items.length) return

    const next = [...items]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    setItems(next) // optimistic — reorderDrivingCheckItems reassigns sort_order server-side

    const { error } = await reorderDrivingCheckItems(next.map(i => i.id))
    if (error) {
      toast.error(`Reorder failed: ${error}`)
      await load()
    }
  }

  if (!loaded) {
    return <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginBottom: 14, lineHeight: 1.6 }}>
        Define the items checked during a random Airfield Driving Spot Check (FOD tire check, radio
        procedures, vehicle serviceability, escort compliance, and similar). Each active item becomes
        a Pass / Discrepancy / N/A row on the Start Spot Check form; optional guidance renders as a
        subline under the item. AF Form 483 verification is its own field on the check, not an item here.
      </p>

      {/* Airfield Licenses roster (ADDx import) — powers driver lookup on the spot check */}
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
        Airfield Driver Licenses
      </h3>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginBottom: 10, lineHeight: 1.6 }}>
        Import the ADDx <strong>Airfield Licenses Report</strong> (.xlsx) so a spot check can look a driver
        up by last name, first name, or unit and auto-fill their identity and AF Form 483 number. Re-importing
        replaces the roster.
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: 14, borderRadius: 'var(--radius-base)', marginBottom: 20,
        background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
      }}>
        <div style={{ flex: 1, minWidth: 160, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
          {licenseCount === null
            ? 'Loading roster…'
            : licenseCount === 0
              ? 'No drivers on file yet.'
              : `${licenseCount.toLocaleString()} driver${licenseCount === 1 ? '' : 's'} on file.`}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing || !installationId}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'linear-gradient(135deg, var(--color-accent-dark), var(--color-accent-secondary))',
            color: '#fff', cursor: importing || !installationId ? 'default' : 'pointer',
            fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: importing || !installationId ? 0.6 : 1,
          }}
        >
          <Upload size={14} /> {importing ? 'Importing…' : 'Import .xlsx'}
        </button>
        {(licenseCount ?? 0) > 0 && (
          <button
            onClick={handleClearRoster}
            disabled={importing}
            style={{
              background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              padding: '8px 12px', color: 'var(--color-danger)', cursor: importing ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, opacity: importing ? 0.6 : 1,
            }}
          >
            Clear roster
          </button>
        )}
      </div>

      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
        Driving Check Items <FieldHint stepKey="drivingcheckitems" fieldId="item_label" />
      </h3>

      {items.length === 0 && (
        <div style={{
          padding: 14, borderRadius: 'var(--radius-base)', marginBottom: 14,
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
        }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 10 }}>
            No check items configured yet. Add items below, or load a suggested starting point and
            edit it for local procedures.
          </p>
          <button
            onClick={handleSeedDefaults}
            disabled={seeding || !installationId}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'linear-gradient(135deg, var(--color-accent-dark), var(--color-accent-secondary))',
              color: '#fff',
              cursor: seeding || !installationId ? 'default' : 'pointer',
              fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
              opacity: seeding || !installationId ? 0.6 : 1,
            }}
          >
            {seeding ? 'Loading...' : 'Load Default Items'}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', overflow: 'hidden', marginBottom: 16 }}>
          {items.map((item, i) => {
            const isEditing = editingId === item.id
            return (
              <div key={item.id}>
                {isEditing ? (
                  <div style={{ padding: '10px 12px', background: 'var(--color-bg-elevated)' }}>
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      placeholder="Item label"
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
                    />
                    <input
                      value={editGuidance}
                      onChange={e => setEditGuidance(e.target.value)}
                      placeholder="Guidance (optional) — clarifies what &quot;Pass&quot; means for this item"
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)' }}>Cancel</button>
                      <button
                        onClick={() => saveEdit(item)}
                        disabled={!editLabel.trim()}
                        style={{ background: 'var(--color-cyan)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
                      >Save</button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                      opacity: item.is_active ? 1 : 0.5,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0 }}>
                      <button
                        onClick={() => handleMove(item, 'up')}
                        disabled={i === 0}
                        title="Move up"
                        style={{
                          background: 'none', border: 'none', padding: 0, lineHeight: 1,
                          minWidth: 24, minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                          color: i === 0 ? 'var(--color-text-4)' : 'var(--color-text-2)',
                          cursor: i === 0 ? 'default' : 'pointer',
                        }}
                      >&#9650;</button>
                      <button
                        onClick={() => handleMove(item, 'down')}
                        disabled={i === items.length - 1}
                        title="Move down"
                        style={{
                          background: 'none', border: 'none', padding: 0, lineHeight: 1,
                          minWidth: 24, minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                          color: i === items.length - 1 ? 'var(--color-text-4)' : 'var(--color-text-2)',
                          cursor: i === items.length - 1 ? 'default' : 'pointer',
                        }}
                      >&#9660;</button>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)' }}>{item.label}</div>
                      {item.guidance && (
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>{item.guidance}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleActive(item)}
                      title={item.is_active ? 'Disable' : 'Enable'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 'var(--fs-xs)', fontWeight: 600, flexShrink: 0,
                        color: item.is_active ? 'var(--color-status-pass)' : 'var(--color-text-4)',
                      }}
                    >{item.is_active ? 'Active' : 'Inactive'}</button>
                    <button onClick={() => startEdit(item)} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, flexShrink: 0 }}>Edit</button>
                    <button onClick={() => handleDelete(item)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px', flexShrink: 0 }}>&times;</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add item (e.g. FOD tire check performed)..."
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newGuidance}
            onChange={e => setNewGuidance(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Guidance (optional)..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newLabel.trim()}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'linear-gradient(135deg, var(--color-accent-dark), var(--color-accent-secondary))',
              color: '#fff',
              cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
              opacity: adding || !newLabel.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
