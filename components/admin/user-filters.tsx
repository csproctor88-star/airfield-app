'use client'

import { Search } from 'lucide-react'

interface UserFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  roleFilter: string
  onRoleFilterChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  totalCount: number
  filteredCount: number
  isSysAdmin: boolean
}

export function UserFilters({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  filteredCount,
  isSysAdmin,
}: UserFiltersProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          color="var(--color-text-3)"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          className="input-dark"
          placeholder="Search by name, email, rank..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 32, fontSize: 'var(--fs-md)' }}
        />
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          className="input-dark"
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          style={{ flex: 1, fontSize: 'var(--fs-base)' }}
        >
          <option value="">All Roles</option>
          <option value="sys_admin">System Admin</option>
          {isSysAdmin && <option value="base_admin">Base Admin</option>}
          <option value="airfield_manager">Airfield Manager</option>
          <option value="namo">NAMO</option>
          <option value="amops">AMOPS</option>
          <option value="ces">CES</option>
          <option value="safety">Safety</option>
          <option value="atc">ATC</option>
          <option value="read_only">Read Only</option>
        </select>

        <select
          className="input-dark"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          style={{ flex: 1, fontSize: 'var(--fs-base)' }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Count */}
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 600 }}>
        {filteredCount === totalCount
          ? `Showing ${totalCount} users`
          : `Showing ${filteredCount} of ${totalCount} users`}
      </div>
    </div>
  )
}
