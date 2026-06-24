'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  fetchFlipRoleAssignments, addFlipRole, removeFlipRole, type FlipRoleAssignment,
} from '@/lib/supabase/flip'
import { FLIP_ROLES, FLIP_ROLE_LABELS, type FlipRole } from '@/lib/flip/roles'

type Member = { user_id: string; full_name: string }

const thStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const tdStyle: React.CSSProperties = { padding: '8px 12px' }

// Base members come from `base_members` joined to `profiles` for display
// names — the same source the PPR coordinator picker uses
// (lib/supabase/ppr-agency-members.ts → fetchPprCoordinatorPicker). The
// display name is built from profiles.name (there is no `full_name` column),
// prefixed with the member's rank when present.
async function fetchBaseMembers(baseId: string): Promise<Member[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('base_members')
    .select('user_id, profiles:user_id(name, rank)')
    .eq('base_id', baseId)
  if (error || !data) {
    if (error) console.error('fetchBaseMembers:', error.message)
    return []
  }
  return (data as Record<string, unknown>[])
    .map((row) => {
      const prof = row.profiles as { name?: string; rank?: string } | null
      const name = prof?.name?.trim() || '(no name)'
      const rank = prof?.rank?.trim()
      return {
        user_id: row.user_id as string,
        full_name: rank ? `${rank} ${name}` : name,
      }
    })
    .filter((m) => m.user_id)
}

export default function FlipRolesPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canManage = has(PERM.FLIP_MANAGE)

  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<FlipRoleAssignment[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [a, m] = await Promise.all([
      fetchFlipRoleAssignments(installationId),
      fetchBaseMembers(installationId),
    ])
    setAssignments(a)
    setMembers(m.sort((x, y) => x.full_name.localeCompare(y.full_name)))
    setLoading(false)
  }, [installationId])

  useEffect(() => { load() }, [load])

  const assignByKey = useMemo(() => {
    const map = new Map<string, string>()
    assignments.forEach((a) => map.set(`${a.user_id}:${a.role}`, a.id))
    return map
  }, [assignments])

  const filteredMembers = useMemo(
    () => members.filter((m) => m.full_name.toLowerCase().includes(search.trim().toLowerCase())),
    [members, search],
  )

  const toggleAssign = async (uid: string, role: FlipRole, existingId: string | undefined) => {
    if (!installationId) return
    const key = `${uid}:${role}`
    setSavingKey(key)
    const { error } = existingId ? await removeFlipRole(existingId) : await addFlipRole(installationId, uid, role)
    setSavingKey(null)
    if (error) { toast.error(error); return }
    load()
  }

  if (!canManage) return <div style={{ padding: 24, color: 'var(--color-text-2)' }}>Requires the Manage FLIP Roles permission.</div>
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 4, color: 'var(--color-text-1)' }}>FLIP Role Assignments</h1>
      <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', marginBottom: 16 }}>
        Assign FLIP roles per person. A user may hold multiple roles. Per DAFMAN 13-204V2 §2.5.2.18, appoint a primary and alternate FLIP custodian.
      </p>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…"
        style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', color: 'var(--color-text-1)', width: 260 }} />
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>Member</th>
              {FLIP_ROLES.map((r) => <th key={r} style={{ ...thStyle, textAlign: 'center', width: 110 }}>{FLIP_ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => (
              <tr key={m.user_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{m.full_name}</td>
                {FLIP_ROLES.map((r) => {
                  const key = `${m.user_id}:${r}`
                  const existingId = assignByKey.get(key)
                  return (
                    <td key={r} style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="checkbox" checked={!!existingId} disabled={savingKey === key}
                        onChange={() => toggleAssign(m.user_id, r, existingId)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                    </td>
                  )
                })}
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr><td colSpan={FLIP_ROLES.length + 1} style={{ ...tdStyle, color: 'var(--color-text-3)' }}>No members.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
