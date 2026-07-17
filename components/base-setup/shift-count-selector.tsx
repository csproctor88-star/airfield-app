'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { fetchChecklistItems, updateChecklistItem } from '@/lib/supabase/shift-checklist'
import {
  getActiveShifts,
  getShiftLabel,
  DEFAULT_SHIFT_LABELS,
  SHIFT_ORDER,
  type ShiftKey,
} from '@/lib/shifts'

// Shared "Shifts per Day" (1–3) + shift-name control, wired to
// bases.shift_count / bases.shift_name_*. A single source of truth so the
// Shift Checklist and Flight Planning Room configs offer identical shift
// setup ("match the shift checklist"). Reducing the count reassigns any
// shift-checklist items on the now-removed shifts to the first shift — a
// compliance checklist must never silently lose items — regardless of which
// config surface changed the count.

const controlStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-1)',
  fontSize: 'var(--fs-md)',
  fontFamily: 'inherit',
}

export function ShiftCountSelector() {
  const { installationId, currentInstallation, refreshCurrentInstallation } = useInstallation()

  const [shiftCount, setShiftCount] = useState<1 | 2 | 3>(2)
  const [shiftNames, setShiftNames] = useState<Record<ShiftKey, string>>({ day: '', swing: '', mid: '' })
  const [savingShiftCount, setSavingShiftCount] = useState(false)
  const [savingShiftName, setSavingShiftName] = useState<ShiftKey | null>(null)

  useEffect(() => {
    const inst = currentInstallation as {
      shift_count?: number
      shift_name_day?: string | null
      shift_name_swing?: string | null
      shift_name_mid?: string | null
    } | null
    const sc = inst?.shift_count
    setShiftCount(sc === 3 ? 3 : sc === 1 ? 1 : 2)
    setShiftNames({
      day: inst?.shift_name_day || '',
      swing: inst?.shift_name_swing || '',
      mid: inst?.shift_name_mid || '',
    })
  }, [currentInstallation])

  async function handleSaveShiftCount(next: 1 | 2 | 3) {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    const prev = shiftCount
    // Shift-checklist items on shifts that stop existing move to the first
    // shift so a compliance checklist never silently loses items.
    const removedKeys: readonly string[] = SHIFT_ORDER.slice(next)
    const items = removedKeys.length > 0 ? await fetchChecklistItems(installationId) : []
    const affected = items.filter(i => removedKeys.includes(i.shift))
    if (affected.length > 0) {
      const firstLabel = getShiftLabel(currentInstallation, 'day')
      const noun = affected.length === 1 ? 'shift checklist item is' : 'shift checklist items are'
      if (!confirm(`${affected.length} ${noun} assigned to shifts being removed and will move to ${firstLabel}. Continue?`)) return
    }
    setSavingShiftCount(true)
    setShiftCount(next)
    for (const it of affected) {
      const { error } = await updateChecklistItem(it.id, { shift: 'day' })
      if (error) {
        toast.error(error)
        setShiftCount(prev)
        setSavingShiftCount(false)
        return
      }
    }
    const { error } = await supabase
      .from('bases')
      .update({ shift_count: next, updated_at: new Date().toISOString() })
      .eq('id', installationId)
    if (error) {
      toast.error(error.message)
      setShiftCount(prev)
    } else {
      toast.success(`Shift count set to ${next}`)
      await refreshCurrentInstallation()
    }
    setSavingShiftCount(false)
  }

  async function handleSaveShiftName(key: ShiftKey) {
    if (!installationId) return
    const value = shiftNames[key].trim()
    const column = `shift_name_${key}`
    const stored = ((currentInstallation as Record<string, unknown> | null)?.[column] as string | null) || ''
    if (value === stored.trim()) return
    setSavingShiftName(key)
    const supabase = createClient()
    if (supabase) {
      const { error } = await supabase
        .from('bases')
        .update({ [column]: value || null, updated_at: new Date().toISOString() })
        .eq('id', installationId)
      if (error) toast.error(error.message)
      else {
        toast.success(value
          ? `Shift renamed to "${value}"`
          : `Shift name reset to ${DEFAULT_SHIFT_LABELS[key]}`)
        await refreshCurrentInstallation()
      }
    }
    setSavingShiftName(null)
  }

  const activeShifts = getActiveShifts(currentInstallation)

  return (
    <>
      <div style={{
        background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-base)', padding: 14, marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Shifts per Day</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            Sets the per-shift cards here and on the Shift Checklist, plus Daily Review sign-off slots.
          </div>
        </div>
        <select
          value={shiftCount}
          onChange={(e) => handleSaveShiftCount(Number(e.target.value) as 1 | 2 | 3)}
          disabled={savingShiftCount}
          style={{ ...controlStyle, minWidth: 100 }}
        >
          <option value={1}>1 shift</option>
          <option value={2}>2 shifts</option>
          <option value={3}>3 shifts</option>
        </select>
      </div>

      <div style={{
        background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-base)', padding: 14, marginBottom: 12,
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Shift Names</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, marginBottom: 10 }}>
          Rename shifts to match how your team works. Leave blank to use the default.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {activeShifts.map(s => (
            <input
              key={s.key}
              value={shiftNames[s.key]}
              onChange={e => setShiftNames(prevNames => ({ ...prevNames, [s.key]: e.target.value }))}
              onBlur={() => handleSaveShiftName(s.key)}
              placeholder={DEFAULT_SHIFT_LABELS[s.key]}
              maxLength={20}
              disabled={savingShiftName === s.key}
              aria-label={`Name for ${DEFAULT_SHIFT_LABELS[s.key]}`}
              style={{ ...controlStyle, flex: 1, minWidth: 140 }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
