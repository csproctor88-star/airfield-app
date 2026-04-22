'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'
import {
  MODULES,
  TYPICAL_BASE_PRESET,
  ALL_TOGGLEABLE_MODULES,
  CATEGORY_LABELS,
  getModulesByCategory,
  type ModuleKey,
  type ModuleCategory,
} from '@/lib/modules-config'

const CATEGORY_ORDER: ModuleCategory[] = ['core-ops', 'emergency', 'compliance', 'optional']

const ROLE_LABEL_FOR_LOCK: Partial<Record<UserRole, string>> = {
  ces: 'CES',
  namo: 'NAMO',
  amops: 'AMOPS',
  atc: 'ATC',
  safety: 'Safety',
}

export default function ModuleSelectorPage() {
  const { currentInstallation, installationId, enabledModules, updateEnabledModules } = useInstallation()
  const { has } = usePermissions()
  const router = useRouter()

  const canEdit = has(PERM.BASE_SETUP_WRITE)

  const [selected, setSelected] = useState<Set<ModuleKey>>(() => new Set(enabledModules))
  const [saving, setSaving] = useState(false)
  const [baseRoles, setBaseRoles] = useState<Set<UserRole>>(new Set())

  useEffect(() => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    supabase
      .from('profiles')
      .select('role')
      .eq('primary_base_id', installationId)
      .not('role', 'is', null)
      .then(({ data }) => {
        const roles = new Set<UserRole>()
        for (const r of (data as { role: UserRole | null }[] | null) ?? []) {
          if (r.role) roles.add(r.role)
        }
        setBaseRoles(roles)
      })
  }, [installationId])

  const grouped = useMemo(() => getModulesByCategory(), [])

  const lockInfo = useMemo(() => {
    const map = new Map<ModuleKey, string[]>()
    for (const m of MODULES) {
      if (!m.roleRestrictions) continue
      const present = m.roleRestrictions.filter(r => baseRoles.has(r))
      if (present.length > 0) {
        map.set(m.key, present.map(r => ROLE_LABEL_FOR_LOCK[r] || r))
      }
    }
    return map
  }, [baseRoles])

  // Ensure locked modules are always in the selection set (applies after baseRoles load)
  useEffect(() => {
    if (lockInfo.size === 0) return
    setSelected(prev => {
      let changed = false
      const next = new Set(prev)
      lockInfo.forEach((_, key) => {
        if (!next.has(key)) { next.add(key); changed = true }
      })
      return changed ? next : prev
    })
  }, [lockInfo])

  if (!canEdit) {
    return (
      <div style={{ padding: 24 }}>
        <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
          &larr; Settings
        </Link>
        <h1 style={{ marginTop: 16, fontSize: 'var(--fs-4xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
          Modules
        </h1>
        <p style={{ color: 'var(--color-text-3)', marginTop: 8 }}>
          Only Airfield Managers and System Admins can change enabled modules.
        </p>
      </div>
    )
  }

  const toggle = (key: ModuleKey) => {
    if (lockInfo.has(key)) {
      const roles = lockInfo.get(key)!.join(', ')
      toast.error(`${roles} users depend on this module — can't disable it while they're on the base.`)
      return
    }
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const applyPreset = (keys: ModuleKey[]) => {
    const next = new Set(keys)
    lockInfo.forEach((_, locked) => next.add(locked))
    setSelected(next)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const keys = MODULES.filter(m => selected.has(m.key)).map(m => m.key)
      await updateEnabledModules(keys)
      toast.success('Modules updated')
      router.push('/settings/base-setup')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save modules')
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = selected.size
  const changedFromCurrent =
    selectedCount !== enabledModules.length ||
    enabledModules.some(k => !selected.has(k as ModuleKey))

  return (
    <div className="page-container" style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link href="/settings/base-setup" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
        &larr; Base Setup
      </Link>

      {/* Header */}
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
          Modules
        </h1>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
          Pick which Glidepath modules {currentInstallation?.name ?? 'this installation'} will use. Disabled modules
          hide from the sidebar, dashboard, and setup wizard — data stays in the database so re-enabling a module
          brings everything back untouched.
        </p>
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => applyPreset(TYPICAL_BASE_PRESET)}
          style={{
            padding: '10px 16px', borderRadius: 'var(--radius-base)',
            border: '1px solid var(--color-cyan)', background: 'rgba(34,211,238,0.12)',
            color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Use Recommended Setup
        </button>
        <button
          type="button"
          onClick={() => applyPreset(ALL_TOGGLEABLE_MODULES)}
          style={{
            padding: '10px 16px', borderRadius: 'var(--radius-base)',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
            color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Enable Everything
        </button>
        <button
          type="button"
          onClick={() => applyPreset([])}
          style={{
            padding: '10px 16px', borderRadius: 'var(--radius-base)',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
            color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Clear All
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ alignSelf: 'center', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          {selectedCount} of {MODULES.length} selected
        </div>
      </div>

      {/* Grouped module cards */}
      {CATEGORY_ORDER.map(cat => {
        const mods = grouped[cat]
        if (mods.length === 0) return null
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)',
              marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--color-border)',
            }}>
              {CATEGORY_LABELS[cat]}
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 10,
            }}>
              {mods.map(m => {
                const on = selected.has(m.key)
                const lockedRoles = lockInfo.get(m.key)
                const locked = !!lockedRoles
                return (
                  <label
                    key={m.key}
                    style={{
                      display: 'block',
                      padding: 14,
                      borderRadius: 'var(--radius-lg)',
                      border: on ? '2px solid var(--color-cyan)' : '1px solid var(--color-border)',
                      background: on ? 'rgba(34,211,238,0.06)' : 'var(--color-surface-1)',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      transition: 'border 0.12s, background 0.12s',
                      opacity: locked ? 0.95 : 1,
                    }}
                    title={locked ? `${lockedRoles!.join(', ')} users depend on this module` : undefined}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked}
                        onChange={() => toggle(m.key)}
                        style={{ marginTop: 3, cursor: locked ? 'not-allowed' : 'pointer', accentColor: 'var(--color-cyan)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                            {m.label}
                          </div>
                          {m.defaultEnabled && (
                            <span style={{
                              fontSize: 'var(--fs-2xs)', fontWeight: 700,
                              color: 'var(--color-cyan)',
                              background: 'rgba(34,211,238,0.12)',
                              padding: '2px 6px', borderRadius: 4,
                            }}>
                              RECOMMENDED
                            </span>
                          )}
                          {locked && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 'var(--fs-2xs)', fontWeight: 700,
                              color: 'var(--color-warning)',
                              background: 'rgba(251,191,36,0.12)',
                              padding: '2px 6px', borderRadius: 4,
                            }}>
                              <Lock size={10} /> REQUIRED FOR {lockedRoles!.join(', ')}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.45, marginBottom: 4 }}>
                          {m.description}
                        </div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', lineHeight: 1.45, fontStyle: 'italic' }}>
                          {m.useCase}
                        </div>
                        {locked && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', marginTop: 6 }}>
                            Can&apos;t disable — {lockedRoles!.join(', ')} users on this base rely on it.
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Save bar */}
      <div style={{
        position: 'sticky', bottom: 0, marginTop: 20, padding: '12px 0',
        background: 'linear-gradient(to top, var(--color-bg-1) 85%, transparent)',
        display: 'flex', gap: 8,
      }}>
        <Link
          href="/settings/base-setup"
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-base)',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
            color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none',
          }}
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={saving || !changedFromCurrent}
          onClick={handleSave}
          style={{
            flex: 2, padding: '12px 16px', borderRadius: 'var(--radius-base)',
            border: 'none',
            background: changedFromCurrent
              ? 'linear-gradient(135deg, var(--color-cyan), var(--color-accent))'
              : 'var(--color-bg-inset)',
            color: changedFromCurrent ? '#fff' : 'var(--color-text-3)',
            fontSize: 'var(--fs-md)', fontWeight: 700,
            cursor: saving || !changedFromCurrent ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : changedFromCurrent ? 'Save and Continue' : 'No Changes'}
        </button>
      </div>
    </div>
  )
}
