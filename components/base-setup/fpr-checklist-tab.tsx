'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchFprChecklistItems,
  createFprChecklistItem,
  updateFprChecklistItem,
  reorderFprChecklistItems,
  deleteFprChecklistItem,
  seedDefaultFprItems,
  type FprChecklistItemRow,
} from '@/lib/supabase/fpr'
import { FieldHint } from '@/components/base-setup/FieldHint'
import type { WizardStepKey } from '@/lib/modules-config'

// ═══════════════════════════════════════════════════════════════
// FPR Checklist tab — Base Setup wizard step for the Flight Planning
// Room Check module. Modeled on ScnAgenciesTab (flat list, inline
// rename, live-fetch load pattern) and ShiftChecklistTab (up/down
// reorder, active toggle). Extracted per the design spec rather than
// another inline block in the 6.3k-LOC setup page.
//
// Frozen-prop note: like both sibling tabs, this fetches live via
// load() keyed on installationId — it does not capture a mount-time
// prop snapshot, so it does not carry the RunwayTab-class staleness
// bug (page.tsx:677-680, :2172-2173).
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

export function FprChecklistTab({
  installationId,
  markSaved,
}: {
  installationId: string | null
  markSaved?: (stepKey: WizardStepKey) => void
}) {
  const [items, setItems] = useState<FprChecklistItemRow[]>([])
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
    const rows = await fetchFprChecklistItems(installationId, false)
    setItems(rows)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    const trimmed = newLabel.trim()
    if (!trimmed || !installationId) return
    setAdding(true)
    const { error } = await createFprChecklistItem(installationId, trimmed, newGuidance.trim() || null)
    setAdding(false)
    if (error) {
      toast.error(error)
      return
    }
    setNewLabel('')
    setNewGuidance('')
    toast.success(`Added "${trimmed}"`)
    markSaved?.('fprchecklist')
    await load()
  }

  async function handleSeedDefaults() {
    if (!installationId) return
    setSeeding(true)
    const { error } = await seedDefaultFprItems(installationId)
    setSeeding(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Default checklist loaded — edit items to match local procedures')
    markSaved?.('fprchecklist')
    await load()
  }

  async function handleToggleActive(item: FprChecklistItemRow) {
    const { error } = await updateFprChecklistItem(item.id, { is_active: !item.is_active })
    if (error) {
      toast.error(error)
      return
    }
    await load()
  }

  async function handleDelete(item: FprChecklistItemRow) {
    if (!confirm(`Delete "${item.label}"? This cannot be undone.`)) return
    const { error } = await deleteFprChecklistItem(item.id)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(`Deleted "${item.label}"`)
    await load()
  }

  function startEdit(item: FprChecklistItemRow) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditGuidance(item.guidance || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditLabel('')
    setEditGuidance('')
  }

  async function saveEdit(item: FprChecklistItemRow) {
    const trimmed = editLabel.trim()
    if (!trimmed) {
      toast.error('Item label cannot be empty')
      return
    }
    const { error } = await updateFprChecklistItem(item.id, {
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

  async function handleMove(item: FprChecklistItemRow, direction: 'up' | 'down') {
    const idx = items.findIndex(i => i.id === item.id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || targetIdx < 0 || targetIdx >= items.length) return

    const next = [...items]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    setItems(next) // optimistic — reorderFprChecklistItems reassigns sort_order server-side

    const { error } = await reorderFprChecklistItems(next.map(i => i.id))
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
        Define the items AMOPS personnel verify each shift for accuracy, currency, and availability
        of Flight Planning Room materials (FLIPs, charts, forms, NOTAM display, and similar). Each
        active item becomes a Satisfactory / Issue / N/A row on the FPR check page; optional
        guidance renders as a subline under the item.
      </p>

      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
        FPR Checklist Items <FieldHint stepKey="fprchecklist" fieldId="item_label" />
      </h3>

      {items.length === 0 && (
        <div style={{
          padding: 14, borderRadius: 'var(--radius-base)', marginBottom: 14,
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
        }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 10 }}>
            No checklist items configured yet. Add items below, or load a suggested starting point
            and edit it for local procedures.
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
            {seeding ? 'Loading...' : 'Load Default Checklist'}
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
                      placeholder="Guidance (optional) — clarifies what &quot;Satisfactory&quot; means for this item"
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
          placeholder="Add item (e.g. FLIP products current)..."
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
