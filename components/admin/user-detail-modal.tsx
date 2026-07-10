'use client'

import { useState, useRef, useEffect } from 'react'
import { X, RotateCcw, UserX, UserCheck, Trash2, ChevronDown, Eye, EyeOff, Plus, Building2, ListChecks } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RANK_OPTIONS, USER_ROLES } from '@/lib/constants'
import { RoleBadge } from './role-badge'
import { UserStatusBadge } from './status-badge'
import { formatRelativeTime, formatZuluDate } from '@/lib/utils'
import { UserEngagementPanel } from './user-engagement-panel'
import type { UserCardData } from './user-card'
import type { Installation, UserRole } from '@/lib/supabase/types'

interface UserDetailModalProps {
  user: UserCardData
  isSysAdmin: boolean
  isBaseAdmin: boolean
  installations: Installation[]
  onSave: (userId: string, updates: Record<string, unknown>) => Promise<void>
  onResetPassword: (email: string, userId: string) => Promise<void>
  onDeactivate: (userId: string) => Promise<void>
  onReactivate: (userId: string) => Promise<void>
  onDelete: (userId: string) => void
  onClose: () => void
  onSendEmail?: (template: 'approved' | 'info_needed' | 'rejected') => void
}

export function UserDetailModal({
  user,
  isSysAdmin,
  isBaseAdmin,
  installations,
  onSave,
  onResetPassword,
  onDeactivate,
  onReactivate,
  onDelete,
  onClose,
  onSendEmail,
}: UserDetailModalProps) {
  const [rank, setRank] = useState(user.rank || '')
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [lastName, setLastName] = useState(user.last_name || '')
  const [email, setEmail] = useState(user.email || '')
  const [edipi, setEdipi] = useState(user.edipi || '')
  const [operatingInitials, setOperatingInitials] = useState(user.operating_initials || '')
  const [unit, setUnit] = useState(user.unit || '')
  const [officeSymbol, setOfficeSymbol] = useState(user.office_symbol || '')
  const [role, setRole] = useState(user.role)
  const [baseId, setBaseId] = useState(user.primary_base_id || '')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showInstDropdown, setShowInstDropdown] = useState(false)
  const [instSearch, setInstSearch] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [baseMemberships, setBaseMemberships] = useState<{ base_id: string; role: string; name: string; icao: string }[]>([])
  const [showAddBase, setShowAddBase] = useState(false)
  const [addBaseSearch, setAddBaseSearch] = useState('')
  const addBaseRef = useRef<HTMLDivElement>(null)
  // Bulk-edit state — for MAJCOM/RFM and any user with lots of bases
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkSearch, setBulkSearch] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const instDropdownRef = useRef<HTMLDivElement>(null)

  // Close installation dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (instDropdownRef.current && !instDropdownRef.current.contains(e.target as Node)) {
        setShowInstDropdown(false)
        setInstSearch('')
      }
    }
    if (showInstDropdown) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showInstDropdown])

  // Load base memberships for this user
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase
      .from('base_members')
      .select('base_id, role, bases(name, icao)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          setBaseMemberships(data.map((row: any) => ({
            base_id: row.base_id,
            role: row.role,
            name: row.bases?.name || 'Unknown',
            icao: row.bases?.icao || '',
          })))
        }
      })
  }, [user.id])

  // Close add-base dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addBaseRef.current && !addBaseRef.current.contains(e.target as Node)) {
        setShowAddBase(false)
        setAddBaseSearch('')
      }
    }
    if (showAddBase) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAddBase])

  const handleAddBase = async (baseId: string) => {
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from('base_members')
      .upsert({ base_id: baseId, user_id: user.id, role: 'read_only' }, { onConflict: 'base_id,user_id' })
    if (error) {
      showMessage('Failed to add base access', true)
      return
    }
    const inst = installations.find(i => i.id === baseId)
    setBaseMemberships(prev => [...prev, { base_id: baseId, role: 'read_only', name: inst?.name || '', icao: inst?.icao || '' }])
    setShowAddBase(false)
    setAddBaseSearch('')
    showMessage(`Added access to ${inst?.name || 'base'}`)
  }

  const handleRemoveBase = async (baseId: string) => {
    // Don't allow removing their primary base
    if (baseId === user.primary_base_id) {
      showMessage('Cannot remove primary base assignment', true)
      return
    }
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from('base_members')
      .delete()
      .eq('base_id', baseId)
      .eq('user_id', user.id)
    if (error) {
      showMessage('Failed to remove base access', true)
      return
    }
    setBaseMemberships(prev => prev.filter(m => m.base_id !== baseId))
    showMessage('Base access removed')
  }

  const openBulkEdit = () => {
    setBulkSelected(new Set(baseMemberships.map(m => m.base_id)))
    setBulkSearch('')
    setShowBulkEdit(true)
  }

  const toggleBulk = (baseId: string) => {
    // Primary base stays checked — it's locked in like the per-row remove.
    if (baseId === user.primary_base_id) return
    setBulkSelected(prev => {
      const next = new Set(prev)
      if (next.has(baseId)) next.delete(baseId)
      else next.add(baseId)
      return next
    })
  }

  const handleBulkSave = async () => {
    const supabase = createClient()
    if (!supabase) return
    setBulkSaving(true)
    const current = new Set(baseMemberships.map(m => m.base_id))
    const desired = new Set(bulkSelected)
    // Always keep primary base in desired — defensive.
    if (user.primary_base_id) desired.add(user.primary_base_id)

    const toAdd: string[] = []
    const toRemove: string[] = []
    desired.forEach(id => { if (!current.has(id)) toAdd.push(id) })
    current.forEach(id => { if (!desired.has(id)) toRemove.push(id) })

    try {
      if (toAdd.length > 0) {
        const rows = toAdd.map(base_id => ({ base_id, user_id: user.id, role: 'read_only' }))
        const { error } = await supabase.from('base_members').upsert(rows, { onConflict: 'base_id,user_id' })
        if (error) throw new Error(error.message)
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('base_members')
          .delete()
          .eq('user_id', user.id)
          .in('base_id', toRemove)
        if (error) throw new Error(error.message)
      }
      // Rebuild memberships from the desired set
      setBaseMemberships(() => {
        const rows: { base_id: string; role: string; name: string; icao: string }[] = []
        desired.forEach(base_id => {
          const existing = baseMemberships.find(m => m.base_id === base_id)
          if (existing) { rows.push(existing); return }
          const inst = installations.find(i => i.id === base_id)
          rows.push({ base_id, role: 'read_only', name: inst?.name || '', icao: inst?.icao || '' })
        })
        return rows
      })
      const n = toAdd.length + toRemove.length
      showMessage(n === 0 ? 'No changes' : `Saved — ${toAdd.length} added, ${toRemove.length} removed`)
      setShowBulkEdit(false)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Bulk save failed', true)
    } finally {
      setBulkSaving(false)
    }
  }

  const isDeactivated = user.status === 'deactivated'

  const ADMIN_ONLY_ROLES: UserRole[] = ['sys_admin', 'base_admin']
  const roleOptions = Object.entries(USER_ROLES)
    .filter(([key]) => isSysAdmin || !ADMIN_ONLY_ROLES.includes(key as UserRole))
    .map(([key, cfg]) => ({
      value: key as UserRole,
      label: cfg.label,
    }))

  const showMessage = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(null), 4000)
    } else {
      setSuccessMsg(msg)
      setTimeout(() => setSuccessMsg(null), 3000)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setErrorMsg(null)
    try {
      const updates: Record<string, unknown> = {
        rank,
        first_name: firstName,
        last_name: lastName,
        edipi: edipi.trim() || null,
        operating_initials: operatingInitials.trim().toUpperCase() || null,
        unit: unit.trim() || null,
        office_symbol: officeSymbol.trim() || null,
      }
      // Only thread the email through if an admin actually changed it.
      // Sending the same value would still trigger the auth admin call
      // unnecessarily; sending a different value gates on a real change.
      const trimmedEmail = email.trim().toLowerCase()
      if ((isSysAdmin || isBaseAdmin) && trimmedEmail && trimmedEmail !== (user.email || '').toLowerCase()) {
        updates.email = trimmedEmail
      }
      if (isSysAdmin) {
        updates.role = role
        updates.primary_base_id = baseId
      } else if (isBaseAdmin) {
        updates.role = role
      }
      await onSave(user.id, updates)
      showMessage('Profile updated')
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to save', true)
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    setResetting(true)
    try {
      await onResetPassword(user.email, user.id)
      // Success + the temp password are surfaced by the parent as a persistent
      // toast — the temp password must stay on screen long enough for the admin
      // to relay it on a .mil tenant. No inline message here: showMessage
      // auto-dismisses in 3s and would duplicate the toast.
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to reset password', true)
    } finally {
      setResetting(false)
    }
  }

  const handleToggleStatus = async () => {
    setToggling(true)
    try {
      if (isDeactivated) {
        await onReactivate(user.id)
        showMessage('User reactivated')
      } else {
        await onDeactivate(user.id)
        showMessage('User deactivated')
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to update status', true)
    } finally {
      setToggling(false)
    }
  }

  const anyLoading = saving || resetting || toggling

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 20,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              Edit Profile
            </div>
            <RoleBadge role={user.role} />
            <UserStatusBadge status={user.status || 'active'} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} color="var(--color-text-3)" />
          </button>
        </div>

        {/* Profile Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Rank */}
          <div>
            <span className="section-label">Rank</span>
            <select
              className="input-dark"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              style={{ width: '100%' }}
              disabled={anyLoading}
            >
              <option value="">Select rank...</option>
              {RANK_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* First & Last Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span className="section-label">First Name</span>
              <input
                type="text"
                className="input-dark"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={anyLoading}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <span className="section-label">Last Name</span>
              <input
                type="text"
                className="input-dark"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={anyLoading}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Unit & Office Symbol */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span className="section-label">Unit</span>
              <input
                type="text"
                className="input-dark"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. 115th OSS"
                disabled={anyLoading}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <span className="section-label">Office Symbol</span>
              <input
                type="text"
                className="input-dark"
                value={officeSymbol}
                onChange={(e) => setOfficeSymbol(e.target.value)}
                placeholder="e.g. OSAA"
                disabled={anyLoading}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Email — editable for admins; reveal-only for everyone else */}
          {(isSysAdmin || isBaseAdmin) ? (
            <div>
              <span className="section-label">Email</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="email"
                  className="input-dark"
                  value={showEmail ? email : email.replace(/^(..)[^@]*/, '$1***')}
                  onChange={(e) => { if (showEmail) setEmail(e.target.value) }}
                  disabled={anyLoading || !showEmail}
                  placeholder="user@example.com"
                  autoComplete="off"
                  style={{ flex: 1, boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowEmail(!showEmail)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                  title={showEmail ? 'Hide email' : 'Reveal and edit email'}
                >
                  {showEmail
                    ? <EyeOff size={14} color="var(--color-text-3)" />
                    : <Eye size={14} color="var(--color-text-3)" />}
                </button>
              </div>
              {showEmail && email.trim().toLowerCase() !== (user.email || '').toLowerCase() && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', marginTop: 4 }}>
                  Changing email takes effect immediately on next sign-in. The user will need to use the new address.
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="section-label">Email</span>
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 'var(--fs-md)',
                  color: 'var(--color-text-2)',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {showEmail ? user.email : user.email.replace(/^(..)[^@]*/, '$1***')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowEmail(!showEmail)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                  title={showEmail ? 'Hide email' : 'Reveal email'}
                >
                  {showEmail
                    ? <EyeOff size={14} color="var(--color-text-3)" />
                    : <Eye size={14} color="var(--color-text-3)" />}
                </button>
              </div>
            </div>
          )}

          {/* EDIPI */}
          <div>
            <span className="section-label">EDIPI</span>
            <input
              type="text"
              className="input-dark"
              value={edipi}
              onChange={(e) => setEdipi(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit DoD ID number"
              disabled={anyLoading}
              maxLength={10}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
            />
          </div>

          {/* Operating Initials */}
          <div>
            <span className="section-label">Operating Initials</span>
            <input
              type="text"
              className="input-dark"
              value={operatingInitials}
              onChange={(e) => setOperatingInitials(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. JDS"
              disabled={anyLoading}
              maxLength={4}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.1em' }}
            />
          </div>

          {/* Role */}
          {(isSysAdmin || isBaseAdmin) ? (
            <div>
              <span className="section-label">Role</span>
              <select
                className="input-dark"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%' }}
                disabled={anyLoading}
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <span className="section-label">Role</span>
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 'var(--fs-md)',
                  color: 'var(--color-text-2)',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
              >
                {USER_ROLES[user.role as keyof typeof USER_ROLES]?.label || user.role}
              </div>
            </div>
          )}

          {/* Installation (sys admin only) */}
          {isSysAdmin ? (
            <div ref={instDropdownRef} style={{ position: 'relative' }}>
              <span className="section-label">Assigned Installation</span>
              <button
                type="button"
                onClick={() => { if (!anyLoading) setShowInstDropdown(!showInstDropdown) }}
                className="input-dark"
                disabled={anyLoading}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: anyLoading ? 'not-allowed' : 'pointer', textAlign: 'left',
                  opacity: anyLoading ? 0.6 : 1,
                }}
              >
                <span style={{ color: baseId ? 'var(--color-text-1)' : 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
                  {baseId
                    ? (() => { const inst = installations.find(i => i.id === baseId); return inst ? `${inst.name} · ${inst.icao}` : 'Select installation...' })()
                    : 'Select installation...'}
                </span>
                <ChevronDown size={14} color="var(--color-text-3)" />
              </button>

              {showInstDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  zIndex: 100, marginTop: 4,
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-mid)',
                  borderRadius: 8,
                  maxHeight: 200, overflowY: 'auto',
                }}>
                  <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                    <input
                      type="text"
                      placeholder="Search installations..."
                      value={instSearch}
                      onChange={(e) => setInstSearch(e.target.value)}
                      className="input-dark"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-base)' }}
                      autoFocus
                    />
                  </div>
                  {installations
                    .filter(inst => !instSearch || `${inst.name} ${inst.icao}`.toLowerCase().includes(instSearch.toLowerCase()))
                    .map(inst => (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => { setBaseId(inst.id); setShowInstDropdown(false); setInstSearch('') }}
                        style={{
                          display: 'block', width: '100%', padding: '10px 14px',
                          background: inst.id === baseId ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
                          border: 'none',
                          borderBottom: '1px solid var(--color-border)',
                          cursor: 'pointer', textAlign: 'left',
                          color: inst.id === baseId ? 'var(--color-accent)' : 'var(--color-text-1)',
                          fontSize: 'var(--fs-md)', fontFamily: 'inherit',
                          fontWeight: inst.id === baseId ? 700 : 500,
                        }}
                      >
                        {inst.name}
                        {inst.icao && <span style={{ fontSize: 'var(--fs-xs)', marginLeft: 8, opacity: 0.5 }}>{inst.icao}</span>}
                      </button>
                    ))}
                  {installations.filter(inst => !instSearch || `${inst.name} ${inst.icao}`.toLowerCase().includes(instSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '12px 14px', fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
                      No installations found
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="section-label">Assigned Installation</span>
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 'var(--fs-md)',
                  color: 'var(--color-text-2)',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
              >
                {user.bases ? `${user.bases.name} · ${user.bases.icao}` : 'None'}
              </div>
            </div>
          )}

          {/* Base Access (multi-base) */}
          {(isSysAdmin || isBaseAdmin) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span className="section-label" style={{ marginBottom: 0 }}>Base Access</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={openBulkEdit}
                    disabled={anyLoading}
                    title="Select multiple bases at once (useful for MAJCOM / RFM)"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 8px', borderRadius: 6,
                      border: '1px solid var(--color-border)',
                      background: 'transparent', color: 'var(--color-cyan)',
                      fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <ListChecks size={12} /> Bulk
                  </button>
                <div ref={addBaseRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddBase(!showAddBase)}
                    disabled={anyLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 8px', borderRadius: 6,
                      border: '1px solid var(--color-border)',
                      background: 'transparent', color: 'var(--color-cyan)',
                      fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Plus size={12} /> Add Base
                  </button>
                  {showAddBase && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0,
                      zIndex: 100, marginTop: 4, width: 260,
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8, maxHeight: 200, overflowY: 'auto',
                    }}>
                      <div style={{ padding: 6, borderBottom: '1px solid var(--color-border)' }}>
                        <input
                          type="text"
                          placeholder="Search bases..."
                          value={addBaseSearch}
                          onChange={(e) => setAddBaseSearch(e.target.value)}
                          className="input-dark"
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-xs)', padding: '6px 8px' }}
                          autoFocus
                        />
                      </div>
                      {installations
                        .filter(inst => !baseMemberships.some(m => m.base_id === inst.id))
                        .filter(inst => !addBaseSearch || `${inst.name} ${inst.icao}`.toLowerCase().includes(addBaseSearch.toLowerCase()))
                        .map(inst => (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => handleAddBase(inst.id)}
                            style={{
                              display: 'block', width: '100%', padding: '8px 10px',
                              background: 'transparent', border: 'none',
                              borderBottom: '1px solid var(--color-border)',
                              cursor: 'pointer', textAlign: 'left',
                              color: 'var(--color-text-1)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                            }}
                          >
                            {inst.name} <span style={{ opacity: 0.5 }}>{inst.icao}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {baseMemberships.length === 0 && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', padding: '6px 0' }}>
                    No base assignments
                  </div>
                )}
                {baseMemberships.map(m => (
                  <div
                    key={m.base_id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px', borderRadius: 6,
                      background: 'var(--color-bg-elevated)',
                      border: m.base_id === user.primary_base_id ? '1px solid var(--color-border-active)' : '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={12} style={{ color: 'var(--color-text-4)' }} />
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 500 }}>
                        {m.name}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>{m.icao}</span>
                      {m.base_id === user.primary_base_id && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, color: 'var(--color-cyan)',
                          padding: '1px 4px', borderRadius: 3,
                          background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                        }}>PRIMARY</span>
                      )}
                    </div>
                    {m.base_id !== user.primary_base_id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBase(m.base_id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                          color: 'var(--color-text-4)',
                        }}
                        title="Remove base access"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Read-only info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span className="section-label">Date Joined</span>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
                {formatZuluDate(user.created_at)}
              </div>
            </div>
            <div>
              <span className="section-label">Last Active</span>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
                {user.last_seen_at ? formatRelativeTime(user.last_seen_at) : 'Never'}
              </div>
            </div>
          </div>

          {/* Activity & Engagement — admins only */}
          {(isSysAdmin || isBaseAdmin) && (
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
              <UserEngagementPanel
                userId={user.id}
                lastSeenAt={user.last_seen_at}
                createdAt={user.created_at}
              />
            </div>
          )}
        </div>

        {/* Messages */}
        {successMsg && (
          <div
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 6,
              padding: '8px 12px',
              marginTop: 12,
              fontSize: 'var(--fs-base)',
              color: 'var(--color-green)',
            }}
          >
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6,
              padding: '8px 12px',
              marginTop: 12,
              fontSize: 'var(--fs-base)',
              color: 'var(--color-danger)',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={anyLoading}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: 'none',
            background: anyLoading ? 'rgba(6,182,212,0.5)' : '#06B6D4',
            color: '#fff',
            fontSize: 'var(--fs-md)',
            fontWeight: 700,
            cursor: anyLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            marginTop: 16,
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {/* Email Actions */}
          {onSendEmail && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => onSendEmail('approved')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 600,
                border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)',
                color: 'var(--color-green)', cursor: 'pointer', fontFamily: 'inherit',
              }}>Approve</button>
              <button type="button" onClick={() => onSendEmail('info_needed')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 600,
                border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)',
                color: 'var(--color-amber)', cursor: 'pointer', fontFamily: 'inherit',
              }}>Request Info</button>
              <button type="button" onClick={() => onSendEmail('rejected')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 600,
                border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)',
                color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit',
              }}>Reject</button>
            </div>
          )}

          {/* Reset Password */}
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={anyLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-base)',
              fontWeight: 600,
              cursor: anyLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: anyLoading ? 0.5 : 1,
            }}
          >
            <RotateCcw size={14} />
            {resetting ? 'Resetting…' : 'Reset Password (email temp)'}
          </button>

          {/* Deactivate / Reactivate */}
          {isDeactivated ? (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={anyLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                border: '1px solid var(--color-green)',
                background: 'transparent',
                color: '#4ADE80',
                fontSize: 'var(--fs-base)',
                fontWeight: 600,
                cursor: anyLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: anyLoading ? 0.5 : 1,
              }}
            >
              <UserCheck size={14} />
              {toggling ? 'Reactivating...' : 'Reactivate User'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Deactivate ${user.rank ? user.rank + ' ' : ''}${user.first_name} ${user.last_name}? They will be unable to log in until reactivated.`)) {
                  handleToggleStatus()
                }
              }}
              disabled={anyLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                border: '1px solid var(--color-danger)',
                background: 'transparent',
                color: '#F87171',
                fontSize: 'var(--fs-base)',
                fontWeight: 600,
                cursor: anyLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: anyLoading ? 0.5 : 1,
              }}
            >
              <UserX size={14} />
              {toggling ? 'Deactivating...' : 'Deactivate User'}
            </button>
          )}

          {/* Delete — sys admin only */}
          {isSysAdmin && (
            <button
              type="button"
              onClick={() => onDelete(user.id)}
              disabled={anyLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                border: 'none',
                background: anyLoading ? 'rgba(220,38,38,0.3)' : 'var(--color-danger)',
                color: '#fff',
                fontSize: 'var(--fs-base)',
                fontWeight: 600,
                cursor: anyLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: anyLoading ? 0.5 : 1,
              }}
            >
              <Trash2 size={14} />
              Delete User Permanently
            </button>
          )}
        </div>
      </div>

      {/* Bulk base assignment — optimized for MAJCOM/RFM with many bases */}
      {showBulkEdit && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)', padding: 16,
          }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !bulkSaving) setShowBulkEdit(false) }}
        >
          <div
            style={{
              width: '100%', maxWidth: 460, maxHeight: '85vh',
              background: 'var(--color-bg-surface-solid)',
              border: '1px solid var(--color-border)',
              borderRadius: 12, display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                Bulk Base Assignment
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                Check every base this user should have access to. Primary base stays locked.
              </div>
            </div>

            <div style={{ padding: '10px 18px' }}>
              <input
                type="text"
                placeholder="Filter bases..."
                value={bulkSearch}
                onChange={(e) => setBulkSearch(e.target.value)}
                className="input-dark"
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-sm)' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setBulkSelected(new Set(installations.map(i => i.id)))}
                  style={{
                    padding: '3px 8px', borderRadius: 4, border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-3)',
                    fontSize: 'var(--fs-2xs)', fontWeight: 600, cursor: 'pointer',
                  }}
                >Select all</button>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Set<string>()
                    if (user.primary_base_id) next.add(user.primary_base_id)
                    setBulkSelected(next)
                  }}
                  style={{
                    padding: '3px 8px', borderRadius: 4, border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-3)',
                    fontSize: 'var(--fs-2xs)', fontWeight: 600, cursor: 'pointer',
                  }}
                >Clear</button>
                <div style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', alignSelf: 'center' }}>
                  {bulkSelected.size} selected
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 12px' }}>
              {installations
                .filter(inst => !bulkSearch || `${inst.name} ${inst.icao ?? ''}`.toLowerCase().includes(bulkSearch.toLowerCase()))
                .map(inst => {
                  const checked = bulkSelected.has(inst.id)
                  const isPrimary = inst.id === user.primary_base_id
                  return (
                    <label
                      key={inst.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 6px', borderRadius: 4,
                        borderBottom: '1px solid var(--color-border)',
                        cursor: isPrimary ? 'default' : 'pointer',
                        opacity: isPrimary ? 0.8 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isPrimary}
                        onChange={() => toggleBulk(inst.id)}
                        style={{ cursor: isPrimary ? 'default' : 'pointer' }}
                      />
                      <Building2 size={12} style={{ color: 'var(--color-text-4)' }} />
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 500 }}>
                        {inst.name}
                      </span>
                      {inst.icao && (
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>{inst.icao}</span>
                      )}
                      {isPrimary && (
                        <span style={{
                          marginLeft: 'auto', fontSize: '9px', fontWeight: 700,
                          color: 'var(--color-cyan)', padding: '1px 4px', borderRadius: 3,
                          background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                        }}>PRIMARY</span>
                      )}
                    </label>
                  )
                })}
            </div>

            <div style={{
              display: 'flex', gap: 8, padding: '12px 18px',
              borderTop: '1px solid var(--color-border)', justifyContent: 'flex-end',
            }}>
              <button
                type="button"
                onClick={() => setShowBulkEdit(false)}
                disabled={bulkSaving}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-border)',
                  background: 'transparent', color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: bulkSaving ? 'not-allowed' : 'pointer',
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={handleBulkSave}
                disabled={bulkSaving}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: bulkSaving ? 'color-mix(in srgb, var(--color-accent) 40%, transparent)' : 'var(--color-cyan)',
                  color: '#000', fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: bulkSaving ? 'not-allowed' : 'pointer',
                }}
              >{bulkSaving ? 'Saving…' : 'Save assignments'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
