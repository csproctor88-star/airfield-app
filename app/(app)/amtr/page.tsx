'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  fetchAmtrMembers, fetchAmtrByBase, fetchAmtrRoleAssignments, syncAmtrRosterFromBase,
  type AmtrMember, type AmtrRole,
} from '@/lib/supabase/amtr'
import { dueStatus, ratApplies } from '@/lib/amtr/status'
import { buildUnitKpis, type UnitKpis } from '@/lib/amtr/rollup'
import { NotificationCenter } from '@/components/amtr/notification-center'
import { thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Badge } from '@/components/ui/badge'
import { Award, ChevronRight } from 'lucide-react'

type Row = Record<string, unknown>

export default function AmtrRosterPage() {
  const { installationId } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()
  const router = useRouter()
  const canWrite = has(PERM.AMTR_WRITE)
  const canManage = has(PERM.AMTR_MANAGE)
  const canView = has(PERM.AMTR_VIEW)

  const [members, setMembers] = useState<AmtrMember[]>([])
  const [kpis, setKpis] = useState<UnitKpis>({ members: 0, requiredTasks: 0, complete: 0, dueSoon: 0, overdue: 0 })
  const [memberDue, setMemberDue] = useState<Record<string, { overdue: number; dueSoon: number }>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myRoles, setMyRoles] = useState<AmtrRole[]>([])
  // Roster KPI filter: null = no filter. Clicking a KPI card narrows the roster.
  const [rosterFilter, setRosterFilter] = useState<'current' | 'due_soon' | 'overdue' | null>(null)

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    // Auto-populate the roster from the base's assigned users (skips anyone
    // already on the roster or explicitly removed). Requires write access.
    if (canWrite) await syncAmtrRosterFromBase(installationId)
    let uid: string | null = null
    const supabase = createClient()
    if (supabase) {
      try { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id ?? null } catch { /* */ }
    }
    setMyUserId(uid)
    const [mem, r1098Prog, ratProg, roleRows] = await Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Row>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_rat_progress', installationId, 'member_id'),
      fetchAmtrRoleAssignments(installationId),
    ])
    setMyRoles(roleRows.filter((r) => r.user_id === uid).map((r) => r.role))
    setMembers(mem)

    const statusOf = new Map(mem.map((m) => [m.id, m.status]))
    const recurring: { memberStatus: string; isRat: boolean; dueDate?: string | null; completedDate?: string | null }[] = []
    const perMember: Record<string, { overdue: number; dueSoon: number }> = {}
    const bump = (id: string, s: ReturnType<typeof dueStatus>) => {
      if (s !== 'overdue' && s !== 'due_soon') return
      perMember[id] = perMember[id] ?? { overdue: 0, dueSoon: 0 }
      if (s === 'overdue') perMember[id].overdue++; else perMember[id].dueSoon++
    }
    for (const r of r1098Prog) {
      const ms = statusOf.get(String(r.member_id)) ?? 'Active'
      recurring.push({ memberStatus: ms, isRat: false, dueDate: r.next_due as string, completedDate: r.last_completed as string })
      bump(String(r.member_id), dueStatus({ dueDate: r.next_due as string, completedDate: r.last_completed as string }))
    }
    for (const r of ratProg) {
      const ms = statusOf.get(String(r.member_id)) ?? 'Active'
      if (!ratApplies(ms)) continue
      recurring.push({ memberStatus: ms, isRat: true, dueDate: r.due as string, completedDate: r.completed as string })
      bump(String(r.member_id), dueStatus({ dueDate: r.due as string, completedDate: r.completed as string }))
    }
    setKpis(buildUnitKpis(mem, recurring))
    setMemberDue(perMember)
    setLoading(false)
  }, [installationId, canWrite])

  useEffect(() => { load() }, [load])

  if (permsLoaded && !canView) {
    return <div style={{ padding: 24 }}><EmptyState message="You don't have access to Training Records." /></div>
  }

  const compliancePct = kpis.requiredTasks > 0 ? Math.round((kpis.complete / kpis.requiredTasks) * 100) : 100
  const complianceColor = compliancePct >= 90 ? 'var(--color-success)' : compliancePct >= 75 ? 'var(--color-warning)' : 'var(--color-danger)'
  // Users with a non-trainee role (or managers) see the whole roster; everyone
  // else sees only their own record.
  const hasOversight = canManage || myRoles.some((r) => r !== 'trainee')
  type RosterFilter = 'current' | 'due_soon' | 'overdue' | null
  const toggleFilter = (f: RosterFilter) => setRosterFilter((cur) => (cur === f ? null : f))
  const kpiCards: { label: string; value: string | number; color?: string; filter?: RosterFilter; active?: boolean; onClick?: () => void }[] = [
    { label: 'Members', value: kpis.members, color: 'var(--color-accent)', active: rosterFilter === null, onClick: () => { setRosterFilter(null); document.getElementById('amtr-roster')?.scrollIntoView({ behavior: 'smooth' }) } },
    { label: 'Compliance', value: `${compliancePct}%`, color: complianceColor },
    { label: 'Recurring Items', value: kpis.requiredTasks },
    { label: 'Complete', value: kpis.complete, color: 'var(--color-success)', active: rosterFilter === 'current', onClick: () => toggleFilter('current') },
    { label: 'Due Soon', value: kpis.dueSoon, color: 'var(--color-warning)', active: rosterFilter === 'due_soon', onClick: () => toggleFilter('due_soon') },
    { label: 'Overdue', value: kpis.overdue, color: 'var(--color-danger)', active: rosterFilter === 'overdue', onClick: () => toggleFilter('overdue') },
  ]

  const matchesRosterFilter = (m: AmtrMember) => {
    if (!rosterFilter) return true
    const due = memberDue[m.id]
    const overdue = due?.overdue ?? 0, dueSoon = due?.dueSoon ?? 0
    if (rosterFilter === 'overdue') return overdue > 0
    if (rosterFilter === 'due_soon') return dueSoon > 0
    return overdue === 0 && dueSoon === 0 // 'current'
  }
  const visibleMembers = hasOversight ? members : members.filter((m) => m.user_id === myUserId)
  const filtered = visibleMembers.filter((m) =>
    (!search || m.full_name.toLowerCase().includes(search.toLowerCase())) && matchesRosterFilter(m))
  const filterLabel = rosterFilter === 'overdue' ? 'with overdue items' : rosterFilter === 'due_soon' ? 'with items due soon' : rosterFilter === 'current' ? 'who are current' : null

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Award size={24} style={{ color: 'var(--color-accent)' }} />
        <h1 style={{ margin: 0, fontSize: 22 }}>Training Records</h1>
      </div>

      {/* Analytics KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 18 }}>
        {kpiCards.map((k) => (
          <div key={k.label} className="card"
            style={{
              padding: '14px 16px', cursor: k.onClick ? 'pointer' : 'default',
              border: k.active ? `1.5px solid ${k.color ?? 'var(--color-accent)'}` : undefined,
              boxShadow: k.active ? `0 0 0 1px ${k.color ?? 'var(--color-accent)'}` : undefined,
            }}
            onClick={k.onClick}
            title={k.onClick && k.label !== 'Members' ? `Show only members ${k.label === 'Complete' ? 'who are current' : k.label === 'Due Soon' ? 'with items due soon' : 'with overdue items'}` : k.onClick ? 'Show all members' : undefined}>
            <div className="section-label" style={{ marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color ?? 'var(--color-text-1)' }}>{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}><NotificationCenter /></div>

      <div id="amtr-roster" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{hasOversight ? 'Assigned Members' : 'My Record'}</h2>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{filtered.length}{filterLabel ? ` of ${visibleMembers.length}` : ''}</span>
        {filterLabel && (
          <button onClick={() => setRosterFilter(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--color-border-mid)', background: 'var(--color-bg-inset)', color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Showing members {filterLabel} · clear ✕
          </button>
        )}
        <input
          className="input-dark"
          style={{ marginLeft: 'auto', maxWidth: 280 }}
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? <LoadingState message="Loading roster…" />
        : filtered.length === 0 ? <EmptyState message={rosterFilter || search ? 'No members match the current filter.' : 'No members yet — the roster populates automatically from the base\'s assigned users.'} icon="🎓" />
        : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Member</th>
                  <th style={thStyle}>Grade</th>
                  <th style={thStyle}>DAFSC</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Currency</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const due = memberDue[m.id]
                  return (
                    <tr
                      key={m.id}
                      onClick={() => router.push(`/amtr/${m.id}`)}
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{m.full_name}</td>
                      <td style={tdStyle}>{m.grade ?? '—'}</td>
                      <td style={tdStyle}>{m.dafsc ?? '—'}</td>
                      <td style={tdStyle}>{m.status}</td>
                      <td style={tdStyle}>
                        {!due || (due.overdue === 0 && due.dueSoon === 0)
                          ? <Badge label="Current" color="var(--color-success)" />
                          : (
                            <span style={{ display: 'inline-flex', gap: 6 }}>
                              {due.overdue > 0 && <Badge label={`${due.overdue} overdue`} color="var(--color-danger)" />}
                              {due.dueSoon > 0 && <Badge label={`${due.dueSoon} due soon`} color="var(--color-warning)" />}
                            </span>
                          )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}><ChevronRight size={16} style={{ color: 'var(--color-text-3)' }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
