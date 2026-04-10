'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import { InstallationSelector } from '@/components/admin/installation-selector'
import { UserFilters } from '@/components/admin/user-filters'
import { UserList } from '@/components/admin/user-list'
import { UserDetailModal } from '@/components/admin/user-detail-modal'
import { InviteUserModal } from '@/components/admin/invite-user-modal'
import { DeleteConfirmationDialog } from '@/components/admin/delete-confirmation-dialog'
import {
  inviteUser,
  resetUserPassword,
  updateUserProfile,
  deleteUser,
} from '@/lib/admin/user-management'
import type { UserCardData } from '@/components/admin/user-card'
import type { Installation, UserRole } from '@/lib/supabase/types'
import { toast } from 'sonner'

/** Fetch profiles from Supabase, with optional base filter */
async function loadUsers(
  supabase: ReturnType<typeof createClient>,
  baseId: string | null,
  baseLookup: Map<string, { name: string; icao: string }>,
): Promise<{ users: UserCardData[]; error: string | null }> {
  if (!supabase) return { users: [], error: 'Supabase client not available' }

  try {
    // Use select('*') to get whatever columns exist — avoids errors from missing columns
    let query = supabase
      .from('profiles')
      .select('*')
      .order('name', { ascending: true })

    if (baseId) {
      query = query.eq('primary_base_id', baseId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[UserMgmt] Query error:', error.message, error.code, error.details)
      return { users: [], error: `Query failed: ${error.message}` }
    }

    if (!data) {
      return { users: [], error: null }
    }

    const mapped: UserCardData[] = data.map((u: Record<string, unknown>) => {
      // Parse name — handle both first_name/last_name and legacy name column
      const firstName = (u.first_name as string) || null
      const lastName = (u.last_name as string) || null
      const fullName = (u.name as string) || ''
      const parsedFirst = firstName || fullName.split(' ')[0] || ''
      const parsedLast = lastName || fullName.split(' ').slice(1).join(' ') || ''

      return {
        id: u.id as string,
        email: u.email as string,
        first_name: parsedFirst || null,
        last_name: parsedLast || null,
        rank: (u.rank as string) || null,
        role: (u.role as string) === 'observer' ? 'read_only' : (u.role as string) || 'read_only',
        status: u.status === 'pending' ? 'pending' : u.status === 'deactivated' ? 'deactivated' : (u.status === 'active' || u.is_active !== false) ? 'active' : 'deactivated',
        last_seen_at: (u.last_seen_at as string) || null,
        primary_base_id: (u.primary_base_id as string) || null,
        edipi: (u.edipi as string) || null,
        operating_initials: (u.operating_initials as string) || null,
        created_at: u.created_at as string,
        bases: u.primary_base_id ? baseLookup.get(u.primary_base_id as string) || null : null,
      }
    })

    return { users: mapped, error: null }
  } catch (err) {
    console.error('[UserMgmt] Unexpected error in loadUsers:', err)
    return { users: [], error: err instanceof Error ? err.message : 'Unexpected error loading users' }
  }
}

export default function UserManagementPage() {
  const router = useRouter()
  const [initialized, setInitialized] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [users, setUsers] = useState<UserCardData[]>([])
  const [installations, setInstallations] = useState<Installation[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [baseLookup, setBaseLookup] = useState(new Map<string, { name: string; icao: string }>())
  const [callerRole, setCallerRole] = useState<UserRole>('read_only')
  const [callerBaseId, setCallerBaseId] = useState<string | null>(null)
  const [callerInstallation, setCallerInstallation] = useState<Installation | null>(null)

  // Filters
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals
  const [selectedUser, setSelectedUser] = useState<UserCardData | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserCardData | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Email approval workflow
  const [emailDialog, setEmailDialog] = useState<{ user: UserCardData; template: 'approved' | 'info_needed' | 'rejected' } | null>(null)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailSending, setEmailSending] = useState(false)

  const isSysAdmin = callerRole === 'sys_admin'
  const isBaseAdmin = callerRole === 'base_admin' || callerRole === 'airfield_manager' || callerRole === 'namo'

  // Initialize: load caller profile, installations, and first user list
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      if (!supabase) {
        setInitialized(true)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Fetch caller's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, primary_base_id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        router.push('/')
        return
      }

      const role = profile.role as UserRole
      const roleConfig = USER_ROLES[role]

      // Access control: redirect non-admin users
      if (!roleConfig?.canManageUsers && role !== 'sys_admin' && role !== 'base_admin') {
        router.push('/')
        return
      }

      setCallerRole(role)
      setCallerBaseId(profile.primary_base_id)

      // Load installations
      const { data: bases } = await supabase
        .from('bases')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      // Build base lookup map
      const lookup = new Map<string, { name: string; icao: string }>()
      if (bases) {
        const typedBases = bases as Installation[]
        setInstallations(typedBases)
        for (const b of typedBases) {
          lookup.set(b.id, { name: b.name, icao: b.icao })
        }
        setBaseLookup(lookup)
        const userBase = typedBases.find((b) => b.id === profile.primary_base_id)
        setCallerInstallation(userBase || null)
      }

      // Determine initial base filter
      const initialBaseFilter = role === 'sys_admin' ? null : profile.primary_base_id
      setSelectedBaseId(initialBaseFilter)

      // Load users immediately
      const result = await loadUsers(supabase, initialBaseFilter, lookup)
      setUsers(result.users)
      if (result.error) setFetchError(result.error)
      setInitialized(true)
    }

    init().catch((err) => {
      console.error('[UserMgmt] init() crashed:', err)
      setFetchError(err instanceof Error ? err.message : 'Failed to initialize')
      setInitialized(true)
    })
  }, [router])

  // Refetch users when base filter changes (after init)
  const fetchUsers = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return

    setLoadingUsers(true)
    setFetchError(null)
    const result = await loadUsers(supabase, selectedBaseId, baseLookup)
    setUsers(result.users)
    if (result.error) setFetchError(result.error)
    setLoadingUsers(false)
  }, [selectedBaseId, baseLookup])

  // When selectedBaseId changes after init, refetch
  const [prevBaseId, setPrevBaseId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (!initialized) return
    if (prevBaseId === undefined) {
      // First run after init — skip, already loaded
      setPrevBaseId(selectedBaseId)
      return
    }
    if (selectedBaseId !== prevBaseId) {
      setPrevBaseId(selectedBaseId)
      fetchUsers()
    }
  }, [initialized, selectedBaseId, prevBaseId, fetchUsers])

  // Client-side filter
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        !searchTerm ||
        (user.first_name || '').toLowerCase().includes(searchLower) ||
        (user.last_name || '').toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.rank || '').toLowerCase().includes(searchLower)
      const matchesRole = !roleFilter || user.role === roleFilter
      const matchesStatus = !statusFilter || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchTerm, roleFilter, statusFilter])

  // Show installation column when viewing "All Installations"
  const showInstallation = isSysAdmin && !selectedBaseId

  // === Handlers ===

  const handleInvite = async (data: {
    email: string
    rank: string
    firstName: string
    lastName: string
    role: string
    installationId: string
  }) => {
    await inviteUser(data)
    setShowInviteModal(false)
    toast.success(`Invite sent to ${data.email}`)
    fetchUsers()
  }

  const handleSaveProfile = async (userId: string, updates: Record<string, unknown>) => {
    await updateUserProfile(userId, updates)
    fetchUsers()
  }

  const handleResetPassword = async (email: string, userId: string) => {
    await resetUserPassword(email, userId)
  }

  const handleDeactivate = async (userId: string) => {
    await updateUserProfile(userId, { status: 'deactivated', is_active: false })
    fetchUsers()
    setSelectedUser(null)
  }

  const handleReactivate = async (userId: string) => {
    await updateUserProfile(userId, { status: 'active', is_active: true })
    fetchUsers()
    setSelectedUser(null)
  }

  const handleDeleteRequest = (userId: string) => {
    const target = users.find((u) => u.id === userId)
    if (target) {
      setSelectedUser(null)
      setDeleteTarget(target)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      toast.success(`${deleteTarget.first_name} ${deleteTarget.last_name} has been deleted`)
      setDeleteTarget(null)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  // Show skeleton while initializing
  if (!initialized) {
    return (
      <div className="page-container">
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>User Management</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{ height: 72, background: 'var(--color-bg-elevated)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
          User Management
        </div>
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: '#06B6D4',
            color: '#fff',
            fontSize: 'var(--fs-base)',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={14} />
          Invite User
        </button>
      </div>

      {/* Installation Selector */}
      <div style={{ marginBottom: 12 }}>
        <InstallationSelector
          installations={installations}
          selectedId={selectedBaseId}
          isSysAdmin={isSysAdmin}
          userInstallation={callerInstallation}
          onChange={setSelectedBaseId}
        />
      </div>

      {/* Search & Filters */}
      <div style={{ marginBottom: 12 }}>
        <UserFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          totalCount={users.length}
          filteredCount={filteredUsers.length}
          isSysAdmin={isSysAdmin}
        />
      </div>

      {/* Error display */}
      {fetchError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 'var(--fs-base)',
            color: '#F87171',
          }}
        >
          {fetchError}
        </div>
      )}

      {/* User List */}
      <UserList
        users={filteredUsers}
        loading={loadingUsers}
        showInstallation={showInstallation}
        onSelectUser={(user) => setSelectedUser(user)}
      />

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          isSysAdmin={isSysAdmin}
          isBaseAdmin={isBaseAdmin}
          installations={installations}
          onSave={handleSaveProfile}
          onResetPassword={handleResetPassword}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
          onDelete={handleDeleteRequest}
          onClose={() => setSelectedUser(null)}
          onSendEmail={(template) => {
            setEmailMessage('')
            setEmailDialog({ user: selectedUser, template })
            setSelectedUser(null)
          }}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal
          isSysAdmin={isSysAdmin}
          callerBaseId={callerBaseId}
          installations={installations}
          defaultInstallationId={selectedBaseId}
          onInvite={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmationDialog
          userName={`${deleteTarget.rank ? deleteTarget.rank + ' ' : ''}${deleteTarget.first_name} ${deleteTarget.last_name}`}
          lastName={deleteTarget.last_name || ''}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Email Approval Dialog */}
      {emailDialog && (() => {
        const u = emailDialog.user
        const userName = `${u.rank ? u.rank + ' ' : ''}${u.first_name} ${u.last_name}`
        const titleMap = { approved: 'Approve Account', info_needed: 'Request Additional Info', rejected: 'Reject Account' }
        const colorMap = { approved: '#22C55E', info_needed: '#F59E0B', rejected: '#EF4444' }
        const btnMap = { approved: 'Send Approval Email', info_needed: 'Send Info Request', rejected: 'Send Rejection Email' }
        const t = emailDialog.template
        return (
          <div className="modal-overlay" onClick={() => setEmailDialog(null)} style={{ padding: 24, zIndex: 10000 }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--color-bg-surface-solid, #1E293B)', borderRadius: 'var(--radius-lg)', padding: 24,
              width: '100%', maxWidth: 440, border: '1px solid var(--color-border-mid)',
            }}>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: colorMap[t], marginBottom: 4 }}>
                {titleMap[t]}
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
                {userName} &bull; {u.email}
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 4 }}>
                {t === 'approved' ? 'Message (optional)' : t === 'info_needed' ? 'What information is needed?' : 'Reason (optional)'}
              </div>
              <textarea
                autoFocus
                value={emailMessage}
                onChange={e => setEmailMessage(e.target.value)}
                placeholder={t === 'info_needed' ? 'Please provide your unit, duty position, and supervisor name...' : t === 'rejected' ? 'Reason for rejection...' : 'Additional message...'}
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', outline: 'none',
                  fontFamily: 'inherit', resize: 'vertical', minHeight: 80, marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    if (t === 'info_needed' && !emailMessage.trim()) {
                      toast.error('Please describe what information is needed')
                      return
                    }
                    setEmailSending(true)
                    try {
                      const res = await fetch('/api/user-emails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          template: t,
                          toEmail: u.email,
                          toName: `${u.first_name} ${u.last_name}`,
                          customMessage: emailMessage.trim() || undefined,
                          userId: u.id,
                        }),
                      })
                      const result = await res.json()
                      if (res.ok) {
                        toast.success(`${titleMap[t]} email sent to ${u.email}`)
                        setEmailDialog(null)
                        setEmailMessage('')
                        // Refresh user list to reflect status change
                        const supabase = (await import('@/lib/supabase/client')).createClient()
                        if (supabase) {
                          const result = await loadUsers(supabase, selectedBaseId, baseLookup)
                          setUsers(result.users)
                        }
                      } else {
                        toast.error(result.error || 'Failed to send email')
                      }
                    } catch {
                      toast.error('Failed to send email')
                    }
                    setEmailSending(false)
                  }}
                  disabled={emailSending || (t === 'info_needed' && !emailMessage.trim())}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                    cursor: emailSending ? 'wait' : 'pointer',
                    border: `1px solid ${colorMap[t]}`,
                    background: `${colorMap[t]}20`,
                    color: colorMap[t],
                    opacity: emailSending || (t === 'info_needed' && !emailMessage.trim()) ? 0.5 : 1,
                    fontFamily: 'inherit',
                  }}
                >{emailSending ? 'Sending...' : btnMap[t]}</button>
                <button
                  onClick={() => { setEmailDialog(null); setEmailMessage('') }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                    cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                    background: 'var(--color-bg-inset)', color: 'var(--color-text-3)', fontFamily: 'inherit',
                  }}
                >Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
