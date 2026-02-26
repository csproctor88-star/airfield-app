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

export default function UserManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserCardData[]>([])
  const [installations, setInstallations] = useState<Installation[]>([])
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

  const isSysAdmin = callerRole === 'sys_admin'
  const isBaseAdmin = callerRole === 'base_admin'

  // Load caller profile, installations, and users
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      if (!supabase) {
        setLoading(false)
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

      if (bases) {
        setInstallations(bases as Installation[])
        const userBase = (bases as Installation[]).find((b) => b.id === profile.primary_base_id)
        setCallerInstallation(userBase || null)

        // Base admins default to their base
        if (role !== 'sys_admin') {
          setSelectedBaseId(profile.primary_base_id)
        }
      }

      setLoading(false)
    }

    init()
  }, [router])

  // Fetch users when base selection changes
  const fetchUsers = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return

    setLoading(true)

    // Query profiles — select columns that definitely exist, handle optional ones gracefully
    let query = supabase
      .from('profiles')
      .select('*')
      .order('last_name', { ascending: true })

    // Filter by selected installation
    if (selectedBaseId) {
      query = query.eq('primary_base_id', selectedBaseId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to load users:', error)
      setUsers([])
      setLoading(false)
      return
    }

    // Load base names for display
    const { data: allBases } = await supabase
      .from('bases')
      .select('id, name, icao')

    const baseLookup = new Map<string, { name: string; icao: string }>()
    if (allBases) {
      for (const b of allBases) {
        baseLookup.set(b.id, { name: b.name, icao: b.icao })
      }
    }

    // Map to UserCardData
    const mapped: UserCardData[] = (data || []).map((u: Record<string, unknown>) => ({
      id: u.id as string,
      email: u.email as string,
      first_name: (u.first_name as string) || null,
      last_name: (u.last_name as string) || null,
      rank: (u.rank as string) || null,
      role: (u.role as string) || 'read_only',
      status: (u.status as string) || (u.is_active === false ? 'deactivated' : 'active'),
      last_seen_at: (u.last_seen_at as string) || null,
      primary_base_id: (u.primary_base_id as string) || null,
      created_at: u.created_at as string,
      bases: u.primary_base_id ? baseLookup.get(u.primary_base_id as string) || null : null,
    }))

    setUsers(mapped)
    setLoading(false)
  }, [selectedBaseId])

  // Fetch when selectedBaseId changes or after init completes
  useEffect(() => {
    if (callerRole && callerRole !== 'read_only') {
      fetchUsers()
    }
  }, [callerRole, selectedBaseId, fetchUsers])

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

  // Determine access for the initial load
  if (loading && users.length === 0) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>User Management</div>
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
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-1)' }}>
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
            fontSize: 12,
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

      {/* User List */}
      <UserList
        users={filteredUsers}
        loading={loading}
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
    </div>
  )
}
